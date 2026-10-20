"""T065 native cross-role proof using an isolated TEST_FIXTURE_ONLY practice."""

from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T065_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T065_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T065_PASSWORD", "")
FIXTURE_FILE = Path(os.environ.get("YZ_T065_FIXTURE_MANIFEST", ""))
EVIDENCE_DIR = Path(os.environ.get("YZ_T065_EVIDENCE_DIR", ""))
PSQL = os.environ.get("YZ_T065_PSQL", "psql")
API_READY_STATUS = os.environ.get("YZ_T065_API_READY_STATUS", "NOT_CAPTURED")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
API = f"{BASE}/api/v1"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL or not PASSWORD or not FIXTURE_FILE.is_file(),
    reason="requires the isolated YZ-RD-T065 native Chrome/API/PostgreSQL/MinIO runtime",
)


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1" and parsed.port == 55765
    assert parsed.username == "yz_t065" and parsed.path.lstrip("/") == "yuzan_t065_native"
    password = unquote(parsed.password or "")
    assert password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    output = result.stdout.strip()
    return output if capture else ""


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def sql_scalar(statement: str) -> str:
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def api_login(request, identifier: str) -> dict:
    response = request.post(f"{API}/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, response.text()
    return payload(response)


def browser_session(page, session: dict) -> None:
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate(
        """value => {
          localStorage.setItem('yuzan-access-token', value.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(value.user));
          localStorage.setItem('yuzan-active-school-id', value.activeSchoolId);
        }""",
        session,
    )


def headers(session: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['accessToken']}"}


def test_t065_published_fixture_reaches_manual_review_and_same_attempt_report():
    fixture = json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))
    assert fixture["task"] == "YZ-RD-T065" and fixture["fixturePolicy"] == "TEST_FIXTURE_ONLY"
    assert fixture["actualEducationContent"] is False
    assert fixture["actualTibetanResource"] is False and fixture["classroomPublication"] is False
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "fixture-manifest.json").write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    versions = [entry["questionVersionId"] for entry in fixture["questionVersions"]]
    refs = fixture["practiceItemRefs"]
    assert len(versions) == len(refs) == 20
    assert [entry["questionVersionId"] for entry in refs] == versions
    relation_rows = sql_rows(
        f'''SELECT ref.id,ref."questionVersionId",qv.status::text,qv."publishedAt" IS NOT NULL
              FROM "PracticeItemRef" ref
              JOIN "QuestionBankItemVersion" qv ON qv.id=ref."questionVersionId"
             WHERE ref.id IN ({','.join(q(item['id']) for item in refs)}) ORDER BY ref."sortOrder";'''
    )
    assert relation_rows == [[ref["id"], version, "PUBLISHED", "t"] for ref, version in zip(refs, versions, strict=True)]

    page_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("CHROMIUM", "/usr/bin/google-chrome"),
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(type(error).__name__))
        try:
            anonymous = playwright.request.new_context()
            try:
                no_auth = anonymous.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews")
                assert no_auth.status == 401
            finally:
                anonymous.dispose()

            student = api_login(page.request, fixture["identities"]["student"]["loginIdentifier"])
            student_headers = headers(student)
            forbidden_queue = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=student_headers)
            assert forbidden_queue.status == 403
            browser_session(page, student)

            practice_id = fixture["practiceDefinitionId"]
            practice_detail = page.request.get(f"{API}/schools/{SCHOOL_ID}/practices/{practice_id}", headers=student_headers)
            assert practice_detail.ok, practice_detail.text()
            assert "TEST_FIXTURE_ONLY" in json.dumps(payload(practice_detail), ensure_ascii=False)
            page.goto(f"{BASE}/student/practices/{practice_id}/", wait_until="networkidle")
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            assert uuid.UUID(attempt_id)

            pre_submit = sql_rows(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)} AND "schoolId"={q(SCHOOL_ID)};
                    SELECT count(*)::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} AND "scoredScore" IS NULL;'''
            )
            assert pre_submit == [["IN_PROGRESS"], ["20"]], pre_submit
            snapshot_versions = sql_rows(
                f'''SELECT "questionVersionId", "scoredScore" IS NULL
                      FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} ORDER BY "sortOrder";'''
            )
            assert snapshot_versions == [[version, "t"] for version in versions], snapshot_versions

            attempt_items_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}/items",
                headers=student_headers,
            )
            assert attempt_items_response.ok, attempt_items_response.text()
            attempt_items_body = payload(attempt_items_response)
            attempt_items = attempt_items_body if isinstance(attempt_items_body, list) else attempt_items_body["items"]
            assert len(attempt_items) == 20
            for index, item in enumerate(attempt_items, start=1):
                if index > 1:
                    page.locator(f'[data-go="{index - 1}"]').click()
                    page.locator(f'[data-go="{index - 1}"].current').wait_for(timeout=10_000)
                answer = f"TEST_FIXTURE_ONLY T065 student response {index}"
                page.locator("[data-text]").fill(answer)
                answer_url = f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/items/{item['id']}/answer"
                saved_answer = page.request.put(
                    answer_url,
                    headers=student_headers,
                    data={"content": {"value": answer}, "wordCount": len(answer.split()), "charCount": len(answer)},
                )
                assert saved_answer.ok, saved_answer.text()
                finalized_answer = page.request.post(f"{answer_url}/finalize", headers=student_headers, data={})
                assert finalized_answer.ok, finalized_answer.text()
                if index < len(attempt_items):
                    page.locator("[data-next]").click()

            submit_url = f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/submit"
            submit_posts: list[str] = []
            page.on("request", lambda request: submit_posts.append(request.url) if request.method == "POST" and request.url == submit_url else None)
            page.locator("[data-submit]").click()
            submit_dialog = page.get_by_role("dialog")
            submit_dialog.wait_for(timeout=10_000)
            assert f"已完成 {len(attempt_items)} / {len(attempt_items)} 题" in submit_dialog.inner_text()
            submit_dialog.get_by_role("button", name="确认交卷").click()
            page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/processing/", timeout=60_000)
            assert len(submit_posts) == 1, submit_posts
            duplicate_submit = page.request.post(submit_url, headers=student_headers, data={})
            assert duplicate_submit.ok and payload(duplicate_submit)["id"] == attempt_id, duplicate_submit.text()
            submitted = sql_rows(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)};
                    SELECT count(*)::text FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};
                    SELECT count(*)::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} AND "scoredScore" IS NULL;'''
            )
            assert submitted == [["PROCESSING"], ["0"], ["20"]], submitted

            teacher_info = fixture["identities"]["teacher"]
            teacher = api_login(page.request, teacher_info["loginIdentifier"])
            teacher_headers = headers(teacher)
            queue_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=teacher_headers)
            assert queue_response.ok, queue_response.text()
            queue = [entry for entry in payload(queue_response)["items"] if entry["sessionId"] == attempt_id]
            assert len(queue) == 20, queue
            assert all(entry["strategy"] == "RUBRIC_TEXT" and entry["student"]["displayName"] == fixture["identities"]["student"]["displayName"] for entry in queue)
            queue_by_id = {entry["itemId"]: entry for entry in queue}
            attempt_item_ids = [row[0] for row in sql_rows(f'''SELECT id FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} ORDER BY "sortOrder";''')]
            assert len(attempt_item_ids) == 20

            other_class_teacher = api_login(page.request, fixture["identities"]["otherClassTeacher"]["loginIdentifier"])
            cross_class = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{attempt_item_ids[0]}",
                headers=headers(other_class_teacher),
            )
            foreign_teacher = api_login(page.request, fixture["identities"]["foreignTeacher"]["loginIdentifier"])
            cross_school = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{attempt_item_ids[0]}",
                headers=headers(foreign_teacher),
            )
            assert cross_class.status == cross_school.status == 403, (cross_class.status, cross_school.status)

            first_id = attempt_item_ids[0]
            first_detail = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{first_id}", headers=teacher_headers)
            assert first_detail.ok and payload(first_detail)["item"]["scoredScore"] is None
            assert "TEST_FIXTURE_ONLY" in json.dumps(payload(first_detail)["item"]["answer"], ensure_ascii=False)
            page_response = queue_by_id[first_id]
            assert page_response["maxScore"] == 4

            browser_session(page, teacher)
            page.goto(f"{BASE}/teacher/reviews/{first_id}", wait_until="networkidle")
            page.wait_for_url(f"**/teacher/reviews/{first_id}", timeout=20_000)
            page.locator("[data-review-score]").wait_for(state="visible", timeout=20_000)
            expect(page.locator("body")).to_contain_text("TEST_FIXTURE_ONLY")
            page.locator("[data-review-score]").fill("0")
            comment_zero = f"TEST_FIXTURE_ONLY T065 人工复核显式 0 分 {first_id[:8]}。"
            page.locator("[data-review-comment]").fill(comment_zero)
            page.locator("[data-review-submit]").click()
            page.get_by_text("服务器已保存正式得分 0 分").wait_for(timeout=20_000)
            zero_state = sql_rows(
                f'''SELECT "scoredScore"::text,status::text FROM "AssessmentItem" WHERE id={q(first_id)};
                    SELECT count(*)::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} AND "scoredScore" IS NULL;
                    SELECT count(*)::text FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};'''
            )
            assert zero_state == [["0", "REVIEWED"], ["19"], ["0"]], zero_state

            for item_id in attempt_item_ids[1:-1]:
                review = page.request.put(
                    f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{item_id}",
                    headers=teacher_headers,
                    data={"score": 3, "comment": f"TEST_FIXTURE_ONLY T065 人工复核 {item_id[:8]}。"},
                )
                assert review.ok, review.text()
            prefinal_state = sql_rows(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)};
                    SELECT count(*)::text FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};
                    SELECT count(*)::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} AND "scoredScore" IS NULL;'''
            )
            assert prefinal_state == [["PROCESSING"], ["0"], ["1"]], prefinal_state

            last_id = attempt_item_ids[-1]
            final_review = page.request.put(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{last_id}",
                headers=teacher_headers,
                data={"score": 3, "comment": f"TEST_FIXTURE_ONLY T065 人工复核最后一项 {last_id[:8]}。"},
            )
            assert final_review.ok, final_review.text()
            final_state = sql_rows(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)};
                    SELECT count(*)::text FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};
                    SELECT "scoredScore"::text,status::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)} ORDER BY "sortOrder";'''
            )
            assert final_state[:2] == [["COMPLETED"], ["1"]], final_state
            assert final_state[2:] == [["0", "REVIEWED"], *(["3", "REVIEWED"] for _ in range(19))], final_state
            report_row = sql_rows(
                f'''SELECT id,"sessionId","overallScore"::text FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};'''
            )
            assert len(report_row) == 1 and report_row[0][1] == attempt_id
            report_id = report_row[0][0]

            student_report = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report", headers=student_headers)
            assert student_report.ok, student_report.text()
            report_payload = payload(student_report)
            assert report_id in json.dumps(report_payload) and attempt_id in json.dumps(report_payload)
            other_student = api_login(page.request, fixture["identities"]["otherStudent"]["loginIdentifier"])
            other_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=headers(other_student),
            )
            assert other_report.status in (403, 404), other_report.status

            browser_session(page, student)
            page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            history_row = page.locator(f'[data-history-session="{attempt_id}"]')
            history_row.wait_for(timeout=20_000)
            history_link = history_row.get_by_role("link", name="查看正式报告")
            history_href = history_link.get_attribute("href")
            assert history_href and attempt_id in history_href
            history_link.click()
            page.wait_for_url(f"**{history_href}", timeout=20_000)
            page.locator("[data-report-teacher-feedback]").wait_for(timeout=20_000)
            expect(page.locator("body")).to_contain_text(comment_zero)
            assert not page_errors, page_errors

            proof = {
                "task": "YZ-RD-T065",
                "fixturePolicy": "TEST_FIXTURE_ONLY",
                "workflow": "student browser attempt with API-saved/finalized test answers and submit -> teacher review queue -> explicit zero and nonzero manual review -> server-generated AssessmentReport -> same student report",
                "database": "yuzan_t065_native@127.0.0.1:55765",
                "apiReadyStatus": API_READY_STATUS,
                "objectStorage": "NOT_RUN: local MinIO remained in filesystem page I/O wait and did not open its port; this written fixture makes no object-storage request",
                "databaseAndRedisRuntime": "PASS",
                "practiceDefinitionId": practice_id,
                "questionVersionIds": versions,
                "practiceItemRefs": refs,
                "attemptId": attempt_id,
                "assessmentItemIds": attempt_item_ids,
                "reportId": report_id,
                "reportSessionId": report_row[0][1],
                "reportOverallScore": report_row[0][2],
                "preSubmitStatus": "IN_PROGRESS",
                "postSubmitStatus": "PROCESSING",
                "postReviewStatus": "COMPLETED",
                "scoredScoreBeforeReview": None,
                "firstReviewedScore": 0,
                "secondReviewedScore": 3,
                "fullyReviewedItemCount": len(attempt_item_ids),
                "crossClassTeacherStatus": cross_class.status,
                "crossSchoolTeacherStatus": cross_school.status,
                "otherStudentReportStatus": other_report.status,
                "studentAnswersFinalizedViaAPI": len(attempt_items),
                "automaticScoring": "NOT_USED",
                "pageErrors": page_errors,
            }
            (EVIDENCE_DIR / "native-proof.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        finally:
            context.close()
            browser.close()
