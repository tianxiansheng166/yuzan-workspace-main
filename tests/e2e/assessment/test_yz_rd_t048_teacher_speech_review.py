"""T048 real Chromium/API/PostgreSQL/MinIO review queue acceptance."""

from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import expect, sync_playwright
from test_yz_rd_t008_student_history import (
    PRACTICE_TITLE,
    complete_real_attempt,
    practice_in_catalog,
)


BASE = os.environ.get("YZ_T048_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T048_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T048_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T048_EVIDENCE_DIR", ""))
DATABASE_NAME = os.environ.get("YZ_T048_DATABASE_NAME", "yuzan_t048_native")
DATABASE_USER = os.environ.get("YZ_T048_DATABASE_USER", "yz_t048")
S3_BUCKET = os.environ.get("YZ_T048_S3_BUCKET", "yz-t048-native")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
TEACHER_SEED_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_SEED_ID = "22222222-2222-4222-8222-222222222222"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T048 native API/PostgreSQL/MinIO runtime",
)


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == DATABASE_USER
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == DATABASE_NAME
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


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def sql_scalar(statement):
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def verify_runtime_identity():
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    assert identity.startswith(f"{DATABASE_NAME}|{DATABASE_USER}|PostgreSQL 17."), identity.split("|", 2)[:2]
    assert os.environ["YZ_T048_S3_BUCKET"] == S3_BUCKET
    assert urlparse(os.environ["YZ_T048_S3_ENDPOINT"]).port == int(os.environ["YZ_T048_MINIO_API_PORT"])


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


def create_teacher_fixture(label):
    suffix = uuid.uuid4().hex[:10]
    value = {
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "term": str(uuid.uuid4()),
        "class": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"teacher.t048.{label}.{suffix}@test.invalid",
        "name": f"TEST_FIXTURE_ONLY T048 教师{label} {suffix}",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(value['user'])},{q(value['login'])},{q(value['name'])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(value['membership'])},{q(SCHOOL_ID)},{q(value['user'])},'TEACHER','ACTIVE',NOW());
        INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(value['term'])},{q(SCHOOL_ID)},{q(f"TEST_FIXTURE_ONLY T048 学期 {label} {suffix}")},'2026-01-01','2036-12-31',true,NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({q(value['class'])},{q(SCHOOL_ID)},{q(value['term'])},{q(f"TEST_FIXTURE_ONLY T048 班级 {label} {suffix}")},'七年级',NOW(),NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(value['enrollment'])},{q(SCHOOL_ID)},{q(value['class'])},{q(value['user'])},'TEACHER','ACTIVE',NOW());
        COMMIT;'''
    )
    return value


def create_student_fixture(label, class_id):
    suffix = uuid.uuid4().hex[:10]
    value = {
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"student.t048.{label}.{suffix}@test.invalid",
        "name": f"TEST_FIXTURE_ONLY T048 学生{label} {suffix}",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(value['user'])},{q(value['login'])},{q(value['name'])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(value['membership'])},{q(SCHOOL_ID)},{q(value['user'])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(value['enrollment'])},{q(SCHOOL_ID)},{q(class_id)},{q(value['user'])},'STUDENT','ACTIVE',NOW());
        COMMIT;'''
    )
    return value


