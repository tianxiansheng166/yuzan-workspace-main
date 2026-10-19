"""T042 integration proof for Today -> History -> the same live Attempt."""

from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

import test_yz_rd_t037_today_showcase as today
import test_yz_rd_t011_web_review_feedback as fixtures


BASE = os.environ.get("YZ_T042_BASE_URL", "")
API_ROOT = os.environ.get("YZ_T042_API_BASE_URL", "")
API = f"{API_ROOT.rstrip('/')}/api/v1" if API_ROOT else ""
DATABASE_URL = os.environ.get("YZ_T042_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T042_PASSWORD", "")
EVIDENCE = Path(os.environ.get("YZ_T042_EVIDENCE_DIR", "/tmp/yz-rd-t042-evidence"))
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"


def test_today_history_continues_the_same_real_attempt():
    assert BASE and API and DATABASE_URL and PASSWORD
    assert today.verify_database().startswith("PostgreSQL 17.")
    student = fixtures.create_student_fixture("T042-history", CLASS_ID)
    student_id = student["user"]
    enrollment_id = student["enrollment"]

    screenshots = EVIDENCE / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    page_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("YZ_T042_CHROMIUM", "/usr/bin/google-chrome"))
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        try:
            session = today.login_in_browser(page, student["login"])
            assert session["user"]["id"] == student_id
            assert session["activeSchoolId"] == SCHOOL_ID

            today_state = today.open_today(page)
            assert today_state["primaryAction"]["kind"] == "BASELINE"
            assert page.locator(".today-skill-card").count() == 4
            practice_id = today_state["primaryAction"]["target"]["practiceDefinitionId"]
            detail_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/{practice_id}",
                headers=today.auth_headers(session),
            )
            assert detail_response.ok, detail_response.text()
            practice = today.payload(detail_response)
            assert practice["id"] == practice_id
            page.locator(".today-skill-exam .today-skill-link").click()
            page.wait_for_url(f"**/student/practices/{practice_id}/", timeout=20_000)
            expect(page.locator("body")).to_contain_text(practice["title"])

            # Start through the real practice detail and Runner controls.
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            page.locator(".question-shell").wait_for(timeout=20_000)

            # Today renders the current Attempt from its authenticated API data.
            today.open_today(page)
            today_attempt = page.locator(
                f'.today-record-row a[href="/student/practices/attempts/{attempt_id}/runner/"]'
            )
            expect(today_attempt).to_have_count(1)
            expect(today_attempt).to_contain_text("继续练习")

            # Follow the Today learning-history entry, then continue that exact Attempt.
            page.locator('.today-next-card a[href="/assessment/history/"]').click()
            page.wait_for_url("**/assessment/history/", timeout=20_000)
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            page.get_by_label("筛选状态或类型").select_option("IN_PROGRESS")
            row = page.locator(f'[data-history-session="{attempt_id}"]')
            row.wait_for(timeout=30_000)
            assert "尚未形成报告或成绩" in row.inner_text()
            page.screenshot(path=str(screenshots / "t042-history-attempt-resume-1280.png"), full_page=True)
            row.get_by_role("link", name="继续练习").click()
            page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)

            api_attempt = today.payload(page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}",
                headers=today.auth_headers(session),
            ))
            sql_attempt = today.sql_rows(
                f'''SELECT id,"enrollmentId",status::text,purpose::text
                      FROM "AssessmentSession" WHERE id={today.q(attempt_id)};'''
            )
            assert api_attempt["id"] == attempt_id and api_attempt["status"] == "IN_PROGRESS"
            assert sql_attempt == [[attempt_id, enrollment_id, "IN_PROGRESS", "STANDARD"]], sql_attempt
            assert not page_errors, page_errors
        finally:
            context.close()
            browser.close()

    proof = {
        "flow": "student login -> Today live Attempt -> learning history -> continue same Runner",
        "identity": {"studentId": student_id, "enrollmentId": enrollment_id, "schoolId": SCHOOL_ID},
        "practiceDefinitionId": practice_id,
        "authorizedPracticeDetailStatus": detail_response.status,
        "continuedAttemptId": attempt_id,
        "attemptState": "IN_PROGRESS",
        "sameIdAcrossTodayHistoryRunnerApiAndPostgreSQL": True,
        "apiAttempt": {"id": api_attempt["id"], "status": api_attempt["status"]},
        "postgresRow": sql_attempt[0],
        "browserErrors": page_errors,
        "screenshot": "screenshots/t042-history-attempt-resume-1280.png",
        "fixtureBoundary": "TEST_FIXTURE_ONLY; same isolated T042 runtime as the student Today and teacher roster E2Es",
    }
    (EVIDENCE / "t042-cross-module-student-proof.json").write_text(
        json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
