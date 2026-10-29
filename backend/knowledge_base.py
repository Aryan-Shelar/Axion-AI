"""Approved brand knowledge retrieval helpers for AXION AI."""
import re
import hashlib
import math
from datetime import datetime, timezone

_EMBEDDING_CACHE = {}

ALLOWED_TYPES = {"fact", "terminology", "guideline", "reference", "asset"}
ALLOWED_STATUSES = {"draft", "approved", "archived"}


def clean_string(value, field, max_length, required=False):
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    value = value.strip()
    if required and not value:
        raise ValueError(f"{field} is required")
    if len(value) > max_length:
        raise ValueError(f"{field} must be {max_length} characters or fewer")
    return value


def normalize_entry(data, partial=False):
    if not isinstance(data, dict):
        raise ValueError("JSON request body is required")
    result = {}
    for field, limit, required in (("title", 160, True), ("content", 6000, True), ("source_url", 1000, False)):
        if field in data or (not partial and field != "source_url"):
            result[field] = clean_string(data.get(field, ""), field, limit, required and (field in data or not partial))
    if "type" in data or not partial:
        kind = clean_string(data.get("type", "fact"), "type", 30, True).lower()
        if kind not in ALLOWED_TYPES:
            raise ValueError("type must be one of: fact, terminology, guideline, reference, asset")
        result["type"] = kind
    if "status" in data or not partial:
        status = clean_string(data.get("status", "draft"), "status", 20, True).lower()
        if status not in ALLOWED_STATUSES:
            raise ValueError("status must be draft, approved, or archived")
        result["status"] = status
    if "tags" in data or not partial:
        tags = data.get("tags", [])
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            raise ValueError("tags must be a list of strings")
        result["tags"] = list(dict.fromkeys(tag.strip()[:40] for tag in tags if tag.strip()))[:20]
    return result


def tokenize(text):
    """Normalize words and discard common stopwords for more precise lexical retrieval."""
    stopwords = {
        "the", "and", "for", "with", "that", "this", "from", "our", "your",
        "you", "are", "was", "were", "will", "can", "has", "have", "had",
        "its", "into", "about", "than", "then", "they", "them", "their",
        "but", "not", "all", "any", "who", "what", "when", "where", "how",
        "does", "did", "use", "using", "used", "product", "service",
    }
    return {token for token in re.findall(r"[a-z0-9]{3,}", str(text or "").lower()) if token not in stopwords}


# Small, transparent concept map improves recall without pretending this is a
# trained embedding model. Deployments can later replace this with vector search.
CONCEPTS = {
    "fast": {"speed", "quick", "rapid", "performance"},
    "quick": {"fast", "speed", "rapid"},
    "secure": {"security", "safe", "protected", "protection"},
    "safe": {"secure", "security", "protected"},
    "cheap": {"affordable", "low-cost", "inexpensive", "price"},
    "affordable": {"cheap", "low-cost", "inexpensive", "price"},
    "refund": {"return", "money-back", "reimbursement"},
    "warranty": {"guarantee", "coverage", "repair"},
    "guarantee": {"warranty", "promise", "assurance"},
    "revenue": {"sales", "income", "earnings"},
    "improve": {"increase", "boost", "enhance", "improvement"},
    "improves": {"increase", "boost", "enhance", "improvement"},
    "reduces": {"lower", "decrease", "cut", "reduction"},
    "customer": {"client", "buyer", "consumer"},
    "customers": {"clients", "buyers", "consumers"},
    "colour": {"color", "palette", "hex"},
    "color": {"colour", "palette", "hex"},
}


def _expanded_tokens(text):
    tokens = tokenize(text)
    expanded = set(tokens)
    for token in tokens:
        expanded.update(CONCEPTS.get(token, set()))
    # Also compare simple stems for common inflections.
    for token in list(expanded):
        for suffix in ("ing", "ed", "es", "s"):
            if len(token) > len(suffix) + 3 and token.endswith(suffix):
                expanded.add(token[:-len(suffix)])
    return expanded


def _best_passage(entry, query_tokens):
    """Return a concise source passage and page metadata where available."""
    page_texts = entry.get("source_page_texts")
    candidates = []
    if isinstance(page_texts, list):
        for page in page_texts:
            if not isinstance(page, dict):
                continue
            text = str(page.get("text", "")).strip()
            if text:
                candidates.append((text, page.get("page_number")))
    if not candidates:
        body = str(entry.get("content", "")).strip()
        if body:
            candidates = [(body, entry.get("page_number"))]
    best = ("", None, -1)
    for text, page_number in candidates:
        sentences = re.split(r"(?<=[.!?])\\s+|\\n+", text)
        for sentence in sentences:
            sentence = re.sub(r"\\s+", " ", sentence).strip()
            if not sentence:
                continue
            score = len(query_tokens & _expanded_tokens(sentence))
            if score > best[2]:
                best = (sentence[:700], page_number, score)
    if not best[0] and candidates:
        best = (candidates[0][0][:700], candidates[0][1], 0)
    return best[0], best[1], best[2]


