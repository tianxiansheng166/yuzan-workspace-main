"""Real-browser proof for a student's own practice state and history."""

import json
import os
import subprocess
import uuid

import pytest
from playwright.sync_api import sync_playwright


BASE = os.environ.get("QB_RELEASE_BASE_URL", "http://127.0.0.1:4178")
DB_CONTAINER = os.environ.get("QB_RELEASE_DB_CONTAINER", "")
DB_USER = os.environ.get("QB_RELEASE_DB_USER", "")
DB_NAME = os.environ.get("QB_RELEASE_DB_NAME", "")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
PASSWORD = "YuzanTest!2026"
PRACTICE_TITLE = "国家通用语言文字能力｜水平一级综合测评"


def sql(statement, *, capture=False):
    assert DB_CONTAINER and DB_USER and DB_NAME, "run only through the isolated T008 runtime"
    result = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"],
        input=statement,
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def payload(response):
    body = response.json()
    return body.get("data", body)


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


def create_student_b():
    user_id = str(uuid.uuid4())
    identifier = f"yz-rd-t008-{user_id}@test.invalid"
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{identifier}', 'T008 Student B', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{STUDENT_A_ID}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return user_id, identifier, enrollment_id


def student_a_enrollment():
    enrollment_id = sql(
        f'''SELECT "id" FROM "Enrollment"
              WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_A_ID}'
                AND "classId" = '{CLASS_ID}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE'
              LIMIT 1;''',
        capture=True,
    )
    assert enrollment_id
    return enrollment_id


def practice_in_catalog(page, headers):
    response = page.request.get(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices",
        headers=headers,
    )
    assert response.ok, response.text()
    catalog = payload(response)
    return next(item for item in catalog["items"] if item["title"] == PRACTICE_TITLE)


def response_spec(item):
    spec = item.get("itemConfig") or item.get("prompt") or {}
    if isinstance(spec, str):
        spec = json.loads(spec)
    return spec if isinstance(spec, dict) else {}


def complete_real_attempt(page, headers, attempt_id):
    items_response = page.request.get(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}/items",
        headers=headers,
    )
    assert items_response.ok, items_response.text()
    body = payload(items_response)
    items = body if isinstance(body, list) else body["items"]
    assert items
    played_audio = 0
    recorded_audio = 0

    for index, item in enumerate(items):
        if index:
            page.locator(f'[data-go="{index}"]').click()
            page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)
        spec = response_spec(item)
        stimulus = spec.get("stimulus") or {}
        if stimulus.get("type") == "AUDIO":
            audio = page.locator(".audio-stimulus audio")
            if audio.count():
                page.evaluate(
                    """async () => {
                      const audio = document.querySelector('.audio-stimulus audio');
                      audio.muted = true;
                      await audio.play();
                    }"""
                )
                page.wait_for_function(
                    "document.querySelector('.audio-stimulus audio')?.currentTime > 0",
                    timeout=10_000,
                )
                played_audio += 1

        response_type = (spec.get("response") or {}).get("type")
        if response_type == "CHOICE":
            page.locator("[data-choice]").first.click()
            page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)
        elif response_type == "TEXT":
            page.locator("[data-text]").fill("学生本人练习回答")
        elif response_type == "SPEECH":
            page.locator("[data-start-recording]").click()
            page.locator("[data-stop-recording]").wait_for(timeout=10_000)
            page.wait_for_timeout(1_100)
            page.locator("[data-stop-recording]").click()
            page.locator("[data-upload-recording]").wait_for(timeout=10_000)
            page.locator("[data-upload-recording]").click()
            page.locator(".runner-speech.saved").wait_for(timeout=30_000)
            recorded_audio += 1

        if index < len(items) - 1:
            page.locator("[data-next]").click()

    submit_posts = []
    page.on("request", lambda request: submit_posts.append(request.url) if request.method == "POST" and request.url.endswith(f"/assessments/sessions/{attempt_id}/submit") else None)
    page.locator("[data-submit]").evaluate("button => { button.click(); button.click(); }")
    page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/processing/", timeout=60_000)
    assert len(submit_posts) == 1
    duplicate_submit = page.request.post(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/submit",
        headers=headers,
        data={},
    )
    assert duplicate_submit.ok, duplicate_submit.text()
    assert payload(duplicate_submit)["id"] == attempt_id
    return {"itemCount": len(items), "playedAudio": played_audio, "recordedAudio": recorded_audio, "submitPosts": len(submit_posts), "duplicateSubmitId": payload(duplicate_submit)["id"]}


