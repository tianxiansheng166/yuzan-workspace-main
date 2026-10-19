"""Native Chromium/API/PostgreSQL proof for the T036 student history page.

All created identities, practice definitions, recordings, feedback, and review
comments are TEST_FIXTURE_ONLY rows in the T036-owned local database.
"""

import json
import os
import subprocess
import time
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import sync_playwright

import test_yz_rd_t011_web_review_feedback as t011
from test_yz_rd_t008_student_history import complete_real_attempt, payload


BASE = os.environ.get("YZ_T036_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T036_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T036_PASSWORD", "")
PSQL = os.environ.get("YZ_T036_PSQL", "psql")
EVIDENCE = Path(os.environ.get("YZ_T036_EVIDENCE_DIR", "/tmp/yz-rd-t036-history"))
EXPECTED_DATABASE_NAME = os.environ.get("YZ_T036_EXPECTED_DATABASE_NAME", "yuzan_t036_native")
EXPECTED_DATABASE_USER = os.environ.get("YZ_T036_EXPECTED_DATABASE_USER", "yz_t036")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
TEACHER_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_A_ENROLLMENT = "f1111111-1111-4111-8111-111111111111"
TEACHER_ENROLLMENT = "f2222222-2222-4222-8222-222222222222"
QUESTION_CHOICE_VERSION = "75000000-0000-4000-8000-000000000001"
QUESTION_SPEECH_VERSION = "75000000-0000-4000-8000-000000000003"
SEED_ASSIGNMENT_ID = "f8888888-8888-4888-8888-888888888888"


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.username == os.environ["POSTGRES_USER"] == EXPECTED_DATABASE_USER
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == EXPECTED_DATABASE_NAME
    assert parsed.password
    password = unquote(parsed.password)
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
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    return result.stdout.strip() if capture else ""


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def verify_database_identity():
    identity = sql(
        "SELECT current_database() || '|' || current_user || '|' || version();",
        capture=True,
    )
    assert identity.startswith(f"{EXPECTED_DATABASE_NAME}|{EXPECTED_DATABASE_USER}|PostgreSQL 17."), identity.split("|", 2)[:2]


