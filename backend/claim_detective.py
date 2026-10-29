"""Claim extraction and evidence retrieval helpers for AXION AI.

This module uses transparent heuristics to select sentences worth checking. It does
not decide truth by itself; the model compares selected claims with approved entries.
"""
import re
from knowledge_base import retrieve_approved_knowledge

CLAIM_CUES = re.compile(
    r"\b(guarantee|guaranteed|always|never|best|number one|#1|leading|"
    r"first|only|all|every|zero|100%|certified|proven|secure|fastest|"
    r"cheapest|most|increases|reduces|improves|saves|delivers|achieves|"
    r"results|performance|warranty|price|refund|revenue|success|failure)\b",
    re.IGNORECASE,
)

def extract_claim_candidates(content, max_claims=12):
    """Return sentence-level candidates that may contain verifiable claims."""
    sentences = re.split(r"(?<=[.!?])\s+|\n+", str(content or ""))
    candidates = []
    for sentence in sentences:
        clean = re.sub(r"\s+", " ", sentence).strip(" \t\r\n-•")
        if len(clean) < 18:
            continue
        has_number = bool(re.search(r"\b\d+(?:[.,]\d+)?%?\b", clean))
        if CLAIM_CUES.search(clean) or has_number:
            if clean not in candidates:
                candidates.append(clean[:1200])
        if len(candidates) >= max_claims:
            break
    return candidates

def retrieve_evidence_for_claims(entries, claims, per_claim_limit=4, total_limit=12, embedding_provider=None):
    """Return ranked approved evidence and a claim-to-evidence map."""
    by_id = {}
    claim_map = []
    for index, claim in enumerate(claims):
        matches = retrieve_approved_knowledge(entries, claim, limit=per_claim_limit, embedding_provider=embedding_provider)
        ids = []
        for item in matches:
            item_id = str(item.get("id", ""))
            if not item_id:
                continue
            ids.append(item_id)
            if item_id not in by_id:
                by_id[item_id] = {**item, "matched_claims": []}
            if claim not in by_id[item_id]["matched_claims"]:
                by_id[item_id]["matched_claims"].append(claim)
        claim_map.append({"claim_index": index, "claim": claim, "evidence_ids": ids})
    evidence = list(by_id.values())[:total_limit]
    allowed_ids = {str(item.get("id")) for item in evidence}
    for item in claim_map:
        item["evidence_ids"] = [entry_id for entry_id in item["evidence_ids"] if entry_id in allowed_ids]
    return evidence, claim_map
