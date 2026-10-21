import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright


def prefix(value):
    return value[:8] if isinstance(value, str) else None


def main():
    web_url = os.environ["WEB_URL"].rstrip("/")
    identifier = os.environ["T109_LOGIN"]
    password = os.environ["T109_PASSWORD"]
    output_dir = Path("/evidence")
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        response = context.request.post(
            f"{web_url}/api/v1/auth/register",
            headers={"content-type": "application/json"},
            data=json.dumps({"identifier": identifier, "password": password, "role": "STUDENT"}),
            timeout=30000,
        )
        status = response.status
        if status != 201:
            context.clear_cookies()
            browser.close()
            print(json.dumps({"status": "FAIL", "registrationHttpStatus": status}))
            return 1

        # Keep the access/refresh tokens in memory only; persist only opaque ID prefixes.
        payload = response.json()
        data = payload.get("data") or {}
        user = data.get("user") or {}
        school_id = data.get("activeSchoolId")
        user_id = user.get("id")
        role = next((entry.get("role") for entry in user.get("memberships", []) if entry.get("role") == "STUDENT"), None)
        context.clear_cookies()
        browser.close()

    if not school_id or not user_id or role != "STUDENT":
        print(json.dumps({"status": "FAIL", "registrationHttpStatus": status, "activeStudentMembership": False}))
        return 1

    result = {
        "taskId": "YZ-RD-T109",
        "status": "PASS",
        "accountAlias": "T109-STUDENT-01",
        "registrationHttpStatus": status,
        "registrationRoute": "/api/v1/auth/register",
        "role": role,
        "schoolIdPrefix": prefix(school_id),
        "userIdPrefix": prefix(user_id),
        "tokensPersisted": False,
        "registeredAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    (output_dir / "account-registration.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
