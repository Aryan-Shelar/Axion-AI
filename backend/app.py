
from pathlib import Path
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from compliance import check_brand_compliance
from flask import request
from ai_analyzer import analyze_brand_content
from knowledge_base import normalize_entry, retrieve_approved_knowledge, now_iso
from claim_detective import extract_claim_candidates, retrieve_evidence_for_claims
from document_extraction import extract_document, ExtractionError, MAX_UPLOAD_BYTES
from access_control import has_permission, required_permission, ROLE_PERMISSIONS


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES + 1024 * 1024
allowed_origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
CORS(app, origins=allowed_origins, supports_credentials=True)

# Firebase initialization is guarded so liveness checks can run even when
# credentials are not configured. Data routes should return a useful error.
BASE_DIR = Path(__file__).resolve().parent
KEY_PATH = Path(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", str(BASE_DIR / "serviceAccountKey.json")))
db = None
firebase_init_error = None
_embedding_client = None

def _embed_knowledge_text(text):
    """Gemini embedding provider used by optional semantic evidence retrieval."""
    global _embedding_client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing")
    from google import genai
    if _embedding_client is None:
        _embedding_client = genai.Client(api_key=api_key)
    response = _embedding_client.models.embed_content(
        model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        contents=str(text or "")[:6000],
    )
    embeddings = getattr(response, "embeddings", None) or []
    if not embeddings:
        raise RuntimeError("Gemini returned no embedding")
    values = getattr(embeddings[0], "values", None)
    if not values:
        raise RuntimeError("Gemini returned an empty embedding")
    return [float(value) for value in values]

def _semantic_retrieval_provider():
    enabled = os.getenv("ENABLE_SEMANTIC_RETRIEVAL", "true").strip().lower() not in {"0", "false", "no", "off"}
    return _embed_knowledge_text if enabled and os.getenv("GEMINI_API_KEY") else None

try:
    if not firebase_admin._apps:
        if KEY_PATH.exists():
            firebase_admin.initialize_app(credentials.Certificate(str(KEY_PATH)))
        else:
            firebase_admin.initialize_app()
    db = firestore.client(database_id=os.getenv("FIRESTORE_DATABASE_ID", "axionai"))
except Exception as exc:
    firebase_init_error = str(exc)
    app.logger.exception("Firebase initialization failed")

@app.before_request
def enforce_authentication_and_authorization():
    # Let browser CORS preflights through; all actual API requests are protected.
    if request.method == "OPTIONS":
        return None
    if request.path in ("/", "/api/health", "/api/ready"):
        return None
    if db is None:
        return jsonify({"status": "error", "message": "Firestore is not configured. Check backend credentials."}), 503

    from firebase_admin import auth as firebase_auth
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"status": "error", "code": "auth_required", "message": "Sign in is required. Send a Firebase ID token in the Authorization header."}), 401
    token = header.split(" ", 1)[1].strip()
    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=True)
    except Exception:
        return jsonify({"status": "error", "code": "invalid_token", "message": "Your session is invalid or expired. Sign in again."}), 401

    uid = decoded.get("uid")
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        return jsonify({"status": "error", "code": "membership_not_configured", "message": "Your account has no AXION access record. Ask an administrator to assign a platform role or brand membership."}), 403
    user_record = user_snapshot.to_dict() or {}
    platform_role = user_record.get("platform_role", "")
    brand_id = (request.view_args or {}).get("brand_id")
    brand_roles = user_record.get("brand_roles", {})
    role = platform_role if platform_role == "Admin" else (brand_roles.get(brand_id, "") if brand_id else "")

    permission = required_permission(request.endpoint, request.method, request.get_json(silent=True) if request.is_json else {})
    if permission == "__deny__" or permission is None:
        return jsonify({"status": "error", "code": "forbidden", "message": "This API action is not available."}), 403
    if permission == "platform:admin":
        allowed = platform_role == "Admin"
    elif permission == "brand:list":
        allowed = platform_role == "Admin" or bool(brand_roles)
    else:
        allowed = bool(brand_id) and has_permission(role, permission)
    if not allowed:
        return jsonify({"status": "error", "code": "insufficient_permissions", "message": "Your role is not allowed to perform this action for the selected brand."}), 403
    request.axion_uid = uid
    request.axion_role = role or platform_role
    request.axion_user_record = user_record
    return None