def authenticate(page, identifier):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    session = payload(response)
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
        }""",
        session,
    )
    return session


def headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def create_student_b():
    user_id = str(uuid.uuid4())
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    login = f"yz-rd-t036-student-b-{user_id}@test.invalid"
    display_name = f"TEST_FIXTURE_ONLY T036 学生B {user_id[:8]}"
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{login}', '{display_name}', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{STUDENT_A_ID}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return {"userId": user_id, "enrollmentId": enrollment_id, "login": login}


def create_foreign_school():
    school_id = str(uuid.uuid4())
    code = f"T036-X-{uuid.uuid4().hex[:12]}"
    sql(
        f'''INSERT INTO "School" ("id", "code", "name", "regionCode", "isActive", "createdAt", "updatedAt")
              VALUES ('{school_id}', '{code}', 'TEST_FIXTURE_ONLY T036 跨校隔离', 'TEST', true, NOW(), NOW());'''
    )
    return school_id


def ensure_feedback_assignment_fixture():
    """Keep this history E2E independent of the full, non-bootstrap seed."""
    t011.ensure_test_course()
    sql(
        f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt","createdAt","updatedAt")
              VALUES ('{SEED_ASSIGNMENT_ID}','{SCHOOL_ID}','{t011.COURSE_VERSION_ID}','{TEACHER_ID}',
                      'TEST_FIXTURE_ONLY T036 history feedback assignment','OPEN',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',NOW(),NOW(),NOW())
              ON CONFLICT (id) DO NOTHING;
            INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","enrollmentId","createdAt")
              VALUES ('f9999999-9999-4999-8999-999999999999','{SCHOOL_ID}','{SEED_ASSIGNMENT_ID}','STUDENT','{STUDENT_A_ENROLLMENT}',NOW())
              ON CONFLICT (id) DO NOTHING;'''
    )


def prepare_question_bank_test_families():
    # These are existing P0 bootstrap question versions. The old sample choice
    # stores the authored correct key as `correctAnswer`; the current scorer
    # contract uses `referenceAnswer`. Normalize only this isolated test row,
    # preserving the authored correct key B, then run the normal scorer.
    sql(
        f'''UPDATE "QuestionBankItem"
               SET "domain" = 'READ', "questionType" = 'SENTENCE_COMPREHENSION', "level" = '水平一级'
             WHERE "id" = '74000000-0000-4000-8000-000000000001';
            UPDATE "QuestionBankItem"
               SET "domain" = 'SPEAK', "questionType" = 'READ_ALOUD', "level" = '水平一级'
             WHERE "id" = '74000000-0000-4000-8000-000000000003';
            UPDATE "QuestionBankItemVersion"
               SET "scoringSpec" = '{{"strategy":"EXACT_CHOICE","maxScore":3,"referenceAnswer":"B"}}'::jsonb
             WHERE "id" = '{QUESTION_CHOICE_VERSION}';
            DO $$ BEGIN
              IF (SELECT count(*) FROM "QuestionBankItemVersion"
                   WHERE "id" IN ('{QUESTION_CHOICE_VERSION}', '{QUESTION_SPEECH_VERSION}')
                     AND "status" = 'PUBLISHED') <> 2 THEN
                RAISE EXCEPTION 'T036 requires the existing published P0 Question Bank fixtures';
              END IF;
            END $$;'''
    )


def create_practice_fixture(title, item_versions):
    definition_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    section_id = str(uuid.uuid4())
    delivery_id = str(uuid.uuid4())
    item_rows = []
    for sort_order, item_version_id in enumerate(item_versions, start=1):
        ref_id = str(uuid.uuid4())
        item_type = "SPEECH" if item_version_id == QUESTION_SPEECH_VERSION else "CHOICE"
        item_rows.append(
            f'''INSERT INTO "PracticeItemRef" ("id", "sectionId", "questionVersionId", "itemType", "sortOrder", "config")
                  VALUES ('{ref_id}', '{section_id}', '{item_version_id}', '{item_type}', {sort_order}, '{{}}'::jsonb);'''
        )
    sql(
        f'''INSERT INTO "PracticeDefinition" ("id", "schoolId", "visibility", "title", "summary", "difficulty", "estimatedMinutes", "gradeBand", "abilityCategories", "cultureTags", "catalogType", "requiresRecording", "instantFeedback", "status", "createdAt", "updatedAt")
              VALUES ('{definition_id}', '{SCHOOL_ID}', 'SCHOOL', '{title}', 'TEST_FIXTURE_ONLY 本地验收练习', '基础', 5, '七年级', ARRAY['阅读理解','独立朗读']::text[], ARRAY['T036_TEST_FIXTURE_ONLY']::text[], 'COMPREHENSIVE', true, false, 'PUBLISHED', NOW(), NOW());
            INSERT INTO "PracticeVersion" ("id", "definitionId", "version", "status", "contentHash", "publishedAt", "createdAt")
              VALUES ('{version_id}', '{definition_id}', 1, 'PUBLISHED', '{definition_id}', NOW(), NOW());
            INSERT INTO "PracticeSection" ("id", "versionId", "title", "description", "sortOrder", "estimatedMinutes")
              VALUES ('{section_id}', '{version_id}', 'TEST_FIXTURE_ONLY 正式验收题', '通过真实服务端评分和复核生成本地报告。', 1, 5);
            {''.join(item_rows)}
            INSERT INTO "PracticeDelivery" ("id", "practiceVersionId", "schoolId", "classId", "mode", "reRecordPolicy", "mobilePolicy", "status", "createdAt", "updatedAt")
              VALUES ('{delivery_id}', '{version_id}', '{SCHOOL_ID}', '{CLASS_ID}', 'SELF_PRACTICE', '{{"maxAttempts":2}}'::jsonb, '{{"allowed":true}}'::jsonb, 'OPEN', NOW(), NOW());'''
    )
    return {"definitionId": definition_id, "versionId": version_id, "deliveryId": delivery_id, "title": title}


def create_attempt(page, school_id, session, definition_id):
    response = page.request.post(
        f"{BASE}/api/v1/schools/{school_id}/practices/{definition_id}/attempts",
        headers=headers(session),
        data={},
    )
    assert response.ok, response.text()
    attempt_id = payload(response).get("attemptId")
    assert uuid.UUID(attempt_id)
    return attempt_id


def test_student_history_is_actionable_private_and_report_backed():
    assert BASE and DATABASE_URL and PASSWORD
    verify_database_identity()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    prepare_question_bank_test_families()
    run_key = uuid.uuid4().hex[:8]

    student_b = create_student_b()
    foreign_school_id = create_foreign_school()
    formal_practice = create_practice_fixture(
        f"TEST_FIXTURE_ONLY T036 正式报告零分验证 {run_key}",
        [QUESTION_CHOICE_VERSION] * 19 + [QUESTION_SPEECH_VERSION],
    )
    processing_practice = create_practice_fixture(
        f"TEST_FIXTURE_ONLY T036 PROCESSING 验证 {run_key}",
        [QUESTION_CHOICE_VERSION, QUESTION_SPEECH_VERSION],
    )
    in_progress_practice = create_practice_fixture(
        f"TEST_FIXTURE_ONLY T036 IN_PROGRESS 验证 {run_key}",
        [QUESTION_CHOICE_VERSION],
    )
    cursor_practices = [
        create_practice_fixture(
            f"TEST_FIXTURE_ONLY T036 cursor {run_key} sample {index:03d}",
            [QUESTION_CHOICE_VERSION],
        )
        for index in range(1, 102)
    ]

    feedback_submission_id = str(uuid.uuid4())
    ensure_feedback_assignment_fixture()
    sql(
        f'''INSERT INTO "Submission" ("id", "schoolId", "assignmentId", "enrollmentId", "attemptNo", "status", "idempotencyKey", "submittedAt", "createdAt", "updatedAt")
              SELECT '{feedback_submission_id}', '{SCHOOL_ID}', '{SEED_ASSIGNMENT_ID}', '{STUDENT_A_ENROLLMENT}',
                     COALESCE(MAX("attemptNo"), 0) + 1, 'NEEDS_REVIEW', 't036-feedback-{feedback_submission_id}', NOW(), NOW(), NOW()
                FROM "Submission" WHERE "assignmentId" = '{SEED_ASSIGNMENT_ID}' AND "enrollmentId" = '{STUDENT_A_ENROLLMENT}';'''
    )

    evidence = {
        "database": EXPECTED_DATABASE_NAME,
        "postgresMajor": "17",
        "fixtureRunKey": run_key,
        "studentAUserId": STUDENT_A_ID,
        "studentAEnrollmentId": STUDENT_A_ENROLLMENT,
        "studentBUserId": student_b["userId"],
        "studentBEnrollmentId": student_b["enrollmentId"],
        "foreignSchoolId": foreign_school_id,
        "practiceDefinitionIds": {
            "formal": formal_practice["definitionId"],
            "processing": processing_practice["definitionId"],
            "inProgress": in_progress_practice["definitionId"],
            "cursorSamples": [practice["definitionId"] for practice in cursor_practices],
        },
        "fixturePolicy": "TEST_FIXTURE_ONLY; no database score or AssessmentReport rows are inserted directly",
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["microphone"],
        )
        context_b = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page_b = context_b.new_page()
        page_errors = []
        history_requests = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "request",
            lambda request: history_requests.append(request.url)
            if "/assessments/sessions?" in request.url
            else None,
        )
        try:
            student_a_session = authenticate(page, "student.test")
            headers_a = headers(student_a_session)
            student_b_session = authenticate(page_b, student_b["login"])
            headers_b = headers(student_b_session)
            teacher_session = page.request.post(
                f"{BASE}/api/v1/auth/login",
                data={"identifier": "teacher.test", "password": PASSWORD},
            )
            assert teacher_session.ok, teacher_session.text()
            teacher_session = payload(teacher_session)
            headers_teacher = headers(teacher_session)

            # Student A creates a real Attempt from a published test definition.
            formal_attempt_id = create_attempt(page, SCHOOL_ID, student_a_session, formal_practice["definitionId"])
            page.goto(f"{BASE}/student/practices/attempts/{formal_attempt_id}/runner/", wait_until="domcontentloaded")
            page.locator(".question-shell").wait_for(timeout=20_000)
            formal_completion = complete_real_attempt(
                page,
                headers_a,
                formal_attempt_id,
                base_url=BASE,
                exercise_upload_retry=False,
            )
            assert formal_completion["itemCount"] == 20
            assert formal_completion["recordedAudio"] == 1
            processing_after_submit = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}",
                headers=headers_a,
            ))
            assert processing_after_submit["status"] == "PROCESSING"

            qb_items_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{formal_attempt_id}/items",
                headers=headers_a,
            )
            assert qb_items_response.ok, qb_items_response.text()
            qb_items = payload(qb_items_response)
            speech_item = next(item for item in qb_items if item["itemType"] == "SPEECH")
            review_response = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{speech_item['id']}",
                headers=headers_teacher,
                data={
                    "score": 0,
                    "comment": "TEST_FIXTURE_ONLY T036：隔离环境的待复核录音；此复核分数不属于真实学生或校准证据。",
                },
            )
            assert review_response.ok, review_response.text()

            report_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}/report",
                headers=headers_a,
            )
            assert report_response.ok, report_response.text()
            formal_report = payload(report_response)
            assert formal_report["sessionId"] == formal_attempt_id
            assert formal_report["dataCompleteness"] == 100
            assert formal_report["overallScore"] == 0
            assert any("TEST_FIXTURE_ONLY T036" in item["comment"] for item in formal_report["teacherFeedback"])
            evidence["formalAttemptId"] = formal_attempt_id
            evidence["formalReportId"] = formal_report["id"]
            evidence["formalReportScore"] = formal_report["overallScore"]
            evidence["formalReportCompleteness"] = formal_report["dataCompleteness"]
            evidence["formalAssessmentReviewComment"] = "TEST_FIXTURE_ONLY T036"

            report_sql = sql_rows(
                f'''SELECT s."status"::text, r."overallScore"::text, r."dataCompleteness"::text,
                           count(i.id)::text, count(i.id) FILTER (WHERE i."scoredScore" = 0)::text
                      FROM "AssessmentSession" s
                      JOIN "AssessmentReport" r ON r."sessionId" = s.id
                      JOIN "AssessmentItem" i ON i."sessionId" = s.id
                     WHERE s.id = '{formal_attempt_id}'
                     GROUP BY s."status", r."overallScore", r."dataCompleteness";'''
            )[0]
            assert report_sql[0] == "COMPLETED"
            assert float(report_sql[1]) == 0
            assert float(report_sql[2]) == 100
            assert int(report_sql[3]) == int(report_sql[4]) == 20

            remediation_response = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}/remediation",
                headers=headers_a,
                data={},
            )
            assert remediation_response.ok, remediation_response.text()
            remediation = payload(remediation_response)
            remediation_attempt_id = remediation.get("attemptId")
            assert remediation_attempt_id and uuid.UUID(remediation_attempt_id)
            evidence["remediationAttemptId"] = remediation_attempt_id

            # A second genuine attempt is submitted but intentionally remains
            # PROCESSING until any required review exists.
            processing_attempt_id = create_attempt(page, SCHOOL_ID, student_a_session, processing_practice["definitionId"])
            page.goto(f"{BASE}/student/practices/attempts/{processing_attempt_id}/runner/", wait_until="domcontentloaded")
            page.locator(".question-shell").wait_for(timeout=20_000)
            processing_completion = complete_real_attempt(
                page,
                headers_a,
                processing_attempt_id,
                base_url=BASE,
                exercise_upload_retry=False,
            )
            assert processing_completion["itemCount"] == 2
            processing_attempt = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{processing_attempt_id}",
                headers=headers_a,
            ))
            assert processing_attempt["status"] == "PROCESSING"
            assert sql(
                f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId" = '{processing_attempt_id}';''',
                capture=True,
            ) == "0"
            evidence["processingAttemptId"] = processing_attempt_id

            # A third attempt is started through the real API. Repeating the
            # state transition is a real 409; history must resume this ID.
            in_progress_attempt_id = create_attempt(page, SCHOOL_ID, student_a_session, in_progress_practice["definitionId"])
            first_start = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{in_progress_attempt_id}/start",
                headers=headers_a,
                data={},
            )
            assert first_start.ok, first_start.text()
            duplicate_start = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{in_progress_attempt_id}/start",
                headers=headers_a,
                data={},
            )
            assert duplicate_start.status == 409, duplicate_start.text()
            evidence["inProgressAttemptId"] = in_progress_attempt_id

            # Create enough independent, server-created Attempts to exercise
            # both the backend cursor and the UI's second page.
            cursor_attempts_a = []
            cursor_attempts_b = []
            for index, practice in enumerate(cursor_practices, start=1):
                if index == 101:
                    cursor_attempts_b.append(create_attempt(page_b, SCHOOL_ID, student_b_session, practice["definitionId"]))
                cursor_attempts_a.append(create_attempt(page, SCHOOL_ID, student_a_session, practice["definitionId"]))
                time.sleep(0.008)
            evidence["cursorOldestAttemptA"] = cursor_attempts_a[0]
            evidence["studentBAttemptId"] = cursor_attempts_b[0]

            cursor_first = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions?limit=25",
                headers=headers_a,
            ))
            assert len(cursor_first["items"]) == 25 and cursor_first["nextCursor"]
            cursor_pages = [cursor_first]
            while cursor_pages[-1]["nextCursor"]:
                cursor = cursor_pages[-1]["nextCursor"]
                cursor_pages.append(payload(page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions?limit=25&cursor={cursor}",
                    headers=headers_a,
                )))
                assert len(cursor_pages) <= 200, "cursor loop must stop"
            cursor_ids = {item["id"] for result in cursor_pages for item in result["items"]}
            assert cursor_attempts_a[0] in cursor_ids
            assert cursor_attempts_b[0] not in cursor_ids
            evidence["serverCursorPages"] = [len(result["items"]) for result in cursor_pages]

            # Add one real teacher Feedback record on a fictional submission;
            # the formal AssessmentReview comment remains in the report source.
            feedback_response = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/submissions/{feedback_submission_id}/feedback",
                headers=headers_teacher,
                data={"decision": "RETURN", "comment": "TEST_FIXTURE_ONLY T036：课程任务 Feedback 来源样例。"},
            )
            assert feedback_response.ok, feedback_response.text()
            feedback = payload(feedback_response)
            evidence["courseFeedbackId"] = feedback["id"]

            # Authentication and resource-scope negatives.
            anonymous = playwright.request.new_context()
            try:
                unauthorized = anonymous.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions?limit=1")
                assert unauthorized.status == 401
            finally:
                anonymous.dispose()
            cross_student_history = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/history?enrollmentId={student_b['enrollmentId']}",
                headers=headers_a,
            )
            assert cross_student_history.status == 403
            cross_student_report = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}/report",
                headers=headers_b,
            )
            assert cross_student_report.status == 403
            cross_school = page.request.get(
                f"{BASE}/api/v1/schools/{foreign_school_id}/assessments/sessions?limit=1",
                headers=headers_a,
            )
            assert cross_school.status == 403
            missing = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{uuid.uuid4()}/report",
                headers=headers_a,
            )
            assert missing.status == 404
            evidence["apiStatusMatrix"] = {"401": unauthorized.status, "403_student": cross_student_history.status, "403_report": cross_student_report.status, "403_school": cross_school.status, "404": missing.status, "409": duplicate_start.status}

            # Student A's page is real, personalized history. It proves the
            # processing state without a report, distinct from its completed
            # zero score and the separately labeled remediation Attempt.
            page.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            page.locator("[data-history-session]").first.wait_for(timeout=30_000)
            assert page.locator(f'[data-history-session="{cursor_attempts_a[0]}"]').count() == 0
            page.get_by_role("button", name="加载更多学习记录").click()
            second_page_attempt = cursor_attempts_a[51]
            page.locator(f'[data-history-session="{second_page_attempt}"]').wait_for(timeout=30_000)
            assert page.locator(f'[data-history-session="{cursor_attempts_a[0]}"]').count() == 0
            evidence["uiCursorPage"] = {"pageTwoAttemptId": second_page_attempt, "oldestAttemptDeferred": True}

            status_filter = page.get_by_label("筛选状态或类型")
            status_filter.select_option("PROCESSING")
            processing_row = page.locator(f'[data-history-session="{processing_attempt_id}"]')
            processing_row.wait_for(timeout=30_000)
            assert "PROCESSING" in processing_row.inner_text()
            assert "尚未形成报告或成绩" in processing_row.inner_text()
            assert processing_row.get_by_role("link", name="查看处理状态").count() == 1
            processing_row.get_by_role("link", name="查看处理状态").click()
            page.wait_for_url(f"**/student/practices/attempts/{processing_attempt_id}/processing/", timeout=30_000)
            assert page.locator("body").inner_text().find("处理") >= 0
            evidence["processingDynamicClick"] = page.url

            page.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            status_filter = page.get_by_label("筛选状态或类型")
            status_filter.select_option("IN_PROGRESS")
            in_progress_row = page.locator(f'[data-history-session="{in_progress_attempt_id}"]')
            in_progress_row.wait_for(timeout=30_000)
            assert "IN_PROGRESS" in in_progress_row.inner_text()
            assert "尚未形成报告或成绩" in in_progress_row.inner_text()
            in_progress_row.get_by_role("link", name="继续练习").click()
            page.wait_for_url(f"**/student/practices/attempts/{in_progress_attempt_id}/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            live_attempt = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{in_progress_attempt_id}",
                headers=headers_a,
            ))
            assert live_attempt["id"] == in_progress_attempt_id and live_attempt["status"] == "IN_PROGRESS"
            evidence["inProgressDynamicClick"] = page.url

            page.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            page.get_by_label("筛选状态或类型").select_option("COMPLETED")
            formal_row = page.locator(f'[data-history-session="{formal_attempt_id}"]')
            formal_row.wait_for(timeout=30_000)
            assert "COMPLETED" in formal_row.inner_text()
            assert "正式报告 0 分" in formal_row.inner_text()
            assert "AssessmentReview" in formal_row.inner_text()
            review_details = formal_row.locator(".history-review-comments")
            review_details.locator("summary").click()
            assert "TEST_FIXTURE_ONLY T036：隔离环境的待复核录音" in review_details.inner_text()
            feedback_row = page.locator(".history-course-feedback").filter(has_text=f"Feedback {feedback['id']}")
            assert "课程任务反馈 · Feedback" in feedback_row.inner_text()
            assert "TEST_FIXTURE_ONLY T036：课程任务 Feedback 来源样例。" in feedback_row.inner_text()
            assert "课程任务 Feedback 来源样例" not in formal_row.inner_text()
            formal_row.get_by_role("link", name="查看正式报告").click()
            page.wait_for_url(f"**/student/practices/attempts/{formal_attempt_id}/report/", timeout=30_000)
            page.locator(".score-number").wait_for(timeout=20_000)
            assert page.locator(".score-number").inner_text().strip().startswith("0")
            assert page.get_by_role("heading", name="正式测评复核评语 · AssessmentReview").count() == 1
            evidence["formalReportDynamicClick"] = page.url

            page.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            page.get_by_label("筛选状态或类型").select_option("REMEDIATION")
            remediation_row = page.locator(f'[data-history-session="{remediation_attempt_id}"]')
            remediation_row.wait_for(timeout=30_000)
            assert "REMEDIATION" in remediation_row.inner_text()
            assert "专项巩固" in remediation_row.inner_text()
            remediation_row.get_by_role("link", name="开始练习").click()
            page.wait_for_url(f"**/student/practices/attempts/{remediation_attempt_id}/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            evidence["remediationDynamicClick"] = page.url

            # Search scans past the visible first page and uses the actual
            # PracticeDefinition title returned by the authorized API.
            page.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的学习记录").wait_for(timeout=20_000)
            search = page.get_by_label("搜索练习名称")
            search.fill(cursor_practices[0]["title"])
            search_row = page.locator(f'[data-history-session="{cursor_attempts_a[0]}"]')
            search_row.wait_for(timeout=60_000)
            assert cursor_practices[0]["title"] in search_row.inner_text()
            assert any("cursor=" in url and "limit=100" in url for url in history_requests)
            evidence["fullHistorySearch"] = cursor_practices[0]["title"]

            # Offline query failure is visible and never reports a success state.
            def fail_history_list(route):
                if urlparse(route.request.url).path.endswith("/assessments/sessions"):
                    route.abort("internetdisconnected")
                else:
                    route.continue_()

            page.route("**/api/v1/**", fail_history_list)
            search.fill("T036 offline recovery probe")
            page.get_by_role("alert").filter(has_text="完整历史查询未完成").wait_for(timeout=20_000)
            assert page.locator(f'[data-history-session="{cursor_attempts_a[0]}"]').is_hidden()
            page.unroute("**/api/v1/**", fail_history_list)
            page.get_by_role("button", name="重试查询").click()
            page.get_by_text("没有符合条件的学习记录").wait_for(timeout=30_000)
            evidence["offlineRecovery"] = "visible query error; retry returned authoritative empty result"

            # Four required viewports plus keyboard focus and live announcements.
            page.get_by_role("button", name="清除筛选").click()
            page.locator("[data-history-query]").wait_for(timeout=20_000)
            page.wait_for_function("document.querySelector('.history-record-panel')?.getAttribute('aria-busy') === 'false'", timeout=30_000)
            page.wait_for_timeout(650)
            viewport_proof = []
            for width, height in [(390, 844), (768, 1024), (1280, 900), (1440, 1000)]:
                page.set_viewport_size({"width": width, "height": height})
                page.wait_for_timeout(100)
                dimensions = page.evaluate("({width: innerWidth, document: document.documentElement.scrollWidth})")
                assert dimensions["document"] <= dimensions["width"], f"horizontal overflow at {width}: {dimensions}"
                screenshot = EVIDENCE / f"history-{width}.png"
                page.screenshot(path=str(screenshot), full_page=False)
                viewport_proof.append({"viewport": width, "scrollWidth": dimensions["document"], "screenshot": screenshot.name})
            search = page.get_by_label("搜索练习名称")
            search.focus()
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement.id") == "history-status"
            assert page.locator('[data-history-count][role="status"][aria-live="polite"]').count() == 1
            evidence["viewports"] = viewport_proof
            evidence["keyboardAndA11y"] = "search/status labels, Tab order, native select, polite count announcement"

            # B has a real own Attempt, while A cannot enumerate or read it.
            page_b.goto(f"{BASE}/assessment/history/", wait_until="domcontentloaded")
            page_b.locator(f'[data-history-session="{cursor_attempts_b[0]}"]').wait_for(timeout=30_000)
            assert page_b.locator(f'[data-history-session="{cursor_attempts_a[0]}"]').count() == 0
            page_b.close()
            assert not page_errors, page_errors

            sql_proof = sql_rows(
                f'''SELECT s."enrollmentId", s."status"::text, s."purpose"::text,
                           count(i.id)::text, count(i.id) FILTER (WHERE i."scoredScore" IS NOT NULL)::text
                      FROM "AssessmentSession" s
                      JOIN "AssessmentItem" i ON i."sessionId" = s.id
                     WHERE s.id IN ('{formal_attempt_id}', '{processing_attempt_id}', '{in_progress_attempt_id}', '{remediation_attempt_id}')
                     GROUP BY s."enrollmentId", s."status", s."purpose"
                     ORDER BY s."status"::text;'''
            )
            evidence["sqlSessionProof"] = sql_proof
            assert any(row[1] == "COMPLETED" and row[2] == "STANDARD" and row[4] == "20" for row in sql_proof)
            assert any(row[1] == "PROCESSING" for row in sql_proof)
            assert any(row[1] == "IN_PROGRESS" for row in sql_proof)
            assert any(row[2] == "REMEDIATION" and row[1] in {"CREATED", "IN_PROGRESS"} for row in sql_proof)
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            (EVIDENCE / "e2e-proof.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        finally:
            context.close()
            context_b.close()
            browser.close()
