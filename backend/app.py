
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from compliance import check_brand_compliance

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

    content = data.get("content", "")

    # Fetch brand guidelines from Firestore
    brand_doc = db.collection("brands").document(brand_id).get()

    if not brand_doc.exists:
        return jsonify({
            "status": "error",
            "message": "Brand not found"
        }), 404

    brand = brand_doc.to_dict()

    prohibited_words = brand.get("prohibited_words", [])
    required_keywords = brand.get("required_keywords", [])
    tone_of_voice = brand.get("tone_of_voice", "professional")

    result = check_brand_compliance(
        content=content,
        tone_of_voice=tone_of_voice,
        prohibited_words=prohibited_words,
        required_keywords=required_keywords
    )

    if result.get("status") == "error":
        return jsonify(result), 400

    result["brand_id"] = brand_id

    return jsonify(result), 200



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
