
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ["http://localhost:5173"]
        }
    }
)


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
