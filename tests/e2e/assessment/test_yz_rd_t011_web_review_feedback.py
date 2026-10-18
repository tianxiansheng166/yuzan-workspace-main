"""Native Chromium/API/PostgreSQL/MinIO acceptance for YZ-RD-T011."""

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import expect, sync_playwright
from test_yz_rd_t008_student_history import (
    PRACTICE_TITLE as LEVEL_ONE_PRACTICE_TITLE,
    complete_real_attempt as complete_level_one_attempt,
    practice_in_catalog,
)


BASE = os.environ.get("YZ_T011_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T011_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T011_PASSWORD", "")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
TEACHER_SEED_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_SEED_ID = "22222222-2222-4222-8222-222222222222"
COURSE_ID = "f3333333-3333-4333-8333-333333333333"
COURSE_VERSION_ID = "f4444444-4444-4444-8444-444444444444"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T011 native API/PostgreSQL/MinIO fixture",
)


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t011"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t011_native"
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
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    output = result.stdout.strip()
    return output if capture else ""


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def sql_scalar(statement):
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def verify_database_identity():
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    assert identity.startswith("yuzan_t011_native|yz_t011|PostgreSQL 17."), identity.split("|", 2)[:2]


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def login_api(page, identifier):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    return payload(response)


def authenticate(page, identifier):
    session = login_api(page, identifier)
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


def verify_minio_identity():
    assert os.environ["YZ_T011_S3_BUCKET"] == "yz-t011-native"
    assert urlparse(os.environ["YZ_T011_S3_ENDPOINT"]).port == int(os.environ["YZ_T011_MINIO_API_PORT"])


def minio_head_object(object_key):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T011_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.YZ_T011_S3_ENDPOINT,
  region: process.env.YZ_T011_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YZ_T011_S3_ACCESS_KEY,
    secretAccessKey: process.env.YZ_T011_S3_SECRET_KEY,
  },
});
(async () => {
  try {
    const head = await client.send(new HeadObjectCommand({
      Bucket: process.env.YZ_T011_S3_BUCKET,
      Key: process.env.YZ_T011_MINIO_OBJECT_KEY,
    }));
    process.stdout.write(JSON.stringify({bytes: head.ContentLength, contentType: head.ContentType}));
  } finally {
    client.destroy();
  }
})().catch(error => {
  process.stderr.write(`${error.name || "S3_HEAD_FAILED"}\n`);
  process.exitCode = 1;
});'''
    env = {**os.environ, "YZ_T011_MINIO_OBJECT_KEY": object_key}
    result = subprocess.run(["node", "-e", script], cwd=Path(__file__).resolve().parents[3], capture_output=True, text=True, env=env)
    if result.returncode:
        message = result.stderr
        for secret in (env.get("YZ_T011_S3_SECRET_KEY", ""), env.get("POSTGRES_PASSWORD", "")):
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


def create_teacher_fixture(label):
    suffix = uuid.uuid4().hex[:10]
    values = {
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "term": str(uuid.uuid4()),
        "class": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"teacher.t011.{label}.{suffix}@test.invalid",
        "name": f"TEST_FIXTURE_ONLY T011 教师{label} {suffix}",
        "class_name": f"TEST_FIXTURE_ONLY T011 班级{label} {suffix}",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(values['user'])},{q(values['login'])},{q(values['name'])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(values['membership'])},{q(SCHOOL_ID)},{q(values['user'])},'TEACHER','ACTIVE',NOW());
        INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(values['term'])},{q(SCHOOL_ID)},{q(f"TEST_FIXTURE_ONLY T011 学期{label} {suffix}")},'2026-01-01','2036-12-31',true,NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({q(values['class'])},{q(SCHOOL_ID)},{q(values['term'])},{q(values['class_name'])},'七年级',NOW(),NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(values['enrollment'])},{q(SCHOOL_ID)},{q(values['class'])},{q(values['user'])},'TEACHER','ACTIVE',NOW());
        COMMIT;'''
    )
    return values


