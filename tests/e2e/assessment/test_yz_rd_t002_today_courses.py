"""Opt-in isolated real API/DB proof; positive navigation never stubs responses.

Run only against the task-owned runtime (see the versioned plan's evidence).
Fictional identities and already-OPEN deliveries are explicit DB fixtures.
Course content/publication uses teacher APIs. The DRAFT→OPEN API gap is NOT passed.
Only failure/latency tests intercept requests. No speech process is needed.
"""
import json
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T002_BASE_URL", "")
SCHOOL = "11111111-1111-4111-8111-111111111111"
PASSWORD = "YuzanTest!2026"
pytestmark = pytest.mark.skipif(not BASE, reason="requires YZ_T002 isolated runtime")


def sql(statement):
    container = os.environ["YZ_T002_DB_CONTAINER"]
    assert container.startswith("yz-rd-t002-")
    assert urlparse(BASE).hostname == "127.0.0.1"
    project = subprocess.check_output(
        ["docker", "inspect", container, "--format", '{{index .Config.Labels "com.docker.compose.project"}}'], text=True
    ).strip()
    assert project.startswith("yz-rd-t002-")
    return subprocess.check_output(
        ["docker", "exec", "-i", container, "psql", "-U", os.environ["YZ_T002_DB_USER"],
         "-d", os.environ["YZ_T002_DB_NAME"], "-At", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True,
    ).strip()


def body(response):
    assert response.ok, f"{response.status}: {response.text()}"
    value = response.json()
    return value.get("data", value)


class AuthorizedSession(dict):
    def __repr__(self):
        return "<authorized fictional session>"


def login(request, identifier):
    return AuthorizedSession(body(request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})))


def authenticate(page, session):
    page.goto(f"{BASE}/login/")
    page.evaluate("""session => {
      localStorage.setItem('yuzan-access-token', session.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
      localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
    }""", session)


@pytest.fixture
def runtime():
    suffix = uuid.uuid4().hex
    student, other, class_id, enrollment = [str(uuid.uuid4()) for _ in range(4)]
    # Only fictional identities in an isolated DB. No state/score bypass for the
    # tested student path; course publication and student submission are real APIs.
    sql(f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
      SELECT '{class_id}',"schoolId","termId",'T002 class {suffix}','七年级',now(),now()
      FROM "Class" WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{student}','t002-{suffix}','T002 fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE "loginIdentifier"='student.test';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{other}','t002-other-{suffix}','T002 other fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE id='{student}';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
      ('{uuid.uuid4()}','{SCHOOL}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{other}','STUDENT','ACTIVE',now());
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
      ('{enrollment}','{SCHOOL}','{class_id}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{class_id}','{other}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{class_id}','33333333-3333-4333-8333-333333333333','TEACHER','ACTIVE',now());''')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 960})
        session = login(page.request, f"t002-{suffix}")
        authenticate(page, session)
        yield page, session, enrollment, login(page.request, f"t002-other-{suffix}")
        browser.close()


def create_course(page, enrollment):
    teacher = login(page.request, "teacher.test")
    headers = {"Authorization": f"Bearer {teacher['accessToken']}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    objective = {"originalText": "阅读后确认完成", "locale": "zh-CN", "translationSource": "NONE", "reviewStatus": "REVIEWED"}
    course = body(page.request.post(f"{prefix}/course-versions", headers=headers, data={
        "title": f"T002 阅读路径 {uuid.uuid4().hex[:8]}", "objectives": [objective],
    }))
    detail = body(page.request.get(f"{prefix}/course-versions/{course['id']}", headers=headers))
    activity = str(uuid.uuid4())
    body(page.request.patch(f"{prefix}/course-versions/{course['id']}", headers=headers, data={
        "expectedUpdatedAt": detail["updatedAt"], "units": [{"id": str(uuid.uuid4()), "title": "阅读单元", "sortOrder": 0,
        "lessons": [{"id": str(uuid.uuid4()), "title": "阅读课次", "sortOrder": 0,
        "activities": [{"id": activity, "title": "阅读后确认", "type": "TEXT", "sortOrder": 0,
        "required": True, "resources": [], "instruction": objective,
        "teacherNotes": objective, "studentNotes": objective,
        "content": {"text": "这是教师通过真实课程 API 发布的隔离验收阅读内容。"}}]}]}],
    }))
    body(page.request.post(f"{prefix}/course-versions/{course['id']}/publish", headers=headers, data={}))
    now = datetime.now(timezone.utc)
    # Fixture represents an already-open delivery, as used by the existing
    # trusted importer/seed. The separate teacher create DRAFT → open API probe
    # returned 409 (no scheduling endpoint); do not pretend that path passed.
    # No permissions are bypassed by student reads/writes or negative controls.
    assignment = str(uuid.uuid4())
    title = course["title"]
    sql(f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt","createdAt","updatedAt")
      VALUES ('{assignment}','{SCHOOL}','{course["id"]}','33333333-3333-4333-8333-333333333333','{title}','OPEN','{(now-timedelta(minutes=1)).isoformat()}','{(now+timedelta(days=1)).isoformat()}',now(),now(),now());
      INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","enrollmentId")
      VALUES ('{uuid.uuid4()}','{SCHOOL}','{assignment}','STUDENT','{enrollment}');''')
    return assignment, title, activity



