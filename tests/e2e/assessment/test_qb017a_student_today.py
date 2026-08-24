"""QB-017A browser proof for the server-authoritative Student Today action."""

import os
import uuid

import pytest
from playwright.sync_api import Page, sync_playwright

from test_qb015f_teacher_assignment import (
    BASE,
    CANONICAL_CLASS_ID,
    PASSWORD,
    SCHOOL_ID,
    TEACHER_ID,
    create_source,
    load_delivery,
    sql,
)


STUDENT_IDENTIFIER = "student.test"
STUDENT_ID = "22222222-2222-4222-8222-222222222222"


def payload(response):
    body = response.json()
    return body.get("data", body)


def authenticate(page: Page, identifier: str):
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


def today(page: Page):
    page.goto(f"{BASE}/student/today/", wait_until="networkidle")
    page.locator("[data-action-kind]").wait_for(timeout=20_000)
    return page.evaluate("window.__studentTodayData")


def student_enrollment_id():
    enrollment_id = sql(
        f'''SELECT "id" FROM "Enrollment"
            WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}'
              AND "classId" = '{CANONICAL_CLASS_ID}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE'
            LIMIT 1;''',
        capture=True,
    )
    assert enrollment_id
    return enrollment_id


@pytest.mark.skipif(not os.environ.get("QB_RELEASE_BASE_URL"), reason="requires the isolated pilot runtime")
def test_qb017a_student_today_four_real_states():
    delivery = load_delivery()
    enrollment_id = student_enrollment_id()
    source_id = None
    self_attempt_id = None
    teacher_attempt_id = None

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            try:
                # State 1: a fresh student sees only a real published Level 1 baseline.
                authenticate(page, STUDENT_IDENTIFIER)
                baseline = today(page)
                assert baseline["version"] == "student-today-v1"
                assert baseline["primaryAction"]["kind"] == "BASELINE"
                assert baseline["primaryAction"]["target"]["practiceDefinitionId"] == delivery["definitionId"]
                assert "高原上的春天" not in page.locator("body").inner_text()

                # Create a completed formal diagnosis through the same published
                # delivery used by the existing assessment E2E fixtures.
                source_id = create_source(STUDENT_ID, enrollment_id, delivery)

                # State 2: persisted diagnosis -> the existing remediation Runner.
                diagnosis = today(page)
                assert diagnosis["primaryAction"]["kind"] == "START_REMEDIATION"
                assert diagnosis["primaryAction"]["target"]["sourceSessionId"] == source_id
                page.locator("[data-primary-action]").click()
                page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=20_000)
                page.locator(".question-shell").wait_for(timeout=20_000)
                self_attempt_id = page.url.split("/attempts/")[1].split("/")[0]
                assert self_attempt_id != source_id

                # State 3: the same self-created attempt is resumed, not duplicated.
                resumed = today(page)
                assert resumed["primaryAction"]["kind"] == "RESUME_REMEDIATION"
                assert resumed["primaryAction"]["target"]["href"].endswith(
                    f"/student/practices/attempts/{self_attempt_id}/runner/"
                )
                page.locator("[data-primary-action]").click()
                page.wait_for_url(f"**/student/practices/attempts/{self_attempt_id}/runner/", timeout=20_000)
                page.locator(".question-shell").wait_for(timeout=20_000)

                # Create a teacher assignment through the real teacher API. The
                # student page still supplies no session or question identifiers.
                teacher_session = authenticate(page, "teacher.test")
                assignment_response = page.request.post(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/teacher/question-bank-diagnostics/classes/{CANONICAL_CLASS_ID}/remediation-assignments",
                    headers={"Authorization": f"Bearer {teacher_session['accessToken']}"},
                    data={
                        "practiceDefinitionId": delivery["definitionId"],
                        "enrollmentIds": [enrollment_id],
                        "focus": {"mode": "FAMILY", "family": "READ_ALOUD"},
                    },
                )
                assert assignment_response.ok, assignment_response.text()
                assignment = payload(assignment_response)
                teacher_attempt_id = assignment["targets"][0]["attemptId"]
                assert teacher_attempt_id

                # State 4: teacher-assigned remediation outranks self-resume and
                # opens the same existing Runner with the assigned attempt.
                authenticate(page, STUDENT_IDENTIFIER)
                teacher_action = today(page)
                assert teacher_action["primaryAction"]["kind"] == "TEACHER_REMEDIATION"
                assert teacher_action["primaryAction"]["target"]["href"].endswith(
                    f"/student/practices/attempts/{teacher_attempt_id}/runner/"
                )
                page.locator("[data-primary-action]").click()
                page.wait_for_url(f"**/student/practices/attempts/{teacher_attempt_id}/runner/", timeout=20_000)
                page.locator(".question-shell").wait_for(timeout=20_000)
            finally:
                browser.close()
    finally:
        ids = [session_id for session_id in [teacher_attempt_id, self_attempt_id, source_id] if session_id]
        if ids:
            sql(
                'DELETE FROM "AssessmentSession" WHERE "id" IN ('
                + ",".join(f"'{session_id}'" for session_id in ids)
                + ");"
            )


