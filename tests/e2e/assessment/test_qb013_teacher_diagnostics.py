"""QB-013 browser proof for the teacher's class-scoped Question Bank dashboard.

The fixture owns a temporary class, users, enrollments and assessment rows. It
uses canonical published Question Bank versions as immutable inputs and removes
only the fixture data afterwards. No speech provider is started or called.
"""

import json
import os
import subprocess
import uuid

from playwright.sync_api import sync_playwright

from test_qb012_progress import (
    BASE,
    CLASS_ID as CANONICAL_CLASS_ID,
    PASSWORD,
    SCHOOL_ID,
    STUDENT_ID,
    diagnosis_for,
    load_delivery,
    scores_for_loss,
)

TEACHER_ID = "33333333-3333-4333-8333-333333333333"
DB_CONTAINER = os.environ.get("QB_RELEASE_DB_CONTAINER", "p0-integration-postgres-1")
DB_USER = os.environ.get("QB_RELEASE_DB_USER", "yuzan")
DB_NAME = os.environ.get("QB_RELEASE_DB_NAME", "yuzan_dev")


def sql(statement, *, capture=False):
    result = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"],
        input=statement,
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def quote(value):
    return str(value).replace("'", "''")


def authenticate(page):
    response = page.request.post(f"{BASE}/api/v1/auth/login", data={"identifier": "teacher.test", "password": PASSWORD})
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """payload => {
          localStorage.setItem('yuzan-access-token', payload.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
          localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
        }""",
        payload,
    )


def create_formal_fixture(enrollment_id, user_id, delivery, total_loss, completed_at, *, candidate_count=0):
    session_id = str(uuid.uuid4())
    scores = scores_for_loss(delivery["items"], total_loss, candidate_count)
    diagnosis = diagnosis_for(delivery["items"], scores)
    # Persisted diagnosis remains the authority. The dashboard only reads its
    # aggregate family priorities, never item answers or provider evidence.
    diagnosis["priorities"] = [entry for entry in diagnosis["families"] if entry["percentage"] < 70][:3]
    if not diagnosis["priorities"]:
        diagnosis["priorities"] = [diagnosis["families"][0]]
    sql(
        f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "completedAt", "practiceDefinitionId", "practiceVersionId", "createdAt", "updatedAt")
            VALUES ('{session_id}', '{SCHOOL_ID}', '{enrollment_id}', (SELECT "classId" FROM "Enrollment" WHERE "id" = '{enrollment_id}'), '{user_id}', 'MIXED', 'STANDARD', 'COMPLETED', '{completed_at}', '{delivery["definitionId"]}', '{delivery["versionId"]}', '{completed_at}', '{completed_at}');'''
    )
    values = []
    for execution_order, (item, earned) in enumerate(zip(delivery["items"], scores), start=1):
        values.append(
            f"('{uuid.uuid4()}', '{session_id}', '{item['questionVersionId']}', '{{}}'::jsonb, '{{}}'::jsonb, '{quote(item['itemType'])}', '{quote(item['sectionTitle'])}', {item['sectionOrder']}, {execution_order}, {item['maxScore']}, {earned}, '{completed_at}', '{completed_at}')"
        )
    sql('''INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemConfig", "itemType", "sectionTitle", "sectionOrder", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt") VALUES ''' + ",".join(values) + ";")
    summary = quote(json.dumps({"diagnosis": diagnosis}, ensure_ascii=False))
    sql(
        f'''INSERT INTO "AssessmentReport" ("id", "sessionId", "schoolId", "overallScore", "dataCompleteness", "summary", "createdAt", "updatedAt")
            VALUES ('{uuid.uuid4()}', '{session_id}', '{SCHOOL_ID}', {100 - total_loss}, 100, '{summary}'::jsonb, '{completed_at}', '{completed_at}');'''
    )
    candidates = [(item, earned) for item, earned in zip(delivery["items"], scores) if earned < item["maxScore"]]
    return {"id": session_id, "candidates": candidates}


def create_remediation_fixture(enrollment_id, user_id, source, delivery):
    session_id = str(uuid.uuid4())
    at = "2026-08-06T10:00:00.000Z"
    sql(
        f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "retestOfSessionId", "practiceDefinitionId", "practiceVersionId", "completedAt", "createdAt", "updatedAt")
            VALUES ('{session_id}', '{SCHOOL_ID}', '{enrollment_id}', (SELECT "classId" FROM "Enrollment" WHERE "id" = '{enrollment_id}'), '{user_id}', 'MIXED', 'REMEDIATION', 'COMPLETED', '{source["id"]}', '{delivery["definitionId"]}', '{delivery["versionId"]}', '{at}', '{at}', '{at}');'''
    )
    values = []
    for index, (item, source_score) in enumerate(source["candidates"]):
        remediation_score = item["maxScore"] if index < 3 else source_score
        values.append(f"('{uuid.uuid4()}', '{session_id}', '{item['questionVersionId']}', '{{}}'::jsonb, 'CHOICE', {index + 1}, {item['maxScore']}, {remediation_score}, '{at}', '{at}')")
    sql('''INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemType", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt") VALUES ''' + ",".join(values) + ";")
    return session_id


