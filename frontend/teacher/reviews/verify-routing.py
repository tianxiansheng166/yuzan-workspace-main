"""Browser smoke and focused UI regression for dynamic teacher review routing.

The unavailable-path smoke does not intercept network calls. A separate,
explicitly labelled route fixture exercises frontend evidence gating and the
feedback payload; it is regression coverage, not server authorization evidence.
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
        assert any("/api/v1/me" in url for url in api_requests), api_requests
        assert not any(DYNAMIC_SUBMISSION_ID in url for url in api_requests), api_requests
        assert page.locator("#studentName").inner_text() == "数据不足"
        assert "不会请求或展示" in page.locator("#evidenceMessage").inner_text()
        assert page.locator("#playBtn").is_disabled()
        assert page.locator("#btnGrade").is_disabled()
        assert page.locator("#btnAccept").is_disabled()
        assert page.locator("#btnReturn").is_disabled()
        assert FIXED_PLACEHOLDER not in page.content()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(evidence_dir / "dynamic-submission-unavailable-390.png"), full_page=True)
        result["checks"].append({
            "name": "unknown_role_fails_closed_before_submission_request",
            "status": "PASS",
            "submission_id": DYNAMIC_SUBMISSION_ID,
        })

        # Focused frontend contract regression. This fixture intentionally does
        # not claim backend policy or persistence coverage.
        regression = browser.new_context(viewport={"width": 1024, "height": 768})
        regression.add_init_script(
            """
            localStorage.setItem('yuzan-access-token', 'teacher-ui-regression-token');
            localStorage.setItem('yuzan-active-school-id', '%s');
            localStorage.setItem('yuzan-current-user', JSON.stringify({
              id: 'teacher-ui-regression',
              memberships: [{ schoolId: '%s', role: 'TEACHER' }]
            }));
            """ % (SCHOOL_ID, SCHOOL_ID)
        )
        regression_page = regression.new_page()
        response_state = {
            "id": DYNAMIC_SUBMISSION_ID,
            "schoolId": SCHOOL_ID,
            "enrollmentId": "33333333-3333-4333-8333-333333333333",
            "status": "NEEDS_REVIEW",
            "revision": 1,
        }
        feedback_payloads: list[dict[str, object]] = []
        submission_gets = 0

        def fulfill_submission(route, request) -> None:
            nonlocal submission_gets
            if request.method == "POST" and request.url.endswith("/feedback"):
                feedback_payloads.append(request.post_data_json)
                response_state["status"] = "RETURNED"
                route.fulfill(
                    status=201,
                    content_type="application/json",
                    body=json.dumps({"data": {"decision": "RETURN", "revision": 1}}),
                )
                return
            submission_gets += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"data": response_state}),
            )

        regression_page.route(
            f"**/api/v1/schools/{SCHOOL_ID}/submissions/{DYNAMIC_SUBMISSION_ID}**",
            fulfill_submission,
        )
        detail_url = f"{BASE_URL}/teacher/submissions/{DYNAMIC_SUBMISSION_ID}"
        regression_page.goto(detail_url, wait_until="networkidle")
        assert "没有答案或录音证据" in regression_page.locator("#evidenceMessage").inner_text()
        for selector in ("#playBtn", "#btnGrade", "#btnAccept", "#btnReturn"):
            assert regression_page.locator(selector).is_disabled(), selector

        response_state["writtenAnswer"] = "床前明月光，疑是地上霜。"
        regression_page.reload(wait_until="networkidle")
        assert regression_page.locator("#btnGrade").is_enabled()
        assert regression_page.locator("#btnAccept").is_enabled()
        assert regression_page.locator("#btnReturn").is_enabled()
        assert regression_page.locator("#playBtn").is_disabled()

        regression_page.locator("#btnReturn").click()
        regression_page.locator("#returnComment").fill("第二句停顿位置不准确，请对照示范重新朗读。")
        regression_page.locator("#confirmReturn").click()
        regression_page.wait_for_function(
            "() => document.querySelector('#submitStatus').textContent === '已退回'"
        )
        assert feedback_payloads == [{
            "decision": "RETURN",
            "comment": "第二句停顿位置不准确，请对照示范重新朗读。",
        }], feedback_payloads
        assert submission_gets >= 3, submission_gets
        assert regression_page.locator("#btnAccept").is_disabled()
        assert regression_page.locator("#btnReturn").is_disabled()
        result["checks"].append({
            "name": "evidence_gate_and_return_contract_ui_regression",
            "status": "PASS",
            "feedback_payload": feedback_payloads[0],
            "refreshed_status": "RETURNED",
            "server_scope_claimed": False,
        })
        regression.close()

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