def create_student_fixture(label, class_id):
    suffix = uuid.uuid4().hex[:10]
    values = {
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"student.t011.{label}.{suffix}@test.invalid",
        "name": f"TEST_FIXTURE_ONLY T011 学生{label} {suffix}",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(values['user'])},{q(values['login'])},{q(values['name'])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(values['membership'])},{q(SCHOOL_ID)},{q(values['user'])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(values['enrollment'])},{q(SCHOOL_ID)},{q(class_id)},{q(values['user'])},'STUDENT','ACTIVE',NOW());
        COMMIT;'''
    )
    return values


def ensure_test_course():
    sql(
        f'''INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
            VALUES ({q(COURSE_ID)},{q(SCHOOL_ID)},{q(TEACHER_SEED_ID)},'TEST_FIXTURE_ONLY_T011_COURSE','TEST_FIXTURE_ONLY T011 测试课程',NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET title='TEST_FIXTURE_ONLY T011 测试课程',"updatedAt"=NOW();
            INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"publishedAt","createdAt","updatedAt")
            VALUES ({q(COURSE_VERSION_ID)},{q(SCHOOL_ID)},{q(COURSE_ID)},1,'PUBLISHED','TEST_FIXTURE_ONLY T011 测试课程版本','zh-CN','[]'::jsonb,NOW(),NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET status='PUBLISHED',title='TEST_FIXTURE_ONLY T011 测试课程版本',"updatedAt"=NOW();'''
    )


def insert_one_assignment(title, teacher, class_id, *, created_at="TIMESTAMP '2025-12-31 08:00:00'"):
    assignment_id = str(uuid.uuid4())
    sql(
        f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","createdAt","updatedAt")
            VALUES ({q(assignment_id)},{q(SCHOOL_ID)},{q(COURSE_VERSION_ID)},{q(teacher['user'])},{q(title)},'DRAFT',NOW(),NOW()+INTERVAL '30 days',{created_at},NOW());
            INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
            VALUES ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(assignment_id)},'CLASS',{q(class_id)},NOW());'''
    )
    return assignment_id


def install_assignment_fixtures():
    verify_database_identity()
    ensure_test_course()
    empty = create_teacher_fixture("空班")
    one = create_teacher_fixture("单任务")
    many = create_teacher_fixture("多任务")
    network = create_teacher_fixture("网络故障")
    one_old = insert_one_assignment(f"TEST_FIXTURE_ONLY T011 单任务历史 {uuid.uuid4().hex[:8]}", one, one["class"])
    sql(
        f'''WITH created AS (
          INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","createdAt","updatedAt")
          SELECT gen_random_uuid(),{q(SCHOOL_ID)},{q(COURSE_VERSION_ID)},{q(many['user'])},
                 'TEST_FIXTURE_ONLY T011 分页任务 ' || generator.i::text,'DRAFT',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',
                 TIMESTAMP '2026-01-01 08:00:00' + (206-generator.i) * INTERVAL '1 minute',NOW()
            FROM generate_series(1,205) AS generator(i)
          RETURNING id
        )
        INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
        SELECT gen_random_uuid(),{q(SCHOOL_ID)},created.id,'CLASS',{q(many['class'])},NOW() FROM created;'''
    )
    return {"empty": empty, "one": one, "one_old": one_old, "many": many, "network": network}


def open_create_form(page, title):
    page.locator(".new").click()
    page.locator('#taskForm input[name="title"]').fill(title)


def create_draft_from_ui(page, title, *, double_click=False):
    open_create_form(page, title)
    save_button = page.locator("#taskForm .save")
    if double_click:
        save_button.evaluate("button => { button.click(); button.click(); }")
    else:
        save_button.click()
    page.wait_for_function("new URLSearchParams(location.search).has('assignmentId')", timeout=20_000)
    assignment_id = page.evaluate("new URLSearchParams(location.search).get('assignmentId')")
    row = page.locator(f'.row[data-id="{assignment_id}"]')
    row.wait_for(timeout=20_000)
    expect(row).to_be_visible()
    page.locator(".dynamic-detail").wait_for(timeout=20_000)
    assert row.get_attribute("data-status") == "DRAFT"
    return assignment_id


