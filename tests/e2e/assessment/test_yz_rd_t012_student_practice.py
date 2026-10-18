"""Native API/PostgreSQL/MinIO Chromium proof for YZ-RD-T012."""

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import parse_qs, urlencode, unquote, urlparse, urlunparse

from playwright.sync_api import sync_playwright


BASE = os.environ["YZ_T012_BASE_URL"]
DATABASE_URL = os.environ["YZ_T012_DATABASE_URL"]
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
SEED_STUDENT_ID = "22222222-2222-4222-8222-222222222222"
PASSWORD = os.environ["YZ_T012_TEST_PASSWORD"]
PRACTICE_TITLE = "停顿与节奏专项训练"
BUCKET = os.environ["YZ_T012_S3_BUCKET"]
EVIDENCE_DIR = Path(os.environ["YZ_T012_EVIDENCE_DIR"])


def payload(response):
    body = response.json()
    return body.get("data", body)


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["YZ_T012_POSTGRES_PORT"])
    assert parsed.username == os.environ["YZ_T012_POSTGRES_USER"] == "yz_t012"
    assert parsed.path.lstrip("/") == os.environ["YZ_T012_POSTGRES_DB"] == "yuzan_t012_native"
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
        [os.environ["YZ_T012_PSQL"], "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        capture_output=True,
        text=True,
        env=env,
        check=False,
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
    assert identity.startswith("yuzan_t012_native|yz_t012|PostgreSQL 17."), identity.split("|", 2)[:2]


def create_student_fixture(label):
    user_id = str(uuid.uuid4())
    identifier = f"yz-rd-t012-{label}-{user_id}@test.invalid"
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    display_name = f"TEST_FIXTURE_ONLY T012 学生{label}"
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{identifier}', '{display_name}', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{SEED_STUDENT_ID}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return user_id, identifier, enrollment_id


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


def api_headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def practice_in_catalog(page, headers):
    response = page.request.get(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices?catalogType=SPECIALIZED",
        headers=headers,
    )
    assert response.ok, response.text()
    catalog = payload(response)
    return next(item for item in catalog["items"] if item["title"] == PRACTICE_TITLE)


def response_spec(item):
    spec = item.get("itemConfig") or item.get("prompt") or {}
    if isinstance(spec, str):
        spec = json.loads(spec)
    if not isinstance(spec, dict):
        return {}
    if spec.get("response"):
        return spec
    item_type = item.get("itemType", "")
    if item_type == "LISTEN_ONLY":
        response_type = "NONE"
    elif item_type in ("READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"):
        response_type = "SPEECH"
    elif item_type in ("CHOICE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"):
        response_type = "CHOICE"
    else:
        response_type = "TEXT"
    return {**spec, "response": {"type": response_type}}


def get_attempt_items(page, headers, attempt_id):
    response = page.request.get(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}/items",
        headers=headers,
    )
    assert response.ok, response.text()
    body = payload(response)
    items = body if isinstance(body, list) else body["items"]
    assert len(items) == 4, f"Expected four persisted items, got {len(items)}"
    return items


