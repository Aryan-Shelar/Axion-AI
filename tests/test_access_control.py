import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from access_control import has_permission, required_permission


class AccessControlPolicyTests(unittest.TestCase):
    def test_editor_can_analyze_but_cannot_approve_or_delete(self):
        self.assertTrue(has_permission("Editor", "content:analyze"))
        self.assertFalse(has_permission("Editor", "knowledge:approve"))
        self.assertFalse(has_permission("Editor", "knowledge:delete"))

    def test_reviewer_can_approve_but_cannot_edit_brand_rules(self):
        self.assertTrue(has_permission("Reviewer", "knowledge:approve"))
        self.assertFalse(has_permission("Reviewer", "rules:update"))

    def test_manager_can_manage_knowledge_but_cannot_create_or_delete_brands(self):
        self.assertTrue(has_permission("Brand manager", "knowledge:delete"))
        self.assertFalse(has_permission("Brand manager", "platform:admin"))

    def test_knowledge_status_change_requires_approval_permission(self):
        self.assertEqual(required_permission("update_brand_knowledge", "PUT", {"status": "approved"}), "knowledge:approve")
        self.assertEqual(required_permission("update_brand_knowledge", "PUT", {"status": "draft"}), "knowledge:approve")
        self.assertEqual(required_permission("update_brand_knowledge", "PUT", {"title": "Edited"}), "knowledge:write")

    def test_status_authorization_is_case_and_whitespace_insensitive(self):
        for status in ("approved", "Approved", " APPROVED ", "archived", "Draft"):
            with self.subTest(status=status):
                self.assertEqual(
                    required_permission("update_brand_knowledge", "PUT", {"status": status}),
                    "knowledge:approve",
                )

    def test_non_string_status_requires_approval_permission(self):
        self.assertEqual(required_permission("update_brand_knowledge", "PUT", {"status": ["approved"]}), "knowledge:approve")

    def test_unknown_routes_deny_by_default(self):
        self.assertEqual(required_permission("some_new_endpoint", "POST", {}), "__deny__")


if __name__ == "__main__":
    unittest.main()
