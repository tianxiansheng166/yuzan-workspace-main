import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4176")
ACCESS_TOKEN = os.environ["YUZAN_E2E_ACCESS_TOKEN"]
SCHOOL_ID = os.environ["YUZAN_E2E_SCHOOL_ID"]
SESSION_ID = os.environ["YUZAN_E2E_SESSION_ID"]
OUTPUT_DIR = Path(__file__).resolve().parent


def main() -> None:
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script(
            f"""
            localStorage.setItem('yuzan-access-token', {json.dumps(ACCESS_TOKEN)});
            localStorage.setItem('yuzan-active-school-id', {json.dumps(SCHOOL_ID)});
            """
        )
        page = context.new_page()
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "requestfailed",
            lambda request: failed_requests.append(
                f"{request.method} {request.url}: {request.failure}"
            ),
        )

        page.goto(f"{BASE_URL}/assessment/history/", wait_until="networkidle")
        page.get_by_role("heading", name="历史测评").wait_for()
        history_text = page.locator("body").inner_text()
        assert "测评历史记录" in history_text
        assert "3" in history_text
        page.screenshot(path=OUTPUT_DIR / "01-history-1440.png", full_page=True)

        page.goto(
            f"{BASE_URL}/assessment/sessions/{SESSION_ID}/report/",
            wait_until="networkidle",
        )
        page.get_by_text("待教师复核", exact=True).first.wait_for()
        report_text = page.locator("body").inner_text()
        assert "总体得分" in report_text
        assert "3 /100" in report_text.replace("\n", " ")
        page.screenshot(path=OUTPUT_DIR / "02-report-1440.png", full_page=True)

        result = {
            "status": "PASSED",
            "baseUrl": BASE_URL,
            "sessionId": SESSION_ID,
            "historyVisible": True,
            "reportVisible": True,
            "needsTeacherReviewVisible": True,
            "overallScore": 3,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
        }
        with (OUTPUT_DIR / "browser-result.json").open(
            "w", encoding="utf-8", newline="\n"
        ) as result_file:
            result_file.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        assert not console_errors
        assert not page_errors
        assert not failed_requests
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