def test_teacher_draft_visibility_state_transitions_and_failures():
    verify_database_identity()
    fixtures = install_assignment_fixtures()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            # Empty history: create a real server DRAFT and complete the UI state machine.
            empty_session = authenticate(page, fixtures["empty"]["login"])
            page.goto(f"{BASE}/teacher/assignments/", wait_until="networkidle")
            page.get_by_text("暂无教学任务").wait_for(timeout=20_000)
            draft_title = f"TEST_FIXTURE_ONLY T011 空历史草稿 {uuid.uuid4().hex[:8]}"
            empty_assignment_id = create_draft_from_ui(page, draft_title)
            sql(
                f'''UPDATE "Assignment" SET revision=revision+1
                     WHERE id={q(empty_assignment_id)} AND "schoolId"={q(SCHOOL_ID)};'''
            )
            stale_revision = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assignments/{empty_assignment_id}/schedule",
                headers=headers(empty_session),
                data={"expectedRevision": 1},
            )
            assert stale_revision.status == 409, stale_revision.text()
            schedule = page.locator('.dynamic-detail button[data-transition="schedule"]')
            schedule.click()
            expect(page.locator(".transition-status")).to_contain_text("重新加载最新状态", timeout=15_000)
            page.locator(".transition-status").get_by_role("button", name="重新加载").click()
            page.locator(".dynamic-detail").wait_for(state="detached", timeout=15_000)
            row = page.locator(f'.row[data-id="{empty_assignment_id}"]')
            row.click()
            page.locator('.dynamic-detail button[data-transition="schedule"]').wait_for(timeout=15_000)
            page.locator('.dynamic-detail button[data-transition="schedule"]').click()
            page.wait_for_function(
                """id => document.querySelector(`.row[data-id="${id}"]`)?.dataset.status === 'SCHEDULED'""",
                arg=empty_assignment_id,
                timeout=20_000,
            )
            row = page.locator(f'.row[data-id="{empty_assignment_id}"]')
            row.click()
            page.locator('.dynamic-detail button[data-transition="open"]').click()
            page.wait_for_function(
                """id => document.querySelector(`.row[data-id="${id}"]`)?.dataset.status === 'OPEN'""",
                arg=empty_assignment_id,
                timeout=20_000,
            )
            transition_assignment = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assignments/{empty_assignment_id}",
                headers=headers(empty_session),
            ))
            sql_state = sql_scalar(
                f'''SELECT status::text || '|' || revision::text FROM "Assignment"
                     WHERE id={q(empty_assignment_id)} AND "schoolId"={q(SCHOOL_ID)};'''
            )
            assert transition_assignment["status"] == "OPEN"
            assert sql_state == "OPEN|4", sql_state

            # One old record: the next real ID opens after refresh.
            one_session = authenticate(page, fixtures["one"]["login"])
            page.goto(f"{BASE}/teacher/assignments/", wait_until="networkidle")
            page.locator(f'.row[data-id="{fixtures["one_old"]}"]').wait_for(timeout=20_000)
            one_title = f"TEST_FIXTURE_ONLY T011 单历史新草稿 {uuid.uuid4().hex[:8]}"
            one_id = create_draft_from_ui(page, one_title)
            page.reload(wait_until="networkidle")
            page.locator(f'.row[data-id="{one_id}"]').wait_for(timeout=20_000)
            page.locator(".dynamic-detail").wait_for(timeout=20_000)
            assert "assignmentId" in page.url and one_id in page.url
            assert sql_scalar(f'''SELECT COUNT(*) FROM "Assignment" WHERE id={q(one_id)};''') == "1"

            # More than 200 records, a nonmatching search filter, cursor page,
            # and a legacy UTC-naive createdAt must not hide the new API ID.
            many_session = authenticate(page, fixtures["many"]["login"])
            page.goto(f"{BASE}/teacher/assignments/", wait_until="networkidle")
            expect(page.locator('.row[data-id]')).to_have_count(20, timeout=20_000)
            page.locator("#assignmentSearch").fill("T011-filter-intentionally-does-not-match")
            page.wait_for_function("!document.querySelector('.row[data-id]')", timeout=10_000)
            many_title = f"TEST_FIXTURE_ONLY T011 UTC naive draft {uuid.uuid4().hex[:8]}"
            route_state = {"posts": 0, "id": None}

            def persist_legacy_time(route):
                if route.request.method != "POST":
                    route.continue_()
                    return
                route_state["posts"] += 1
                response = route.fetch()
                created = payload(response)
                route_state["id"] = created["id"]
                sql(
                    f'''UPDATE "Assignment" SET "createdAt"=TIMESTAMP '2025-01-01 08:00:00'
                         WHERE id={q(created['id'])} AND "schoolId"={q(SCHOOL_ID)};'''
                )
                route.fulfill(response=response)

            assignment_url = f"**/api/v1/schools/{SCHOOL_ID}/assignments"
            page.route(assignment_url, persist_legacy_time)
            many_id = create_draft_from_ui(page, many_title, double_click=True)
            page.unroute(assignment_url, persist_legacy_time)
            assert route_state["posts"] == 1
            assert route_state["id"] == many_id
            assert sql_scalar(
                f'''SELECT ("createdAt"=TIMESTAMP '2025-01-01 08:00:00')::text FROM "Assignment" WHERE id={q(many_id)};'''
            ) == "true"
            page.reload(wait_until="networkidle")
            page.locator(f'.row[data-id="{many_id}"]').wait_for(timeout=20_000)
            page.locator(".dynamic-detail").wait_for(timeout=20_000)
            page.locator("#assignmentSearch").fill("T011-filter-intentionally-does-not-match")
            page.wait_for_function("!document.querySelector('.row[data-id]')", timeout=10_000)
            page.locator("#reloadAssignments").click()
            page.locator(f'.row[data-id="{many_id}"]').wait_for(timeout=20_000)
            expect(page.locator(f'.row[data-id="{many_id}"]')).to_be_visible()
            page.locator(".dynamic-detail").wait_for(timeout=20_000)
            assert payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assignments/{many_id}", headers=headers(many_session)
            ))["id"] == many_id
            cross_class = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assignments/{empty_assignment_id}", headers=headers(many_session)
            )
            assert cross_class.status in (403, 404)

            # A transport failure does not claim success or create a row.
            network_session = authenticate(page, fixtures["network"]["login"])
            page.goto(f"{BASE}/teacher/assignments/", wait_until="networkidle")
            network_title = f"TEST_FIXTURE_ONLY T011 network failure {uuid.uuid4().hex[:8]}"
            open_create_form(page, network_title)
            page.route(assignment_url, lambda route: route.abort("internetdisconnected") if route.request.method == "POST" else route.continue_())
            page.locator("#taskForm .save").click()
            expect(page.locator(".dialog-error")).to_contain_text("未收到服务端确认", timeout=15_000)
            assert sql_scalar(f'''SELECT COUNT(*) FROM "Assignment" WHERE title={q(network_title)};''') == "0"
            assert page.locator("#modal").evaluate("dialog => dialog.open") is True
            assert page.get_by_text("草稿已保存并已打开").count() == 0
            page.unroute(assignment_url)
            assert errors == [], errors
            print(json.dumps({
                "zeroHistoryAssignment": empty_assignment_id,
                "oneHistoryAssignment": one_id,
                "manyHistoryAssignment": many_id,
                "manyExistingRows": 205,
                "legacyCreatedAt": "2025-01-01T08:00:00 UTC-naive fixture",
                "duplicateSavePostCount": route_state["posts"],
                "scheduleRevisionConflict": stale_revision.status,
                "finalState": sql_state,
                "crossClassStatus": cross_class.status,
                "networkFailureCreatedRows": 0,
            }, ensure_ascii=False))
        finally:
            browser.close()


