
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from compliance import check_brand_compliance
from flask import request
from ai_analyzer import analyze_brand_content

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ["http://localhost:5173"]
        }
    }
)

# Firebase Admin SDK setup
BASE_DIR = Path(__file__).resolve().parent
KEY_PATH = BASE_DIR / "serviceAccountKey.json"

if not firebase_admin._apps:
    firebase_credentials = credentials.Certificate(str(KEY_PATH))
    firebase_admin.initialize_app(firebase_credentials)
db = firestore.client(database_id="axionai")


@app.get("/")
def home():
    return jsonify({
        "application": "Axion AI",
        "message": "Backend is running",
        "status": "success"
    })


@app.get("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "Axion AI Backend",
        "version": "1.0.0"
    })


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
    documents = db.collection("brands").stream()
    brands = []

    for document in documents:
        brand = document.to_dict()
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
        result = analyze_brand_content(content.strip(), brand)

        return jsonify({
            "status": "success",
            "brand_id": brand_id,
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