@app.errorhandler(413)
def upload_too_large(_error):
    return jsonify({"status": "error", "message": "Upload is too large. Maximum file size is 10 MB."}), 413


@app.get("/")
def home():
    return jsonify({
        "application": "Axion AI",
        "message": "Backend is running",
        "status": "success"
    })


@app.get("/api/health")
def health():
    # Liveness only: does not depend on Firebase availability.
    return jsonify({"status": "alive", "service": "Axion AI Backend", "version": "1.1.0"}), 200

@app.get("/api/ready")
def readiness():
    if db is None:
        return jsonify({"status": "not_ready", "dependency": "firestore"}), 503
    try:
        db.collection("_health").limit(1).get()
        return jsonify({"status": "ready", "dependency": "firestore"}), 200
    except Exception:
        app.logger.exception("Readiness check failed")
        return jsonify({"status": "not_ready", "dependency": "firestore"}), 503


@app.get("/api/db-test")
def db_test():
    """Temporary local development test: write, read and delete a test document."""
    try:
        test_ref = db.collection("_backend_test").document("connection_check")
        test_ref.set({"message": "Firestore connection successful"})

        document = test_ref.get()
        result = document.to_dict() if document.exists else None

        test_ref.delete()

        return jsonify({
            "status": "success",
            "message": "Firestore connection successful",
            "test_document": result
        }), 200

    except Exception:
        app.logger.exception("Firestore connection test failed")
        return jsonify({
            "status": "error",
            "message": "Firestore test failed. Check backend logs and credentials."
        }), 500


from datetime import datetime, timezone
from flask import request

