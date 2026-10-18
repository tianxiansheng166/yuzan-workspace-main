"""T020 real Chromium, NestJS, PostgreSQL and MinIO teacher-home acceptance."""

from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright
from test_yz_rd_t008_student_history import (
    PRACTICE_TITLE,
    complete_real_attempt,
    practice_in_catalog,
)


BASE = os.environ.get("YZ_T020_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T020_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T020_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T020_EVIDENCE_DIR", ""))
SCHOOL_A = "11111111-1111-4111-8111-111111111111"
TEACHER_TEMPLATE_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222"


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t020"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t020_native"
    password = unquote(parsed.password or "")
    assert password and password == os.environ["POSTGRES_PASSWORD"]
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
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


def sql_scalar(statement):
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def verify_runtime_identity():
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    assert identity.startswith("yuzan_t020_native|yz_t020|PostgreSQL 17."), identity.split("|", 2)[:2]
    assert os.environ["YZ_T020_S3_BUCKET"] == "yz-t020-native"
    assert urlparse(os.environ["YZ_T020_S3_ENDPOINT"]).port == int(os.environ["YZ_T020_MINIO_API_PORT"])
    return identity.split("|", 2)[:2]


def seed_t020_identities():
    suffix = uuid.uuid4().hex[:10]
    ids = {
        "school_a": SCHOOL_A,
        "school_c": str(uuid.uuid4()),
        "teacher_a": str(uuid.uuid4()),
        "teacher_b": str(uuid.uuid4()),
        "teacher_c": str(uuid.uuid4()),
        "teacher_empty": str(uuid.uuid4()),
        "student_a1": str(uuid.uuid4()),
        "student_a2": str(uuid.uuid4()),
        "student_b": str(uuid.uuid4()),
        "student_c": str(uuid.uuid4()),
        "class_a1": str(uuid.uuid4()),
        "class_a2": str(uuid.uuid4()),
        "class_b": str(uuid.uuid4()),
        "class_c": str(uuid.uuid4()),
        "term_a1": str(uuid.uuid4()),
        "term_a2": str(uuid.uuid4()),
        "term_b": str(uuid.uuid4()),
        "term_c": str(uuid.uuid4()),
        "enrollment_a1": str(uuid.uuid4()),
        "enrollment_a2": str(uuid.uuid4()),
        "enrollment_a_student1": str(uuid.uuid4()),
        "enrollment_a_student2": str(uuid.uuid4()),
        "enrollment_b": str(uuid.uuid4()),
        "enrollment_b_student": str(uuid.uuid4()),
        "enrollment_c": str(uuid.uuid4()),
        "enrollment_c_student": str(uuid.uuid4()),
        "assignment_a": str(uuid.uuid4()),
        "assignment_a2": str(uuid.uuid4()),
        "assignment_b": str(uuid.uuid4()),
        "assignment_c": str(uuid.uuid4()),
        "submission_a": str(uuid.uuid4()),
        "course_a": str(uuid.uuid4()),
        "course_b": str(uuid.uuid4()),
        "course_c": str(uuid.uuid4()),
        "version_a": str(uuid.uuid4()),
        "version_b": str(uuid.uuid4()),
        "version_c": str(uuid.uuid4()),
    }
    logins = {
        "teacher_a": f"teacher.t020.a.{suffix}@test.invalid",
        "teacher_b": f"teacher.t020.b.{suffix}@test.invalid",
        "teacher_c": f"teacher.t020.c.{suffix}@test.invalid",
        "teacher_empty": f"teacher.t020.empty.{suffix}@test.invalid",
        "student_a1": f"student.t020.a1.{suffix}@test.invalid",
        "student_a2": f"student.t020.a2.{suffix}@test.invalid",
        "student_b": f"student.t020.b.{suffix}@test.invalid",
        "student_c": f"student.t020.c.{suffix}@test.invalid",
    }
    names = {
        "teacher_a": f"TEST_FIXTURE_ONLY T020 教师甲 {suffix}",
        "teacher_b": f"TEST_FIXTURE_ONLY T020 教师乙 {suffix}",
        "teacher_c": f"TEST_FIXTURE_ONLY T020 教师丙 {suffix}",
        "teacher_empty": f"TEST_FIXTURE_ONLY T020 空任务教师 {suffix}",
        "student_a1": f"TEST_FIXTURE_ONLY T020 学生甲一 {suffix}",
        "student_a2": f"TEST_FIXTURE_ONLY T020 学生甲二 {suffix}",
        "student_b": f"TEST_FIXTURE_ONLY T020 学生乙 {suffix}",
        "student_c": f"TEST_FIXTURE_ONLY T020 学生丙 {suffix}",
    }
    membership_ids = {key: str(uuid.uuid4()) for key in ("teacher_a", "teacher_b", "teacher_c", "teacher_empty", "student_a1", "student_a2", "student_b", "student_c")}

    user_rows = []
    for key in ("teacher_a", "teacher_b", "teacher_c", "teacher_empty"):
        user_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
              SELECT {q(ids[key])},{q(logins[key])},{q(names[key])},"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(TEACHER_TEMPLATE_ID)};'''
        )
    for key in ("student_a1", "student_a2", "student_b", "student_c"):
        user_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
              SELECT {q(ids[key])},{q(logins[key])},{q(names[key])},"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(STUDENT_TEMPLATE_ID)};'''
        )

    membership_rows = []
    for key, role, school_key in (
        ("teacher_a", "TEACHER", "school_a"),
        ("teacher_b", "TEACHER", "school_a"),
        ("teacher_c", "TEACHER", "school_c"),
        ("teacher_empty", "TEACHER", "school_a"),
        ("student_a1", "STUDENT", "school_a"),
        ("student_a2", "STUDENT", "school_a"),
        ("student_b", "STUDENT", "school_a"),
        ("student_c", "STUDENT", "school_c"),
    ):
        membership_rows.append(
            f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
              VALUES ({q(membership_ids[key])},{q(ids[school_key])},{q(ids[key])},{q(role)},'ACTIVE',NOW());'''
        )

    term_specs = (
        ("term_a1", "school_a", f"T020 甲班学期一 {suffix}"),
        ("term_a2", "school_a", f"T020 甲班学期二 {suffix}"),
        ("term_b", "school_a", f"T020 乙班学期 {suffix}"),
        ("term_c", "school_c", f"T020 丙班学期 {suffix}"),
    )
    term_rows = [
        f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(ids[term_key])},{q(ids[school_key])},{q(name)},'2026-01-01','2036-12-31',true,NOW());'''
        for term_key, school_key, name in term_specs
    ]
    class_specs = (
        ("class_a1", "school_a", "term_a1", f"TEST_FIXTURE_ONLY T020 甲班一 {suffix}"),
        ("class_a2", "school_a", "term_a2", f"TEST_FIXTURE_ONLY T020 甲班二 {suffix}"),
        ("class_b", "school_a", "term_b", f"TEST_FIXTURE_ONLY T020 乙班 {suffix}"),
        ("class_c", "school_c", "term_c", f"TEST_FIXTURE_ONLY T020 丙班 {suffix}"),
    )
    class_rows = [
        f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({q(ids[class_key])},{q(ids[school_key])},{q(ids[term_key])},{q(name)},'七年级',NOW(),NOW());'''
        for class_key, school_key, term_key, name in class_specs
    ]
    enrollment_specs = (
        ("enrollment_a1", "school_a", "class_a1", "teacher_a", "TEACHER"),
        ("enrollment_a2", "school_a", "class_a2", "teacher_a", "TEACHER"),
        ("enrollment_a_student1", "school_a", "class_a1", "student_a1", "STUDENT"),
        ("enrollment_a_student2", "school_a", "class_a2", "student_a2", "STUDENT"),
        ("enrollment_b", "school_a", "class_b", "teacher_b", "TEACHER"),
        ("enrollment_b_student", "school_a", "class_b", "student_b", "STUDENT"),
        ("enrollment_c", "school_c", "class_c", "teacher_c", "TEACHER"),
        ("enrollment_c_student", "school_c", "class_c", "student_c", "STUDENT"),
    )
    enrollment_rows = [
        f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(ids[enrollment_key])},{q(ids[school_key])},{q(ids[class_key])},{q(ids[user_key])},{q(role)},'ACTIVE',NOW());'''
        for enrollment_key, school_key, class_key, user_key, role in enrollment_specs
    ]

    school_c = f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
      VALUES ({q(ids['school_c'])},{q('YZ-T020-'+suffix)},{q('TEST_FIXTURE_ONLY T020 丙学校 '+suffix)},'TEST',NOW(),NOW());'''
    course_rows = []
    for key, version_key, school_key, teacher_key, title in (
        ("course_a", "version_a", "school_a", "teacher_a", f"T020 甲教师真实课程 {suffix}"),
        ("course_b", "version_b", "school_a", "teacher_b", f"T020 乙教师真实课程 {suffix}"),
        ("course_c", "version_c", "school_c", "teacher_c", f"T020 丙教师真实课程 {suffix}"),
    ):
        course_rows.append(
            f'''INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
              VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[teacher_key])},{q('T020_'+suffix+'_'+key)},{q(title)},NOW(),NOW());
            INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"publishedAt","createdAt","updatedAt")
              VALUES ({q(ids[version_key])},{q(ids[school_key])},{q(ids[key])},1,'PUBLISHED',{q(title)},'zh-CN','[]'::jsonb,NOW(),NOW(),NOW());'''
        )

    assignment_rows = []
    for key, version_key, school_key, teacher_key, class_key, title in (
        ("assignment_a", "version_a", "school_a", "teacher_a", "class_a1", f"TEST_FIXTURE_ONLY T020 甲教师朗读任务 {suffix}"),
        ("assignment_a2", "version_a", "school_a", "teacher_a", "class_a2", f"TEST_FIXTURE_ONLY T020 甲班二待交任务 {suffix}"),
        ("assignment_b", "version_b", "school_a", "teacher_b", "class_b", f"TEST_FIXTURE_ONLY T020 乙教师任务 {suffix}"),
        ("assignment_c", "version_c", "school_c", "teacher_c", "class_c", f"TEST_FIXTURE_ONLY T020 丙教师任务 {suffix}"),
    ):
        target_id = str(uuid.uuid4())
        assignment_rows.append(
            f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt","createdAt","updatedAt")
              VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[version_key])},{q(ids[teacher_key])},{q(title)},'OPEN',NOW()-INTERVAL '1 day',NOW()+INTERVAL '2 days',NOW(),NOW(),NOW());
            INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
              VALUES ({q(target_id)},{q(ids[school_key])},{q(ids[key])},'CLASS',{q(ids[class_key])},NOW());'''
        )
    submission = f'''INSERT INTO "Submission" (id,"schoolId","assignmentId","enrollmentId","attemptNo",status,"idempotencyKey","submittedAt","createdAt","updatedAt")
      VALUES ({q(ids['submission_a'])},{q(ids['school_a'])},{q(ids['assignment_a'])},{q(ids['enrollment_a_student1'])},1,'NEEDS_REVIEW',{q('T020-'+suffix+'-submission-a')},NOW(),NOW(),NOW());'''
    sql(
        "BEGIN;\n" + school_c + "\n" + "\n".join(user_rows + membership_rows + term_rows + class_rows + enrollment_rows + course_rows + assignment_rows) + "\n" + submission + "\nCOMMIT;"
    )
    practice_version = sql_scalar(
        f'''SELECT v.id FROM "PracticeVersion" v
              JOIN "PracticeDefinition" d ON d.id=v."definitionId"
             WHERE d.title={q(PRACTICE_TITLE)} AND d.status='PUBLISHED' AND v.status='PUBLISHED'
             ORDER BY v.version DESC LIMIT 1;'''
    )
    delivery_id = str(uuid.uuid4())
    sql(
        f'''INSERT INTO "PracticeDelivery" (id,"practiceVersionId","schoolId","classId",mode,"reRecordPolicy","mobilePolicy",status,"createdAt","updatedAt")
            VALUES ({q(delivery_id)},{q(practice_version)},{q(ids['school_a'])},{q(ids['class_a1'])},'SELF_PRACTICE','{{}}'::jsonb,'{{"allowed":true}}'::jsonb,'OPEN',NOW(),NOW());'''
    )
    assert sql_scalar(f'''SELECT COUNT(*) FROM "PracticeDelivery" WHERE id={q(delivery_id)} AND "practiceVersionId"={q(practice_version)} AND "classId"={q(ids['class_a1'])} AND status='OPEN';''') == "1"
    ids["practiceVersionId"] = practice_version
    ids["practiceDeliveryId"] = delivery_id
    ids.update(logins=logins, names=names, suffix=suffix)
    return ids