def minio_head_object(object_key):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T012_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});
(async () => {
  try {
    const head = await client.send(new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: process.env.YZ_T012_OBJECT_KEY,
    }));
    process.stdout.write(JSON.stringify({
      bytes: head.ContentLength,
      contentType: head.ContentType,
      etag: head.ETag,
    }));
  } catch (error) {
    if (error && (error.$metadata?.httpStatusCode === 404 || error.name === "NotFound")) {
      process.stdout.write(JSON.stringify({missing: true}));
    } else {
      process.stderr.write((error.name || "S3_HEAD_FAILED") + "\n");
      process.exitCode = 1;
    }
  } finally {
    client.destroy();
  }
})().catch(error => {
  process.stderr.write((error.name || "S3_HEAD_FAILED") + "\n");
  process.exitCode = 1;
});'''
    env = {
        **os.environ,
        "YZ_T012_API_PACKAGE": str(Path(__file__).resolve().parents[3] / "backend" / "api" / "package.json"),
        "YZ_T012_OBJECT_KEY": object_key,
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
        secrets = [env.get(key, "") for key in ("S3_SECRET_KEY", "POSTGRES_PASSWORD")]
        message = result.stderr
        for secret in secrets:
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"T012 MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


def object_key_from_signed_url(value):
    parts = urlparse(value).path.strip("/").split("/")
    assert parts[0] == BUCKET
    return "/".join(parts[1:])


def recording_rows(enrollment_id, attempt_id, item_id):
    key_prefix = f"runner-{attempt_id}-{item_id}-"
    return sql_rows(
        f'''SELECT id::text, status::text, COALESCE("objectKey", ''), COALESCE("mimeType", ''),
                    COALESCE("durationMs", 0)::text, "idempotencyKey"
               FROM "Recording"
              WHERE "enrollmentId" = '{enrollment_id}'
                AND "idempotencyKey" LIKE '{key_prefix}%'
              ORDER BY "createdAt";'''
    )


def test_t012_student_practice_runner_real_api_postgres_minio_and_recovery():
    verify_database_identity()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    student_a_id, identifier_a, enrollment_a = create_student_fixture("A")
    student_b_id, identifier_b, enrollment_b = create_student_fixture("B")
    attempt_id = None
    practice_id = None
    recording_evidence = []
    page_errors = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path="/usr/bin/google-chrome",
                args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
            )
            context = browser.new_context(
                viewport={"width": 1440, "height": 960},
                permissions=["microphone"],
            )
            context.add_init_script("window.__yuzanRunnerMicrophoneSource = 'SIMULATED_MIC';")
            page = context.new_page()
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            try:
                session_a = authenticate(page, identifier_a)
                headers_a = api_headers(session_a)
                practice = practice_in_catalog(page, headers_a)
                practice_id = practice["id"]
                assert practice["catalogType"] == "SPECIALIZED"
                assert practice["mode"] == "SELF_PRACTICE"
                assert practice["estimatedMinutes"] == 10

                anonymous = playwright.request.new_context()
                unauthenticated = anonymous.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices"
                )
                anonymous.dispose()
                assert unauthenticated.status == 401
                foreign_school = page.request.get(
                    f"{BASE}/api/v1/schools/{uuid.uuid4()}/practices",
                    headers=headers_a,
                )
                assert foreign_school.status == 403, foreign_school.text()
                missing_attempt = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{uuid.uuid4()}",
                    headers=headers_a,
                )
                assert missing_attempt.status == 404
                initial_attempt_count = int(
                    sql(
                        f'''SELECT count(*) FROM "AssessmentSession"
                             WHERE "enrollmentId" = '{enrollment_a}'
                               AND "practiceDefinitionId" = '{practice_id}';''',
                        capture=True,
                    )
                )

                page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
                page.set_viewport_size({"width": 1920, "height": 1080})
                page.wait_for_function("document.querySelectorAll('.practice-tile').length > 0")
                page.screenshot(path=str(EVIDENCE_DIR / "catalog-1920.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})
                page.screenshot(path=str(EVIDENCE_DIR / "catalog-1440.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1280, "height": 900})
                page.screenshot(path=str(EVIDENCE_DIR / "catalog-1280.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 390, "height": 844})
                page.screenshot(path=str(EVIDENCE_DIR / "catalog-390.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})

                page.get_by_role("button", name="专项训练", exact=True).click()
                card = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
                card.wait_for(timeout=20_000)
                favorite = card.locator("[data-favorite]")
                catalog_url = page.url
                favorite.focus()
                page.keyboard.press("Enter")
                page.wait_for_function(
                    "id => document.querySelector('[data-favorite=\"' + id + '\"]')?.getAttribute('aria-pressed') === 'true'",
                    arg=practice_id,
                    timeout=20_000,
                )
                assert page.url == catalog_url
                assert page.locator("a.practice-cover button[data-favorite]").count() == 0
                card.locator("h2 a").click()
                page.wait_for_url(f"**/student/practices/{practice_id}/", timeout=20_000)
                page.get_by_text("训练流程").wait_for()
                page.set_viewport_size({"width": 390, "height": 844})
                page.wait_for_function(
                    "document.querySelector('.practice-page')?.getAnimations().every(animation => animation.playState === 'finished')",
                    timeout=5_000,
                )
                page.screenshot(path=str(EVIDENCE_DIR / "detail-390.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})
                page.screenshot(path=str(EVIDENCE_DIR / "detail-1440.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")

                page.locator("[data-start]").click()
                page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
                attempt_id = page.url.split("/attempts/")[1].split("/")[0]
                assert attempt_id
                assert int(
                    sql(
                        f'''SELECT count(*) FROM "AssessmentSession"
                             WHERE "enrollmentId" = '{enrollment_a}'
                               AND "practiceDefinitionId" = '{practice_id}';''',
                        capture=True,
                    )
                ) == initial_attempt_count + 1
                items = get_attempt_items(page, headers_a, attempt_id)
                assert [response_spec(item).get("response", {}).get("type") for item in items] == [
                    "CHOICE",
                    "SPEECH",
                    "SPEECH",
                    "TEXT",
                ]

                deny_browser = playwright.chromium.launch(
                    headless=True,
                    executable_path="/usr/bin/google-chrome",
                    args=["--use-fake-device-for-media-stream"],
                )
                deny_page = deny_browser.new_page(viewport={"width": 1280, "height": 900})
                deny_cdp = deny_browser.new_browser_cdp_session()
                deny_cdp.send(
                    "Browser.setPermission",
                    {
                        "permission": {"name": "microphone"},
                        "setting": "denied",
                        "origin": BASE,
                    },
                )
                authenticate(deny_page, identifier_a)
                deny_page.goto(
                    f"{BASE}/student/practices/attempts/{attempt_id}/runner/",
                    wait_until="networkidle",
                )
                deny_page.locator('[data-go="1"]').click()
                deny_page.locator("[data-start-recording]").click()
                deny_page.get_by_text("麦克风权限被拒绝", exact=False).first.wait_for(timeout=15_000)
                assert recording_rows(enrollment_a, attempt_id, items[1]["id"]) == []
                deny_browser.close()

                page.locator("[data-go='0']").click()
                page.locator(".runner-option").first.wait_for()
                failed_answer = {"seen": False}

                def fail_answer_once(route):
                    if not failed_answer["seen"] and route.request.method == "PUT":
                        failed_answer["seen"] = True
                        route.abort("internetdisconnected")
                    else:
                        route.continue_()

                answer_route = "**/api/v1/schools/*/assessments/sessions/*/items/*/answer"
                page.route(answer_route, fail_answer_once)
                page.locator("[data-choice]").first.click()
                page.locator("[data-retry-save]").wait_for(timeout=15_000)
                page.unroute(answer_route, fail_answer_once)
                page.locator("[data-retry-save]").click()
                page.get_by_text("答案已保存到服务器").wait_for(timeout=15_000)

                runner_url = f"{BASE}/student/practices/attempts/{attempt_id}/runner/"
                page.reload(wait_until="networkidle")
                assert page.url == runner_url
                page.locator(".runner-option.selected").wait_for(timeout=15_000)
                own_attempt = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}",
                    headers=headers_a,
                )
                assert payload(own_attempt)["id"] == attempt_id

                page.get_by_role("link", name="返回练习中心").click()
                page.wait_for_url("**/student/practices/", timeout=20_000)
                card = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
                card.locator("h2 a").click()
                page.wait_for_url(f"**/student/practices/{practice_id}/", timeout=20_000)
                attempt_snapshot = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}",
                    headers=headers_a,
                )
                sessions_snapshot = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions?limit=100",
                    headers=headers_a,
                )
                assert attempt_snapshot.ok, attempt_snapshot.text()
                assert sessions_snapshot.ok, sessions_snapshot.text()
                print(
                    "T012 resume diagnostic: "
                    + json.dumps(
                        {
                            "attempt": {
                                "id": payload(attempt_snapshot).get("id"),
                                "status": payload(attempt_snapshot).get("status"),
                                "practiceDefinitionId": payload(attempt_snapshot).get("practiceDefinitionId"),
                            },
                            "listedSessionIds": [
                                item.get("id") for item in payload(sessions_snapshot).get("items", [])
                            ],
                            "detailActionLinks": page.locator(".detail-actions a").count(),
                            "detailStartButtons": page.locator("[data-start]").count(),
                            "pageErrors": page_errors,
                        },
                        ensure_ascii=False,
                    )
                )
                resume_href = f'/student/practices/attempts/{attempt_id}/runner/'
                assert page.locator(f'a[href="{resume_href}"]').count() == 1
                page.locator(f'a[href="{resume_href}"]').click()
                page.wait_for_url(runner_url, timeout=20_000)
                assert page.url == runner_url
                page.locator('[data-go="1"]').click()

                prompt_audio = page.locator("[data-prompt-audio]")
                prompt_audio.wait_for(timeout=15_000)
                page.evaluate(
                    """async () => {
                      const audio = document.querySelector('[data-prompt-audio]');
                      audio.muted = true;
                      await audio.play();
                    }"""
                )
                page.wait_for_function(
                    "document.querySelector('[data-prompt-audio]')?.currentTime > 0",
                    timeout=10_000,
                )
                assert "is-playing" in page.locator("[data-audio-player]").get_attribute("class")
                page.locator("[data-prompt-audio]").evaluate("audio => audio.pause()")
                page.get_by_text("题目音频已暂停").wait_for(timeout=5_000)
                page.set_viewport_size({"width": 1440, "height": 960})
                page.screenshot(path=str(EVIDENCE_DIR / "runner-audio-1440.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 390, "height": 844})
                page.screenshot(path=str(EVIDENCE_DIR / "runner-audio-390.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})

                page.locator("[data-start-recording]").click()
                page.locator("[data-stop-recording]").wait_for(timeout=12_000)
                page.get_by_text("SIMULATED_MIC", exact=False).wait_for(timeout=5_000)
                assert page.locator('[data-waveform="input"].is-live').count() == 1
                page.wait_for_timeout(1_200)
                page.locator("[data-stop-recording]").click()
                page.locator("[data-upload-recording]").wait_for(timeout=15_000)
                first_preview = page.locator("[data-take-audio]")
                assert first_preview.get_attribute("src").startswith("blob:")
                assert page.get_by_text("SIMULATED_MIC", exact=False).count() == 1

                signed_put = {"seen": False, "original": "", "objectKey": ""}

                def invalidate_first_signature(route):
                    request = route.request
                    if not signed_put["seen"] and request.method == "PUT" and BUCKET in request.url:
                        parsed = urlparse(request.url)
                        query = parse_qs(parsed.query)
                        assert "X-Amz-Signature" in query
                        signed_put["seen"] = True
                        signed_put["original"] = request.url
                        signed_put["objectKey"] = object_key_from_signed_url(request.url)
                        query["X-Amz-Signature"] = ["0" * 64]
                        invalid_url = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))
                        route.continue_(url=invalid_url)
                    else:
                        route.continue_()

                signed_responses = []
                page.on(
                    "response",
                    lambda response: signed_responses.append(response.status)
                    if response.request.method == "PUT" and BUCKET in response.url
                    else None,
                )
                page.route("**/*", invalidate_first_signature)
                page.locator("[data-upload-recording]").click()
                page.locator('[data-runner-message]:not([hidden])').filter(has_text="上传尚未确认").wait_for(timeout=20_000)
                assert signed_put["seen"]
                assert 403 in signed_responses, signed_responses
                page.unroute("**/*", invalidate_first_signature)
                failed_first = recording_rows(enrollment_a, attempt_id, items[1]["id"])
                assert len(failed_first) == 1
                assert failed_first[0][1] == "INITIALIZED"
                assert minio_head_object(signed_put["objectKey"]) == {"missing": True}

                page.locator("[data-upload-recording]").click()
                page.get_by_text("服务器已确认保存").wait_for(timeout=30_000)
                first_recordings = recording_rows(enrollment_a, attempt_id, items[1]["id"])
                assert len(first_recordings) == 1, first_recordings
                first_recording = first_recordings[0]
                first_head = minio_head_object(first_recording[2])
                assert first_head["bytes"] > 0
                assert first_head["contentType"].startswith("audio/")
                recording_evidence.append(
                    {
                        "itemId": items[1]["id"],
                        "recordingId": first_recording[0],
                        "status": first_recording[1],
                        "objectKey": first_recording[2],
                        "bytes": first_head["bytes"],
                        "contentType": first_head["contentType"],
                        "signatureFailure": 403,
                        "retryCountForIdempotencyKey": len(first_recordings),
                    }
                )

                page.locator("[data-next]").click()
                page.locator("[data-start-recording]").click()
                page.locator("[data-stop-recording]").wait_for(timeout=12_000)
                page.wait_for_timeout(1_200)
                page.locator("[data-stop-recording]").click()
                page.locator("[data-upload-recording]").wait_for(timeout=15_000)
                offline_put = {"seen": False}

                def interrupt_first_put(route):
                    request = route.request
                    if not offline_put["seen"] and request.method == "PUT" and BUCKET in request.url:
                        offline_put["seen"] = True
                        route.abort("internetdisconnected")
                    else:
                        route.continue_()

                page.route("**/*", interrupt_first_put)
                page.locator("[data-upload-recording]").click()
                page.locator('[data-runner-message]:not([hidden])').filter(has_text="上传尚未确认").wait_for(timeout=20_000)
                assert offline_put["seen"]
                page.unroute("**/*", interrupt_first_put)
                failed_second = recording_rows(enrollment_a, attempt_id, items[2]["id"])
                assert len(failed_second) == 1
                assert failed_second[0][1] == "INITIALIZED"

                page.locator("[data-upload-recording]").click()
                page.get_by_text("服务器已确认保存").wait_for(timeout=30_000)
                second_recordings = recording_rows(enrollment_a, attempt_id, items[2]["id"])
                assert len(second_recordings) == 1, second_recordings
                second_recording = second_recordings[0]
                second_head = minio_head_object(second_recording[2])
                assert second_head["bytes"] > 0
                assert second_head["contentType"].startswith("audio/")
                recording_evidence.append(
                    {
                        "itemId": items[2]["id"],
                        "recordingId": second_recording[0],
                        "status": second_recording[1],
                        "objectKey": second_recording[2],
                        "bytes": second_head["bytes"],
                        "contentType": second_head["contentType"],
                        "networkRetry": True,
                        "retryCountForIdempotencyKey": len(second_recordings),
                    }
                )

                page.locator("[data-next]").click()
                page.locator("[data-text]").fill("山风穿过树梢，声音清楚而自然。")
                page.wait_for_function(
                    "document.querySelector('[data-save-state]')?.textContent === '答案已保存到服务器'",
                    timeout=15_000,
                )
                assert "4 / 4 题已完成" in page.locator("[data-progress-copy]").inner_text()
                page.set_viewport_size({"width": 1440, "height": 960})
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(path=str(EVIDENCE_DIR / "runner-ready-submit-1440.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 390, "height": 844})
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(path=str(EVIDENCE_DIR / "runner-ready-submit-390.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})

                submit_posts = []
                page.on(
                    "request",
                    lambda request: submit_posts.append(request.url)
                    if request.method == "POST"
                    and request.url.endswith(f"/assessments/sessions/{attempt_id}/submit")
                    else None,
                )
                page.locator("[data-submit]").click()
                page.get_by_role("dialog", name="确认交卷").wait_for(timeout=10_000)
                assert page.evaluate("document.activeElement.matches('[data-cancel-submit]')")
                page.keyboard.press("Tab")
                assert page.evaluate("document.activeElement.matches('[data-confirm-submit]')")
                page.keyboard.press("Escape")
                assert page.locator(".runner-confirm-modal").count() == 0
                assert page.evaluate("document.activeElement.matches('[data-submit]')")
                page.locator("[data-submit]").click()
                page.get_by_role("dialog", name="确认交卷").wait_for(timeout=10_000)
                page.set_viewport_size({"width": 390, "height": 844})
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(path=str(EVIDENCE_DIR / "runner-confirm-390.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.set_viewport_size({"width": 1440, "height": 960})
                page.locator("[data-confirm-submit]").evaluate(
                    "button => { button.click(); button.click(); }"
                )
                page.wait_for_url(
                    f"**/student/practices/attempts/{attempt_id}/processing/",
                    timeout=45_000,
                )
                assert len(submit_posts) == 1, submit_posts
                duplicate_submit = page.request.post(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/submit",
                    headers=headers_a,
                    data={},
                )
                assert duplicate_submit.ok, duplicate_submit.text()
                assert payload(duplicate_submit)["id"] == attempt_id

                attempt_row = sql_rows(
                    f'''SELECT id::text, status::text, "enrollmentId"::text
                         FROM "AssessmentSession" WHERE id = '{attempt_id}';'''
                )[0]
                assert attempt_row == [attempt_id, "PROCESSING", enrollment_a], attempt_row
                report_count = int(
                    sql(
                        f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId" = '{attempt_id}';''',
                        capture=True,
                    )
                )
                audio_score_count = int(
                    sql(
                        f'''SELECT count(*) FROM "AssessmentItem"
                             WHERE "sessionId" = '{attempt_id}' AND "recordingId" IS NOT NULL
                               AND "scoredScore" IS NOT NULL;''',
                        capture=True,
                    )
                )
                assert report_count == 0
                assert audio_score_count == 0
                speech_job_rows = sql_rows(
                    f'''SELECT count(*)::text, count(DISTINCT "recordingId")::text
                         FROM "SpeechJob" WHERE "schoolId" = '{SCHOOL_ID}'
                           AND "assessmentItemId" IN (
                             SELECT id FROM "AssessmentItem" WHERE "sessionId" = '{attempt_id}'
                           );'''
                )[0]
                assert speech_job_rows == ["2", "2"], speech_job_rows

                page.reload(wait_until="networkidle")
                assert page.url.endswith(f"/student/practices/attempts/{attempt_id}/processing/")
                page.locator(".processing-meta").wait_for(timeout=20_000)
                history_link = page.locator('a[href="/student/practices/history/"]').first
                history_link.click()
                page.wait_for_url("**/student/practices/history/", timeout=20_000)
                history_row = page.locator(f'[data-history-session="{attempt_id}"]')
                history_row.wait_for(timeout=20_000)
                history_row.get_by_text("处理中").wait_for()
                assert "尚未形成报告或成绩" in history_row.inner_text()

                page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
                active_card = page.locator(".practice-tile").filter(has_text=PRACTICE_TITLE)
                active_card.wait_for(timeout=20_000)
                assert active_card.locator(
                    f'a[href="/student/practices/attempts/{attempt_id}/processing/"]'
                ).count() == 1
                assert active_card.get_by_text("处理中").count() >= 1

                b_context = browser.new_context(viewport={"width": 1280, "height": 900})
                b_page = b_context.new_page()
                session_b = authenticate(b_page, identifier_b)
                headers_b = api_headers(session_b)
                practice_b = b_page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/{practice_id}",
                    headers=headers_b,
                )
                assert practice_b.ok, practice_b.text()
                assert payload(practice_b)["studentState"]["attempt"] is None
                foreign_attempt = b_page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}",
                    headers=headers_b,
                )
                assert foreign_attempt.status in (403, 404)
                assert enrollment_a != enrollment_b
                assert student_a_id != student_b_id
                b_context.close()

                assert page_errors == [], page_errors
                EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                summary = {
                    "attemptId": attempt_id,
                    "practiceDefinitionId": practice_id,
                    "studentA": student_a_id,
                    "studentB": student_b_id,
                    "enrollmentA": enrollment_a,
                    "enrollmentB": enrollment_b,
                    "status": attempt_row[1],
                    "recordings": recording_evidence,
                    "reportCount": report_count,
                    "scoredSpeechItems": audio_score_count,
                    "speechJobs": {
                        "count": int(speech_job_rows[0]),
                        "distinctRecordings": int(speech_job_rows[1]),
                    },
                    "unauthenticated": 401,
                    "wrongSchool": foreign_school.status,
                    "missingAttempt": 404,
                    "studentIsolation": foreign_attempt.status,
                    "permissionDenied": True,
                    "invalidSignature": 403,
                    "networkInterrupted": True,
                    "duplicateSubmitPosts": len(submit_posts),
                    "screenshots": sorted(path.name for path in EVIDENCE_DIR.glob("*.png")),
                }
                EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                summary_text = json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
                (EVIDENCE_DIR / "e2e-summary.json").write_text(summary_text, encoding="utf-8")
                print(summary_text)
            finally:
                browser.close()
    finally:
        # Keep the task-owned fictional SQL rows and real MinIO objects as evidence.
        pass