@pytest.mark.skipif(not os.environ.get("QB_RELEASE_BASE_URL"), reason="requires the isolated pilot runtime")
def test_qb017a_multi_enrollment_teacher_assignment_runner():
    temporary_class_id = str(uuid.uuid4())
    temporary_student_enrollment_id = str(uuid.uuid4())
    temporary_teacher_enrollment_id = str(uuid.uuid4())
    source_id = None
    teacher_attempt_id = None
    delivery = load_delivery()

    try:
        term_id = sql(
            f'''SELECT "termId" FROM "Class" WHERE "id" = '{CANONICAL_CLASS_ID}';''',
            capture=True,
        )
        assert term_id
        sql(
            f'''INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt")
                VALUES ('{temporary_class_id}', '{SCHOOL_ID}', '{term_id}', 'QB017A-F 第二班', '七年级', NOW(), NOW());
                INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
                VALUES
                  ('{temporary_student_enrollment_id}', '{SCHOOL_ID}', '{temporary_class_id}', '{STUDENT_ID}', 'STUDENT', 'ACTIVE', NOW()),
                  ('{temporary_teacher_enrollment_id}', '{SCHOOL_ID}', '{temporary_class_id}', '{TEACHER_ID}', 'TEACHER', 'ACTIVE', NOW());''',
        )
        source_id = create_source(STUDENT_ID, temporary_student_enrollment_id, delivery)
        sql(
            f'''UPDATE "AssessmentSession"
                SET "classId" = '{temporary_class_id}'
                WHERE "id" = '{source_id}';''',
        )

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            try:
                teacher_session = authenticate(page, "teacher.test")
                assignment_response = page.request.post(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/teacher/question-bank-diagnostics/classes/{temporary_class_id}/remediation-assignments",
                    headers={"Authorization": f"Bearer {teacher_session['accessToken']}"},
                    data={
                        "practiceDefinitionId": delivery["definitionId"],
                        "enrollmentIds": [temporary_student_enrollment_id],
                        "focus": {"mode": "FAMILY", "family": "READ_ALOUD"},
                    },
                )
                assert assignment_response.ok, assignment_response.text()
                teacher_attempt_id = payload(assignment_response)["targets"][0]["attemptId"]
                assert teacher_attempt_id

                authenticate(page, STUDENT_IDENTIFIER)
                data = today(page)
                assert data["primaryAction"]["kind"] == "TEACHER_REMEDIATION"
                assert "老师布置的" in data["primaryAction"]["title"]
                assert "专项巩固" in data["primaryAction"]["title"]
                page.locator("[data-primary-action]").click()
                page.wait_for_url(f"**/student/practices/attempts/{teacher_attempt_id}/runner/", timeout=20_000)
                page.locator(".question-shell").wait_for(timeout=20_000)
            finally:
                browser.close()
    finally:
        ids = [session_id for session_id in [teacher_attempt_id, source_id] if session_id]
        if ids:
            sql(
                'DELETE FROM "AssessmentSession" WHERE "id" IN ('
                + ",".join(f"'{session_id}'" for session_id in ids)
                + ");"
            )
        sql(
            f'''DELETE FROM "Enrollment"
                WHERE "id" IN ('{temporary_student_enrollment_id}', '{temporary_teacher_enrollment_id}');
                DELETE FROM "Class" WHERE "id" = '{temporary_class_id}';''',
        )
