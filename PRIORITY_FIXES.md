# AXION AI Priority Fixes

## Implemented in this package

### 1. Security and access control
- Normalized knowledge status before permission selection, so case and whitespace variations cannot bypass the approval permission.
- Added a second permission check in the knowledge update route for any status mutation.
- Added `firestore.rules` and `firebase.json` for the `axionai` named database:
  - deny direct client access to brand records and user role records;
  - owner-scope scans and company profiles;
  - limit scan approval/rejection to a Reviewer/Brand manager for the associated brand or a platform Admin;
  - prevent browser clients from updating/deleting audit log entries.
- Important: deploy the rules to the correct Firebase project/database and test with separate user accounts before relying on them.

### 2. AI accuracy and evidence quality
- Added optional Gemini embedding retrieval combined with lexical/concept ranking.
- Embeddings are cached in process memory by entry ID and content hash. If the embedding service fails, retrieval falls back to hybrid lexical/concept ranking.
- Draft and archived knowledge are still excluded.
- Retrieval scores are explicitly ranking metadata, not truth confidence. Claim verdicts still require claim-specific evidence IDs.

### 3. End-to-end workflow and traceability
- Document upload can retain PDF page-level excerpts and source page numbers.
- Claim Detective source responses include matched passage, source document, page number, retrieval method, and ranking metadata.
- Scanner UI displays the evidence excerpt and source location.

### 4. Visual brand verification
- Added deterministic image dimension and aspect-ratio checks, sampled palette checks against configured primary/secondary colours, and a separate rule-based score.
- Exact logo identity is explicitly marked `not_verified`: a configured approved reference-logo comparison is still needed for a true identity check.

### 5. Business value
- Analytics includes an approximate correction signal, average review time when timestamps are available, and CSV export.
- These are operational proxies, not causal proof of risk reduction. Legacy records may lack timestamps.

## Validation performed
- Python syntax compilation: passed.
- Python tests: 29 passed across access control, claim detection, knowledge retrieval, document extraction, and visual validation.
- Node tests: 3 passed.
- JSX/JavaScript syntax parse using Babel parser: passed for all files under `src/`.
- PDF metadata smoke test: confirmed page number and excerpt extraction.
- Production Vite build: **not verified in this environment**. The uploaded `node_modules` lacks the Linux Rollup optional binary (`@rollup/rollup-linux-x64-gnu`); this is an environment/dependency packaging issue, so run `npm ci` and `npm run build` locally.

## Still required before production
1. Deploy `firestore.rules` to the correct `axionai` database.
2. Test with Editor, Reviewer, Brand manager, and Admin accounts, including cross-brand ID tampering.
3. Run live Gemini embedding/vision tests and confirm graceful fallback when the API is unavailable.
4. Move browser-created audit log writes to a trusted backend endpoint if tamper-evident audit history is required.
5. Configure approved reference-logo assets for exact logo comparison.
