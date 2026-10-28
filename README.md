# AXION AI
### AI-Powered Brand Governance Platform

**Search the Truth. Build the Trust.**

AXION AI is a brand-governance application designed to help teams review content against brand guidelines, identify potential compliance issues, and obtain AI-assisted analysis and correction suggestions.

## Key Features

- **Brand Governance:** Manage brand guidelines and compliance rules.
- **Content Scanning:** Check submitted content against configured rules.
- **AI-Assisted Analysis:** Use the Flask backend and Groq API for AI-generated analysis.
- **Correction Suggestions:** Generate suggestions to improve content consistency.
- **Review Dashboard:** View scans and related information in the application.
- **Backend API:** Flask endpoints support health checks and backend operations.

Feature availability and data persistence depend on the specific workflow implemented in the current version.

## Technology Stack

- Frontend: React and Vite
- Styling: Tailwind CSS
- Backend: Python and Flask
- AI: Groq API
- Data services: Firebase/Firestore integration

## Prerequisites

- Node.js 18 or newer
- npm
- Python 3.11
- Git
- A Groq API key for AI analysis
- Firebase credentials if using Firebase-backed endpoints

## Run the Frontend

Open a terminal in the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Run the Backend

Create and configure `backend/.env` with the required environment variables. At minimum, AI analysis requires:

```dotenv
GROQ_API_KEY=your_groq_api_key
```

The backend supports the `GROQ_MODEL` and `GROQ_URL` environment variables for model and endpoint configuration.

Install the backend dependencies using your Python 3.11 environment:

```powershell
.\.venv311\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Start the Flask application:

```powershell
.\.venv311\Scripts\python.exe backend\app.py
```

Use the address printed by Flask to access the backend. The health endpoint is available at `/api/health`.

If you use Firebase-backed endpoints, configure the required Firebase service-account credentials locally. Never commit credentials or API keys.

## Production Build

From the project root:

```bash
npm run build
```

Vite writes the production build to `dist/`.

## Project Structure

```text
AXION-AI/
├── backend/
│   ├── app.py
│   ├── ai_analyzer.py
│   ├── compliance.py
│   └── requirements.txt
├── src/
│   ├── App.jsx
│   ├── pages.jsx
│   ├── data.js
│   └── ui.jsx
├── package.json
└── README.md
```

## Security and Limitations

- Configure API keys and credentials locally; never commit them to Git.
- Frontend demo sign-in must not be treated as production-grade authentication.
- Some interface data and workflows may use client-side state and may not persist after a refresh.
- Rule-based findings and AI-generated findings are different analysis mechanisms; verify the relevant workflow before relying on results.
- AI output can be incorrect. Review suggestions and evidence before making publication decisions.
- Production deployment requires appropriate authentication, authorization, data validation, error handling, and security testing.

## Verification

Run the frontend production build:

```bash
npm run build
```

Check the backend health endpoint:

```text
GET /api/health
```

Test AI analysis with a valid API key and verify how the application handles missing credentials and API failures.

## Future Improvements

- Persistent scan history and review workflows
- Production-grade authentication and role-based access
- Stronger evidence verification
- Expanded automated tests
- Deployment configuration and monitoring

---

**AXION AI — Search the Truth. Build the Trust.**