def create_cross_school_teacher():
    suffix = uuid.uuid4().hex[:8]
    value = {
        "school": str(uuid.uuid4()),
        "term": str(uuid.uuid4()),
        "class": str(uuid.uuid4()),
        "user": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"teacher.t048.foreign.{suffix}@test.invalid",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
          VALUES ({q(value['school'])},{q('YZ-T048-' + suffix)},'TEST_FIXTURE_ONLY T048 外校','T048',NOW(),NOW());
        INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(value['term'])},{q(value['school'])},'TEST_FIXTURE_ONLY T048 外校学期','2026-01-01','2036-12-31',true,NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({q(value['class'])},{q(value['school'])},{q(value['term'])},'TEST_FIXTURE_ONLY T048 外校班','七年级',NOW(),NOW());
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(value['user'])},{q(value['login'])},'TEST_FIXTURE_ONLY T048 外校教师',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(value['membership'])},{q(value['school'])},{q(value['user'])},'TEACHER','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(value['enrollment'])},{q(value['school'])},{q(value['class'])},{q(value['user'])},'TEACHER','ACTIVE',NOW());
        COMMIT;'''
    )
    return value


def minio_head_object(object_key):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T048_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.YZ_T048_S3_ENDPOINT,
  region: process.env.YZ_T048_S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.YZ_T048_S3_ACCESS_KEY, secretAccessKey: process.env.YZ_T048_S3_SECRET_KEY },
});
(async () => {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: process.env.YZ_T048_S3_BUCKET, Key: process.env.YZ_T048_OBJECT_KEY }));
    process.stdout.write(JSON.stringify({bytes: head.ContentLength, contentType: head.ContentType}));
  } finally { client.destroy(); }
})().catch(error => { process.stderr.write(`${error.name || "S3_HEAD_FAILED"}\n`); process.exitCode = 1; });'''
    env = {**os.environ, "YZ_T048_OBJECT_KEY": object_key}
    root = Path(__file__).resolve().parents[3]
    result = subprocess.run(["node", "-e", script], cwd=root, capture_output=True, text=True, env=env, check=False)
    if result.returncode:
        message = result.stderr
        for secret in (env.get("YZ_T048_S3_SECRET_KEY", ""), env.get("POSTGRES_PASSWORD", "")):
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"T048 MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


def item_queue(request, auth_headers, student_name):
    response = request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers=auth_headers)
    assert response.ok, response.text()
    return [item for item in payload(response)["items"] if item["student"]["displayName"] == student_name]


def save_responsive_screenshots(page, prefix, *, detail=False):
    for width in (390, 768, 1280, 1440):
        page.set_viewport_size({"width": width, "height": 920})
        page.wait_for_timeout(350)
        layout = page.evaluate("""() => {
          const rect = selector => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return {x: box.x, width: box.width, right: box.right, y: box.y, height: box.height, bottom: box.bottom};
          };
          return {
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
            inner: window.innerWidth,
            shellColumns: getComputedStyle(document.querySelector('.ts-app-shell')).gridTemplateColumns,
            sidebarWidth: getComputedStyle(document.querySelector('.ts-sidebar')).width,
            shell: rect('.ts-app-shell'),
            sidebar: rect('.ts-sidebar'),
            main: rect('.ts-main'),
            page: rect('.review-page, .detail-page'),
          };
        }""")
        if detail:
            layout["audio"] = page.locator("[data-review-audio]").bounding_box()
            layout["scoreSubmit"] = page.locator("[data-review-submit]").bounding_box()
        print(f"RESPONSIVE {prefix} {width}px {json.dumps(layout, ensure_ascii=False)}")
        assert layout["client"] <= width + 1 and layout["inner"] <= width + 1, f"viewport sizing changed at {width}px: {layout}"
        assert layout["scroll"] <= layout["client"] + 1, f"horizontal overflow at {width}px: {layout}"
        if width > 760:
            assert layout["sidebar"]["right"] <= layout["page"]["x"] + 1, f"sidebar covers page content at {width}px: {layout}"
        else:
            assert layout["sidebar"]["bottom"] <= layout["page"]["y"] + 1, f"top navigation covers page content at {width}px: {layout}"
        if detail:
            audio = page.locator("[data-review-audio]").bounding_box()
            button = page.locator("[data-review-submit]").bounding_box()
            assert audio and button, "recording player or scoring action is not laid out"
            for name, box in (("audio", audio), ("score submit", button)):
                assert box["x"] >= -1 and box["x"] + box["width"] <= width + 1, f"{name} is horizontally clipped at {width}px"
            overlap_x = min(audio["x"] + audio["width"], button["x"] + button["width"]) - max(audio["x"], button["x"])
            overlap_y = min(audio["y"] + audio["height"], button["y"] + button["height"]) - max(audio["y"], button["y"])
            assert overlap_x <= 0 or overlap_y <= 0, f"recording player overlaps scoring action at {width}px"
            if width <= 900:
                evidence_box = page.locator(".detail-main").bounding_box()
                form_box = page.locator(".review-form-card").bounding_box()
                assert evidence_box and form_box and evidence_box["y"] < form_box["y"], f"evidence must precede scoring form at {width}px"
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(EVIDENCE_DIR / f"{prefix}-{width}.png"), full_page=True)


