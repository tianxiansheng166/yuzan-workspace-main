"""Real-browser proof for a student's own practice state and history."""

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import sync_playwright


BASE = os.environ.get("YZ_T010_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T010_DATABASE_URL", "")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
PASSWORD = os.environ.get("YZ_T010_PASSWORD", "")
PRACTICE_TITLE = "国家通用语言文字能力｜水平一级综合测评"


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t010"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t010_native"
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
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode:
        message = result.stderr.replace(password, "<redacted>")
        raise RuntimeError(message)
    return result.stdout.strip() if capture else ""


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def verify_database_identity():
    identity = sql(
        "SELECT current_database() || '|' || current_user || '|' || version();",
        capture=True,
    )
    assert identity.startswith("yuzan_t010_native|yz_t010|PostgreSQL 17."), identity.split("|", 2)[:2]


def minio_head_object(object_key):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T010_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.YZ_T010_S3_ENDPOINT,
  region: process.env.YZ_T010_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YZ_T010_S3_ACCESS_KEY,
    secretAccessKey: process.env.YZ_T010_S3_SECRET_KEY,
  },
});
(async () => {
  try {
    const head = await client.send(new HeadObjectCommand({
      Bucket: process.env.YZ_T010_S3_BUCKET,
      Key: process.env.YZ_T010_MINIO_OBJECT_KEY,
    }));
    process.stdout.write(JSON.stringify({bytes: head.ContentLength, contentType: head.ContentType}));
  } finally {
    client.destroy();
  }
})().catch(error => {
  process.stderr.write(`${error.name || "S3_HEAD_FAILED"}\\n`);
  process.exitCode = 1;
});'''
    env = {
        **os.environ,
        "YZ_T010_API_PACKAGE": str(Path(__file__).resolve().parents[3] / "backend" / "api" / "package.json"),
        "YZ_T010_MINIO_OBJECT_KEY": object_key,
    }
    result = subprocess.run(
        ["node", "-e", script],
        cwd=Path(__file__).resolve().parents[3],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        secrets = [env.get(key, "") for key in ("YZ_T010_S3_SECRET_KEY", "POSTGRES_PASSWORD")]
        message = result.stderr
        for secret in secrets:
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


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


def create_student_fixture(label):
    user_id = str(uuid.uuid4())
    identifier = f"yz-rd-t010-{label.lower()}-{user_id}@test.invalid"
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    display_name = f"TEST_FIXTURE_ONLY T010 学生{label}"
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{identifier}', '{display_name}', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{STUDENT_A_ID}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return user_id, identifier, enrollment_id


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
    upload_retries = 0

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
            failure = {"injected": False}

            def fail_first_upload(route):
                request = route.request
                if not failure["injected"] and request.method == "PUT" and "/recordings/" in request.url:
                    failure["injected"] = True
                    route.abort("internetdisconnected")
                else:
                    route.continue_()

            page.route("**/*", fail_first_upload)
            page.locator("[data-upload-recording]").click()
            page.get_by_text("上传尚未确认").wait_for(timeout=20_000)
            assert failure["injected"], "the test must exercise a failed real MinIO upload request"
            page.unroute("**/*", fail_first_upload)
            page.locator("[data-upload-recording]").click()
            page.locator(".runner-speech.saved").wait_for(timeout=30_000)
            recorded_audio += 1
            upload_retries += 1

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
    return {"itemCount": len(items), "playedAudio": played_audio, "recordedAudio": recorded_audio, "uploadRetries": upload_retries, "submitPosts": len(submit_posts), "duplicateSubmitId": payload(duplicate_submit)["id"]}


@pytest.mark.skipif(not BASE or not DATABASE_URL, reason="requires the isolated T010 native API/PostgreSQL/MinIO fixture")
def test_student_practice_submission_appears_only_in_the_owners_history():
    verify_database_identity()
    user_a_id, identifier_a, enrollment_a = create_student_fixture("甲")
    user_b_id, identifier_b, enrollment_b = create_student_fixture("乙")
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
                student_a = authenticate(page, identifier_a)
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
                assert own_session["id"] == attempt_a
                assert own_session["status"] == "PROCESSING"
                assert sql(
                    f'''SELECT id || '|' || status::text || '|' || revision::text
                         FROM "AssessmentSession" WHERE id='{attempt_a}' AND "schoolId"='{SCHOOL_ID}';''',
                    capture=True,
                ).split("|")[:2] == [attempt_a, "PROCESSING"]
                assert sql(
                    f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"='{attempt_a}';''',
                    capture=True,
                ) == "0"
                item_score_counts = sql_rows(
                    f'''SELECT count(*) FILTER (WHERE "scoredScore" IS NOT NULL AND "recordingId" IS NULL)::text,
                               count(*) FILTER (WHERE "scoredScore" IS NOT NULL AND "recordingId" IS NOT NULL)::text
                        FROM "AssessmentItem" WHERE "sessionId"='{attempt_a}';'''
                )[0]
                written_item_score_count, scored_audio_item_count = map(int, item_score_counts)
                assert scored_audio_item_count == 0, "unreviewed recording items must not receive speech scores"
                audio_rows = sql_rows(
                    f'''SELECT r.id, COALESCE(r."objectKey", ''), r.status::text,
                               COALESCE(r."mimeType", ''), COALESCE(r."durationMs"::text, ''), count(j.id)::text
                        FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                        LEFT JOIN "SpeechJob" j ON j."recordingId"=r.id
                        WHERE i."sessionId"='{attempt_a}'
                        GROUP BY r.id ORDER BY r.id;'''
                )
                assert audio_rows, "the submitted attempt must retain its uploaded recording evidence"
                uploaded_objects = []
                for recording_id, object_key, recording_status, mime_type, duration_ms, jobs in audio_rows:
                    assert object_key.startswith(f"recordings/{recording_id}/")
                    assert recording_status in {"READY", "PROCESSING", "COMPLETE"}
                    assert mime_type.startswith("audio/")
                    head = minio_head_object(object_key)
                    assert int(head["bytes"]) > 0
                    assert head["contentType"].startswith("audio/")
                    uploaded_objects.append({
                        "recordingId": recording_id,
                        "objectKey": object_key,
                        "recordingStatus": recording_status,
                        "mimeType": mime_type,
                        "durationMs": int(duration_ms or 0),
                        "speechJobs": int(jobs),
                        "bytes": int(head["bytes"]),
                    })

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
                page.set_viewport_size({"width": 1280, "height": 900})
                own_row = page.locator(f'[data-history-session="{attempt_a}"]')
                processing_link = own_row.get_by_role("link", name="查看处理状态")
                processing_href = processing_link.get_attribute("href")
                assert processing_href == f"/assessment/sessions/{attempt_a}/processing/"
                processing_link.click()
                page.wait_for_url(f"**{processing_href}", timeout=20_000)
                page.get_by_text("处理中").first.wait_for(timeout=20_000)
                page.go_back()
                page.wait_for_url("**/student/practices/history/", timeout=20_000)
                page.locator(f'[data-history-session="{attempt_a}"]').wait_for(timeout=20_000)
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
                evidence_dir = Path(os.environ["YZ_T010_EVIDENCE_DIR"])
                evidence_dir.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(evidence_dir / "student-history-1280.png"), full_page=True)
                page.set_viewport_size({"width": 1440, "height": 1000})
                page.screenshot(path=str(evidence_dir / "student-history-1440.png"), full_page=True)

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
                runner_url_b = f"{BASE}/student/practices/attempts/{attempt_b}/runner/"
                page.reload(wait_until="networkidle")
                assert page.url == runner_url_b
                page.locator(".question-shell").wait_for(timeout=20_000)
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
                print(json.dumps({"studentA": user_a_id, "studentB": user_b_id, "attemptA": attempt_a, "attemptB": attempt_b, "processingRoute": processing_href, "enrollmentA": enrollment_a, "enrollmentB": enrollment_b, "statusA": own_session["status"], "formalReportCount": 0, "writtenItemScoreCount": written_item_score_count, "scoredAudioItemCount": scored_audio_item_count, "microphoneSource": "SIMULATED_MIC", "uploadedObjects": uploaded_objects, "statusB": status_b, "completion": completion}, ensure_ascii=False))
            finally:
                browser.close()
    finally:
        # Keep the isolated fictional fixture, Attempt, Recording, and MinIO objects as evidence.
        pass
