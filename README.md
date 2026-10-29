# AXION AI — Brand Governance Platform

## Local validation and configuration

1. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.
2. Copy `backend/.env.example` to `backend/.env`; provide a valid Firebase Admin service account outside version control and a Gemini API key.
3. Install frontend dependencies with `npm install`, then run `npm test` and `npm run build`.
4. Install backend dependencies with `pip install -r backend/requirements.txt` and run the Flask app from `backend/`.
5. Check `/api/health` for process liveness and `/api/ready` for Firestore readiness. Configure `CORS_ORIGINS` to your exact deployed frontend origin(s).

## Security / release checklist

- The Flask API verifies Firebase ID tokens on protected routes and applies server-side role permissions. Brand-specific API calls require membership for that exact brand ID.
- `firestore.rules` is configured for the named `axionai` database via `firebase.json`. It denies direct browser access to brand data and user role records, scopes scans/company profiles to their owner, restricts scan approvals to a reviewer/brand-manager membership for the scan's brand (or platform Admin), and makes browser audit logs append-only.
- **Deploy and verify the rules before relying on them.** From a trusted environment with Firebase CLI access, run `firebase deploy --only firestore:rules`. Confirm the target project/database in Firebase Console first. Rules are not active merely because the file exists in this repository.
- Role records are trusted admin data at `users/{firebase_auth_uid}`. Never allow a normal client to create or edit its own role record.
- Browser-created audit events are owner-scoped and append-only, but a client can still submit a fabricated event. For compliance-grade tamper evidence, move audit writes to a trusted backend endpoint and consider immutable export/storage.
- Do not commit `.env`, service-account JSON files, or secrets. Rotate any secret that was ever committed or shared.
- AI and local-rule findings are advisory, not certified compliance determinations. Scores are heuristics and require human review.

## Evidence retrieval and traceability

