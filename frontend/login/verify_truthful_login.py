import argparse
import json
import os
import tempfile
import uuid

from playwright.sync_api import sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser(description="Builder preflight for truthful login failure behavior")
    parser.add_argument("--base-url", default="http://127.0.0.1:44175")
    parser.add_argument("--mode", choices=("api-unavailable", "invalid-credentials"), default="api-unavailable")
    parser.add_argument("--screenshot")
    args = parser.parse_args()
    screenshot = args.screenshot or os.path.join(tempfile.gettempdir(), f"yuzan-login-{args.mode}.png")

    console_errors = []
    page_errors = []
    auth_responses = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "response",
            lambda response: auth_responses.append({"url": response.url, "status": response.status})
            if "/api/v1/auth/login" in response.url else None,
        )

        page.goto(f"{args.base_url}/login", wait_until="networkidle")
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
