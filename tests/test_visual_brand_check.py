import io
import os
import unittest
from unittest.mock import patch

from PIL import Image
from backend.visual_brand_check import analyze_visual_asset, VisualCheckError, MAX_VISUAL_UPLOAD_BYTES


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (20, 20), (225, 6, 0)).save(output, format="PNG")
    return output.getvalue()


class VisualBrandCheckTests(unittest.TestCase):
    def test_rejects_unsupported_file(self):
        with self.assertRaises(VisualCheckError):
            analyze_visual_asset("logo.pdf", b"not a pdf", {})

    def test_rejects_empty_image(self):
        with self.assertRaises(VisualCheckError):
            analyze_visual_asset("logo.png", b"", {})

    def test_enforces_upload_limit(self):
        with self.assertRaises(VisualCheckError):
            analyze_visual_asset("logo.png", b"x" * (MAX_VISUAL_UPLOAD_BYTES + 1), {})

    def test_requires_vision_api_key_after_image_validation(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "GEMINI_API_KEY"):
                analyze_visual_asset("logo.png", png_bytes(), {"name": "Test brand"})


if __name__ == "__main__":
    unittest.main()