def open_today(page):
    page.goto(f"{BASE}/student/today/")
    expect(page.locator("#todayApp")).not_to_have_attribute("data-state", "loading")
    expect(page.locator("[data-course-state]")).not_to_have_attribute("data-course-state", "loading")


@pytest.mark.parametrize("later_class", [False, True])
def test_three_dynamic_course_entries_refresh_return_and_scope(runtime, later_class):
    page, session, enrollment, other = runtime
    if later_class:
        class_id, later_enrollment = str(uuid.uuid4()), str(uuid.uuid4())
        student = session["user"]["id"]
        sql(f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          SELECT '{class_id}',"schoolId","termId",'T002 later {uuid.uuid4().hex}','七年级',now(),now()
          FROM "Class" WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
          INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
          ('{later_enrollment}','{SCHOOL}','{class_id}','{student}','STUDENT','ACTIVE',now()),
          ('{uuid.uuid4()}','{SCHOOL}','{class_id}','33333333-3333-4333-8333-333333333333','TEACHER','ACTIVE',now());''')
        enrollment = later_enrollment
    assignment, title, activity = create_course(page, enrollment)
    for selector in ("[data-primary-action]", ".today-course-item a", ".today-lists a"):
        open_today(page)
        assert page.locator("[data-course-state]").get_attribute("data-course-state") == "ready", page.locator(".today-course-wrap").inner_text()
        assert page.evaluate("window.__studentTodayData.primaryAction.kind") == "LEGACY_ASSIGNMENT"
        assert page.evaluate("window.__studentTodayData.legacyTasks[0].assignmentId") == assignment
        with page.expect_response(lambda response: f"/student/courses/{assignment}" in response.url and response.request.method == "GET") as loaded:
            page.locator(selector).first.click()
        assert loaded.value.status == 200
        page.wait_for_url(f"**/student/courses/course-detail/?id={assignment}")
        expect(page.locator("#cpHeroTitle")).to_have_text(title)
        state = page.evaluate("CoursePlayerState.getState()")
        assert state["assignmentId"] == assignment
        assert state["currentActivityId"] == activity
        expect(page.get_by_text("这是教师通过真实课程 API 发布的隔离验收阅读内容。")).to_be_visible()
        acknowledge = page.get_by_role("button", name="确认阅读", exact=True)
        if acknowledge.count():
            acknowledge.click()
            expect(page.get_by_text("已确认", exact=True)).to_be_visible()
        artifacts = os.environ.get("YZ_T002_ARTIFACT_DIR")
        if artifacts:
            os.makedirs(artifacts, exist_ok=True)
            page.screenshot(path=f"{artifacts}/course-ready-{later_class}.png", full_page=True)
        submission = state["submissionId"]
        page.reload()
        expect(page.locator("#cpHeroTitle")).to_have_text(title)
        assert page.evaluate("CoursePlayerState.getState().submissionId") == submission
        page.go_back()
        expect(page.locator("[data-primary-action]")).to_be_visible()
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}/student/courses"
    denied = page.request.get(f"{prefix}/{assignment}", headers={"Authorization": f"Bearer {other['accessToken']}"})
    assert denied.status in (403, 404)
    missing = page.request.get(f"{prefix}/{uuid.uuid4()}", headers={"Authorization": f"Bearer {session['accessToken']}"})
    assert missing.status == 404
    # DB proof: all three entry sources resume exactly one real Submission.
    rows = sql(f'''SELECT count(*) FROM "Submission" WHERE "assignmentId"='{assignment}' AND "enrollmentId"='{enrollment}';''')
    assert rows == "1"
    assert sql(f'''SELECT completed FROM "ActivityProgress" WHERE "activityId"='{activity}' AND "enrollmentId"='{enrollment}';''') == "t"
    artifacts = os.environ.get("YZ_T002_ARTIFACT_DIR")
    if artifacts:
        os.makedirs(artifacts, exist_ok=True)
        page.screenshot(path=f"{artifacts}/today-ready.png", full_page=True)
    print(json.dumps({"assignmentId": assignment, "activityId": activity, "submissionId": submission,
                      "entrySources": 3, "laterClass": later_class, "submissionRows": 1, "otherStudentStatus": denied.status, "missingStatus": missing.status}))


def test_today_failures_empty_loading_and_recovery(runtime):
    page, session, enrollment, _ = runtime
    open_today(page)
    expect(page.locator("#todayApp")).to_have_attribute("data-state", "empty")
    expect(page.locator("[data-course-state]")).to_have_attribute("data-course-state", "empty")
    assignment, title, _ = create_course(page, enrollment)
    catalog = f"**/api/v1/schools/{SCHOOL}/student/courses?*"
    page.route(catalog, lambda route: route.abort("failed"))
    open_today(page)
    expect(page.locator("[data-course-state]")).to_have_attribute("data-course-state", "error")
    expect(page.get_by_text("课程列表加载失败，暂时无法确认可学课程。")).to_be_visible()
    expect(page.locator("[data-primary-action]")).to_be_visible()
    artifacts = os.environ.get("YZ_T002_ARTIFACT_DIR")
    if artifacts:
        os.makedirs(artifacts, exist_ok=True)
        page.screenshot(path=f"{artifacts}/today-course-error.png", full_page=True)
    page.unroute(catalog)
    page.locator("[data-courses-retry]").click()
    expect(page.locator(".today-course-item h3")).to_have_text(title)
    today_url = f"**/api/v1/schools/{SCHOOL}/student/today"
    page.route(today_url, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    page.reload()
    expect(page.locator("#todayApp")).to_have_attribute("data-state", "error")
    expect(page.get_by_text("当前账号没有访问权限，请确认学校或联系老师后重试。")).to_be_visible()
    expect(page.locator("[data-primary-action]")).to_have_count(0)
    page.unroute(today_url)
    page.locator("[data-today-retry]").click()
    expect(page.locator("[data-primary-action]")).to_be_visible()
    # Pause only the catalog: a slow secondary request cannot hide primary CTA.
    pending = []
    page.route(catalog, lambda route: pending.append(route))
    page.reload()
    expect(page.locator("[data-primary-action]")).to_be_visible()
    expect(page.locator("[data-course-state]")).to_have_attribute("data-course-state", "loading")
    assert pending
    pending[0].continue_()
    expect(page.locator("[data-course-state]")).to_have_attribute("data-course-state", "ready")
    page.unroute(catalog)
    # The destination's real 404 and existing retry UI recover without fake content.
    detail_url = f"**/api/v1/schools/{SCHOOL}/student/courses/{assignment}"
    page.route(detail_url, lambda route: route.fulfill(status=404, json={"message": "not found"}))
    page.locator("[data-primary-action]").click()
    expect(page.locator("#cpError")).to_be_visible()
    page.unroute(detail_url)
    page.locator("#cpRetryBtn").click()
    expect(page.locator("#cpHeroTitle")).to_have_text(title)


def test_baseline_primary_keeps_existing_real_runner(runtime):
    page, session, _, other = runtime
    # Give this fictional student a legitimate active enrollment in the seeded
    # delivery class; Today still derives authority entirely on the server.
    student = session["user"]["id"]
    sql(f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
      ('{uuid.uuid4()}','{SCHOOL}','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{student}','STUDENT','ACTIVE',now());''')
    open_today(page)
    assert page.evaluate("window.__studentTodayData.primaryAction.kind") == "BASELINE"
    definition = page.evaluate("window.__studentTodayData.primaryAction.target.practiceDefinitionId")
    denied = page.request.post(f"{BASE}/api/v1/schools/{SCHOOL}/practices/{definition}/attempts",
        headers={"Authorization": f"Bearer {other['accessToken']}"}, data={})
    assert denied.status == 404
    with page.expect_response(lambda response: f"/practices/{definition}/attempts" in response.url) as created:
        page.locator("[data-primary-action]").click()
    assert created.value.ok
    page.wait_for_url("**/student/practices/attempts/*/runner/")
    attempt = page.url.split("/attempts/")[1].split("/")[0]
    expect(page.locator(".question-shell")).to_be_visible()
    page.reload()
    expect(page.locator(".question-shell")).to_be_visible()
    page.go_back()
    expect(page.locator("[data-primary-action]")).to_be_visible()
    print(json.dumps({"practiceDefinitionId": definition, "attemptId": attempt, "runnerVisible": True}))