Claim Detective now supports optional Gemini embedding retrieval (`ENABLE_SEMANTIC_RETRIEVAL=true`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`) combined with lexical/concept matching. Approved-entry embeddings are cached in process memory by entry ID and content hash. If embedding calls fail, the backend falls back to transparent hybrid lexical/concept retrieval so scans can continue. Set `ENABLE_SEMANTIC_RETRIEVAL=false` to disable embeddings.

Retrieval metadata includes the method and ranking score. The ranking score is **not** a confidence score and does not prove a claim. Claim assessments must cite only evidence IDs associated with that exact claim. PDF uploads preserve page-level excerpts when available; the UI displays the matched passage, source document and page number. Other source types may not have reliable page metadata.

Semantic retrieval requires a working Gemini API key and network access. It has not been live-verified against your production Firebase/Gemini project in this code-editing environment.


## Brand DNA knowledge base (prototype)

The Company Profile screen includes a knowledge library for backend brands. Each entry has a title, type (`fact`, `terminology`, `guideline`, `reference`, or `asset`), content, optional source URL and tags, and a status (`draft`, `approved`, or `archived`). New entries are drafts; a person must approve them before they can be considered by AI analysis.

Knowledge entries are stored under `brands/{brand_id}/knowledge_base/{entry_id}` in Firestore. The API exposes `GET` and `POST /api/brands/{brand_id}/knowledge`, `PUT` and `DELETE /api/brands/{brand_id}/knowledge/{entry_id}`. AI analysis retrieves only approved entries, using per-claim evidence retrieval and optional Gemini embeddings combined with transparent lexical/concept ranking. The response includes source IDs and retrieval metadata.

Current limitations: source URLs are stored but not fetched or independently verified; embedding retrieval depends on Gemini availability and falls back to hybrid lexical/concept matching; only backend brands can use this library. Verify live role assignments and deploy the included Firestore rules before public deployment.


## Claim Detective with evidence retrieval (prototype)

The AI analysis endpoint now runs a Claim Detective pass before calling Gemini:

1. `backend/claim_detective.py` extracts likely factual or high-risk sentences using transparent cues (for example guarantees, superlatives, numeric claims, warranties, prices, and performance claims).
2. For each candidate, it retrieves relevant **approved** knowledge entries from that brand's `knowledge_base` collection. Draft and archived entries are excluded.
3. Gemini receives the candidate claims, retrieved evidence, and a claim-to-evidence ID map. It returns `claim_assessments` with a verdict (`supported`, `contradicted`, `needs_verification`, or `not_assessed`), explanation, evidence IDs, and confidence.
4. The backend validates verdicts and removes evidence IDs that were not retrieved for that exact claim. A `supported` or `contradicted` verdict without a valid evidence ID is downgraded to `needs_verification`.
5. The scanner UI displays each assessment and its retrieved approved knowledge sources.

**Important limits:** claim extraction is heuristic and can miss claims or select irrelevant sentences. Retrieval uses optional embeddings plus hybrid lexical/concept ranking, with a deterministic fallback. The model's verdict is an assistive assessment, not proof of truth; a source URL is not independently fetched or verified. If evidence is missing, the system should say `needs_verification`, not infer falsity. Keep human review in the workflow.

Run backend unit tests from the project root:

```powershell
python tests/knowledge_base.test.py
python tests/claim_detective.test.py
```

## Document upload and extraction

The Brand DNA knowledge base can accept `.txt`, `.md`, `.pdf`, `.docx`, and common image formats. Extracted text is saved as a **Draft** knowledge entry; a person must review and approve it before it can be used as approved evidence. Uploads are limited to 10 MB and extracted knowledge text is capped at 6,000 characters.

Install backend packages from `backend/requirements.txt`. Image OCR and OCR fallback for scanned PDFs require the Tesseract OCR application to be installed on the backend host and available on `PATH` (the Python `pytesseract` package alone is not the OCR engine). PDFs with embedded text and DOCX files do not require Tesseract.

## Enforced roles and access control (Feature 11)

The Flask API now verifies Firebase ID tokens on protected routes and denies requests without a valid bearer token. Authorization is checked on the server, not trusted from UI state. Brand-specific endpoints require membership for that exact brand, and the brand-list endpoint only returns brands assigned to the caller. Unknown endpoints are denied by default.

### Provisioning a user

After the person signs in once with Firebase Authentication, an administrator must create a Firestore document at `users/{firebase_auth_uid}` in the same `axionai` Firestore database. Use one of these shapes:

Platform administrator (global access, use sparingly):

```json
{"platform_role": "Admin", "brand_roles": {}}
```

Brand-scoped user (recommended):

```json
{"platform_role": "", "brand_roles": {"YOUR_BRAND_DOCUMENT_ID": "Brand manager"}}
```

Supported brand roles are `Brand manager`, `Reviewer`, and `Editor`. Add each allowed brand ID to `brand_roles`; absence of a mapping means no access. The Firebase Auth UID, not an email or display name, is the `users` document ID. Never let a normal client create or edit its own role record. Provision roles through trusted admin tooling or the Firebase Console.

### Permission summary

- **Admin**: platform-wide access, including creating/deleting brands.
- **Brand manager**: manage brand settings/rules and knowledge; approve knowledge; run analysis and visual checks.
- **Reviewer**: read brand data, run analysis, approve/unapprove knowledge, view history, and run visual checks.
- **Editor**: read knowledge, create drafts/upload documents, run analysis and visual checks; cannot approve or delete knowledge or change brand rules.

New knowledge entries are forced to `draft` server-side. Only roles with `knowledge:approve` can change knowledge status. Frontend API calls attach the signed-in Firebase ID token automatically.

### Test and rollout notes

Run `python tests/test_access_control.py` from the project root. This is a baseline RBAC implementation; verify Firestore rules for client-side collections (`scans`, `auditLogs`, and `companyProfiles`) separately. The Team Members & Roles panel still contains profile-level roster UI and is not the source of backend permissions. Backend role assignment is authoritative. Test with separate Firebase accounts and confirm cross-brand requests return HTTP 403 before deploying.


## Visual verification and business reporting

Visual checks record image dimensions, aspect ratio, sampled palette colours, deterministic rule-based flags, and a separate rule-based score in addition to Gemini's advisory score. The deterministic score only covers the explicit heuristics and is not an overall compliance guarantee. Exact logo identity remains `not_verified` until a reference-logo asset comparison is configured.

Reports & Analytics includes saved-scan trends, pass rate, recurring findings, an approximate correction signal based on audit events, average review time where timestamps are available, and CSV export. Correction rate and review time are proxies; incomplete or legacy timestamps can leave metrics unavailable, and the report should not be represented as causal proof of risk reduction.
