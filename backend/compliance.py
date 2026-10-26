
import re


def check_brand_compliance(
    content,
    tone_of_voice="professional",
    prohibited_words=None,
    required_keywords=None
):
    prohibited_words = prohibited_words or []
    required_keywords = required_keywords or []

    violations = []
    passed_checks = []

    content = content.strip()

    if not content:
        return {
            "status": "error",
            "message": "Content cannot be empty"
        }

    # Check prohibited words
    for word in prohibited_words:
        pattern = r"\b" + re.escape(word) + r"\b"

        if re.search(pattern, content, re.IGNORECASE):
            violations.append({
                "type": "prohibited_word",
                "message": f"Prohibited word found: {word}"
            })

    if not any(v["type"] == "prohibited_word" for v in violations):
        passed_checks.append("No prohibited words found")

    # Check required keywords
    missing_keywords = []

    for keyword in required_keywords:
        if keyword.casefold() not in content.casefold():
            missing_keywords.append(keyword)

    if missing_keywords:
        violations.append({
            "type": "missing_keywords",
            "keywords": missing_keywords,
            "message": "Required keywords are missing"
        })
    else:
        passed_checks.append("Required keywords check passed")

    # Basic tone check (rule-based, not AI)
    tone = tone_of_voice.casefold()

    if tone in ("professional", "formal"):
        casual_words = ["lol", "bro", "wanna", "gonna"]
        found_casual = [
            word for word in casual_words
            if re.search(r"\b" + re.escape(word) + r"\b",
                         content, re.IGNORECASE)
        ]

        if found_casual:
            violations.append({
                "type": "tone_mismatch",
                "words": found_casual,
                "message": "Casual language may not match the requested tone"
            })
        else:
            passed_checks.append("Basic tone check passed")
    else:
        passed_checks.append(
            "Tone check skipped: no specific tone rules configured"
        )

    total_checks = len(passed_checks) + len(violations)

    score = round(
        len(passed_checks) / total_checks * 100
    ) if total_checks else 100

    return {
        "status": "success",
        "compliance_score": score,
        "is_compliant": len(violations) == 0,
        "passed_checks": passed_checks,
        "violations": violations,
        "suggestions": [
            violation["message"] for violation in violations
        ]
    }