def test_qb013_teacher_class_diagnostic_dashboard():
    class_a, class_b = str(uuid.uuid4()), str(uuid.uuid4())
    teacher_enrollment = str(uuid.uuid4())
    users = [(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), f"诊断学生{index}") for index in range(1, 6)]
    sessions = []
    teacher_membership = None
    try:
        existing_teacher_membership = sql(
            f'''SELECT "id" FROM "Membership" WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{TEACHER_ID}' AND "role" = 'TEACHER' LIMIT 1;''',
            capture=True,
        )
        if not existing_teacher_membership:
            teacher_membership = str(uuid.uuid4())
            sql(f'''INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt") VALUES ('{teacher_membership}', '{SCHOOL_ID}', '{TEACHER_ID}', 'TEACHER', 'ACTIVE', NOW());''')
        term_id = sql(f'''SELECT "termId" FROM "Class" WHERE "id" = '{CANONICAL_CLASS_ID}';''', capture=True)
        sql(
            f'''INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt") VALUES
                ('{class_a}', '{SCHOOL_ID}', '{term_id}', 'QB013 诊断班 A', '七年级', NOW(), NOW()),
                ('{class_b}', '{SCHOOL_ID}', '{term_id}', 'QB013 诊断班 B', '七年级', NOW(), NOW());
                INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt") VALUES
                ('{teacher_enrollment}', '{SCHOOL_ID}', '{class_a}', '{TEACHER_ID}', 'TEACHER', 'ACTIVE', NOW());'''
        )
        for user_id, membership_id, enrollment_id, name in users:
            sql(
                f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
                    SELECT '{user_id}', 'qb013-{user_id}@test.invalid', '{name}', "passwordHash", 'ACTIVE', NOW(), NOW() FROM "User" WHERE "id" = '{STUDENT_ID}';
                    INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt") VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
                    INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt") VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{class_a}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
            )
        delivery = load_delivery("水平一级")
        source = create_formal_fixture(users[0][2], users[0][0], delivery, 16, "2026-08-01T10:00:00.000Z", candidate_count=4)
        sessions.append(source["id"])
        remediation_id = create_remediation_fixture(users[0][2], users[0][0], source, delivery)
        sessions.append(remediation_id)
        follow_up = create_formal_fixture(users[0][2], users[0][0], delivery, 9, "2026-08-10T10:00:00.000Z")
        sessions.append(follow_up["id"])
        sessions.append(create_formal_fixture(users[1][2], users[1][0], delivery, 20, "2026-08-03T10:00:00.000Z")["id"])
        sessions.append(create_formal_fixture(users[2][2], users[2][0], delivery, 28, "2026-08-04T10:00:00.000Z")["id"])
        speech_version = sql(
            f'''SELECT r."questionVersionId" FROM "PracticeSection" s JOIN "PracticeItemRef" r ON r."sectionId" = s."id" JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
                  WHERE s."versionId" = '{delivery["versionId"]}' AND v."scoringSpec"->>'strategy' = 'SPEECH_READING' LIMIT 1;''',
            capture=True,
        )
        processing_id = str(uuid.uuid4())
        sessions.append(processing_id)
        sql(
            f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "practiceDefinitionId", "practiceVersionId", "createdAt", "updatedAt")
                VALUES ('{processing_id}', '{SCHOOL_ID}', '{users[3][2]}', '{class_a}', '{users[3][0]}', 'MIXED', 'STANDARD', 'PROCESSING', '{delivery["definitionId"]}', '{delivery["versionId"]}', NOW(), NOW());
                INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemType", "sortOrder", "maxScore", "createdAt", "updatedAt")
                VALUES ('{uuid.uuid4()}', '{processing_id}', '{speech_version}', '{{}}'::jsonb, 'SPEECH', 1, 4, NOW(), NOW());'''
        )

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            try:
                authenticate(page)
                dashboard_response = page.evaluate(
                    """async ({classId, definitionId}) => {
                      const schoolId = localStorage.getItem('yuzan-active-school-id');
                      const response = await fetch(`/api/v1/schools/${schoolId}/teacher/question-bank-diagnostics/classes/${classId}?practiceDefinitionId=${definitionId}`, {headers:{Authorization:`Bearer ${localStorage.getItem('yuzan-access-token')}`}});
                      return {status:response.status, payload:await response.json()};
                    }""",
                    {"classId": class_a, "definitionId": delivery["definitionId"]},
                )
                assert dashboard_response["status"] == 200
                data = dashboard_response["payload"].get("data", dashboard_response["payload"])
                assert data["summary"].get("eligibleStudents") == 5
                assert data["summary"].get("assessedStudents") == 3
                assert data["summary"].get("inProgressStudents") == 1
                assert data["summary"].get("notAssessedStudents") == 1
                assert data["summary"].get("coveragePercentage") == 60
                assert data["summary"].get("averageScore") == 81
                assert data["summary"].get("pendingReviewItemCount") == 1
                assert len(data["domains"]) == 4 and len(data["families"]) == 8
                assert next(row for row in data["students"] if row["enrollmentId"] == users[0][2])["latestVsPrevious"] == 7
                serialized = json.dumps(data, ensure_ascii=False)
                for forbidden in ["rank", "position", "percentile", "classRank", "correctAnswer", "referenceAnswer", "acceptedAnswers", "scoringSpec", "rubric", "deductionRules", "sourceTrace", "providerAudit", "rawResponse", "transcript", "candidatePoints"]:
                    assert forbidden not in serialized

                forbidden = page.evaluate(
                    """async ({classId, definitionId}) => {
                      const schoolId = localStorage.getItem('yuzan-active-school-id');
                      const response = await fetch(`/api/v1/schools/${schoolId}/teacher/question-bank-diagnostics/classes/${classId}?practiceDefinitionId=${definitionId}`, {headers:{Authorization:`Bearer ${localStorage.getItem('yuzan-access-token')}`}});
                      return response.status;
                    }""",
                    {"classId": class_b, "definitionId": delivery["definitionId"]},
                )
                assert forbidden == 403

                page.goto(f"{BASE}/teacher/diagnostics/")
                page.get_by_role("heading", name="学情诊断").wait_for(timeout=20_000)
                page.locator("#diagnostic-class").select_option(class_a)
                page.locator("#diagnostic-practice").select_option(delivery["definitionId"])
                page.get_by_text("已测人数 / 总人数").wait_for(timeout=20_000)
                page.get_by_text("3 / 5", exact=True).wait_for(timeout=20_000)
                body = page.locator("body").inner_text()
                assert "3 / 5" in body and "60%" in body and "班级建议重点巩固" in body and "专项巩固" in body
                page.locator("tr", has_text="诊断学生1").get_by_role("button", name="查看").click()
                page.get_by_role("heading", name="诊断学生1").wait_for(timeout=20_000)
                detail_body = page.locator("#student-detail").inner_text()
                assert "+7 分" in detail_body and "专项巩固" in detail_body and "正式测评记录" in detail_body
            finally:
                browser.close()
    finally:
        if sessions:
            sql("DELETE FROM \"AssessmentSession\" WHERE \"id\" IN (" + ",".join(f"'{session_id}'" for session_id in sessions) + ");")
        sql(f'''DELETE FROM "Enrollment" WHERE "classId" = '{class_a}'; DELETE FROM "Membership" WHERE "userId" IN ({",".join(f"'{entry[0]}'" for entry in users)}); DELETE FROM "User" WHERE "id" IN ({",".join(f"'{entry[0]}'" for entry in users)}); DELETE FROM "Class" WHERE "id" IN ('{class_a}', '{class_b}');''')
        if teacher_membership:
            sql(f'''DELETE FROM "Membership" WHERE "id" = '{teacher_membership}';''')
