# AXION AI
### AI-Assisted Brand Governance Platform

**Search the Truth. Build the Trust.**

AXION AI helps teams review content against brand guidelines, identify potential inconsistencies, and flag claims that may require supporting evidence. It combines automated analysis with human review.

> **Project status:** Prototype. Automated findings are advisory, and live Firebase/Gemini integration and production security must be verified before deployment.

## Features

- **Brand governance:** Manage brand-specific rules, guidelines, and terminology.
- **Content analysis:** Identify potential brand inconsistencies and suggest corrections.
- **Claim Detective:** Flag claims that may need evidence and associate them with approved knowledge sources.
- **Knowledge base:** Organize brand facts, guidelines, terminology, references, and assets.
- **Document extraction:** Extract text from supported documents and images for review.
- **Visual brand checks:** Inspect image properties, colour patterns, and rule-based indicators.
- **Access control:** Firebase authentication and server-side role checks for protected API routes.
- **Review history and reporting:** Track available review activity and export reports.

AI-generated findings and heuristic scores are not proof of factual accuracy or regulatory compliance. Human review remains essential.

## Technology stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Python, Flask
- **Authentication and data:** Firebase Authentication and Firestore
- **AI integration:** Gemini API
- **Testing:** JavaScript tests and Python unit tests

## Prerequisites

- Node.js and npm
- Python 3.10 or a version supported by the backend dependencies
- Firebase project and appropriate credentials for live backend integration
- Gemini API key for Gemini-powered features

## Run locally

### 1. Configure the frontend

From the project root:

```powershell
npm install
Copy-Item .env.example .env
```

Set `VITE_API_BASE_URL` in `.env` to the local backend URL expected by the frontend.

### 2. Configure the backend

Copy the example environment file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Configure the required Firebase credentials, Gemini API key, and other backend settings using the example file as a guide. Keep real secrets out of Git.

Install dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Start the Flask backend from the `backend` directory using the project's configured entry point.

### 3. Start the frontend

In a separate terminal, from the project root:

```powershell
npm run dev
```

Open the local URL printed by Vite.

## Run tests

From the project root:

```powershell
npm test
npm run build
python -m unittest discover -s tests -p "test_*.py"
```

Additional standalone test files, if needed:

```powershell
python tests/claim_detective.test.py
python tests/knowledge_base.test.py
```

Record actual results in [`TESTING.md`](TESTING.md). A successful unit test or build does not by itself verify live Firebase authentication, deployed Firestore rules, Gemini connectivity, or production security.

## Security notes

- Never commit `.env` files, service-account JSON files, API keys, or other credentials.
- Configure and deploy Firestore security rules to the intended Firebase project before relying on them.
- Verify user roles and cross-brand access restrictions using separate test accounts.
- Keep privileged role assignment restricted to trusted administrative processes.
- Treat AI findings, evidence retrieval scores, and visual scores as advisory.
- Do not use real sensitive business data in an unverified development deployment.

## Project structure

```text
Axion-AI/
├── backend/       # Flask API and analysis modules
├── src/           # React frontend
├── tests/         # Automated tests
├── firebase.json  # Firebase configuration
├── firestore.rules
├── package.json
├── TESTING.md
└── README.md
```

## Current limitations

- Live Firebase and Gemini integration require correct external configuration.
- Claim extraction and some visual checks use heuristics and may miss issues or produce false positives.
- Retrieved source URLs are not necessarily independently verified.
- Production readiness requires live integration, authorization, security-rule, and deployment testing.

## Project goal

AXION AI aims to make content review more consistent and evidence-aware while keeping important publishing decisions under human control.