@app.post("/api/brands")
def create_brand():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "status": "error",
            "message": "JSON request body is required"
        }), 400

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "status": "error",
            "message": "Brand name is required"
        }), 400

    brand = {
        "name": name.strip(),
        "description": data.get("description", ""),
        "primary_color": data.get("primary_color", ""),
        "secondary_color": data.get("secondary_color", ""),
        "tone_of_voice": data.get("tone_of_voice", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    doc_ref = db.collection("brands").document()
    doc_ref.set(brand)

    return jsonify({
        "status": "success",
        "message": "Brand created successfully",
        "brand_id": doc_ref.id,
        "brand": brand
    }), 201


@app.get("/api/brands")
def get_brands():
    user_record = getattr(request, "axion_user_record", {})
    is_platform_admin = user_record.get("platform_role") == "Admin"
    allowed_brand_ids = set((user_record.get("brand_roles") or {}).keys())
    documents = db.collection("brands").stream()
    brands = []

    for document in documents:
        if not is_platform_admin and document.id not in allowed_brand_ids:
            continue
        brand = document.to_dict() or {}
        brand["id"] = document.id
        brands.append(brand)

    return jsonify({
        "status": "success",
        "count": len(brands),
        "brands": brands
    }), 200

@app.put("/api/brands/<brand_id>")
def update_brand(brand_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return jsonify({
            "status": "error",
            "message": "JSON request body is required"
        }), 400

    allowed_fields = {
        "name",
        "description",
        "primary_color",
        "secondary_color",
        "tone_of_voice"
    }

    updates = {
        key: value
        for key, value in data.items()
        if key in allowed_fields
    }

    if not updates:
        return jsonify({
            "status": "error",
            "message": "No valid fields provided"
        }), 400

    if "name" in updates:
        if not isinstance(updates["name"], str) or not updates["name"].strip():
            return jsonify({
                "status": "error",
                "message": "Brand name cannot be empty"
            }), 400
        updates["name"] = updates["name"].strip()

    brand_ref = db.collection("brands").document(brand_id)

    if not brand_ref.get().exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    brand_ref.update(updates)

    updated_brand = brand_ref.get().to_dict()

    return jsonify({
        "status": "success",
        "message": "Brand updated successfully",
        "brand": {"id": brand_id, **updated_brand}
    }), 200


@app.delete("/api/brands/<brand_id>")
def delete_brand(brand_id):
    brand_ref = db.collection("brands").document(brand_id)

    if not brand_ref.get().exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    brand_ref.delete()

    return jsonify({
        "status": "success",
        "message": "Brand deleted successfully",
        "brand_id": brand_id
    }), 200



@app.post("/api/brands/<brand_id>/compliance-check")
def brand_compliance_check(brand_id):
    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()

    if not content:
        return jsonify({
            "status": "error",
            "message": "Content cannot be empty"
        }), 400

    # Fetch brand from Firestore
    brand_ref = db.collection("brands").document(brand_id)
    brand_doc = brand_ref.get()

    if not brand_doc.exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    brand = brand_doc.to_dict()

    # Run compliance checks
    result = check_brand_compliance(
        content=content,
        tone_of_voice=brand.get("tone_of_voice", "professional"),
        prohibited_words=brand.get("prohibited_words", []),
        required_keywords=brand.get("required_keywords", [])
    )

    if result.get("status") == "error":
        return jsonify(result), 400

    result["brand_id"] = brand_id

    # Save report to Firestore
    report_data = {
        "brand_id": brand_id,
        "content": content,
        "compliance_score": result["compliance_score"],
        "is_compliant": result["is_compliant"],
        "passed_checks": result["passed_checks"],
        "violations": result["violations"],
        "suggestions": result["suggestions"],
        "created_at": firestore.SERVER_TIMESTAMP
    }

    report_ref = (
        db.collection("brands")
        .document(brand_id)
        .collection("compliance_reports")
        .document()
    )

    report_ref.set(report_data)

    result["report_id"] = report_ref.id

    return jsonify(result), 200




@app.post("/api/brands/<brand_id>/visual-check")
def visual_brand_check(brand_id):
    """Run multimodal visual brand governance on an uploaded image asset."""
    from visual_brand_check import analyze_visual_asset, VisualCheckError, MAX_VISUAL_UPLOAD_BYTES
    brand_ref = db.collection("brands").document(brand_id)
    brand_snapshot = brand_ref.get()
    if not brand_snapshot.exists:
        return jsonify({"status": "error", "message": "Brand not found."}), 404
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return jsonify({"status": "error", "message": "Choose an image to analyze."}), 400
    filename = Path(uploaded.filename).name
    raw = uploaded.read(MAX_VISUAL_UPLOAD_BYTES + 1)
    brand = brand_snapshot.to_dict() or {}
    try:
        result = analyze_visual_asset(filename, raw, brand)
    except VisualCheckError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 503
    result["filename"] = filename
    result["brand_id"] = brand_id
    result["created_at"] = now_iso()
    # Keep an auditable result; image bytes themselves are not stored.
    brand_ref.collection("visual_checks").add(result)
    return jsonify({"status": "success", "result": result}), 200


@app.get("/api/brands/<brand_id>/compliance-history")
def get_compliance_history(brand_id):
    brand_ref = db.collection("brands").document(brand_id)

    if not brand_ref.get().exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    reports_ref = (
        brand_ref.collection("compliance_reports")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(50)
    )

    reports = []

    for doc in reports_ref.stream():
        report = doc.to_dict()

        # Convert Firestore timestamp for JSON response
        created_at = report.get("created_at")
        report["created_at"] = (
            created_at.isoformat() if created_at else None
        )

        report["report_id"] = doc.id
        reports.append(report)

    return jsonify({
        "status": "success",
        "brand_id": brand_id,
        "total": len(reports),
        "reports": reports
    }), 200

@app.put("/api/brands/<brand_id>/rules")
def update_brand_rules(brand_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return jsonify({
            "status": "error",
            "message": "JSON request body is required"
        }), 400

    allowed_fields = {
        "prohibited_words",
        "required_keywords",
        "tone_of_voice"
    }

    updates = {
        key: value
        for key, value in data.items()
        if key in allowed_fields
    }

    if not updates:
        return jsonify({
            "status": "error",
            "message": "Provide prohibited_words, required_keywords, or tone_of_voice"
        }), 400

    for field in ("prohibited_words", "required_keywords"):
        if field in updates:
            value = updates[field]

            if (
                not isinstance(value, list)
                or not all(isinstance(item, str) and item.strip() for item in value)
            ):
                return jsonify({
                    "status": "error",
                    "message": f"{field} must be a list of non-empty strings"
                }), 400

            updates[field] = [item.strip() for item in value]

    if "tone_of_voice" in updates:
        tone = updates["tone_of_voice"]

        if not isinstance(tone, str) or not tone.strip():
            return jsonify({
                "status": "error",
                "message": "tone_of_voice must be a non-empty string"
            }), 400

        updates["tone_of_voice"] = tone.strip()

    brand_ref = db.collection("brands").document(brand_id)

    if not brand_ref.get().exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    brand_ref.update(updates)

    return jsonify({
        "status": "success",
        "message": "Brand rules updated successfully",
        "brand_id": brand_id,
        "rules": updates
    }), 200

@app.get("/api/brands/<brand_id>/knowledge")
def list_brand_knowledge(brand_id):
    brand_ref = db.collection("brands").document(brand_id)
    if not brand_ref.get().exists:
        return jsonify({"status": "error", "message": "Brand not found"}), 404
    query_text = request.args.get("q", "").strip().lower()
    kind = request.args.get("type", "").strip().lower()
    status = request.args.get("status", "").strip().lower()
    entries = []
    for doc in brand_ref.collection("knowledge_base").stream():
        item = doc.to_dict() or {}
        item["id"] = doc.id
        if query_text and query_text not in (str(item.get("title", "")) + " " + str(item.get("content", "")) + " " + " ".join(item.get("tags", []))).lower():
            continue
        if kind and item.get("type") != kind:
            continue
        if status and item.get("status") != status:
            continue
        entries.append(item)
    entries.sort(key=lambda item: item.get("updated_at", item.get("created_at", "")), reverse=True)
    return jsonify({"status": "success", "count": len(entries), "entries": entries}), 200


@app.post("/api/brands/<brand_id>/knowledge")
def create_brand_knowledge(brand_id):
    data = request.get_json(silent=True)
    try:
        entry = normalize_entry(data)
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    brand_ref = db.collection("brands").document(brand_id)
    if not brand_ref.get().exists:
        return jsonify({"status": "error", "message": "Brand not found"}), 404
    # Creation always starts as Draft. Approval is a separate, role-gated action.
    entry["status"] = "draft"
    timestamp = now_iso()
    entry.update({"created_at": timestamp, "updated_at": timestamp})
    ref = brand_ref.collection("knowledge_base").document()
    ref.set(entry)
    return jsonify({"status": "success", "id": ref.id, "entry": {"id": ref.id, **entry}}), 201


@app.post("/api/brands/<brand_id>/knowledge/upload")
def upload_brand_knowledge_document(brand_id):
    """Extract an uploaded document and save its text as an unapproved draft."""
    brand_ref = db.collection("brands").document(brand_id)
    if not brand_ref.get().exists:
        return jsonify({"status": "error", "message": "Brand not found"}), 404

    uploaded = request.files.get("file")
    if uploaded is None:
        return jsonify({"status": "error", "message": "Choose a document to upload."}), 400
    filename = Path(uploaded.filename or "").name
    if not filename:
        return jsonify({"status": "error", "message": "Uploaded filename is missing."}), 400
    try:
        extracted_text, extraction_method, source_page_texts = extract_document(
            filename, uploaded.read(MAX_UPLOAD_BYTES + 1), include_metadata=True
        )
    except ExtractionError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400

    title = Path(filename).stem.strip()[:160] or "Uploaded document"
    timestamp = now_iso()
    entry = {
        "title": title,
        "content": extracted_text,
        "type": "reference",
        "status": "draft",
        "source_url": "",
        "tags": ["uploaded-document"],
        "original_filename": filename,
        "source_document": filename,
        "source_page_texts": source_page_texts,
        "source_page_count": len(source_page_texts) if source_page_texts else None,
        "extraction_method": extraction_method,
        "extracted_at": timestamp,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    ref = brand_ref.collection("knowledge_base").document()
    ref.set(entry)
    return jsonify({"status": "success", "id": ref.id, "entry": {"id": ref.id, **entry}, "message": "Document text extracted and saved as Draft. Review it before approval."}), 201


@app.put("/api/brands/<brand_id>/knowledge/<entry_id>")
def update_brand_knowledge(brand_id, entry_id):
    data = request.get_json(silent=True)
    # Defense in depth: every status mutation requires approval permission even
    # if a future route refactor changes the global authorization mapper.
    if isinstance(data, dict) and "status" in data and not has_permission(
        getattr(request, "axion_role", ""), "knowledge:approve"
    ):
        return jsonify({"status": "error", "code": "insufficient_permissions", "message": "Your role cannot change knowledge approval status."}), 403
    if not isinstance(data, dict) or not data:
        return jsonify({"status": "error", "message": "JSON request body is required"}), 400
    try:
        updates = normalize_entry(data, partial=True)
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    if not updates:
        return jsonify({"status": "error", "message": "No valid knowledge fields provided"}), 400
    ref = db.collection("brands").document(brand_id).collection("knowledge_base").document(entry_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return jsonify({"status": "error", "message": "Knowledge entry not found"}), 404
    updates["updated_at"] = now_iso()
    ref.update(updates)
    return jsonify({"status": "success", "entry": {"id": entry_id, **ref.get().to_dict()}}), 200


@app.delete("/api/brands/<brand_id>/knowledge/<entry_id>")
def delete_brand_knowledge(brand_id, entry_id):
    ref = db.collection("brands").document(brand_id).collection("knowledge_base").document(entry_id)
    if not ref.get().exists:
        return jsonify({"status": "error", "message": "Knowledge entry not found"}), 404
    ref.delete()
    return jsonify({"status": "success", "deleted_id": entry_id}), 200


@app.route("/api/brands/<brand_id>/ai-analyze", methods=["POST"])
def ai_analyze_brand(brand_id):
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")

    if not isinstance(content, str) or not content.strip():
        return jsonify({
            "status": "error",
            "message": "Please provide content to analyze."
        }), 400

    if len(content) > 12000:
        return jsonify({
            "status": "error",
            "message": "Content must be 12000 characters or fewer."
        }), 400

    brand_ref = db.collection("brands").document(brand_id)
    brand_snapshot = brand_ref.get()

    if not brand_snapshot.exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found."
        }), 404

    brand = brand_snapshot.to_dict() or {}

    try:
        knowledge_docs = [
            {"id": doc.id, **(doc.to_dict() or {})}
            for doc in brand_ref.collection("knowledge_base").stream()
        ]
        # Claim Detective: identify candidate claims, retrieve approved evidence per claim,
        # then ask the model to assess claims only against those retrieved entries.
        claim_candidates = extract_claim_candidates(content.strip())
        embedding_provider = _semantic_retrieval_provider()
        approved_knowledge, claim_evidence_map = retrieve_evidence_for_claims(
            knowledge_docs, claim_candidates, per_claim_limit=4, total_limit=12,
            embedding_provider=embedding_provider,
        )
        # Keep useful general brand guidance in context when claim retrieval found nothing,
        # but never send draft/archived entries to the model.
        if not approved_knowledge:
            approved_knowledge = retrieve_approved_knowledge(
                knowledge_docs, content.strip(), limit=8,
                embedding_provider=embedding_provider,
            )
        result = analyze_brand_content(
            content.strip(), brand,
            approved_knowledge=approved_knowledge,
            claim_candidates=claim_candidates,
            claim_evidence_map=claim_evidence_map,
        )

        return jsonify({
            "status": "success",
            "brand_id": brand_id,
            "claim_candidates": claim_candidates,
            "claim_evidence_map": claim_evidence_map,
            "knowledge_sources_used": [
                {"id": item.get("id"), "title": item.get("title"), "type": item.get("type"), "source_url": item.get("source_url", ""), "source_document": item.get("source_document") or item.get("original_filename", ""), "page_number": item.get("page_number"), "matched_passage": item.get("matched_passage", ""), "retrieval_score": item.get("retrieval_score"), "semantic_similarity": item.get("semantic_similarity"), "retrieval_method": item.get("retrieval_method"), "matched_claims": item.get("matched_claims", [])}
                for item in approved_knowledge
            ],
            "analysis": result
        }), 200

    except RuntimeError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 503

    except Exception:
        app.logger.exception("Gemini brand analysis failed")
        return jsonify({
            "status": "error",
            "message": "AI analysis failed. Check server logs."
        }), 502





if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
