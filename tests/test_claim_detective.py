import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from claim_detective import extract_claim_candidates, retrieve_evidence_for_claims


class ClaimDetectiveTests(unittest.TestCase):
    def test_extracts_absolute_and_numeric_claims(self):
        text = "Our app is the best for every team. We launched a new blue dashboard. The warranty lasts 2 years."
        claims = extract_claim_candidates(text)
        self.assertIn("Our app is the best for every team.", claims)
        self.assertIn("The warranty lasts 2 years.", claims)
        self.assertNotIn("We launched a new blue dashboard.", claims)

    def test_retrieval_is_approved_only_and_maps_evidence(self):
        entries = [
            {"id": "warranty", "title": "Warranty", "content": "Product warranty lasts two years.", "status": "approved", "type": "fact", "tags": ["warranty"]},
            {"id": "draft", "title": "Warranty draft", "content": "Product warranty lasts ten years.", "status": "draft", "type": "fact", "tags": ["warranty"]},
        ]
        evidence, mapping = retrieve_evidence_for_claims(entries, ["The product warranty lasts two years." ])
        self.assertEqual([item["id"] for item in evidence], ["warranty"])
        self.assertEqual(mapping[0]["evidence_ids"], ["warranty"])

    def test_no_claims_means_no_evidence_map(self):
        evidence, mapping = retrieve_evidence_for_claims([], [])
        self.assertEqual(evidence, [])
        self.assertEqual(mapping, [])


if __name__ == "__main__":
    unittest.main()