def create_review_student_fixture():
    verify_database_identity()
    verify_minio_identity()
    suffix = uuid.uuid4().hex[:8]
    teacher_other = create_teacher_fixture("复核负控")
    student_a = create_student_fixture("甲", CLASS_ID)
    student_b = create_student_fixture("乙", teacher_other["class"])
    foreign = {
        "school": str(uuid.uuid4()),
        "term": str(uuid.uuid4()),
        "class": str(uuid.uuid4()),
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"teacher.t011.foreign.{suffix}@test.invalid",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
          VALUES ({q(foreign['school'])},{q('YZ-T011-' + suffix)},{q('TEST_FIXTURE_ONLY T011 外校')},'T011',NOW(),NOW());
        INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(foreign['term'])},{q(foreign['school'])},{q('TEST_FIXTURE_ONLY T011 外校学期')},'2026-01-01','2036-12-31',true,NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({q(foreign['class'])},{q(foreign['school'])},{q(foreign['term'])},'TEST_FIXTURE_ONLY T011 外校班','七年级',NOW(),NOW());
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(foreign['user'])},{q(foreign['login'])},'TEST_FIXTURE_ONLY T011 外校教师',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(foreign['membership'])},{q(foreign['school'])},{q(foreign['user'])},'TEACHER','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(foreign['enrollment'])},{q(foreign['school'])},{q(foreign['class'])},{q(foreign['user'])},'TEACHER','ACTIVE',NOW());
        COMMIT;'''
    )
    return {
        "teacher_other": teacher_other,
        "student_a": student_a,
        "student_b": student_b,
        "foreign_teacher": foreign,
        "practice_title": LEVEL_ONE_PRACTICE_TITLE,
    }


def test_student_recording_teacher_review_and_student_safe_report():
    fixtures = create_review_student_fixture()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["microphone"])
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        try:
            anonymous = playwright.request.new_context()
            try:
                no_auth = anonymous.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews")
                assert no_auth.status == 401
            finally:
                anonymous.dispose()

            student_a = authenticate(page, fixtures["student_a"]["login"])
            student_headers = headers(student_a)
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            practice_info = practice_in_catalog(page, student_headers, base_url=BASE)
            assert practice_info["title"] == fixtures["practice_title"]
            practice = page.locator(".practice-tile").filter(has_text=fixtures["practice_title"])
            practice.wait_for(timeout=20_000)
            practice.locator("h2 a").click()
            practice_id = practice_info["id"]
            page.wait_for_url(f"**/student/practices/{practice_id}/", timeout=20_000)
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            items_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}/items",
                headers=student_headers,
            )
            assert items_response.ok, items_response.text()
            attempt_items = payload(items_response)
            attempt_items = attempt_items if isinstance(attempt_items, list) else attempt_items["items"]
            assert len(attempt_items) == 20
            assert all(item.get("maxScore") is not None for item in attempt_items)
            completion = complete_level_one_attempt(page, student_headers, attempt_id, base_url=BASE)
            assert completion["itemCount"] == 20
            assert completion["recordedAudio"] >= 1
            assert completion["uploadRetries"] == completion["recordedAudio"]

            sql_recordings = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r.status::text,r."mimeType",count(j.id)::text
                     FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                     LEFT JOIN "SpeechJob" j ON j."recordingId"=r.id
                    WHERE i."sessionId"={q(attempt_id)} GROUP BY i.id,r.id ORDER BY i."sortOrder";'''
            )
            assert len(sql_recordings) == completion["recordedAudio"], sql_recordings
            uploaded_objects = []
            for item_id, recording_id, object_key, state, mime_type, job_count in sql_recordings:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert state in {"READY", "PROCESSING", "COMPLETE"}
                assert mime_type.startswith("audio/")
                head = minio_head_object(object_key)
                assert int(head["bytes"]) > 0 and head["contentType"].startswith("audio/")
                uploaded_objects.append({"itemId": item_id, "recordingId": recording_id, "bytes": int(head["bytes"]), "speechJobs": int(job_count)})

            session_state = sql_scalar(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)} AND "schoolId"={q(SCHOOL_ID)};'''
            )
            assert session_state == "PROCESSING"
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)}
                     AND "recordingId" IS NOT NULL AND "scoredScore" IS NOT NULL;'''
            ) == "0", "uncalibrated machine results must not become formal audio scores"
            no_report = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=student_headers,
            )
            assert no_report.ok and payload(no_report) is None

            page.locator('a[href="/student/practices/history/"]').first.click()
            page.wait_for_url("**/student/practices/history/", timeout=20_000)
            pending_row = page.locator(f'[data-history-session="{attempt_id}"]')
            pending_row.wait_for(timeout=20_000)
            pending_row.get_by_text("处理中").wait_for()
            assert "尚未形成报告或成绩" in pending_row.inner_text()
            assert pending_row.get_by_role("link", name="查看处理状态").get_attribute("href") == f"/assessment/sessions/{attempt_id}/processing/"

            teacher = authenticate(page, "teacher.test")
            teacher_headers = headers(teacher)
            review_queue_url = f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews"
            queue_response = page.request.get(review_queue_url, headers=teacher_headers)
            assert queue_response.ok, queue_response.text()
            matching_queue = [item for item in payload(queue_response)["items"]
                if item["practice"]["title"] == fixtures["practice_title"]
                and item["student"]["displayName"] == fixtures["student_a"]["name"]]
            assert len(matching_queue) >= 2, matching_queue
            review_item_ids = [item["itemId"] for item in matching_queue]
            audio_queue_item = next(item for item in matching_queue if item["strategy"] == "SPEECH_READING")
            audio_item_id = audio_queue_item["itemId"]

            student_forbidden = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}",
                headers=student_headers,
                data={"score": 2, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert student_forbidden.status == 403
            missing_review = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{uuid.uuid4()}", headers=teacher_headers
            )
            assert missing_review.status == 404
            out_of_range = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}",
                headers=teacher_headers,
                data={"score": float(audio_queue_item["maxScore"]) + 1, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert out_of_range.status == 400

            other_teacher = login_api(page, fixtures["teacher_other"]["login"])
            cross_class = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}", headers=headers(other_teacher)
            )
            assert cross_class.status == 403
            foreign_teacher = login_api(page, fixtures["foreign_teacher"]["login"])
            cross_school = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}", headers=headers(foreign_teacher)
            )
            assert cross_school.status == 403

            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            audio_review = page.locator(f'.review-row[href="/teacher/reviews/{audio_item_id}"]')
            audio_href = audio_review.get_attribute("href")
            assert audio_href == f"/teacher/reviews/{audio_item_id}"
            audio_review.click()
            page.wait_for_url(f"**/teacher/reviews/{audio_item_id}", timeout=20_000)
            page.get_by_text("同一条原始录音", exact=True).wait_for(timeout=20_000)
            page.get_by_text("教师参考量表").wait_for()
            assert page.locator(".rubric-block li").count() > 0
            audio = page.locator(".detail-audio audio")
            expect(audio).to_be_visible()
            audio.evaluate("element => element.play()")
            page.wait_for_function("document.querySelector('.detail-audio audio')?.currentTime > 0.2", timeout=15_000)
            detail = payload(page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}", headers=teacher_headers
            ))
            assert detail["evidence"]["recordingId"]
            assert detail["evidence"]["playbackUrl"]
            assert detail["item"]["targetText"]
            assert detail["review"]["rubric"]

            score_by_item = {item["itemId"]: float(item["maxScore"]) - 1 for item in matching_queue}
            comments = {
                item["itemId"]: f"TEST_FIXTURE_ONLY 教师第 {index + 1} 项复核：朗读清楚，继续保持自然停顿。"
                for index, item in enumerate(matching_queue)
            }
            page.locator("[data-review-score]").fill(str(score_by_item[audio_item_id]))
            page.locator("[data-review-comment]").fill(comments[audio_item_id])
            item_review_url = f"**/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}"
            page.route(item_review_url, lambda route: route.abort("internetdisconnected") if route.request.method == "PUT" else route.continue_())
            page.locator("[data-review-submit]").click()
            expect(page.locator("[data-review-message]")).to_contain_text("Failed to fetch", timeout=15_000)
            assert page.locator("[data-review-submit]").is_enabled()
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(audio_item_id)} AND "scoredScore" IS NULL;'''
            ) == "1"
            page.unroute(item_review_url)
            page.locator("[data-review-submit]").click()
            expect(page.locator("[data-review-message]")).to_contain_text("其他必要题目仍待复核", timeout=20_000)
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            assert sql_scalar(f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)};''') == "PROCESSING"

            repeated = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}",
                headers=teacher_headers,
                data={"score": score_by_item[audio_item_id], "comment": comments[audio_item_id]},
            )
            assert repeated.status == 200, repeated.text()
            changed_duplicate = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_item_id}",
                headers=teacher_headers,
                data={"score": 0, "comment": "TEST_FIXTURE_ONLY 覆盖尝试"},
            )
            assert changed_duplicate.status == 409

            remaining_item_ids = [item_id for item_id in review_item_ids if item_id != audio_item_id]
            for index, next_item_id in enumerate(remaining_item_ids):
                page.locator("[data-review-message]").get_by_role("link", name="返回复核队列").click()
                page.wait_for_url("**/teacher/reviews/", timeout=20_000)
                remaining_row = page.locator(f'.review-row[href="/teacher/reviews/{next_item_id}"]')
                remaining_row.click()
                page.wait_for_url(f"**/teacher/reviews/{next_item_id}", timeout=20_000)
                review_detail = payload(page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{next_item_id}", headers=teacher_headers
                ))
                if review_detail["item"]["strategy"] == "RUBRIC_TEXT":
                    assert review_detail["item"]["answer"] is not None
                    page.get_by_text("学生文字作答").wait_for()
                page.locator("[data-review-score]").fill(str(score_by_item[next_item_id]))
                page.locator("[data-review-comment]").fill(comments[next_item_id])
                page.locator("[data-review-submit]").click()
                is_last_review = index == len(remaining_item_ids) - 1
                expected_message = "正式报告已生成" if is_last_review else "其他必要题目仍待复核"
                expect(page.locator("[data-review-message]")).to_contain_text(expected_message, timeout=20_000)
                expect(page.locator("[data-review-message]")).to_contain_text(comments[next_item_id])
                if not is_last_review:
                    assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
                    assert sql_scalar(f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)};''') == "PROCESSING"

            pg_rows = sql_rows(
                f'''SELECT i.id,i."scoredScore"::text,i."reviewerUserId",i."reviewerComment",i."reviewedAt"::text,i."revision"::text,i.status::text
                     FROM "AssessmentItem" i WHERE i.id IN ({','.join(q(item_id) for item_id in review_item_ids)}) ORDER BY i."sortOrder";'''
            )
            assert len(pg_rows) == len(review_item_ids)
            assert all(row[1] is not None and row[2] == TEACHER_SEED_ID and row[4] and row[5] == "2" and row[6] == "REVIEWED" for row in pg_rows), pg_rows
            assert {row[0]: row[3] for row in pg_rows} == comments
            report_row = sql_rows(
                f'''SELECT r.id,r."overallScore"::text,s.status::text FROM "AssessmentReport" r
                     JOIN "AssessmentSession" s ON s.id=r."sessionId" WHERE r."sessionId"={q(attempt_id)};'''
            )
            assert len(report_row) == 1 and report_row[0][2] == "COMPLETED"
            awarded_points, total_max_points = sql_rows(
                f'''SELECT SUM("scoredScore")::text,SUM("maxScore")::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)};'''
            )[0]
            assert float(report_row[0][1]) == pytest.approx(
                float(awarded_points) / float(total_max_points) * 100
            )

            # Re-login as the student and follow the real history action to the report.
            student_a = authenticate(page, fixtures["student_a"]["login"])
            student_headers = headers(student_a)
            page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            completed_row = page.locator(f'[data-history-session="{attempt_id}"]')
            completed_row.wait_for(timeout=20_000)
            completed_row.get_by_text("已完成").wait_for()
            assert "正式报告" in completed_row.inner_text()
            completed_row.get_by_role("link", name="查看报告或结果").click()
            page.wait_for_url(f"**/assessment/sessions/{attempt_id}/report/", timeout=20_000)
            page.get_by_text("教师反馈").wait_for(timeout=20_000)
            for comment in comments.values():
                expect(page.locator("[data-report-teacher-feedback]")).to_contain_text(comment)
            report_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=student_headers,
            )
            assert report_response.ok, report_response.text()
            student_report = payload(report_response)
            assert float(student_report["overallScore"]) == pytest.approx(float(report_row[0][1]))
            assert {item["comment"] for item in student_report["teacherFeedback"]} == set(comments.values())
            private_json = json.dumps(student_report, ensure_ascii=False)
            for private_field in ("reviewerUserId", "referenceAnswer", "deductionRules", "scoringSpec"):
                assert private_field not in private_json

            student_b = login_api(page, fixtures["student_b"]["login"])
            foreign_report = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=headers(student_b),
            )
            assert foreign_report.status in (403, 404)
            foreign_history = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/history?enrollmentId={fixtures['student_a']['enrollment']}",
                headers=headers(student_b),
            )
            assert foreign_history.status == 403
            assert page_errors == [], page_errors
            print(json.dumps({
                "attemptId": attempt_id,
                "practiceId": practice_id,
                "reviewItemIds": review_item_ids,
                "recordings": uploaded_objects,
                "runnerCompletion": completion,
                "speechProvider": "disabled; worker not started",
                "microphoneSource": "SIMULATED_MIC",
                "queueClickedHref": audio_href,
                "manualReview": pg_rows,
                "reportId": report_row[0][0],
                "studentReportScore": student_report["overallScore"],
                "teacherFeedback": student_report["teacherFeedback"],
                "pendingBeforeReview": {"session": session_state, "report": None},
                "firstReviewReportCount": 0,
                "negativeStatuses": {
                    "unauthenticated": no_auth.status,
                    "studentReview": student_forbidden.status,
                    "missingReview": missing_review.status,
                    "scoreOutOfRange": out_of_range.status,
                    "crossClassTeacher": cross_class.status,
                    "crossSchoolTeacher": cross_school.status,
                    "studentBReport": foreign_report.status,
                    "studentBHistory": foreign_history.status,
                    "changedDuplicate": changed_duplicate.status,
                },
            }, ensure_ascii=False))
        finally:
            browser.close()
