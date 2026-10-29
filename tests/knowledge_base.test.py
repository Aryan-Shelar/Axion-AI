import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.knowledge_base import normalize_entry, retrieve_approved_knowledge


class KnowledgeBaseTests(unittest.TestCase):
    def test_new_entries_default_to_draft(self):
        entry = normalize_entry({"title": "Return policy", "content": "Returns accepted within 30 days."})
        self.assertEqual(entry["status"], "draft")
        self.assertEqual(entry["type"], "fact")

    def test_only_approved_relevant_entries_are_retrieved(self):
        entries = [
            {"id": "a", "title": "Warranty", "content": "Product warranty lasts two years.", "status": "approved", "type": "fact"},
            {"id": "b", "title": "Warranty draft", "content": "Product warranty lasts ten years.", "status": "draft", "type": "fact"},
            {"id": "c", "title": "Shipping", "content": "Shipping takes three days.", "status": "approved", "type": "fact"},
        ]
        result = retrieve_approved_knowledge(entries, "What is the product warranty?", limit=8)
        self.assertEqual([item["id"] for item in result], ["a"])

    def test_concept_expansion_finds_related_approved_evidence(self):
        entries = [
            {"id": "fast", "title": "Performance", "content": "Our service delivers rapid processing.", "status": "approved", "type": "fact"},
            {"id": "draft", "title": "Performance", "content": "Our service is fast.", "status": "draft", "type": "fact"},
        ]
        result = retrieve_approved_knowledge(entries, "Is the service fast?", limit=8)
        self.assertEqual([item["id"] for item in result], ["fast"])
        self.assertEqual(result[0]["retrieval_method"], "hybrid_lexical_concept")
        self.assertIn("rapid processing", result[0]["matched_passage"])

    def test_retrieval_exposes_document_page_passage(self):
        entries = [{
            "id": "pdf", "title": "Claims", "content": "Other text", "status": "approved",
            "type": "reference", "source_document": "claims.pdf",
            "source_page_texts": [{"page_number": 3, "text": "Battery lasts 12 hours under test conditions."}],
        }]
        result = retrieve_approved_knowledge(entries, "battery lasts 12 hours", limit=8)
        self.assertEqual(result[0]["page_number"], 3)
        self.assertEqual(result[0]["source_document"], "claims.pdf")
        self.assertIn("Battery lasts 12 hours", result[0]["matched_passage"])

    def test_embedding_retrieval_still_excludes_unapproved_entries(self):
        entries = [
            {"id": "approved", "title": "Brand facts", "content": "Approved fact", "status": "approved", "type": "fact"},
            {"id": "draft", "title": "Brand facts", "content": "Unreviewed draft", "status": "draft", "type": "fact"},
        ]
        result = retrieve_approved_knowledge(entries, "claim to check", embedding_provider=lambda _text: [1.0, 0.0])
        self.assertEqual([item["id"] for item in result], ["approved"])
        self.assertEqual(result[0]["retrieval_method"], "semantic_embedding+hybrid_lexical")

    def test_invalid_status_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_entry({"title": "X", "content": "Y", "status": "verified-by-ai"})

    def test_empty_required_content_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_entry({"title": "Missing body", "content": "   "})


if __name__ == "__main__":
    unittest.main()
