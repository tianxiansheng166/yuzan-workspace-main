"""Native Chromium/API/PostgreSQL/Redis/MinIO evidence for YZ-RD-T030."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse, urlsplit

import pytest
from playwright.sync_api import expect, sync_playwright

import test_yz_rd_t008_student_history as t008
import test_yz_rd_t011_web_review_feedback as t011


BASE = os.environ.get("YZ_T030_BASE_URL", "")
API_BASE = os.environ.get("YZ_T030_API_BASE_URL", "")
API = f"{API_BASE}/api/v1" if API_BASE else ""
DATABASE_URL = os.environ.get("YZ_T030_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T030_PASSWORD", "")
DATABASE_NAME = os.environ.get("YZ_T030_DATABASE_NAME", "")
DATABASE_USER = os.environ.get("YZ_T030_DATABASE_USER", "")
DATABASE_PORT = int(os.environ.get("YZ_T030_POSTGRES_PORT", "0"))
S3_BUCKET = os.environ.get("YZ_T030_S3_BUCKET", "")
S3_ENDPOINT = os.environ.get("YZ_T030_S3_ENDPOINT", "")
S3_REGION = os.environ.get("YZ_T030_S3_REGION", "")
S3_ACCESS_KEY = os.environ.get("YZ_T030_S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("YZ_T030_S3_SECRET_KEY", "")
API_PACKAGE = os.environ.get("YZ_T030_API_PACKAGE", "")
PSQL = os.environ.get("YZ_T030_PSQL", "")
PG_LIBRARY = os.environ.get("YZ_T030_PG_LIBRARY", "")
CHROME = os.environ.get("YZ_T030_CHROMIUM", "/usr/bin/google-chrome")
EVIDENCE = Path(os.environ.get("YZ_T030_EVIDENCE_DIR", "/tmp/yz-rd-t030-native-e2e"))
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
REMEDIATION_RETRY_PATH = re.compile(r"/student/practices/attempts/([^/]+)/runner/$")

pytestmark = pytest.mark.skipif(
    not BASE or not API or not DATABASE_URL or not PASSWORD or not PSQL,
    reason="requires the isolated YZ-RD-T030 native API/PostgreSQL/MinIO/Chromium runtime",
)


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == DATABASE_PORT
    assert unquote(parsed.username or "") == DATABASE_USER
    assert unquote(parsed.path.lstrip("/")) == DATABASE_NAME
    password = unquote(parsed.password or "")
    assert password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": DATABASE_USER,
        "PGPASSWORD": password,
        "PGDATABASE": DATABASE_NAME,
        "LD_LIBRARY_PATH": ":".join(filter(None, [PG_LIBRARY, os.environ.get("LD_LIBRARY_PATH", "")])),
    }
    import subprocess

    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    return result.stdout.strip() if capture else ""


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def verify_resource_identity() -> None:
    result = sql("SELECT current_database() || '|' || current_user || '|' || version();", capture=True)
    assert result.startswith(f"{DATABASE_NAME}|{DATABASE_USER}|PostgreSQL 17."), result.split("|", 2)[:2]
    assert os.environ.get("YZ_T030_S3_BUCKET") == S3_BUCKET == "yz-t030-native"
    assert urlparse(S3_ENDPOINT).hostname == "127.0.0.1"


def create_cross_school_student(foreign_school: dict[str, str]) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:10]
    values = {
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"student.t030.foreign.{suffix}@test.invalid",
        "name": f"TEST_FIXTURE_ONLY T030 外校学生 {suffix}",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(values['user'])},{q(values['login'])},{q(values['name'])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(t011.STUDENT_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(values['membership'])},{q(foreign_school['school'])},{q(values['user'])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(values['enrollment'])},{q(foreign_school['school'])},{q(foreign_school['class'])},{q(values['user'])},'STUDENT','ACTIVE',NOW());
        COMMIT;'''
    )
    return values


def create_course_submission_feedback(page, fixtures, student_session, teacher_session) -> dict[str, str]:
    """Create a real Assignment and Submission; publish Feedback through the authorized API.

    This isolated course fixture advances the Submission to NEEDS_REVIEW in SQL
    because this slice does not start a course speech worker. The Feedback row
    itself is created by the authenticated teacher API and remains linked to the
    actual Submission and Assignment.
    """
    t011.ensure_test_course()
    now = datetime.now(timezone.utc)
    starts_at = (now - timedelta(minutes=5)).isoformat()
    due_at = (now + timedelta(days=7)).isoformat()
    assignment_response = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments",
        headers=headers(teacher_session),
        data={
            "title": f"TEST_FIXTURE_ONLY T030 课程任务反馈 {uuid.uuid4().hex[:8]}",
            "courseVersionId": t011.COURSE_VERSION_ID,
            "startsAt": starts_at,
            "dueAt": due_at,
            "targets": [{"targetType": "CLASS", "classId": CLASS_ID}],
        },
    )
    assert assignment_response.status in (200, 201), assignment_response.text()
    assignment = payload(assignment_response)
    assignment_id = assignment["id"]
    scheduled = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments/{assignment_id}/schedule",
        headers=headers(teacher_session),
        data={"expectedRevision": assignment["revision"]},
    )
    assert scheduled.ok, scheduled.text()
    opened = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments/{assignment_id}/open",
        headers=headers(teacher_session),
        data={"expectedRevision": payload(scheduled)["revision"]},
    )
    assert opened.ok and payload(opened)["status"] == "OPEN", opened.text()

    submission_response = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/student/courses/{assignment_id}/submissions",
        headers=headers(student_session),
        data={},
    )
    assert submission_response.status in (200, 201), submission_response.text()
    submission = payload(submission_response)["submission"]
    submission_id = submission["id"]
    sql(
        f'''UPDATE "Submission" SET status='NEEDS_REVIEW', "submittedAt"=NOW(), revision=revision+1
             WHERE id={q(submission_id)} AND "schoolId"={q(SCHOOL_ID)} AND "enrollmentId"={q(fixtures['student_a']['enrollment'])};'''
    )
    assert sql(
        f'''SELECT status::text FROM "Submission" WHERE id={q(submission_id)};''', capture=True
    ) == "NEEDS_REVIEW"

    feedback_comment = "TEST_FIXTURE_ONLY 课程任务反馈：请朗读后再核对停顿。"
    feedback_response = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/submissions/{submission_id}/feedback",
        headers=headers(teacher_session),
        data={"decision": "RETURN", "comment": feedback_comment},
    )
    assert feedback_response.status in (200, 201), feedback_response.text()
    feedback = payload(feedback_response)
    assert feedback["submissionId"] == submission_id
    assert feedback["authorUserId"] == teacher_session["user"]["id"]
    assert feedback["releasedAt"]
    feedback_sql = sql_rows(
        f'''SELECT f.id,f."submissionId",f."authorUserId",f.decision::text,f."releasedAt"::text,
                   s."assignmentId",s."enrollmentId",s.status::text,a."schoolId",a.status::text
              FROM "Feedback" f JOIN "Submission" s ON s.id=f."submissionId" AND s."schoolId"=f."schoolId"
              JOIN "Assignment" a ON a.id=s."assignmentId" AND a."schoolId"=s."schoolId"
             WHERE f.id={q(feedback['id'])};'''
    )
    assert len(feedback_sql) == 1
    assert feedback_sql[0][0] == feedback["id"] and feedback_sql[0][1] == submission_id
    assert feedback_sql[0][5] == assignment_id and feedback_sql[0][6] == fixtures["student_a"]["enrollment"]
    assert feedback_sql[0][8:] == [SCHOOL_ID, "OPEN"]
    return {
        "assignmentId": assignment_id,
        "submissionId": submission_id,
        "feedbackId": feedback["id"],
        "feedbackComment": feedback_comment,
        "releasedAt": feedback["releasedAt"],
        "feedbackSQL": feedback_sql[0],
        "submissionReviewState": "NEEDS_REVIEW (isolated SQL fixture transition)",
    }


def assert_no_horizontal_overflow(page, width: int) -> dict[str, int]:
    dimensions = page.evaluate(
        """() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })"""
    )
    assert max(dimensions["document"], dimensions["body"]) <= dimensions["viewport"] + 1, {"width": width, **dimensions}
    return dimensions


def complete_zero_score_attempt(page, student_headers, attempt_id: str) -> dict[str, int]:
    """Submit deliberately wrong answers through the real Runner, without exposing answer keys."""
    items_response = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}/items",
        headers=student_headers,
    )
    assert items_response.ok, items_response.text()
    body = payload(items_response)
    items = body if isinstance(body, list) else body["items"]
    assert items
    item_ids = [item["id"] for item in items if item.get("id")]
    if item_ids:
        item_list = ",".join(q(item_id) for item_id in item_ids)
        answer_rows = sql_rows(
            f'''SELECT ai.id,qv."scoringSpec"->>'referenceAnswer'
                  FROM "AssessmentItem" ai JOIN "QuestionBankItemVersion" qv ON qv.id=ai."questionVersionId"
                 WHERE ai.id IN ({item_list}) AND qv."scoringSpec"->>'strategy'='EXACT_CHOICE';'''
        )
        private_reference_answers = {row[0]: (row[1] or "").strip().upper() for row in answer_rows}
    else:
        private_reference_answers = {}

    counts = {"itemCount": len(items), "choiceCount": 0, "textCount": 0, "recordedAudio": 0}
    for index, item in enumerate(items):
        if index:
            page.locator(f'[data-go="{index}"]').click()
            page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)
        spec = t008.response_spec(item)
        response = spec.get("response") or {}
        response_type = response.get("type")
        if response_type == "CHOICE":
            expected = private_reference_answers.get(item.get("id"), "")
            options = response.get("options") or []
            wrong_index = next(
                (option_index for option_index, option in enumerate(options)
                 if str(option.get("value") if option.get("value") is not None else option.get("key", "")).strip().upper() != expected),
                None,
            )
            assert expected and wrong_index is not None, "test must select an authored incorrect choice"
            page.locator("[data-choice]").nth(wrong_index).click()
            page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)
            counts["choiceCount"] += 1
        elif response_type == "TEXT":
            page.locator("[data-text]").fill("学生本人练习回答")
            page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)
            counts["textCount"] += 1
        elif response_type == "SPEECH":
            if not page.locator(".runner-speech.saved").count():
                page.locator("[data-start-recording]").click()
                page.locator("[data-stop-recording]").wait_for(timeout=10_000)
                page.wait_for_timeout(1_100)
                page.locator("[data-stop-recording]").click()
                page.locator("[data-upload-recording]").wait_for(timeout=10_000)
                page.locator("[data-upload-recording]").click()
                page.locator(".runner-speech.saved").wait_for(timeout=30_000)
                counts["recordedAudio"] += 1
        else:
            raise AssertionError(f"unsupported Runner response type for zero-score proof: {response_type}")
        if index < len(items) - 1:
            page.locator("[data-next]").click()

    page.locator("[data-submit]").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(timeout=10_000)
    assert f"已完成 {len(items)} / {len(items)} 题" in dialog.inner_text()
    dialog.get_by_role("button", name="确认交卷").click()
    page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/processing/", timeout=60_000)
    return counts


@pytest.mark.skipif(not BASE or not API or not DATABASE_URL or not PASSWORD or not S3_BUCKET, reason="requires isolated T030 native runtime")
def test_growth_feedback_remediation_recovery_and_identity_isolation():
    verify_resource_identity()
    fixtures = t011.create_review_student_fixture()
    for key, label in (("student_a", "甲"), ("student_b", "乙")):
        fixtures[key]["name"] = f"TEST_FIXTURE_ONLY T030 学生{label} {uuid.uuid4().hex[:8]}"
        sql(
            f'''UPDATE "User" SET "displayName"={q(fixtures[key]['name'])},"updatedAt"=NOW()
                 WHERE id={q(fixtures[key]['user'])};'''
        )
    student_c = create_cross_school_student(fixtures["foreign_teacher"])
    EVIDENCE.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["microphone"])
        page = context.new_page()
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        try:
            anonymous = playwright.request.new_context()
            try:
                no_auth = anonymous.get(f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{uuid.uuid4()}/report")
                assert no_auth.status == 401
            finally:
                anonymous.dispose()

            teacher_session = t011.login_api(page, "teacher.test")
            student_session = t011.authenticate(page, fixtures["student_a"]["login"])
            student_headers = headers(student_session)
            course_feedback = create_course_submission_feedback(page, fixtures, student_session, teacher_session)

            # The Student A attempt is created by the existing open practice flow.
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            practice = t008.practice_in_catalog(page, student_headers, base_url=BASE)
            practice_id = practice["id"]
            assert practice["title"] == t008.PRACTICE_TITLE
            page.locator(".practice-tile").filter(has_text=t008.PRACTICE_TITLE).locator("h2 a").click()
            page.wait_for_url(f"**/student/practices/{practice_id}/", timeout=20_000)
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            source_session_id = page.url.split("/attempts/")[1].split("/")[0]
            completion = t008.complete_real_attempt(page, student_headers, source_session_id, base_url=BASE)
            assert completion["itemCount"] == 20
            assert completion["recordedAudio"] >= 1
            assert completion["uploadRetries"] == completion["recordedAudio"]

            source_sql = sql_rows(
                f'''SELECT s.id,s."schoolId",s."enrollmentId",s."classId",s."purpose"::text,s.status::text,
                           s."practiceDefinitionId",s."practiceVersionId",s."deliveryId",s."completedAt"::text
                      FROM "AssessmentSession" s WHERE s.id={q(source_session_id)};'''
            )
            assert len(source_sql) == 1 and source_sql[0][4:6] == ["STANDARD", "PROCESSING"], source_sql
            recording_rows = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r.status::text,r."mimeType"
                      FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                     WHERE i."sessionId"={q(source_session_id)} ORDER BY i."sortOrder";'''
            )
            assert len(recording_rows) == completion["recordedAudio"]
            source_recordings = []
            for item_id, recording_id, object_key, state, mime_type in recording_rows:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert mime_type.startswith("audio/") and state in {"READY", "PROCESSING", "COMPLETE"}
                head = t011.minio_head_object(object_key)
                assert int(head["bytes"]) > 0 and head["contentType"].startswith("audio/")
                source_recordings.append({"recordingId": recording_id, "objectKey": object_key, "bytes": int(head["bytes"])})
            assert sql(
                f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"={q(source_session_id)};''', capture=True
            ) == "0"

            # A real submitted record with no AssessmentReport stays PROCESSING and has no score.
            page.goto(f"{BASE}/student/growth/", wait_until="networkidle")
            page.locator("#growthApp[data-state='ready']").wait_for(timeout=30_000)
            assert page.locator(".growth-report-row").count() == 0
            assert "暂无正式得分" not in page.locator("#growthApp").inner_text()
            assert source_session_id not in page.locator("#growthApp").inner_text()
            page.screenshot(path=str(EVIDENCE / "growth-processing-without-report-1440.png"), full_page=True)

            # Teacher A saves each necessary manual review through the authorized review API.
            teacher_headers = headers(teacher_session)
            queue_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=teacher_headers)
            assert queue_response.ok, queue_response.text()
            matching_queue = [entry for entry in payload(queue_response)["items"]
                if entry["practice"]["title"] == t008.PRACTICE_TITLE
                and entry["student"]["displayName"] == fixtures["student_a"]["name"]]
            assert matching_queue and any(entry["strategy"] == "SPEECH_READING" for entry in matching_queue)
            review_item_ids = [entry["itemId"] for entry in matching_queue]
            comments = {}
            for index, entry in enumerate(matching_queue):
                comment = f"TEST_FIXTURE_ONLY T030 教师复核 {index + 1}：朗读清楚，请继续练习自然停顿。"
                review_response = page.request.put(
                    f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{entry['itemId']}",
                    headers=teacher_headers,
                    data={"score": float(entry["maxScore"]) - 1, "comment": comment},
                )
                assert review_response.status == 200, review_response.text()
                comments[entry["itemId"]] = comment
            report_row = sql_rows(
                f'''SELECT r.id,r."overallScore"::text,r."dataCompleteness"::text,s.status::text,s.purpose::text,s."completedAt"::text
                      FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId"
                     WHERE r."sessionId"={q(source_session_id)};'''
            )
            assert len(report_row) == 1 and report_row[0][2:] and report_row[0][3] == "COMPLETED" and report_row[0][4] == "STANDARD", report_row
            report_id = report_row[0][0]
            source_final_sql = sql_rows(
                f'''SELECT id,"schoolId","enrollmentId","classId",purpose::text,status::text,
                           "practiceDefinitionId","practiceVersionId","deliveryId","completedAt"::text
                      FROM "AssessmentSession" WHERE id={q(source_session_id)};'''
            )
            assessment_report_sql = sql_rows(
                f'''SELECT id,"sessionId","schoolId","overallScore"::text,"dataCompleteness"::text,"generatedAt"::text
                      FROM "AssessmentReport" WHERE id={q(report_id)};'''
            )
            manual_reviews_sql = sql_rows(
                f'''SELECT id,"scoredScore"::text,"reviewerUserId","reviewerComment","reviewedAt"::text
                      FROM "AssessmentItem" WHERE "sessionId"={q(source_session_id)} AND "reviewerComment" IS NOT NULL
                     ORDER BY "sortOrder";'''
            )
            course_feedback_count = sql(
                f'''SELECT count(*) FROM "Feedback" WHERE "submissionId"={q(course_feedback['submissionId'])};''', capture=True
            )
            assert len(source_final_sql) == 1 and source_final_sql[0][5] == "COMPLETED"
            assert len(assessment_report_sql) == 1
            assert assessment_report_sql[0][0:3] == [report_id, source_session_id, SCHOOL_ID]
            assert assessment_report_sql[0][4] == "100"
            assert {row[0] for row in manual_reviews_sql} == set(review_item_ids)
            assert len(manual_reviews_sql) == 6 and course_feedback_count == "1"
            assert all(row[2] == t011.TEACHER_SEED_ID and row[3] in comments.values() and row[4] for row in manual_reviews_sql)
            report_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{source_session_id}/report",
                headers=student_headers,
            )
            assert report_response.ok, report_response.text()
            report = payload(report_response)
            assert report["id"] == report_id and report["sessionId"] == source_session_id and report["dataCompleteness"] == 100
            assert report["generatedAt"] and report["teacherFeedback"]
            assert {item["comment"] for item in report["teacherFeedback"]} == set(comments.values())
            retry_candidates = report.get("diagnosis", {}).get("retryCandidates", [])
            assert retry_candidates and all(candidate.get("questionVersionId") for candidate in retry_candidates)
            assert not any(key in json.dumps(report) for key in ("reviewerUserId", "rubric", "answerKey", "scoringSpec"))

            # A second real Session answers every deterministic question incorrectly;
            # teacher review assigns zero through the authorized review endpoint.
            zero_attempt_response = page.request.post(
                f"{API}/schools/{SCHOOL_ID}/practices/{practice_id}/attempts",
                headers=student_headers,
                data={},
            )
            assert zero_attempt_response.status in (200, 201), zero_attempt_response.text()
            zero_attempt_id = payload(zero_attempt_response)["attemptId"]
            zero_start = page.request.post(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{zero_attempt_id}/start",
                headers=student_headers,
            )
            assert zero_start.ok, zero_start.text()
            page.goto(f"{BASE}/student/practices/attempts/{zero_attempt_id}/runner/", wait_until="networkidle")
            page.locator(".question-shell").wait_for(timeout=20_000)
            zero_completion = complete_zero_score_attempt(page, student_headers, zero_attempt_id)
            assert zero_completion["itemCount"] == 20
            zero_queue_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=teacher_headers)
            assert zero_queue_response.ok, zero_queue_response.text()
            zero_review_items = [entry for entry in payload(zero_queue_response)["items"] if entry["sessionId"] == zero_attempt_id]
            assert zero_review_items, "the zero-score attempt must have manual-review items"
            zero_review_results = []
            for index, entry in enumerate(zero_review_items):
                review_response = page.request.put(
                    f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{entry['itemId']}",
                    headers=teacher_headers,
                    data={"score": 0, "comment": f"TEST_FIXTURE_ONLY T030 复核确认 {index + 1}"},
                )
                assert review_response.status == 200, review_response.text()
                review_result = payload(review_response)
                zero_review_results.append({"itemId": entry["itemId"], "requestedScore": 0, "returnedScore": review_result["item"]["scoredScore"]})
                assert review_result["item"]["scoredScore"] == 0, zero_review_results[-1]
            zero_report_sql = sql_rows(
                f'''SELECT r.id,r."sessionId",r."overallScore"::text,r."dataCompleteness"::text,
                           s.status::text,s.purpose::text,s."completedAt"::text
                      FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId"
                     WHERE r."sessionId"={q(zero_attempt_id)};'''
            )
            zero_session_state = sql_rows(
                f'''SELECT id,status::text,purpose::text,"completedAt"::text
                      FROM "AssessmentSession" WHERE id={q(zero_attempt_id)};'''
            )
            zero_scoring_state = sql_rows(
                f'''SELECT i."itemType",COALESCE(qv."scoringSpec"->>'strategy','NO_QUESTION_VERSION'),count(*),
                           count(i."scoredScore"),count(*) FILTER (WHERE i."scoredScore" IS NULL)
                      FROM "AssessmentItem" i LEFT JOIN "QuestionBankItemVersion" qv ON qv.id=i."questionVersionId"
                     WHERE i."sessionId"={q(zero_attempt_id)} GROUP BY i."itemType",qv."scoringSpec"->>'strategy'
                     ORDER BY i."itemType",qv."scoringSpec"->>'strategy';'''
            )
            print("T030_ZERO_SCORE_DIAGNOSTIC", json.dumps({
                "sessionId": zero_attempt_id,
                "reviewQueueItems": len(zero_review_items),
                "manualScores": zero_review_results,
                "session": zero_session_state,
                "scoring": zero_scoring_state,
                "reportRows": zero_report_sql,
            }, ensure_ascii=False))
            assert len(zero_report_sql) == 1 and zero_report_sql[0][2:6] == ["0", "100", "COMPLETED", "STANDARD"], zero_report_sql
            zero_item_scores = sql_rows(
                f'''SELECT count(*),count(*) FILTER (WHERE "scoredScore"=0),count(*) FILTER (WHERE "scoredScore" IS NULL)
                      FROM "AssessmentItem" WHERE "sessionId"={q(zero_attempt_id)};'''
            )
            assert zero_item_scores == [["20", "20", "0"]], zero_item_scores
            zero_report_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{zero_attempt_id}/report",
                headers=student_headers,
            )
            assert zero_report_response.ok and payload(zero_report_response)["overallScore"] == 0

            # Growth presents formal AssessmentReport feedback separately from released Submission Feedback.
            page.goto(f"{BASE}/student/growth/", wait_until="networkidle")
            page.locator("#growthApp[data-state='ready']").wait_for(timeout=30_000)
            row = page.locator(f'.growth-report-row a[href="/assessment/sessions/{source_session_id}/report/"]').locator("xpath=..")
            row.wait_for(timeout=20_000)
            zero_row = page.locator(f'.growth-report-row a[href="/assessment/sessions/{zero_attempt_id}/report/"]').locator("xpath=..")
            zero_row.wait_for(timeout=20_000)
            expect(zero_row).to_contain_text("0 分")
            expect(row.get_by_role("link", name="查看正式报告")).to_be_visible()
            assert re.search(r"\b\d+(?:\.\d+)? 分", row.inner_text())
            assert page.get_by_text("趋势记录还不够", exact=True).count() == 1
            assert page.locator(".growth-chart-wrap").count() == 0
            for comment in comments.values():
                expect(row.locator(".growth-report-feedback")).to_contain_text(comment)
            expect(row.locator(".growth-source-reference")).to_contain_text(f"AssessmentReport {report_id}")
            expect(row.locator(".growth-source-reference")).to_contain_text(f"AssessmentSession {source_session_id}")
            assignment_feedback_card = page.locator(".growth-feedback-card")
            expect(assignment_feedback_card).to_contain_text("课程任务教师反馈")
            expect(assignment_feedback_card).to_contain_text("课程任务 · 已发布")
            expect(assignment_feedback_card).to_contain_text(course_feedback["feedbackComment"])
            expect(assignment_feedback_card.locator(".growth-source-reference")).to_contain_text(f"Feedback {course_feedback['feedbackId']}")
            assert course_feedback["feedbackComment"] not in row.inner_text()
            assert not re.search(r"data-remediation-status=", assignment_feedback_card.inner_html())
            expect(row).to_contain_text("不代表某项开放练习与报告存在系统关联")
            open_practices_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices?sort=RECOMMENDED",
                headers=student_headers,
            )
            assert open_practices_response.ok, open_practices_response.text()
            open_practice_ids = {item["id"] for item in payload(open_practices_response)["items"]}
            growth_practice_cards = page.locator(".growth-practice-row")
            assert growth_practice_cards.count() > 0
            assert all(card.get_attribute("data-practice-definition-id") in open_practice_ids for card in growth_practice_cards.all())

            event_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessments/history/events", headers=student_headers)
            assert event_response.ok, event_response.text()
            course_events = [event for event in payload(event_response)["events"] if event["type"] == "FEEDBACK"]
            assert len(course_events) == 1
            course_event = next(event for event in course_events if event["id"] == course_feedback["feedbackId"])
            assert course_event["type"] == "FEEDBACK" and course_event["description"] == course_feedback["feedbackComment"]
            assert course_event["timestamp"] == course_feedback["releasedAt"]

            EVIDENCE.mkdir(parents=True, exist_ok=True)
            responsive = {}
            for width, height in ((390, 844), (768, 1024), (1280, 900), (1440, 1000)):
                page.set_viewport_size({"width": width, "height": height})
                responsive[str(width)] = assert_no_horizontal_overflow(page, width)
                page.screenshot(path=str(EVIDENCE / f"growth-formal-{width}.png"), full_page=True)
            page.emulate_media(reduced_motion="reduce")
            assert page.locator("[data-growth-remediation]").count() == 2
            assert row.locator("[data-growth-remediation]").count() == 1
            assert zero_row.locator("[data-growth-remediation]").count() == 1
            source_summary = row.locator(".growth-source-reference summary")
            source_summary.focus()
            page.keyboard.press("Enter")
            assert row.locator(".growth-source-reference[open]").count() == 1

            # A confirmed database write with a dropped browser response exercises GET recovery.
            remediation_path = f"**/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{source_session_id}/remediation"
            lost_response = {"posts": 0, "body": None, "status": None}
            recovery_gets = []

            def record_session_get(request):
                if request.method == "GET" and f"/api/v1/schools/{SCHOOL_ID}/assessments/sessions" in request.url:
                    recovery_gets.append(request.url)

            recovery_request_start = len(recovery_gets)
            page.on("request", record_session_get)

            def commit_then_drop(route):
                if route.request.method != "POST":
                    route.continue_()
                    return
                lost_response["posts"] += 1
                server_response = route.fetch()
                lost_response["status"] = server_response.status
                lost_response["body"] = payload(server_response)
                route.abort("internetdisconnected")

            page.route(remediation_path, commit_then_drop)
            start_button = row.get_by_role("button", name="针对本次报告继续巩固")
            start_button.focus()
            page.keyboard.press("Enter")
            start_button.evaluate("button => button.click()")
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=45_000)
            page.unroute(remediation_path, commit_then_drop)
            assert lost_response["posts"] == 1 and lost_response["status"] == 201, lost_response
            creation = lost_response["body"]
            assert creation["outcome"] in {"CREATED", "RESUMED"}
            assert creation["sourceSessionId"] == source_session_id
            remediation_id = creation["attemptId"]
            match = REMEDIATION_RETRY_PATH.search(urlparse(page.url).path)
            assert match and match.group(1) == remediation_id, page.url
            page.locator(".question-shell").wait_for(timeout=20_000)
            recovery_requests = recovery_gets[recovery_request_start:]
            assert any(urlsplit(url).path == f"/api/v1/schools/{SCHOOL_ID}/assessments/sessions" for url in recovery_requests), recovery_requests
            assert any(urlsplit(url).path.endswith(f"/assessments/sessions/{remediation_id}") for url in recovery_requests), recovery_requests
            detail_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{remediation_id}", headers=student_headers
            )
            assert detail_response.ok, detail_response.text()
            remediation_detail = payload(detail_response)
            assert remediation_detail["id"] == remediation_id
            assert remediation_detail["purpose"] == "REMEDIATION"
            assert remediation_detail["retestOfSessionId"] == source_session_id
            assert remediation_detail["schoolId"] == SCHOOL_ID
            assert creation["itemCount"] == len(retry_candidates)

            source_report_ids = {candidate["questionVersionId"] for candidate in retry_candidates}
            remediation_sql = sql_rows(
                f'''SELECT id,"schoolId","enrollmentId","classId",purpose::text,status::text,"retestOfSessionId",
                           "initiatorUserId","practiceDefinitionId","practiceVersionId","deliveryId"
                      FROM "AssessmentSession" WHERE id={q(remediation_id)};'''
            )
            assert len(remediation_sql) == 1
            assert remediation_sql[0][1] == SCHOOL_ID
            assert remediation_sql[0][2] == fixtures["student_a"]["enrollment"]
            assert remediation_sql[0][3] == CLASS_ID
            assert remediation_sql[0][4] == "REMEDIATION"
            assert remediation_sql[0][6] == source_session_id
            assert remediation_sql[0][7] == fixtures["student_a"]["user"]
            assert remediation_sql[0][8:11] == source_sql[0][6:9]
            related_count = sql(
                f'''SELECT count(*) FROM "AssessmentSession" WHERE "schoolId"={q(SCHOOL_ID)}
                     AND "enrollmentId"={q(fixtures['student_a']['enrollment'])} AND purpose='REMEDIATION'
                     AND "retestOfSessionId"={q(source_session_id)};''', capture=True
            )
            assert related_count == "1", related_count
            qv_rows = sql_rows(
                f'''SELECT "questionVersionId" FROM "AssessmentItem" WHERE "sessionId"={q(remediation_id)} ORDER BY "sortOrder";'''
            )
            assert {row[0] for row in qv_rows} == source_report_ids

            # Complete/save the real subset Runner, then return to Growth and read its persisted state.
            remediation_completion = t008.complete_real_attempt(
                page,
                student_headers,
                remediation_id,
                base_url=BASE,
                exercise_upload_retry=False,
            )
            assert remediation_completion["itemCount"] == creation["itemCount"]
            page.wait_for_url(f"**/student/practices/attempts/{remediation_id}/processing/", timeout=60_000)
            page.reload(wait_until="networkidle")
            page.wait_for_url(f"**/student/practices/attempts/{remediation_id}/processing/", timeout=20_000)
            assert "PROCESSING" in page.locator(".processing-meta").inner_text()
            remediation_recording_rows = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r.status::text,r."mimeType"
                      FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                     WHERE i."sessionId"={q(remediation_id)} ORDER BY i."sortOrder";'''
            )
            remediation_recordings = []
            for item_id, recording_id, object_key, state, mime_type in remediation_recording_rows:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert mime_type.startswith("audio/") and state in {"READY", "PROCESSING", "COMPLETE"}
                head = t011.minio_head_object(object_key)
                assert int(head["bytes"]) > 0 and head["contentType"].startswith("audio/")
                remediation_recordings.append({"itemId": item_id, "recordingId": recording_id, "objectKey": object_key, "bytes": int(head["bytes"])})
            page.goto(f"{BASE}/student/growth/", wait_until="networkidle")
            page.locator("#growthApp[data-state='ready']").wait_for(timeout=30_000)
            growth_report_row = page.locator(f'.growth-report-row a[href="/assessment/sessions/{source_session_id}/report/"]').locator("xpath=..")
            growth_report_row.wait_for(timeout=20_000)
            expect(growth_report_row).to_contain_text("已有一项巩固练习正在处理")
            expect(growth_report_row.get_by_role("button", name="查看处理状态")).to_be_visible()
            page.screenshot(path=str(EVIDENCE / "growth-remediation-processing-1440.png"), full_page=True)
            current_attempt_row = page.locator(".growth-attempt-row").filter(has_text=remediation_id)
            assert current_attempt_row.count() == 0  # dynamic IDs are kept in routes, not leaked into copy
            current_route = growth_report_row.get_by_role("button", name="查看处理状态")
            current_route.click()
            page.wait_for_url(f"**/student/practices/attempts/{remediation_id}/processing/", timeout=30_000)
            page.goto(f"{BASE}/student/growth/", wait_until="networkidle")
            assert sql(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(remediation_id)};''', capture=True
            ) in {"PROCESSING", "SUBMITTED"}
            assert sql(
                f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"={q(remediation_id)};''', capture=True
            ) == "0"
            result_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{remediation_id}/remediation-result",
                headers=student_headers,
            )
            assert result_response.ok, result_response.text()
            remediation_result = payload(result_response)
            assert remediation_result["sourceSessionId"] == source_session_id
            assert remediation_result["status"] in {"SUBMITTED", "PROCESSING"}
            assert remediation_result["pendingItemCount"] > 0

            # Negative authorization/status cases use the real API and isolated students.
            student_b = t011.login_api(page, fixtures["student_b"]["login"])
            foreign_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{source_session_id}/report",
                headers=headers(student_b),
            )
            assert foreign_report.status in (403, 404)
            foreign_remediation_create = page.request.post(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{source_session_id}/remediation",
                headers=headers(student_b),
                data={},
            )
            assert foreign_remediation_create.status == 403, foreign_remediation_create.text()
            foreign_history = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/history?enrollmentId={fixtures['student_a']['enrollment']}",
                headers=headers(student_b),
            )
            assert foreign_history.status == 403
            student_c_session = t011.login_api(page, student_c["login"])
            cross_school_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{source_session_id}/report",
                headers=headers(student_c_session),
            )
            assert cross_school_report.status in (403, 404)
            missing_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{uuid.uuid4()}/report",
                headers=student_headers,
            )
            assert missing_report.status == 404

            ineligible = page.request.post(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions",
                headers=teacher_headers,
                data={"enrollmentId": fixtures["student_a"]["enrollment"], "classId": CLASS_ID, "type": "MIXED"},
            )
            assert ineligible.status in (200, 201), ineligible.text()
            ineligible_id = payload(ineligible)["id"]
            conflict = page.request.post(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{ineligible_id}/remediation",
                headers=student_headers,
                data={},
            )
            assert conflict.status == 409, conflict.text()
            assert sql(
                f'''SELECT count(*) FROM "AssessmentSession" WHERE purpose='REMEDIATION' AND "retestOfSessionId"={q(ineligible_id)};''', capture=True
            ) == "0"

            # Switch the same tab from Student A to Student B and discard a delayed response from school A.
            t011.authenticate(page, fixtures["student_b"]["login"])
            page.goto(f"{BASE}/student/growth/", wait_until="networkidle")
            page.locator("#growthApp").wait_for(timeout=20_000)
            assert fixtures["student_b"]["name"] in page.locator("#growthApp").inner_text()
            assert comments[next(iter(comments))] not in page.locator("#growthApp").inner_text()
            assert course_feedback["feedbackComment"] not in page.locator("#growthApp").inner_text()

            t011.authenticate(page, fixtures["student_a"]["login"])
            page.add_init_script("""(() => {
              const nativeFetch = window.fetch.bind(window);
              window.fetch = async (...args) => {
                const input = args[0];
                const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
                const isGrowthHistory = requestUrl.pathname.endsWith('/assessments/history')
                  && requestUrl.searchParams.get('range') === 'all'
                  && !window.__t030OldHistoryHeld;
                if (!isGrowthHistory) return nativeFetch(...args);
                window.__t030OldHistoryHeld = true;
                window.__t030OldHistoryRequested = true;
                await new Promise(resolve => { window.__t030ReleaseOldHistory = resolve; });
                const response = await nativeFetch(...args);
                window.__t030OldHistoryReturned = true;
                return response;
              };
            })();""")
            page.goto(f"{BASE}/student/growth/", wait_until="domcontentloaded")
            page.wait_for_function("window.__t030OldHistoryRequested === true", timeout=20_000)
            page.evaluate(
                """schoolId => {
                  localStorage.setItem('yuzan-active-school-id', schoolId);
                  window.dispatchEvent(new StorageEvent('storage', { key: 'yuzan-active-school-id' }));
                }""",
                fixtures["foreign_teacher"]["school"],
            )
            page.locator("#growthApp[data-state='error']").wait_for(timeout=20_000)
            assert page.get_by_role("alert").count() == 1
            page.evaluate("window.__t030ReleaseOldHistory()")
            page.wait_for_function("window.__t030OldHistoryReturned === true", timeout=20_000)
            page.wait_for_timeout(250)
            assert fixtures["student_a"]["name"] not in page.locator("#growthApp").inner_text()
            assert comments[next(iter(comments))] not in page.locator("#growthApp").inner_text()
            assert page.locator("#growthApp[data-state='error']").count() == 1
            page.screenshot(path=str(EVIDENCE / "school-switch-stale-response-discarded.png"), full_page=True)

            evidence = {
                "sourceSessionId": source_session_id,
                "sourceSessionSQL": source_final_sql[0],
                "assessmentReportId": report_id,
                "assessmentReportSQL": assessment_report_sql[0],
                "formalOverallScore": report_row[0][1],
                "zeroScoreReport": {"sessionId": zero_attempt_id, "reportSQL": zero_report_sql[0], "allItemScoresZero": zero_item_scores[0] == ["20", "20", "0"]},
                "processingWithoutReport": {"sourceSessionId": source_session_id, "reportCountBeforeTeacherReview": 0},
                "formalResultCount": 2,
                "manualReviewSQL": manual_reviews_sql,
                "identities": {
                    "studentA": {"userId": fixtures["student_a"]["user"], "schoolId": SCHOOL_ID, "classId": CLASS_ID, "enrollmentId": fixtures["student_a"]["enrollment"]},
                    "studentB": {"userId": fixtures["student_b"]["user"], "schoolId": SCHOOL_ID, "classId": fixtures["teacher_other"]["class"], "enrollmentId": fixtures["student_b"]["enrollment"]},
                    "studentC": {"userId": student_c["user"], "schoolId": fixtures["foreign_teacher"]["school"], "classId": fixtures["foreign_teacher"]["class"], "enrollmentId": student_c["enrollment"]},
                    "teacherA": {"userId": teacher_session["user"]["id"], "schoolId": SCHOOL_ID},
                },
                "studentAOwnership": {"userId": fixtures["student_a"]["user"], "schoolId": SCHOOL_ID, "classId": CLASS_ID, "enrollmentId": fixtures["student_a"]["enrollment"]},
                "practiceDefinitionId": practice_id,
                "teacherFeedbackSource": {"assessmentItemIds": review_item_ids, "reportId": report_id, "comments": list(comments.values())},
                "courseFeedbackSource": {**course_feedback, "courseFeedbackCount": int(course_feedback_count), "assessmentReviewCount": len(manual_reviews_sql)},
                "recordings": source_recordings,
                "remediationRecordings": remediation_recordings,
                "retryCandidates": retry_candidates,
                "remediationSessionId": remediation_id,
                "remediationCreationResponse": creation,
                "remediationCompletion": remediation_completion,
                "remediationSQL": remediation_sql[0],
                "remediationItemQuestionVersionIds": [row[0] for row in qv_rows],
                "relatedRemediationCount": related_count,
                "remediationResult": {"status": remediation_result["status"], "pendingItemCount": remediation_result["pendingItemCount"]},
                "lostPostResponse": {"serverStatus": lost_response["status"], "browserPostCount": lost_response["posts"], "recoveredBySessionList": True},
                "recoveryGETs": recovery_requests,
                "schoolSwitchStaleResponse": {"oldSchoolResponseArrivedAfterSwitch": True, "oldStudentDataRendered": False},
                "apiNegativeStatuses": {
                    "unauthenticated": no_auth.status,
                    "sameSchoolOtherStudentReport": foreign_report.status,
                    "sameSchoolOtherStudentRemediationPost": foreign_remediation_create.status,
                    "sameSchoolOtherStudentHistory": foreign_history.status,
                    "crossSchoolReport": cross_school_report.status,
                    "missingReport": missing_report.status,
                    "ineligibleRemediation": conflict.status,
                },
                "responsive": responsive,
                "keyboardAndMotion": {"sourceDetailsOpenedWithEnter": True, "remediationActionActivatedWithEnter": True, "reducedMotion": True},
                "browserErrors": page_errors,
            }
            (EVIDENCE / "native-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(evidence, ensure_ascii=False))
            assert page_errors == [], page_errors
        finally:
            browser.close()