def wait_for_review_item(page, item_id):
    page.wait_for_function("itemId => location.pathname.endsWith(`/teacher/reviews/${itemId}`)", arg=item_id, timeout=20_000)
    expect(page.locator("[data-review-score]")).to_be_visible()


def complete_t048_attempt(page, student_headers, attempt_id):
    # The retained T011 helper awaits audio.play(); its extra currentTime>0 poll
    # can miss very short clips that have already ended. The played TimeRanges
    # check is durable evidence that playback actually began.
    original_wait = page.wait_for_function

    def wait_for_audio_played(expression, *args, **kwargs):
        if expression == "document.querySelector('.audio-stimulus audio')?.currentTime > 0":
            expression = "document.querySelector('.audio-stimulus audio')?.played?.length > 0"
        return original_wait(expression, *args, **kwargs)

    page.wait_for_function = wait_for_audio_played
    try:
        return complete_real_attempt(page, student_headers, attempt_id, base_url=BASE)
    finally:
        page.wait_for_function = original_wait


def test_real_student_to_teacher_review_to_student_report():
    verify_runtime_identity()
    teacher_empty = create_teacher_fixture("空队列")
    teacher_other = create_teacher_fixture("其他班级")
    student_a = create_student_fixture("甲", CLASS_ID)
    student_b = create_student_fixture("乙", teacher_other["class"])
    foreign_teacher = create_cross_school_teacher()
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["microphone"])
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            anonymous = playwright.request.new_context()
            try:
                no_auth = anonymous.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews")
                assert no_auth.status == 401
            finally:
                anonymous.dispose()

            # An authorized teacher with a real empty class sees a distinct empty state.
            empty_session = authenticate(page, teacher_empty["login"])
            empty_headers = headers(empty_session)
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            page.get_by_text("当前没有待复核题目").wait_for(timeout=20_000)
            empty_queue = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers=empty_headers)
            assert empty_queue.ok and payload(empty_queue)["total"] == 0
            queue_pattern = f"**/api/v1/schools/{SCHOOL_ID}/assessment-reviews"
            page.route(queue_pattern, lambda route: route.abort("internetdisconnected"))
            page.locator("[data-refresh]").click()
            page.get_by_text("队列暂时无法加载").wait_for(timeout=15_000)
            assert page.locator(".queue-state-complete").count() == 0
            page.unroute(queue_pattern)
            page.locator("[data-refresh]").click()
            page.get_by_text("当前没有待复核题目").wait_for(timeout=20_000)

            # A real student completes a published Level 1 attempt and uploads recordings to T048 MinIO.
            student_session = authenticate(page, student_a["login"])
            student_headers = headers(student_session)
            forbidden_queue = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers=student_headers)
            assert forbidden_queue.status == 403
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            page.get_by_text("无法访问复核队列").wait_for(timeout=20_000)

            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            practice_info = practice_in_catalog(page, student_headers, base_url=BASE)
            assert practice_info["title"] == PRACTICE_TITLE
            practice = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
            practice.wait_for(timeout=20_000)
            practice.locator("h2 a").click()
            page.wait_for_url(f"**/student/practices/{practice_info['id']}/", timeout=20_000)
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            completion = complete_t048_attempt(page, student_headers, attempt_id)
            assert completion["itemCount"] == 20
            assert completion["recordedAudio"] >= 1
            assert completion["uploadRetries"] == completion["recordedAudio"]
            session_state = sql_scalar(
                f'''SELECT status::text FROM "AssessmentSession" WHERE id={q(attempt_id)} AND "schoolId"={q(SCHOOL_ID)};'''
            )
            assert session_state == "PROCESSING"
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            audio_rows = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r."mimeType",r.status::text
                     FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                    WHERE i."sessionId"={q(attempt_id)} ORDER BY i."sortOrder";'''
            )
            assert len(audio_rows) == completion["recordedAudio"]
            uploaded = []
            for item_id, recording_id, object_key, mime_type, state in audio_rows:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert mime_type.startswith("audio/") and state in {"READY", "PROCESSING", "COMPLETE"}
                head = minio_head_object(object_key)
                assert int(head["bytes"]) > 0 and head["contentType"].startswith("audio/")
                uploaded.append({"itemId": item_id, "recordingId": recording_id, "bytes": int(head["bytes"])})
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)}
                     AND "recordingId" IS NOT NULL AND "scoredScore" IS NOT NULL;'''
            ) == "0", "machine diagnostics must not fill formal audio scores"
            no_report = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=student_headers,
            )
            assert no_report.ok and payload(no_report) is None

            teacher_session = authenticate(page, "teacher.test")
            teacher_headers = headers(teacher_session)
            queue_url = f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews"
            queue_response = page.request.get(queue_url, headers=teacher_headers)
            assert queue_response.ok, queue_response.text()
            initial_queue = [
                item for item in payload(queue_response)["items"]
                if item["student"]["displayName"] == student_a["name"]
            ]
            assert len(initial_queue) >= 2, initial_queue
            item_ids = [item["itemId"] for item in initial_queue]
            image_item = next(item for item in initial_queue if item["strategy"] == "SPEECH_OPEN_RESPONSE")
            audio_item = next(item for item in initial_queue if item["strategy"] == "SPEECH_READING")
            image_id = image_item["itemId"]
            audio_id = audio_item["itemId"]
            assert image_item["domain"] is None or isinstance(image_item["domain"], str)
            assert isinstance(image_item["maxScore"], (int, float)) and image_item["maxScore"] > 0

            student_put = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=student_headers,
                data={"score": 0, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert student_put.status == 403
            missing = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{uuid.uuid4()}", headers=teacher_headers
            )
            assert missing.status == 404
            bad_score = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=teacher_headers,
                data={"score": float(audio_item["maxScore"]) + 1, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert bad_score.status == 400
            negative_api = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=teacher_headers,
                data={"score": -1, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert negative_api.status == 400
            other_teacher = login_api(page, teacher_other["login"])
            cross_class = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}", headers=headers(other_teacher)
            )
            assert cross_class.status == 403
            cross_school_session = login_api(page, foreign_teacher["login"])
            cross_school = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}", headers=headers(cross_school_session)
            )
            assert cross_school.status == 403

            # Search, strategy and domain filters only use fields returned by this authorized queue.
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            student_filter = page.locator("[data-student-filter]")
            student_filter.fill("T048-name-that-does-not-match")
            page.get_by_text("没有匹配的题目").wait_for()
            expect(page.locator(".review-stat.accent strong")).to_have_text(str(payload(queue_response)["total"]))
            expect(page.locator(".review-stat:not(.accent) strong")).to_have_text("0")
            page.locator(".queue-filters [data-clear]").click()
            student_filter = page.locator("[data-student-filter]")
            student_filter.fill(student_a["name"])
            expect(page.locator(".review-row")).to_have_count(len(initial_queue))
            page.locator("[data-strategy-filter]").select_option("SPEECH_OPEN_RESPONSE")
            image_matches = [item for item in initial_queue if item["strategy"] == "SPEECH_OPEN_RESPONSE"]
            expect(page.locator(".review-row")).to_have_count(len(image_matches))
            if image_item["domain"] is None:
                page.locator("[data-domain-filter]").select_option("__no_domain__")
            else:
                page.locator("[data-domain-filter]").select_option(image_item["domain"])
            domain_matches = [item for item in image_matches if item["domain"] == image_item["domain"]]
            expect(page.locator(".review-row")).to_have_count(len(domain_matches))
            save_responsive_screenshots(page, "queue")

            # The first authorized image URL request fails; the UI reports it, and a real retry loads the MinIO object.
            image_route_state = {"failed": False}

            def fail_first_picture_url(route):
                if route.request.method == "GET" and not image_route_state["failed"]:
                    image_route_state["failed"] = True
                    route.abort("internetdisconnected")
                else:
                    route.continue_()

            page.route("**/resources/*/playback-url", fail_first_picture_url)
            image_row = page.locator(f'.review-row[href^="/teacher/reviews/{image_id}"]')
            image_href = image_row.get_attribute("href")
            assert image_href and image_href.startswith(f"/teacher/reviews/{image_id}")
            image_row.click()
            wait_for_review_item(page, image_id)
            page.locator("[data-picture-state]").get_by_text("图片授权地址获取失败").wait_for(timeout=20_000)
            assert image_route_state["failed"]
            page.unroute("**/resources/*/playback-url", fail_first_picture_url)
            page.locator("[data-picture-retry]").click()
            expect(page.locator("[data-picture]")).to_be_visible(timeout=30_000)
            page.wait_for_function("document.querySelector('[data-picture]')?.naturalWidth > 0", timeout=30_000)
            image_detail_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{image_id}", headers=teacher_headers
            )
            assert image_detail_response.ok
            image_detail = payload(image_detail_response)
            assert image_detail["item"]["deliverySpec"]
            assert image_detail["review"]["rubric"]
            assert image_detail["item"]["answer"] is not None or image_detail["evidence"]["recordingId"]

            # Open the audio item from a fresh server queue; inject one failed media request without changing the real API response.
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            page.locator("[data-student-filter]").fill(student_a["name"])
            audio_row = page.locator(f'.review-row[href^="/teacher/reviews/{audio_id}"]')
            audio_href = audio_row.get_attribute("href")
            assert audio_href and audio_href.startswith(f"/teacher/reviews/{audio_id}")
            audio_detail_path = f"**/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}"
            playback_failure = {"url": "", "failed": False}

            def fail_one_audio_resource(route):
                playback_failure["failed"] = True
                route.abort("internetdisconnected")

            def attach_audio_failure(route):
                if route.request.method != "GET":
                    route.continue_()
                    return
                response = route.fetch()
                detail_body = payload(response)
                playback_failure["url"] = detail_body["evidence"]["playbackUrl"]
                assert playback_failure["url"]
                audio_url_match = lambda url: str(url) == playback_failure["url"]
                playback_failure["url_match"] = audio_url_match
                page.route(audio_url_match, fail_one_audio_resource)
                route.fulfill(response=response)

            page.route(audio_detail_path, attach_audio_failure)
            audio_row.click()
            wait_for_review_item(page, audio_id)
            page.locator("[data-audio-state]").get_by_text("未确认播放成功").wait_for(timeout=20_000)
            assert playback_failure["failed"]
            page.unroute(audio_detail_path, attach_audio_failure)
            page.unroute(playback_failure["url_match"], fail_one_audio_resource)
            page.locator("[data-audio-retry]").click()
            page.wait_for_function("document.querySelector('[data-review-audio]')?.readyState >= 3", timeout=30_000)
            audio_player = page.locator("[data-review-audio]")
            expect(page.locator("[data-audio-replay]")).to_be_enabled()
            expect(page.get_by_role("heading", name="朗读题目")).to_be_visible()
            audio_player.evaluate("audio => audio.play()")
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            audio_player.evaluate("audio => audio.pause()")
            expect(page.locator("[data-audio-state]")).to_contain_text("录音已暂停")
            page.locator("[data-audio-replay]").click()
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            audio_player.evaluate("audio => audio.pause()")
            audio_detail_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}", headers=teacher_headers
            )
            assert audio_detail_response.ok
            audio_detail = payload(audio_detail_response)
            assert audio_detail["item"]["targetText"]
            expect(page.locator(".detail-stimulus")).to_contain_text(audio_detail["item"]["targetText"])
            assert audio_detail["evidence"]["recordingId"] and audio_detail["evidence"]["playbackUrl"]
            assert audio_detail["review"]["rubric"]

            # Empty input, whitespace, negative, out-of-range and excess precision never send a score request.
            score_input = page.locator("[data-review-score]")
            expect(score_input).to_have_value("")
            submit_url = f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}"
            put_requests = []
            page.on("request", lambda request: put_requests.append(request.url) if request.method == "PUT" and request.url == submit_url else None)
            score_input.evaluate("input => { input.value = '   '; input.dispatchEvent(new Event('input', {bubbles:true})); }")
            score_input.press("Enter")
            page.get_by_text("请先输入得分").wait_for()
            assert page.evaluate("document.activeElement === document.querySelector('[data-review-score]')")
            assert len(put_requests) == 0
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(audio_id)} AND "scoredScore"=0;''') == "0"

            for invalid, expected in [("1.23", "最多保留一位小数"), ("-1", "不能低于 0"), (str(float(audio_item["maxScore"]) + 1), "不能超过")]:
                score_input.fill(invalid)
                score_input.press("Enter")
                expect(page.locator("[data-score-error]")).to_contain_text(expected)
                assert len(put_requests) == 0
            score_input.fill("0")
            expect(page.locator("[data-score-preview]")).to_have_text("当前选择：0 分")
            expect(page.locator("[data-score-marker]")).to_be_visible()

            # A transport interruption preserves the teacher's explicit zero and comment for a safe retry.
            comment = "具体观察：这次朗读停顿自然，句尾收得清楚。\n下一步练习：试试把第二句读慢半拍，留出句间停顿。"
            page.locator("[data-review-comment]").fill(comment)
            expect(page.locator("[data-comment-count]")).to_have_text(f"{len(comment)} / 2000")
            expect(page.locator("[data-feedback-preview]")).to_be_visible()
            expect(page.locator("[data-feedback-preview-text]")).to_have_text(comment)
            page.route(submit_url, lambda route: route.abort("internetdisconnected") if route.request.method == "PUT" else route.continue_())
            page.locator("[data-review-submit]").click()
            page.get_by_text("输入内容已保留").wait_for(timeout=20_000)
            assert score_input.input_value() == "0"
            assert page.locator("[data-review-comment]").input_value() == comment
            assert len(put_requests) == 1
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(audio_id)} AND "scoredScore" IS NOT NULL;''') == "0"
            page.unroute(submit_url)
            page.locator("[data-review-submit]").evaluate("button => { button.click(); button.click(); }")
            page.get_by_text("服务器已保存正式得分 0 分").wait_for(timeout=20_000)
            assert len(put_requests) == 2, put_requests
            assert page.locator("[data-review-score]").is_disabled()
            saved_message = page.locator("[data-review-message]").inner_text()
            assert "具体观察" in saved_message and "下一步练习" in saved_message
            assert "本次未选择分数" not in page.locator("[data-review-message]").inner_text()
            assert "已保存" in page.locator("[data-review-message]").inner_text()
            saved_zero = sql_rows(
                f'''SELECT "scoredScore"::text,"reviewerUserId",encode(convert_to("reviewerComment",'UTF8'),'hex'),"revision"::text,status::text
                     FROM "AssessmentItem" WHERE id={q(audio_id)};'''
            )[0]
            saved_zero[2] = bytes.fromhex(saved_zero[2]).decode("utf-8")
            assert saved_zero == ["0", TEACHER_SEED_ID, comment, "2", "REVIEWED"], saved_zero
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"

            # Same-score retry is server-idempotent; a changed duplicate conflicts and cannot overwrite the first save.
            same_retry = page.request.put(submit_url, headers=teacher_headers, data={"score": 0, "comment": comment})
            assert same_retry.status == 200
            assert sql_scalar(f'''SELECT "revision"::text FROM "AssessmentItem" WHERE id={q(audio_id)};''') == "2"
            changed_duplicate = page.request.put(
                submit_url,
                headers=teacher_headers,
                data={"score": float(audio_item["maxScore"]), "comment": "TEST_FIXTURE_ONLY 不可覆盖"},
            )
            assert changed_duplicate.status == 409

            # Next-item action fetches a fresh authorized queue and follows its returned dynamic item ID.
            remaining = item_queue(page.request, teacher_headers, student_a["name"])
            assert audio_id not in {item["itemId"] for item in remaining}
            expected_next = remaining[0]["itemId"]
            assert expected_next in item_ids and expected_next != audio_id
            save_responsive_screenshots(page, "review-confirmed", detail=True)
            page.emulate_media(reduced_motion="reduce")
            animation_duration = page.locator(".saved-review-banner svg path").evaluate("path => getComputedStyle(path).animationDuration")
            assert float(animation_duration.removesuffix("s")) <= 0.001, animation_duration
            queue_gets = []
            page.on("request", lambda request: queue_gets.append(request.url) if request.method == "GET" and request.url == queue_url else None)
            page.get_by_role("button", name="继续复核下一题").click()
            page.wait_for_function("itemId => location.pathname.endsWith(`/teacher/reviews/${itemId}`)", arg=expected_next, timeout=20_000)
            assert queue_gets == [queue_url], queue_gets

            # Review every remaining server-returned manual item one at a time; only the final response may include a report.
            pending_ids = {item["itemId"] for item in initial_queue if item["itemId"] != audio_id}
            current_id = expected_next
            positive_saved = False
            comments = {audio_id: comment}
            while pending_ids:
                assert current_id in pending_ids, {"current": current_id, "pending": sorted(pending_ids)}
                current_detail_response = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{current_id}", headers=teacher_headers
                )
                assert current_detail_response.ok, current_detail_response.text()
                current_detail = payload(current_detail_response)
                max_score = float(current_detail["item"]["maxScore"])
                score = max_score
                assert score > 0
                score_field = page.locator("[data-review-score]")
                expect(score_field).to_have_value("")
                score_field.fill(str(score))
                note = f"TEST_FIXTURE_ONLY T048 人工复核 {current_id[:8]}。"
                page.locator("[data-review-comment]").fill(note)
                page.locator("[data-review-submit]").click()
                pending_ids.remove(current_id)
                comments[current_id] = note
                is_last = not pending_ids
                if is_last:
                    page.get_by_text("服务端已生成正式报告").wait_for(timeout=30_000)
                    expect(page.locator("[data-review-message]")).to_contain_text("正式报告")
                else:
                    page.get_by_text("服务器已保存正式得分").wait_for(timeout=20_000)
                    assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
                if score > 0:
                    positive_saved = True
                if pending_ids:
                    fresh_queue = item_queue(page.request, teacher_headers, student_a["name"])
                    expected = fresh_queue[0]["itemId"]
                    assert expected in pending_ids
                    page.get_by_role("button", name="继续复核下一题").click()
                    page.wait_for_function("itemId => location.pathname.endsWith(`/teacher/reviews/${itemId}`)", arg=expected, timeout=20_000)
                    current_id = expected
            assert positive_saved

            saved_rows = sql_rows(
                f'''SELECT i.id,i."scoredScore"::text,i."reviewerUserId",encode(convert_to(i."reviewerComment",'UTF8'),'hex'),i."revision"::text,i.status::text
                     FROM "AssessmentItem" i WHERE i.id IN ({','.join(q(item_id) for item_id in item_ids)}) ORDER BY i."sortOrder";'''
            )
            for row in saved_rows:
                row[3] = bytes.fromhex(row[3]).decode("utf-8")
            assert len(saved_rows) == len(item_ids)
            assert all(row[1] is not None and row[2] == TEACHER_SEED_ID and row[4] == "2" and row[5] == "REVIEWED" for row in saved_rows), saved_rows
            assert {row[0]: row[3] for row in saved_rows} == comments
            report_row = sql_rows(
                f'''SELECT r.id,r."overallScore"::text,s.status::text FROM "AssessmentReport" r
                     JOIN "AssessmentSession" s ON s.id=r."sessionId" WHERE r."sessionId"={q(attempt_id)};'''
            )
            assert len(report_row) == 1 and report_row[0][2] == "COMPLETED"
            awarded, maximum = sql_rows(
                f'''SELECT SUM("scoredScore")::text,SUM("maxScore")::text FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)};'''
            )[0]
            assert float(report_row[0][1]) == pytest.approx(float(awarded) / float(maximum) * 100)

            # The completed item is gone from the teacher queue; the student can read only the authorized report feedback.
            updated_queue = page.request.get(queue_url, headers=teacher_headers)
            assert updated_queue.ok
            updated_ids = {item["itemId"] for item in payload(updated_queue)["items"]}
            assert set(item_ids).isdisjoint(updated_ids)
            student_session = authenticate(page, student_a["login"])
            student_headers = headers(student_session)
            page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            completed_row = page.locator(f'[data-history-session="{attempt_id}"]')
            completed_row.wait_for(timeout=20_000)
            completed_row.get_by_text("已完成").wait_for()
            report_link = completed_row.get_by_role("link", name="查看正式报告")
            report_href = report_link.get_attribute("href")
            assert report_href and attempt_id in report_href and report_href.endswith("/report/"), report_href
            assert report_href.startswith(("/assessment/sessions/", "/student/practices/attempts/")), report_href
            report_link.click()
            page.wait_for_url(f"**{report_href}", timeout=20_000)
            page.locator("[data-report-teacher-feedback]").wait_for(timeout=20_000)
            for teacher_comment in comments.values():
                expect(page.locator("[data-report-teacher-feedback]")).to_contain_text(teacher_comment)
            feedback_row = page.locator(".teacher-feedback-item").filter(has_text="具体观察：")
            expect(feedback_row).to_have_count(1)
            assert feedback_row.evaluate("node => node.childNodes[0].textContent") == comment
            assert feedback_row.evaluate("node => getComputedStyle(node).whiteSpace") == "pre-wrap"
            student_report_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=student_headers,
            )
            assert student_report_response.ok
            student_report = payload(student_report_response)
            assert float(student_report["overallScore"]) == pytest.approx(float(report_row[0][1]))
            assert {entry["comment"] for entry in student_report["teacherFeedback"]} == set(comments.values())
            report_json = json.dumps(student_report, ensure_ascii=False)
            for private_field in ("reviewerUserId", "referenceAnswer", "deductionRules", "scoringSpec"):
                assert private_field not in report_json
            student_b_session = login_api(page, student_b["login"])
            foreign_report = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=headers(student_b_session),
            )
            assert foreign_report.status in (403, 404)
            foreign_history = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/history?enrollmentId={student_a['enrollment']}",
                headers=headers(student_b_session),
            )
            assert foreign_history.status == 403
            student_review_detail = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}", headers=student_headers
            )
            assert student_review_detail.status in (403, 404)
            assert errors == [], errors
            proof = {
                "attemptId": attempt_id,
                "studentId": student_a["user"],
                "reviewItemIds": item_ids,
                "dynamicImageClick": {"itemId": image_id, "authorizedRetry": True, "naturalWidth": "positive"},
                "dynamicAudioClick": {"itemId": audio_id, "authorizedRetry": True, "playedSeconds": ">0.2", "pause": True, "replayFromStart": True},
                "emptyScore": {"uiRequests": 0, "databaseRows": 0},
                "explicitZero": saved_zero,
                "positiveScore": positive_saved,
                "nextItem": expected_next,
                "queueAfterReview": "all reviewed item IDs absent",
                "reportId": report_row[0][0],
                "studentReportHref": report_href,
                "studentReportScore": student_report["overallScore"],
                "recordingsInMinIO": uploaded,
                "sessionBeforeReview": session_state,
                "apiStatuses": {
                    "unauthenticated": no_auth.status,
                    "studentQueue": forbidden_queue.status,
                    "studentReview": student_put.status,
                    "missingItem": missing.status,
                    "scoreOverMax": bad_score.status,
                    "negativeScore": negative_api.status,
                    "crossClass": cross_class.status,
                    "crossSchool": cross_school.status,
                    "changedDuplicate": changed_duplicate.status,
                    "studentOtherReport": foreign_report.status,
                    "studentOtherHistory": foreign_history.status,
                },
                "reportGate": "report count 0 through penultimate review; 1 after last",
                "microphoneSource": "SIMULATED_MIC; real recording upload and MinIO playback",
            }
            EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
            (EVIDENCE_DIR / "proof.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(proof, ensure_ascii=False))
        finally:
            browser.close()