@pytest.mark.skipif(not os.environ.get("QB_RELEASE_BASE_URL"), reason="requires the isolated T008 runtime")
def test_student_practice_submission_appears_only_in_the_owners_history():
    enrollment_a = student_a_enrollment()
    user_b_id, identifier_b, enrollment_b = create_student_b()
    attempt_a = None
    attempt_b = None
    definition_id = None
    initial_count_a = None

    try:
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
            page = context.new_page()
            page_errors = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            try:
                student_a = authenticate(page, "student.test")
                headers_a = {"Authorization": f"Bearer {student_a['accessToken']}"}
                practice_a = practice_in_catalog(page, headers_a)
                definition_id = practice_a["id"]
                initial_count_a = int(
                    sql(
                        f'''SELECT COUNT(*) FROM "AssessmentSession"
                             WHERE "schoolId" = '{SCHOOL_ID}' AND "enrollmentId" = '{enrollment_a}'
                               AND "practiceDefinitionId" = '{definition_id}';''',
                        capture=True,
                    )
                )

                page.goto(f"{BASE}/student/today/", wait_until="networkidle")
                page.locator(".today-link-card").click()
                page.wait_for_url("**/student/practices/", timeout=20_000)
                practice_card = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
                practice_card.wait_for(timeout=20_000)
                practice_card.locator("h2 a").click()
                page.wait_for_url(f"**/student/practices/{definition_id}/", timeout=20_000)
                page.locator("[data-start]").click()
                page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
                page.locator(".question-shell").wait_for(timeout=20_000)
                attempt_a = page.url.split("/attempts/")[1].split("/")[0]
                completion = complete_real_attempt(page, headers_a, attempt_a)
                assert completion["itemCount"] == 20
                assert completion["playedAudio"] >= 1
                assert completion["recordedAudio"] >= 1

                page.locator('a[href="/student/practices/history/"]').first.click()
                page.wait_for_url("**/student/practices/history/", timeout=20_000)
                own_row = page.locator(f'[data-history-session="{attempt_a}"]')
                own_row.wait_for(timeout=20_000)
                own_row.get_by_text("处理中").wait_for()
                own_row.get_by_text("查看处理状态").wait_for()
                assert "尚未形成报告或成绩" in own_row.inner_text()

                page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
                current_card = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
                current_card.wait_for(timeout=20_000)
                assert current_card.locator(f'a[href="/student/practices/attempts/{attempt_a}/processing/"]').count() == 1
                count_after_a = int(
                    sql(
                        f'''SELECT COUNT(*) FROM "AssessmentSession"
                             WHERE "schoolId" = '{SCHOOL_ID}' AND "enrollmentId" = '{enrollment_a}'
                               AND "practiceDefinitionId" = '{definition_id}';''',
                        capture=True,
                    )
                )
                assert count_after_a == initial_count_a + 1

                sessions_response = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions?limit=100",
                    headers=headers_a,
                )
                assert sessions_response.ok, sessions_response.text()
                sessions_a = payload(sessions_response)["items"]
                own_session = next(item for item in sessions_a if item["id"] == attempt_a)
                assert own_session["enrollmentId"] == enrollment_a
                assert own_session["status"] in {"SUBMITTED", "PROCESSING", "COMPLETED"}

                anonymous = playwright.request.new_context()
                try:
                    unauthenticated = anonymous.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices")
                    assert unauthenticated.status == 401
                finally:
                    anonymous.dispose()
                nonexistent_attempt = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{uuid.uuid4()}",
                    headers=headers_a,
                )
                assert nonexistent_attempt.status == 404
                cross_enrollment = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/history?enrollmentId={enrollment_b}",
                    headers=headers_a,
                )
                assert cross_enrollment.status == 403

                page.route("**/assessments/sessions?*", lambda route: route.abort("internetdisconnected"))
                page.goto(f"{BASE}/student/practices/history/", wait_until="domcontentloaded")
                page.get_by_text("加载历史失败").wait_for(timeout=20_000)
                page.unroute("**/assessments/sessions?*")
                page.locator("[data-retry]").click()
                page.locator(f'[data-history-session="{attempt_a}"]').wait_for(timeout=20_000)

                student_b = authenticate(page, identifier_b)
                headers_b = {"Authorization": f"Bearer {student_b['accessToken']}"}
                practice_b = practice_in_catalog(page, headers_b)
                assert practice_b["id"] == definition_id
                page.goto(f"{BASE}/student/today/", wait_until="networkidle")
                page.locator(".today-link-card").click()
                page.wait_for_url("**/student/practices/", timeout=20_000)
                page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE).locator("h2 a").click()
                page.wait_for_url(f"**/student/practices/{definition_id}/", timeout=20_000)
                page.locator("[data-start]").click()
                page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
                attempt_b = page.url.split("/attempts/")[1].split("/")[0]
                page.locator(".question-shell").wait_for(timeout=20_000)
                assert attempt_b != attempt_a
                page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
                row_b = page.locator(f'[data-history-session="{attempt_b}"]')
                row_b.wait_for(timeout=20_000)
                attempt_b_response = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_b}",
                    headers=headers_b,
                )
                assert attempt_b_response.ok, attempt_b_response.text()
                status_b = payload(attempt_b_response)["status"]
                status_labels = {"CREATED": "待开始", "IN_PROGRESS": "进行中", "SUBMITTED": "已提交", "PROCESSING": "处理中", "COMPLETED": "已完成"}
                row_b.get_by_text(status_labels[status_b]).wait_for()
                assert page.locator(f'[data-history-session="{attempt_a}"]').count() == 0

                foreign_attempt = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_a}",
                    headers=headers_b,
                )
                assert foreign_attempt.status in (403, 404)
                page.set_viewport_size({"width": 1280, "height": 900})
                page.wait_for_timeout(100)
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 1000})
                page.wait_for_timeout(100)
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
                assert page_errors == [], page_errors
                print(json.dumps({"attemptA": attempt_a, "attemptB": attempt_b, "enrollmentA": enrollment_a, "enrollmentB": enrollment_b, "statusA": own_session["status"], "statusB": status_b, "completion": completion}, ensure_ascii=False))
            finally:
                browser.close()
    finally:
        session_ids = [value for value in [attempt_a, attempt_b] if value]
        if session_ids:
            sql('DELETE FROM "AssessmentSession" WHERE "id" IN (' + ",".join(f"'{value}'" for value in session_ids) + ");")
        sql(f'''DELETE FROM "Membership" WHERE "userId" = '{user_b_id}';
                DELETE FROM "Enrollment" WHERE "userId" = '{user_b_id}';
                DELETE FROM "User" WHERE "id" = '{user_b_id}';''')
