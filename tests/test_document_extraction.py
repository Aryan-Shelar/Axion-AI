import io
import unittest
from document_extraction import extract_document, ExtractionError, MAX_EXTRACTED_CHARS

class DocumentExtractionTests(unittest.TestCase):
    def test_txt_extraction(self):
        text, method = extract_document("brand.txt", b"AXION approved brand message\nSecond line")
        self.assertIn("AXION approved", text)
        self.assertEqual(method, "text")

    def test_rejects_unsupported_extension(self):
        with self.assertRaises(ExtractionError):
            extract_document("payload.exe", b"hello")

    def test_rejects_empty_file(self):
        with self.assertRaises(ExtractionError):
            extract_document("empty.txt", b"")

    def test_enforces_size_limit(self):
        with self.assertRaises(ExtractionError):
            extract_document("large.txt", b"a" * (10 * 1024 * 1024 + 1))

    def test_truncates_to_knowledge_entry_limit(self):
        text, _ = extract_document("long.txt", ("x" * (MAX_EXTRACTED_CHARS + 50)).encode())
        self.assertEqual(len(text), MAX_EXTRACTED_CHARS)

if __name__ == "__main__":
    unittest.main()
