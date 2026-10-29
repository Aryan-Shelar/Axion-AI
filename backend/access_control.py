"""Role-based authorization policy for AXION AI API routes.

Membership records live at users/{firebase_uid} with:
  {"platform_role": "Admin", "brand_roles": {"<brand_id>": "Brand manager"}}
Only platform Admins may create brands or administer platform-wide data.
"""

ROLE_PERMISSIONS = {
    "Admin": {"*"},
    "Brand manager": {
        "brand:read", "brand:update", "content:analyze", "content:review",
        "knowledge:read", "knowledge:write", "knowledge:approve", "knowledge:delete",
        "visual:check", "history:read", "rules:update",
    },
    "Reviewer": {
        "brand:read", "content:analyze", "content:review", "knowledge:read",
        "knowledge:approve", "visual:check", "history:read",
    },
    "Editor": {
        "brand:read", "content:analyze", "knowledge:read", "knowledge:write",
        "visual:check", "history:read",
    },
}


def has_permission(role, permission):
    permissions = ROLE_PERMISSIONS.get(role, set())
    return "*" in permissions or permission in permissions


def required_permission(endpoint, method, payload=None):
    """Map endpoint/action to one permission. Unknown routes deny by default."""
    payload = payload or {}
    if endpoint == "health" or endpoint == "readiness" or endpoint == "home":
        return None
    if endpoint == "db_test":
        return "platform:admin"
    if endpoint == "create_brand":
        return "platform:admin"
    if endpoint == "get_brands":
        return "brand:list"
    if endpoint == "delete_brand":
        return "platform:admin"
    if endpoint == "update_brand":
        return "brand:update"
    if endpoint == "update_brand_rules":
        return "rules:update"
    if endpoint == "brand_compliance_check" or endpoint == "ai_analyze_brand":
        return "content:analyze"
    if endpoint == "visual_brand_check":
        return "visual:check"
    if endpoint == "get_compliance_history":
        return "history:read"
    if endpoint == "list_brand_knowledge":
        return "knowledge:read"
    if endpoint in ("create_brand_knowledge", "upload_brand_knowledge_document"):
        return "knowledge:write"
    if endpoint == "update_brand_knowledge":
        # Status transitions are privileged regardless of casing/whitespace. The
        # route normalizes and validates the payload too, but authorization must
        # never inspect a less-normalized value than the mutation handler.
        if "status" in payload:
            status = payload.get("status")
            if not isinstance(status, str):
                return "knowledge:approve"
            status = status.strip().lower()
            if status in {"draft", "approved", "archived"}:
                return "knowledge:approve"
            # Invalid status values are rejected by validation; require the
            # stronger permission as a defense-in-depth default.
            return "knowledge:approve"
        return "knowledge:write"
    if endpoint == "delete_brand_knowledge":
        return "knowledge:delete"
    return "__deny__"