def retrieve_approved_knowledge(entries, content, limit=8, embedding_provider=None):
    """Hybrid transparent retrieval over approved entries only.

    Ranking combines exact lexical overlap, concept expansion, title/tag weighting,
    term frequency normalization, and phrase matches. This is not vector embedding
    search; the response exposes its passage and score so reviewers can inspect it.
    Draft and archived knowledge are deliberately excluded.
    """
    query = str(content or "").lower()
    tokens = tokenize(query)
    expanded = _expanded_tokens(query)
    if not tokens:
        return []

    ranked = []
    for entry in entries:
        if str(entry.get("status") or "draft").strip().lower() != "approved":
            continue
        title = str(entry.get("title", ""))
        body = str(entry.get("content", ""))
        tags = entry.get("tags", []) if isinstance(entry.get("tags"), list) else []
        source_pages = entry.get("source_page_texts") if isinstance(entry.get("source_page_texts"), list) else []
        page_text = " ".join(str(page.get("text", "")) for page in source_pages if isinstance(page, dict))
        searchable = " ".join([title, body, page_text, " ".join(tags), str(entry.get("type", ""))])
        entry_tokens = _expanded_tokens(searchable)
        overlap = expanded & entry_tokens
        if not overlap:
            continue

        title_overlap = len(expanded & _expanded_tokens(title))
        tag_overlap = len(expanded & _expanded_tokens(" ".join(tags)))
        body_tokens = max(1, len(tokenize(body)))
        # Penalize very long documents, emphasize titles/tags, and keep scores
        # bounded and interpretable for ranking only (not as truth confidence).
        lexical_ratio = len(tokens & tokenize(searchable)) / max(1, len(tokens))
        concept_ratio = len(overlap) / max(1, len(expanded))
        score = lexical_ratio * 5 + concept_ratio * 2 + title_overlap * 0.9 + tag_overlap * 0.6
        score += min(0.4, len(overlap) / body_tokens)
        if len(query.strip()) >= 5 and query.strip() in searchable.lower():
            score += 3
        if str(entry.get("type", "")).lower() in {"fact", "reference"}:
            score += 0.15
        passage, page_number, passage_overlap = _best_passage(entry, expanded)
        # Avoid a result that matches only because the entry is long and unrelated.
        if passage_overlap:
            score += min(1.0, passage_overlap * 0.15)
        result = dict(entry)
        result["matched_passage"] = passage
        result["page_number"] = page_number
        result["retrieval_score"] = round(score, 4)
        result["retrieval_method"] = "hybrid_lexical_concept"
        ranked.append((score, len(overlap), result))

    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    lexical_results = [entry for score, overlap, entry in ranked if score > 0]
    if embedding_provider is not None:
        try:
            query_vector = embedding_provider(query[:6000])
            if not query_vector:
                return lexical_results[:max(0, limit)]
            semantic_ranked = []
            for entry in entries:
                if str(entry.get("status") or "draft").strip().lower() != "approved":
                    continue
                entry_id = str(entry.get("id") or "")
                searchable = " ".join([
                    str(entry.get("title", "")), str(entry.get("content", ""))[:3000],
                    " ".join(entry.get("tags", [])) if isinstance(entry.get("tags"), list) else "",
                    str(entry.get("type", "")),
                ])
                digest = hashlib.sha256(searchable.encode("utf-8")).hexdigest()
                cache_key = (entry_id, digest)
                vector = _EMBEDDING_CACHE.get(cache_key)
                if vector is None:
                    vector = embedding_provider(searchable[:4000])
                    if vector:
                        _EMBEDDING_CACHE[cache_key] = vector
                if not vector or len(vector) != len(query_vector):
                    continue
                dot = sum(float(a) * float(b) for a, b in zip(query_vector, vector))
                norm_q = math.sqrt(sum(float(a) ** 2 for a in query_vector))
                norm_e = math.sqrt(sum(float(b) ** 2 for b in vector))
                similarity = dot / (norm_q * norm_e) if norm_q and norm_e else 0.0
                hybrid_item = next((item for item in lexical_results if str(item.get("id", "")) == entry_id), None)
                result = dict(hybrid_item or entry)
                result["semantic_similarity"] = round(similarity, 5)
                result["retrieval_method"] = "semantic_embedding+hybrid_lexical"
                # Similarity is ranking metadata, never a truth/confidence score.
                combined = similarity * 0.75 + (float(result.get("retrieval_score", 0)) / 20.0) * 0.25
                result["retrieval_score"] = round(combined, 5)
                if not result.get("matched_passage"):
                    passage, page_number, _ = _best_passage(entry, expanded)
                    result["matched_passage"], result["page_number"] = passage, page_number
                semantic_ranked.append((combined, result))
            if semantic_ranked:
                semantic_ranked.sort(key=lambda item: item[0], reverse=True)
                return [item for score, item in semantic_ranked if score > 0][:max(0, limit)]
        except Exception:
            # Embedding service outages should degrade to deterministic retrieval,
            # not take down the whole compliance scan.
            pass
    return lexical_results[:max(0, limit)]


def now_iso():
    return datetime.now(timezone.utc).isoformat()