def login_api(page, identifier):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    return payload(response)


def install_session(page, session):
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
        }""",
        session,
    )


def headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def save_home_responsive(page):
    results = []
    for width, height in ((390, 844), (768, 960), (1280, 920), (1440, 1000)):
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(320)
        layout = page.evaluate("""() => {
          const rect = element => {
            const box = element.getBoundingClientRect();
            return {x: box.x, right: box.right, y: box.y, bottom: box.bottom, width: box.width, height: box.height};
          };
          const main = document.querySelector('#teacherDashboard');
          const action = document.querySelector('#primaryTaskAction');
          return {
            viewport: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            sidebar: rect(document.querySelector('.ts-sidebar')),
            main: rect(main),
            action: rect(action),
            landscape: getComputedStyle(document.querySelector('.hero-landscape')).backgroundImage,
            live: document.querySelector('#dashboardState').getAttribute('aria-live'),
            refreshName: document.querySelector('#dashboardRefresh').getAttribute('type'),
          };
        }""")
        assert layout["viewport"] <= width + 1 and layout["scrollWidth"] <= width + 1, layout
        assert layout["main"]["right"] <= width + 1, layout
        if width > 760:
            assert layout["sidebar"]["right"] <= layout["main"]["x"] + 1, layout
        else:
            assert layout["sidebar"]["bottom"] <= layout["main"]["y"] + 1, layout
        assert layout["action"]["x"] >= -1 and layout["action"]["right"] <= width + 1, layout
        assert "hero-highland.webp" in layout["landscape"], "the highland background must remain visible"
        assert layout["live"] == "polite" and layout["refreshName"] == "button", layout
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        path = EVIDENCE_DIR / f"teacher-home-{width}.png"
        page.screenshot(path=str(path), full_page=True)
        results.append({"width": width, "height": height, "scrollWidth": layout["scrollWidth"], "screenshot": path.name})
    page.set_viewport_size({"width": 1280, "height": 920})
    return results


def minio_head_object(object_key):
    script = '''
const { createRequire } = require("node:module");
const path = require("node:path");
const root = process.cwd();
const requireFromApi = createRequire(path.resolve(root, "backend/api/package.json"));
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.YZ_T020_S3_ENDPOINT,
  region: process.env.YZ_T020_S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.YZ_T020_S3_ACCESS_KEY, secretAccessKey: process.env.YZ_T020_S3_SECRET_KEY },
});
(async () => {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: process.env.YZ_T020_S3_BUCKET, Key: process.env.YZ_T020_OBJECT_KEY }));
    process.stdout.write(JSON.stringify({bytes: head.ContentLength, contentType: head.ContentType}));
  } finally { client.destroy(); }
})().catch(error => { process.stderr.write(`${error.name || "S3_HEAD_FAILED"}\\n`); process.exitCode = 1; });'''
    env = {**os.environ, "YZ_T020_OBJECT_KEY": object_key}
    root = Path(__file__).resolve().parents[3]
    result = subprocess.run(["node", "-e", script], cwd=root, capture_output=True, text=True, env=env, check=False)
    if result.returncode:
        message = result.stderr
        for secret in (env.get("YZ_T020_S3_SECRET_KEY", ""), env.get("POSTGRES_PASSWORD", "")):
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"T020 MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


def click_record(log, page, label, locator):
    log.append({"action": label, "urlBefore": page.url, "href": locator.get_attribute("href")})
    locator.click()


def test_teacher_home_routes_real_actions_and_reloads_authorized_data():
    db_identity = verify_runtime_identity()
    fixture = seed_t020_identities()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    click_log = []
    api_responses = []
    page_errors = []
    evidence = {"database": db_identity, "ids": fixture.copy(), "responses": [], "faultInjection": []}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        teacher_context = browser.new_context(viewport={"width": 1280, "height": 920})
        teacher_page = teacher_context.new_page()
        teacher_page.on("pageerror", lambda error: page_errors.append(str(error)))
        teacher_page.on("response", lambda response: api_responses.append({
            "method": response.request.method,
            "path": urlparse(response.url).path,
            "status": response.status,
        }) if "/api/v1/" in response.url else None)
        try:
            session_a = login_api(teacher_page, fixture["logins"]["teacher_a"])
            session_b = login_api(teacher_page, fixture["logins"]["teacher_b"])
            session_c = login_api(teacher_page, fixture["logins"]["teacher_c"])
            session_empty = login_api(teacher_page, fixture["logins"]["teacher_empty"])
            assert session_a["activeSchoolId"] == SCHOOL_A
            assert session_b["activeSchoolId"] == SCHOOL_A
            assert session_c["activeSchoolId"] == fixture["school_c"]

            anonymous = playwright.request.new_context()
            try:
                unauthenticated = anonymous.get(f"{BASE}/api/v1/schools/{SCHOOL_A}/teacher/dashboard")
                assert unauthenticated.status == 401
            finally:
                anonymous.dispose()
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{SCHOOL_A}/teacher/dashboard", "status": 401})

            install_session(teacher_page, session_a)
            teacher_page.goto(f"{BASE}/teacher/", wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=25_000)
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}", timeout=25_000)
            expect(teacher_page.locator("#classList .class-card")).to_have_count(2, timeout=25_000)
            teacher_page.locator("#studentClassSelect").select_option(fixture["class_a1"])
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a1"], timeout=25_000)
            expect(teacher_page.locator("#studentState")).to_contain_text("暂无有效统计")
            expect(teacher_page.locator("#submissionReviewCount")).to_have_text("1")
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text("0")
            expect(teacher_page.get_by_role("heading", name="教学任务提交待查看")).to_be_visible()
            expect(teacher_page.get_by_role("heading", name="题库人工评分待复核")).to_be_visible()
            assert "0% 已记录活动完成度" not in teacher_page.locator("#studentState").inner_text()
            assert teacher_page.locator("#dashboardState").get_attribute("aria-live") == "polite"
            teacher_page.locator("#studentClassSelect").select_option(fixture["class_a1"])
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)

            dashboard_response = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/teacher/dashboard", headers=headers(session_a)
            )
            queue_response = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/assessment-reviews", headers=headers(session_a)
            )
            assert dashboard_response.ok and queue_response.ok
            dashboard_api = payload(dashboard_response)
            queue_api = payload(queue_response)
            submission_count = next(item["count"] for item in dashboard_api["workflow"] if item["id"] == "review")
            assert submission_count == 1
            assert queue_api["total"] == 0 and queue_api["items"] == []
            assert submission_count != queue_api["total"], "the two real queues must remain separately counted"
            task = next(item for item in dashboard_api["tasks"] if item["id"] == fixture["assignment_a"])
            assert task["id"] == fixture["assignment_a"] and task["done"] == 1 and task["total"] == 1
            evidence["initialCounts"] = {"taskSubmissionsPending": submission_count, "assessmentItemsPending": queue_api["total"]}

            # Fast repeated refresh must leave the latest real API result on screen.
            teacher_page.locator("#dashboardRefresh").click()
            teacher_page.locator("#dashboardRefresh").click()
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}", timeout=25_000)
            expect(teacher_page.locator("#submissionReviewCount")).to_have_text("1")

            # A queue network interruption leaves the successful dashboard and class areas usable.
            queue_pattern = re.compile(r"/api/v1/schools/[^/]+/assessment-reviews$")
            teacher_page.route(queue_pattern, lambda route: route.abort("internetdisconnected"))
            click_record(click_log, teacher_page, "dashboard-refresh-with-queue-network-interruption", teacher_page.locator("#dashboardRefresh"))
            expect(teacher_page.locator("#assessmentReviewStatus")).to_contain_text("读取失败", timeout=20_000)
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}")
            expect(teacher_page.locator("#classList")).to_contain_text("甲班")
            expect(teacher_page.locator("#assessmentReviewList")).to_contain_text("重试读取复核队列")
            teacher_page.unroute(queue_pattern)
            click_record(click_log, teacher_page, "retry-assessment-review-queue", teacher_page.locator("[data-retry-queue]"))
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text("0", timeout=20_000)
            evidence["faultInjection"].append({"area": "Assessment Review Queue", "kind": "browser network abort", "recoveredBy": "queue-only retry", "otherAreasRetained": True})

            # A controlled HTTP 503 is also isolated to the queue request; the retry reaches the live API.
            def reply_503(route):
                route.fulfill(status=503, content_type="application/json", body='{"message":"T020 controlled service-unavailable probe"}')

            teacher_page.route(queue_pattern, reply_503)
            click_record(click_log, teacher_page, "dashboard-refresh-with-queue-503", teacher_page.locator("#dashboardRefresh"))
            expect(teacher_page.locator("#assessmentReviewStatus")).to_contain_text("网络或服务暂时不可用", timeout=20_000)
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}")
            teacher_page.unroute(queue_pattern)
            click_record(click_log, teacher_page, "retry-after-503", teacher_page.locator("[data-retry-queue]"))
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text("0", timeout=20_000)
            evidence["faultInjection"].append({"area": "Assessment Review Queue", "kind": "HTTP 503 response fault injection", "recoveredBy": "queue-only retry", "otherAreasRetained": True})

            # Class list and student-summary failures have their own retry actions.
            classes_pattern = re.compile(r"/api/v1/schools/[^/]+/classes\?limit=100$")
            teacher_page.route(classes_pattern, lambda route: route.abort("internetdisconnected"))
            click_record(click_log, teacher_page, "dashboard-refresh-with-class-network-interruption", teacher_page.locator("#dashboardRefresh"))
            expect(teacher_page.locator("#classDataStatus")).to_contain_text("班级读取失败", timeout=20_000)
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}")
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text("0")
            teacher_page.unroute(classes_pattern)
            click_record(click_log, teacher_page, "retry-class-list", teacher_page.locator("[data-retry-classes]"))
            expect(teacher_page.locator("#classList .class-card")).to_have_count(2, timeout=20_000)
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)

            student_summary_pattern = re.compile(rf"/api/v1/schools/{SCHOOL_A}/classes/{fixture['class_a2']}/student-summaries$")
            teacher_page.route(student_summary_pattern, lambda route: route.abort("internetdisconnected"))
            teacher_page.locator("#studentClassSelect").select_option(fixture["class_a2"])
            expect(teacher_page.locator("#studentDataStatus")).to_contain_text("学情读取失败", timeout=20_000)
            expect(teacher_page.locator("#taskList")).to_contain_text(f"T020 甲教师朗读任务 {fixture['suffix']}")
            teacher_page.unroute(student_summary_pattern)
            click_record(click_log, teacher_page, "retry-student-summary", teacher_page.locator("[data-retry-students]"))
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a2"], timeout=20_000)
            assert fixture["names"]["student_a1"] not in teacher_page.locator("#studentState").inner_text()
            evidence["faultInjection"].extend([
                {"area": "Classes", "kind": "browser network abort", "recoveredBy": "class-only retry", "otherAreasRetained": True},
                {"area": "Student Summaries", "kind": "browser network abort", "recoveredBy": "student-summary-only retry", "otherAreasRetained": True},
            ])

            # Same-school teacher B owns another class but cannot read teacher A's class or student.
            denied_class = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/classes/{fixture['class_a1']}/students/{fixture['enrollment_a_student1']}",
                headers=headers(session_b),
            )
            assert denied_class.status == 403
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{SCHOOL_A}/classes/{fixture['class_a1']}/students/{fixture['enrollment_a_student1']}", "status": 403})
            denied_class_b = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/classes/{fixture['class_b']}/student-summaries",
                headers=headers(session_a),
            )
            assert denied_class_b.status in {403, 404}
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{SCHOOL_A}/classes/{fixture['class_b']}/student-summaries", "status": denied_class_b.status})
            denied_cross_school = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{fixture['school_c']}/teacher/dashboard",
                headers=headers(session_a),
            )
            assert denied_cross_school.status == 403
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{fixture['school_c']}/teacher/dashboard", "status": 403})
            missing_assignment = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/assignments/{uuid.uuid4()}", headers=headers(session_a)
            )
            assert missing_assignment.status == 404
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{SCHOOL_A}/assignments/<missing-id>", "status": 404})
            missing_review = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/assessment-reviews/{uuid.uuid4()}", headers=headers(session_a)
            )
            assert missing_review.status == 404
            api_responses.append({"method": "GET", "path": f"/api/v1/schools/{SCHOOL_A}/assessment-reviews/<missing-itemId>", "status": 404})

            # The Assignment href carries the server's ID and opens its real roster and stats.
            assignment_id = fixture["assignment_a"]
            task_title = f"TEST_FIXTURE_ONLY T020 甲教师朗读任务 {fixture['suffix']}"
            priority_assignment_id = fixture["assignment_a2"]
            priority_title = f"TEST_FIXTURE_ONLY T020 甲班二待交任务 {fixture['suffix']}"
            primary_action = teacher_page.locator("#primaryTaskAction")
            assert primary_action.get_attribute("href") == f"/teacher/assignments/?assignmentId={priority_assignment_id}"
            expect(primary_action).to_contain_text(priority_title)
            click_record(click_log, teacher_page, "open-server-priority-task-action", primary_action)
            teacher_page.wait_for_url(f"**/teacher/assignments/?assignmentId={priority_assignment_id}", timeout=20_000)
            teacher_page.locator(f'.row[data-id="{priority_assignment_id}"]').wait_for(timeout=25_000)
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text("目标 1 人 · 已提交 0", timeout=20_000)
            expect(teacher_page.locator(".assignment-roster")).to_contain_text(fixture["names"]["student_a2"], timeout=20_000)
            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=20_000)

            task_row = teacher_page.locator("#taskList .task-row").filter(has_text=task_title)
            task_href = task_row.get_attribute("href")
            assert task_href == f"/teacher/assignments/?assignmentId={assignment_id}"
            click_record(click_log, teacher_page, "open-real-assignment", task_row)
            teacher_page.wait_for_url(f"**/teacher/assignments/?assignmentId={assignment_id}", timeout=20_000)
            dynamic_assignment_row = teacher_page.locator(f'.row[data-id="{assignment_id}"]')
            dynamic_assignment_row.wait_for(timeout=25_000)
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text("目标 1 人 · 已提交 1", timeout=20_000)
            expect(teacher_page.locator(".assignment-roster")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            assert "T020 甲教师朗读任务" in teacher_page.locator(".dynamic-detail").inner_text()
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "assignment-detail-clicked.png"), full_page=True)
            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=20_000)

            # Teacher-home submission links retain the real Submission ID and open its details.
            submission_id = fixture["submission_a"]
            submission_link = teacher_page.locator(f'#reviewList a[href="/teacher/submissions/{submission_id}"]')
            expect(submission_link).to_be_visible()
            click_record(click_log, teacher_page, "open-real-teaching-submission", submission_link)
            teacher_page.wait_for_url(f"**/teacher/submissions/{submission_id}", timeout=20_000)
            expect(teacher_page.locator("body")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "submission-detail-clicked.png"), full_page=True)
            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=20_000)

            # Keyboard class switching loads new student summaries and clears the prior class rows.
            class_options = teacher_page.locator("#studentClassSelect option").evaluate_all("nodes => nodes.map(node => node.value)")
            assert len(class_options) == 2 and fixture["class_a1"] in class_options and fixture["class_a2"] in class_options
            if class_options[1] == fixture["class_a2"]:
                teacher_page.locator("#studentClassSelect").select_option(class_options[0])
                teacher_page.locator("#studentClassSelect").focus()
                teacher_page.keyboard.press("ArrowDown")
            else:
                teacher_page.locator("#studentClassSelect").select_option(class_options[1])
                teacher_page.locator("#studentClassSelect").focus()
                teacher_page.keyboard.press("ArrowUp")
            teacher_page.keyboard.press("Enter")
            expect(teacher_page.locator("#studentClassSelect")).to_have_value(fixture["class_a2"])
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a2"], timeout=20_000)
            assert fixture["names"]["student_a1"] not in teacher_page.locator("#studentState").inner_text()
            class_two_button = teacher_page.locator(f'#classList [data-class-id="{fixture["class_a2"]}"]')
            assert class_two_button.get_attribute("aria-pressed") == "true"
            teacher_page.locator("#studentClassSelect").select_option(fixture["class_a1"])
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            assert fixture["names"]["student_a2"] not in teacher_page.locator("#studentState").inner_text()

            # Enter the exact authorized class, then open the direct T014 student enrollment route.
            class_link = teacher_page.locator(f'#classList .class-card:has([data-class-id="{fixture["class_a1"]}"]) a')
            class_href = class_link.get_attribute("href")
            assert class_href == f"/teacher/classes/{fixture['class_a1']}?schoolId={SCHOOL_A}"
            click_record(click_log, teacher_page, "open-authorized-class", class_link)
            teacher_page.wait_for_url(f"**/teacher/classes/{fixture['class_a1']}?schoolId={SCHOOL_A}", timeout=20_000)
            expect(teacher_page.locator("body")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#studentState")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)

            student_href = teacher_page.locator(f'#studentState a[href^="/teacher/students/{fixture["enrollment_a_student1"]}"]').get_attribute("href")
            assert student_href == f"/teacher/students/{fixture['enrollment_a_student1']}?schoolId={SCHOOL_A}&classId={fixture['class_a1']}"
            click_record(click_log, teacher_page, "open-authorized-student-detail", teacher_page.locator(f'#studentState a[href="{student_href}"]'))
            teacher_page.wait_for_url(f"**/teacher/students/{fixture['enrollment_a_student1']}?schoolId={SCHOOL_A}&classId={fixture['class_a1']}", timeout=20_000)
            expect(teacher_page.locator("body")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            assert f"{fixture['class_a1']}" in teacher_page.locator("body").inner_text() or "甲班一" in teacher_page.locator("body").inner_text()
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "student-detail-clicked.png"), full_page=True)
            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=20_000)

            # Empty teacher and Teacher B render their own real server data.
            empty_result = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/teacher/dashboard", headers=headers(session_empty)
            )
            empty_classes = teacher_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/classes?limit=100", headers=headers(session_empty)
            )
            empty_class_data = payload(empty_classes)
            if isinstance(empty_class_data, dict):
                empty_class_data = empty_class_data.get("items")
            assert empty_result.ok and empty_classes.ok and empty_class_data == []
            empty_session_data = payload(empty_result)
            assert next(item["count"] for item in empty_session_data["workflow"] if item["id"] == "student") == 0
            empty_context = browser.new_context(viewport={"width": 1280, "height": 920})
            empty_page = empty_context.new_page()
            install_session(empty_page, session_empty)
            empty_page.goto(f"{BASE}/teacher/", wait_until="domcontentloaded")
            expect(empty_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_empty"], timeout=25_000)
            expect(empty_page.locator(".workflow-card-student .workflow-count")).to_have_text("0", timeout=20_000)
            expect(empty_page.locator("#classList")).to_contain_text("没有已授权班级", timeout=20_000)
            expect(empty_page.locator("#taskList")).to_contain_text("没有进行中的本人授权教学任务", timeout=20_000)
            empty_page.screenshot(path=str(EVIDENCE_DIR / "empty-teacher-home.png"), full_page=True)
            empty_context.close()
            evidence["emptyTeacher"] = {"authorizedClasses": 0, "authorizedStudents": 0}

            teacher_b_context = browser.new_context(viewport={"width": 1280, "height": 920})
            teacher_b_page = teacher_b_context.new_page()
            install_session(teacher_b_page, session_b)
            teacher_b_page.goto(f"{BASE}/teacher/", wait_until="domcontentloaded")
            expect(teacher_b_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_b"], timeout=25_000)
            expect(teacher_b_page.locator("#classList")).to_contain_text("乙班", timeout=20_000)
            expect(teacher_b_page.locator("#studentState")).to_contain_text(fixture["names"]["student_b"], timeout=20_000)
            assert fixture["names"]["student_a1"] not in teacher_b_page.locator("#studentState").inner_text()
            teacher_b_page.screenshot(path=str(EVIDENCE_DIR / "teacher-b-home.png"), full_page=True)
            evidence["teacherB"] = {"schoolId": session_b["activeSchoolId"], "classId": fixture["class_b"], "studentVisible": fixture["names"]["student_b"], "teacherAStudentAbsent": True}
            teacher_b_context.close()

            # Missing task IDs render an understandable 404-style message on the existing assignment detail route.
            missing_id = str(uuid.uuid4())
            teacher_page.goto(f"{BASE}/teacher/assignments/?assignmentId={missing_id}", wait_until="domcontentloaded")
            expect(teacher_page.locator(".assignment-deeplink-error")).to_contain_text("无法打开该任务", timeout=25_000)
            teacher_page.go_back(wait_until="domcontentloaded")

            # Create a real Student practice attempt and upload its recording evidence into the T020 MinIO bucket.
            student_context = browser.new_context(
                viewport={"width": 1280, "height": 920},
                permissions=["microphone"],
            )
            student_page = student_context.new_page()
            student_session = login_api(student_page, fixture["logins"]["student_a1"])
            student_headers = headers(student_session)
            install_session(student_page, student_session)
            student_page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            practice = practice_in_catalog(student_page, student_headers, base_url=BASE)
            assert practice["title"] == PRACTICE_TITLE
            practice_tile = student_page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
            practice_tile.wait_for(timeout=20_000)
            click_record(click_log, student_page, "student-open-practice", practice_tile.locator("h2 a"))
            student_page.wait_for_url(f"**/student/practices/{practice['id']}/", timeout=20_000)
            click_record(click_log, student_page, "student-start-real-practice", student_page.locator("[data-start]"))
            student_page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            student_page.locator(".question-shell").wait_for(timeout=20_000)
            attempt_id = student_page.url.split("/attempts/")[1].split("/")[0]
            original_wait = student_page.wait_for_function

            def wait_for_audio_played(expression, *args, **kwargs):
                if expression == "document.querySelector('.audio-stimulus audio')?.currentTime > 0":
                    expression = "document.querySelector('.audio-stimulus audio')?.played?.length > 0"
                return original_wait(expression, *args, **kwargs)

            student_page.wait_for_function = wait_for_audio_played
            try:
                completion = complete_real_attempt(student_page, student_headers, attempt_id, base_url=BASE)
            finally:
                student_page.wait_for_function = original_wait
            assert completion["itemCount"] == 20 and completion["recordedAudio"] >= 1
            attempt_state = sql_scalar(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)} AND "schoolId"={q(SCHOOL_A)};'''
            )
            assert attempt_state == "PROCESSING"
            recordings = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r."mimeType",r.status::text
                     FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                    WHERE i."sessionId"={q(attempt_id)} ORDER BY i."sortOrder";'''
            )
            assert len(recordings) == completion["recordedAudio"]
            minio_evidence = []
            for item_id, recording_id, object_key, mime_type, recording_status in recordings:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert mime_type.startswith("audio/") and recording_status in {"READY", "PROCESSING", "COMPLETE"}
                head = minio_head_object(object_key)
                assert head["bytes"] > 0 and head["contentType"].startswith("audio/")
                minio_evidence.append({"assessmentItemId": item_id, "recordingId": recording_id, "objectKey": object_key, **head})
            evidence["attemptId"] = attempt_id
            evidence["minioObjects"] = minio_evidence
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            student_context.close()

            # The real dashboard refresh displays distinct counts from Dashboard and Assessment Review Queue.
            click_record(click_log, teacher_page, "refresh-after-student-practice", teacher_page.locator("#dashboardRefresh"))
            queue_url = f"{BASE}/api/v1/schools/{SCHOOL_A}/assessment-reviews"
            live_queue_response = teacher_page.request.get(queue_url, headers=headers(session_a))
            assert live_queue_response.ok, live_queue_response.text()
            live_queue = payload(live_queue_response)
            student_items = [item for item in live_queue["items"] if item.get("student", {}).get("displayName") == fixture["names"]["student_a1"]]
            assert live_queue["total"] >= 2 and len(student_items) >= 2, live_queue
            evidence["queueBeforeReview"] = {
                "teachingSubmissionPendingCount": submission_count,
                "assessmentReviewItemTotal": live_queue["total"],
                "studentItemIds": [item["itemId"] for item in student_items],
            }
            review_item = next((item for item in student_items if item.get("strategy") == "SPEECH_READING"), student_items[0])
            item_id = review_item["itemId"]
            assert isinstance(item_id, str) and item_id
            expect(teacher_page.locator("#submissionReviewCount")).to_have_text("1", timeout=20_000)
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text(str(live_queue["total"]), timeout=20_000)
            expect(teacher_page.locator("#assessmentReviewList")).to_contain_text(fixture["names"]["student_a1"], timeout=20_000)
            assert "题库人工评分待复核" in teacher_page.locator("#assessmentReviewPanel").inner_text()
            home_before = EVIDENCE_DIR / "teacher-home-review-before-1280.png"
            teacher_page.screenshot(path=str(home_before), full_page=True)
            item_link = teacher_page.locator(f'#assessmentReviewList a[href="/teacher/reviews/{item_id}"]')
            expect(item_link).to_be_visible()
            item_href = item_link.get_attribute("href")
            assert item_href == f"/teacher/reviews/{item_id}"
            click_record(click_log, teacher_page, "open-dynamic-review-item", item_link)
            teacher_page.wait_for_url(f"**/teacher/reviews/{item_id}", timeout=20_000)
            teacher_page.locator("[data-review-score]").wait_for(timeout=20_000)
            expect(teacher_page.locator("[data-review-audio]")).to_be_visible(timeout=20_000)
            recording_audio = teacher_page.locator("[data-review-audio]").first
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "review-item-before-score-1280.png"), full_page=True)
            recording_audio.evaluate("audio => { audio.muted = true; return audio.play(); }")
            teacher_page.wait_for_function("document.querySelector('[data-review-audio]')?.played?.length > 0", timeout=15_000)
            max_score = float(review_item["maxScore"])
            score = round(max_score / 2, 1)
            comment = f"TEST_FIXTURE_ONLY T020 教师甲完成合法人工评分 {fixture['suffix']}。"
            teacher_page.locator("[data-review-score]").fill(str(score))
            teacher_page.locator("[data-review-comment]").fill(comment)
            click_record(click_log, teacher_page, "submit-one-real-assessment-review", teacher_page.locator("[data-review-submit]"))
            expect(teacher_page.locator(".saved-review-banner")).to_contain_text(f"{score:g} 分", timeout=25_000)
            expect(teacher_page.locator("[data-review-score]")).to_be_disabled()
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "review-item-after-score-1280.png"), full_page=True)

            reviewed_sql = sql_rows(
                f'''SELECT "scoredScore"::text,"reviewerUserId","reviewerComment","revision"::text,status::text
                     FROM "AssessmentItem" WHERE id={q(item_id)};'''
            )[0]
            assert reviewed_sql[0] == f"{score:g}" and reviewed_sql[1] == session_a["user"]["id"]
            assert reviewed_sql[2] == comment and reviewed_sql[4] == "REVIEWED"
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            evidence["reviewedItemId"] = item_id
            evidence["postgresReviewedItem"] = {
                "itemId": item_id,
                "score": reviewed_sql[0],
                "reviewerUserId": reviewed_sql[1],
                "comment": reviewed_sql[2],
                "revision": reviewed_sql[3],
                "status": reviewed_sql[4],
                "formalReportRowsAfterOneReview": 0,
            }

            teacher_page.go_back(wait_until="domcontentloaded")
            expect(teacher_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_a"], timeout=20_000)
            click_record(click_log, teacher_page, "refresh-dashboard-after-server-review-save", teacher_page.locator("#dashboardRefresh"))
            updated_queue_response = teacher_page.request.get(queue_url, headers=headers(session_a))
            assert updated_queue_response.ok
            updated_queue = payload(updated_queue_response)
            assert updated_queue["total"] == live_queue["total"] - 1
            assert item_id not in {item["itemId"] for item in updated_queue["items"]}
            expect(teacher_page.locator("#assessmentReviewCount")).to_have_text(str(updated_queue["total"]), timeout=25_000)
            expect(teacher_page.locator("#submissionReviewCount")).to_have_text("1")
            evidence["countsAfterReview"] = {"taskSubmissionsPending": 1, "assessmentItemsPending": updated_queue["total"]}
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "teacher-home-review-after-1280.png"), full_page=True)

            responsive = save_home_responsive(teacher_page)
            evidence["responsive"] = responsive
            teacher_page.locator("#dashboardRefresh").focus()
            teacher_page.keyboard.press("Tab")
            focused_tag = teacher_page.evaluate("document.activeElement?.tagName")
            assert focused_tag in {"A", "BUTTON", "SELECT", "INPUT"}, f"keyboard focus left interactive controls: {focused_tag}"
            evidence["accessibility"] = {
                "dashboardLiveRegion": teacher_page.locator("#dashboardState").get_attribute("aria-live"),
                "studentSelectorLabel": teacher_page.locator("#studentClassSelect").get_attribute("aria-label"),
                "keyboardFocusTagAfterTab": focused_tag,
                "keyboardSelectChangedClass": True,
            }

            # Teacher C belongs to another school. Its real identity switch must clear A and reject late A responses.
            stale_context = browser.new_context(viewport={"width": 1280, "height": 920})
            stale_page = stale_context.new_page()
            stale_errors = []
            stale_page.on("pageerror", lambda error: stale_errors.append(str(error)))
            install_session(stale_page, session_a)
            stale_page.add_init_script("""(() => {
              const realFetch = window.fetch.bind(window);
              window.__t020HoldDashboard = true;
              window.fetch = async (...args) => {
                const response = await realFetch(...args);
                const requestUrl = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
                if (window.__t020HoldDashboard && requestUrl.pathname.endsWith('/teacher/dashboard')) {
                  window.__t020HoldDashboard = false;
                  window.__t020OldDashboardHeld = true;
                  await new Promise(resolve => setTimeout(resolve, 1800));
                }
                return response;
              };
            })();""")
            stale_page.goto(f"{BASE}/teacher/", wait_until="domcontentloaded")
            stale_page.wait_for_function("window.__t020OldDashboardHeld === true", timeout=20_000)
            stale_page.evaluate(
                """credentials => YuzanApi.login(credentials.identifier, credentials.password)""",
                {"identifier": fixture["logins"]["teacher_c"], "password": PASSWORD},
            )
            expect(stale_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_c"], timeout=25_000)
            expect(stale_page.locator("#taskList")).to_contain_text(f"T020 丙教师任务 {fixture['suffix']}", timeout=25_000)
            expect(stale_page.locator("#classList")).to_contain_text("丙班", timeout=20_000)
            expect(stale_page.locator("#studentState")).to_contain_text(fixture["names"]["student_c"], timeout=20_000)
            assert fixture["names"]["student_a1"] not in stale_page.locator("#studentState").inner_text()
            stale_page.wait_for_timeout(2100)
            expect(stale_page.locator("#teacherGreeting")).to_contain_text(fixture["names"]["teacher_c"])
            expect(stale_page.locator("#taskList")).to_contain_text(f"T020 丙教师任务 {fixture['suffix']}")
            assert fixture["names"]["student_a1"] not in stale_page.locator("#classList").inner_text()
            assert not stale_errors, stale_errors
            stale_page.screenshot(path=str(EVIDENCE_DIR / "teacher-c-after-identity-switch.png"), full_page=True)
            evidence["staleIdentity"] = {"oldSchool": SCHOOL_A, "newSchool": fixture["school_c"], "oldResponseArrivedAfterSwitch": True, "oldTeacherDataVisible": False}
            stale_context.close()

            evidence["clicks"] = click_log
            evidence["responses"] = api_responses
            evidence["runtime"] = {
                "apiBase": BASE,
                "postgresDatabase": "yuzan_t020_native",
                "postgresUser": "yz_t020",
                "bucket": "yz-t020-native",
                "worker": "stopped",
                "docker": "not used",
            }
            (EVIDENCE_DIR / "click-log.json").write_text(json.dumps(click_log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (EVIDENCE_DIR / "api-responses.json").write_text(json.dumps(api_responses, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (EVIDENCE_DIR / "proof.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            assert not page_errors, page_errors
            assert any(item["status"] == 200 and "/assessment-reviews/" in item["path"] for item in api_responses), api_responses
        finally:
            teacher_context.close()
            browser.close()
