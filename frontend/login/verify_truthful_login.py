import argparse
import json
import os
import tempfile
import uuid

from playwright.sync_api import sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser(description="Builder preflight for truthful login failure behavior")
    parser.add_argument("--base-url", default="http://127.0.0.1:44175")
    parser.add_argument(
        "--mode",
        choices=("api-unavailable", "invalid-credentials", "revoked-session", "authenticated-student"),
        default="api-unavailable",
    )
    parser.add_argument("--screenshot")
    args = parser.parse_args()
    screenshot = args.screenshot or os.path.join(tempfile.gettempdir(), f"yuzan-login-{args.mode}.png")

    console_errors = []
    page_errors = []
    auth_responses = []
    me_requests = []
    me_responses = []
    main_frame_navigations = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        if args.mode == "revoked-session":
            context.add_init_script(
                """if (location.pathname.startsWith('/teacher')) {
                  localStorage.setItem('yuzan-access-token', 'revoked-browser-session');
                  localStorage.setItem('yuzan-current-user', JSON.stringify({
                    id: 'revoked-teacher',
                    memberships: [{ role: 'TEACHER', schoolId: 'revoked-school' }]
                  }));
                  localStorage.setItem('yuzan-active-school-id', 'revoked-school');
                }"""
            )
            context.route(
                "**/api/v1/me",
                lambda route: route.fulfill(
                    status=401,
                    content_type="application/json",
                    body=json.dumps({"error": {"code": "UNAUTHORIZED", "message": "Session revoked"}}),
                ),
            )
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "request",
            lambda request: me_requests.append(request.url) if "/api/v1/me" in request.url else None,
        )
        page.on(
            "response",
            lambda response: auth_responses.append({"url": response.url, "status": response.status})
            if "/api/v1/auth/login" in response.url or "/api/v1/auth/register" in response.url else None,
        )
        page.on(
            "response",
            lambda response: me_responses.append({"url": response.url, "status": response.status})
            if "/api/v1/me" in response.url else None,
        )
        page.on("framenavigated", lambda frame: main_frame_navigations.append(frame.url) if frame == page.main_frame else None)

        if args.mode == "revoked-session":
            page.goto(f"{args.base_url}/teacher", wait_until="domcontentloaded")
            page.wait_for_url("**/login**")
            page.screenshot(path=screenshot, full_page=True)
            storage = page.evaluate(
                """() => ({
                  token: localStorage.getItem('yuzan-access-token'),
                  user: localStorage.getItem('yuzan-current-user'),
                  school: localStorage.getItem('yuzan-active-school-id'),
                  demo: localStorage.getItem('yuzan-demo-session')
                })"""
            )
            assert all(value is None for value in storage.values()), storage
            assert me_requests, me_requests
            assert not page_errors, page_errors
            context.close()

            fresh_context = browser.new_context(viewport={"width": 390, "height": 844})
            fresh_page = fresh_context.new_page()
            fresh_page.goto(f"{args.base_url}/teacher", wait_until="domcontentloaded")
            fresh_page.wait_for_url("**/login**")
            fresh_storage = fresh_page.evaluate(
                """() => ({
                  token: localStorage.getItem('yuzan-access-token'),
                  user: localStorage.getItem('yuzan-current-user'),
                  school: localStorage.getItem('yuzan-active-school-id'),
                  demoSession: localStorage.getItem('yuzan-demo-session')
                })"""
            )
            assert all(value is None for value in fresh_storage.values()), fresh_storage
            fresh_context.close()
            browser.close()
            print(json.dumps({
                "result": "PASS",
                "level": "BUILDER_PREFLIGHT_ONLY",
                "mode": args.mode,
                "viewport": "390x844",
                "me_request": me_requests[-1],
                "me_response_status": 401,
                "revoked_context_auth_storage": storage,
                "fresh_context_auth_storage": fresh_storage,
                "console_errors": console_errors,
                "page_errors": page_errors,
                "screenshot": screenshot,
            }, ensure_ascii=False, indent=2))
            return

        page.goto(f"{args.base_url}/login", wait_until="networkidle")
        if args.mode == "authenticated-student":
            account = f"student-{uuid.uuid4().hex}"
            page.locator("#registerTab").click()
            page.locator("#registerPhone").fill(account)
            page.locator("#registerPassword").fill("Evidence-Student-2026!")
            page.locator('#registerPanel button[data-action="register"]').click()
            page.wait_for_url("**/student/today**", timeout=20000)
            page.wait_for_timeout(1500)
            assert page.url.rstrip("/").endswith("/student/today"), page.url
            assert page.evaluate("getComputedStyle(document.documentElement).visibility") == "visible"
            storage = page.evaluate(
                """() => ({
                  token: localStorage.getItem('yuzan-access-token'),
                  user: JSON.parse(localStorage.getItem('yuzan-current-user') || 'null'),
                  school: localStorage.getItem('yuzan-active-school-id'),
                  demo: localStorage.getItem('yuzan-demo-session')
                })"""
            )
            assert storage["token"], storage
            assert storage["school"], storage
            assert storage["demo"] is None, storage
            memberships = storage["user"]["memberships"]
            assert any(
                item["role"] == "STUDENT" and item["schoolId"] == storage["school"]
                for item in memberships
            ), storage
            assert auth_responses and auth_responses[-1]["status"] == 201, auth_responses
            assert me_responses and me_responses[-1]["status"] == 200, me_responses

            page.goto(f"{args.base_url}/teacher", wait_until="domcontentloaded")
            page.wait_for_url("**/student/today**", timeout=10000)
            assert page.url.rstrip("/").endswith("/student/today"), page.url
            assert not page.locator("body").inner_text().strip().startswith("教师工作台")
            page.screenshot(path=screenshot, full_page=True)
            assert not page_errors, page_errors
            final_url = page.url
            browser.close()
            print(json.dumps({
                "result": "PASS",
                "level": "BUILDER_PREFLIGHT_ONLY",
                "mode": args.mode,
                "viewport": "390x844",
                "auth_response": auth_responses[-1],
                "me_responses": me_responses,
                "final_url": final_url,
                "main_frame_navigations": main_frame_navigations,
                "session": {
                    "has_token": bool(storage["token"]),
                    "active_school_id": storage["school"],
                    "roles": [item["role"] for item in memberships],
                    "demo_session": storage["demo"],
                },
                "console_errors": console_errors,
                "page_errors": page_errors,
                "screenshot": screenshot,
            }, ensure_ascii=False, indent=2))
            return

        account = "teacher.test" if args.mode == "api-unavailable" else f"negative-{uuid.uuid4()}"
        page.locator("#loginAccount").fill(account)
        page.locator("#loginPassword").fill("not-a-real-password")
        page.locator('#loginPanel button[data-action="login"]').click()
        page.locator("#loginStatus[role=alert]").wait_for(state="visible")
        message = page.locator("#loginStatus").inner_text()
        page.screenshot(path=screenshot, full_page=True)

        storage = page.evaluate(
            """() => ({
              token: localStorage.getItem('yuzan-access-token'),
              user: localStorage.getItem('yuzan-current-user'),
              school: localStorage.getItem('yuzan-active-school-id'),
              demo: localStorage.getItem('yuzan-demo-session')
            })"""
        )
        assert page.url.rstrip("/").endswith("/login"), page.url
        expected_status = 502 if args.mode == "api-unavailable" else 401
        expected_message = "认证服务暂时不可用" if args.mode == "api-unavailable" else "账号或密码不正确"
        assert expected_message in message, message
        assert auth_responses and auth_responses[-1]["status"] == expected_status, auth_responses
        assert all(value is None for value in storage.values()), storage
        expected_console_status = f"{expected_status} ({'Bad Gateway' if expected_status == 502 else 'Unauthorized'})"
        unexpected_console_errors = [message for message in console_errors if expected_console_status not in message]
        assert not unexpected_console_errors, unexpected_console_errors
        assert not page_errors, page_errors
        context.close()

        fresh_context = browser.new_context(viewport={"width": 390, "height": 844})
        fresh_page = fresh_context.new_page()
        fresh_page.goto(f"{args.base_url}/login", wait_until="networkidle")
        fresh_storage = fresh_page.evaluate(
            """() => ({
              token: localStorage.getItem('yuzan-access-token'),
              user: localStorage.getItem('yuzan-current-user'),
              school: localStorage.getItem('yuzan-active-school-id'),
              demoSession: localStorage.getItem('yuzan-demo-session')
            })"""
        )
        assert fresh_page.url.rstrip("/").endswith("/login"), fresh_page.url
        assert all(value is None for value in fresh_storage.values()), fresh_storage
        fresh_context.close()
        browser.close()

    print(json.dumps({
        "result": "PASS",
        "level": "BUILDER_PREFLIGHT_ONLY",
        "mode": args.mode,
        "viewport": "390x844",
        "auth_response": auth_responses[-1],
        "ui_message": message,
        "fresh_context_auth_storage": fresh_storage,
        "console_errors": console_errors,
        "unexpected_console_errors": unexpected_console_errors,
        "page_errors": page_errors,
        "screenshot": screenshot,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
