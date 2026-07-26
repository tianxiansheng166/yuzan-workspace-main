"""Browser smoke for dynamic teacher review routing.

This test does not intercept or mock network calls. The synthetic expired token is
used only to prove that the UI makes a real API request and renders a truthful
unavailable state instead of falling back to a fixed submission.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("YUZAN_FRONTEND_URL", "http://127.0.0.1:4176")
DYNAMIC_SUBMISSION_ID = "11111111-1111-4111-8111-111111111111"
SCHOOL_ID = "22222222-2222-4222-8222-222222222222"
FIXED_PLACEHOLDER = "submission" + "-1"


def main() -> None:
    evidence_dir = Path("runtime-local/task-evidence/P0-DYNAMIC-ID-ROUTING-CLEANUP")
    evidence_dir.mkdir(parents=True, exist_ok=True)
    result: dict[str, object] = {"base_url": BASE_URL, "checks": []}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)

        anonymous = browser.new_context(viewport={"width": 390, "height": 844})
        anonymous_page = anonymous.new_page()
        anonymous_page.goto(f"{BASE_URL}/teacher/reviews/", wait_until="networkidle")
        assert anonymous_page.url.rstrip("/").endswith("/login"), anonymous_page.url
        result["checks"].append({"name": "anonymous_redirect", "status": "PASS"})
        anonymous.close()

        context = browser.new_context(viewport={"width": 390, "height": 844})
        context.add_init_script(
            """
            localStorage.setItem('yuzan-access-token', 'expired-routing-proof-token');
            localStorage.setItem('yuzan-active-school-id', '%s');
            """ % SCHOOL_ID
        )
        page = context.new_page()
        api_requests: list[str] = []
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("request", lambda request: api_requests.append(request.url) if "/api/" in request.url else None)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        page.goto(f"{BASE_URL}/teacher/reviews/", wait_until="networkidle")
        status_text = page.locator("#queueStatus").inner_text()
        assert page.url.rstrip("/").endswith("/teacher/reviews"), page.url
        assert any("/assignments?limit=100" in url for url in api_requests), api_requests
        assert "加载失败" in status_text and "不会展示演示提交" in status_text, status_text
        assert FIXED_PLACEHOLDER not in page.content()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(evidence_dir / "review-queue-unavailable-390.png"), full_page=True)
        result["checks"].append({
            "name": "real_queue_request_truthful_unavailable",
            "status": "PASS",
            "status_text": status_text,
        })

        api_requests.clear()
        page.goto(
            f"{BASE_URL}/teacher/submissions/{DYNAMIC_SUBMISSION_ID}",
            wait_until="networkidle",
        )
        assert page.url.rstrip("/").endswith(f"/teacher/submissions/{DYNAMIC_SUBMISSION_ID}")
        assert any(DYNAMIC_SUBMISSION_ID in url and "/submissions/" in url for url in api_requests), api_requests
        assert page.locator("#studentName").inner_text() == "数据不足"
        assert page.locator("#btnAccept").is_disabled()
        assert page.locator("#btnReturn").is_disabled()
        assert FIXED_PLACEHOLDER not in page.content()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(evidence_dir / "dynamic-submission-unavailable-390.png"), full_page=True)
        result["checks"].append({
            "name": "dynamic_submission_route_real_request",
            "status": "PASS",
            "submission_id": DYNAMIC_SUBMISSION_ID,
        })

        result["api_requests"] = api_requests
        result["console_errors"] = console_errors
        result["page_errors"] = page_errors
        context.close()
        browser.close()

    (evidence_dir / "browser-routing.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
