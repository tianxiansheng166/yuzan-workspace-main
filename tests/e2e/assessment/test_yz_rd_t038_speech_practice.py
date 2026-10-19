"""Native-browser proof for the T038 speaking and practice-mode journey.

The browser uses the seeded, school-authorized speaking practice. Separate
catalog/report fixtures are TEST_FIXTURE_ONLY rows in the isolated T038 DB.
Speech scoring is disabled; the only speech score below comes from an explicit
teacher review, through the normal API.
"""

import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright


BASE = os.environ.get("YZ_T038_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T038_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T038_PASSWORD", "")
EVIDENCE = Path(os.environ.get("YZ_T038_EVIDENCE_DIR", "/tmp/yz-rd-t038"))
PSQL = os.environ.get("YZ_T038_PSQL", "psql")
API_PACKAGE = os.environ.get("YZ_T038_API_PACKAGE", "")
BUCKET = os.environ.get("YZ_T038_S3_BUCKET", "")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
SEED_STUDENT_ID = "22222222-2222-4222-8222-222222222222"
SEED_CHOICE_VERSION_ID = "75000000-0000-4000-8000-000000000001"
CHROME = "/usr/bin/google-chrome"


def payload(response):
    body = response.json()
    return body.get("data", body)


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.username == os.environ["YZ_T038_POSTGRES_USER"] == "yz_t038"
    assert parsed.port == int(os.environ["YZ_T038_POSTGRES_PORT"])
    assert parsed.path.lstrip("/") == os.environ["YZ_T038_POSTGRES_DB"] == "yuzan_t038_native"
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
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();", capture=True)
    assert identity.startswith("yuzan_t038_native|yz_t038|PostgreSQL 17."), identity.split("|", 2)[:2]


def authenticate(page, identifier):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    session = payload(response)
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
        }""",
        session,
    )
    return session


def auth_headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def sql_text(value):
    return value.replace("'", "''")


def create_student_fixture(label):
    user_id = str(uuid.uuid4())
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    identifier = f"yz-rd-t038-student-{label.lower()}-{user_id}@test.invalid"
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{identifier}', 'TEST_FIXTURE_ONLY T038 学生{label}', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{SEED_STUDENT_ID}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return {"userId": user_id, "enrollmentId": enrollment_id, "identifier": identifier}


def create_question_version(item_type, run_key):
    item_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    speech = item_type == "SPEECH"
    stable_key = f"TEST_FIXTURE_ONLY-T038-{run_key}-{item_type}"
    if speech:
        domain = "SPEAK"
        question_type = "READ_ALOUD"
        ability_category = "独立朗读"
        delivery = {
            "stimulus": {"type": "TEXT", "promptText": "TEST_FIXTURE_ONLY：请朗读下面的练习句子。"},
            "response": {"type": "SPEECH"},
        }
        scoring = {"strategy": "SPEECH_READING", "maxScore": 4, "targetText": "TEST_FIXTURE_ONLY 春风又绿江南岸"}
    else:
        domain = "READ"
        question_type = "SENTENCE_COMPREHENSION"
        ability_category = "阅读理解"
        delivery = {
            "stimulus": {"type": "TEXT", "promptText": "TEST_FIXTURE_ONLY：选择题目中标记的正确选项。"},
            "response": {
                "type": "CHOICE",
                "options": [
                    {"key": "A", "text": "选项 A"},
                    {"key": "B", "text": "选项 B"},
                    {"key": "C", "text": "选项 C"},
                    {"key": "D", "text": "选项 D"},
                ],
            },
        }
        scoring = {"strategy": "EXACT_CHOICE", "maxScore": 3, "referenceAnswer": "B"}
    delivery_json = sql_text(json.dumps(delivery, ensure_ascii=False))
    scoring_json = sql_text(json.dumps(scoring, ensure_ascii=False))
    sql(
        f'''INSERT INTO "QuestionBankItem" ("id", "schoolId", "stableKey", "domain", "questionType", "level", "abilityCategory", "gradeBand", "difficulty", "itemType", "createdAt", "updatedAt")
              VALUES ('{item_id}', '{SCHOOL_ID}', '{stable_key}', '{domain}', '{question_type}', '水平一级', '{ability_category}', '七年级', '基础', '{item_type}', NOW(), NOW());
            INSERT INTO "QuestionBankItemVersion" ("id", "itemId", "version", "status", "deliverySpec", "scoringSpec", "publishedAt", "createdAt", "updatedAt")
              VALUES ('{version_id}', '{item_id}', 1, 'PUBLISHED', '{delivery_json}'::jsonb, '{scoring_json}'::jsonb, NOW(), NOW(), NOW());'''
    )
    return version_id


def create_practice(title, *, catalog_type, requires_recording, item_versions, description):
    definition_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    section_id = str(uuid.uuid4())
    delivery_id = str(uuid.uuid4())
    item_rows = []
    for index, (question_version_id, item_type) in enumerate(item_versions, start=1):
        item_rows.append(
            f'''INSERT INTO "PracticeItemRef" ("id", "sectionId", "questionVersionId", "itemType", "sortOrder", "config")
                  VALUES ('{uuid.uuid4()}', '{section_id}', '{question_version_id}', '{item_type}', {index}, '{{}}'::jsonb);'''
        )
    title_sql = sql_text(title)
    description_sql = sql_text(description)
    sql(
        f'''INSERT INTO "PracticeDefinition" ("id", "schoolId", "visibility", "title", "summary", "difficulty", "estimatedMinutes", "gradeBand", "abilityCategories", "cultureTags", "catalogType", "requiresRecording", "instantFeedback", "status", "createdAt", "updatedAt")
              VALUES ('{definition_id}', '{SCHOOL_ID}', 'SCHOOL', '{title_sql}', '{description_sql}', '基础', 5, '七年级', ARRAY['阅读理解','独立朗读']::text[], ARRAY['TEST_FIXTURE_ONLY','T038']::text[], '{catalog_type}', {str(requires_recording).lower()}, false, 'PUBLISHED', NOW(), NOW());
            INSERT INTO "PracticeVersion" ("id", "definitionId", "version", "status", "contentHash", "publishedAt", "createdAt")
              VALUES ('{version_id}', '{definition_id}', 1, 'PUBLISHED', '{version_id}', NOW(), NOW());
            INSERT INTO "PracticeSection" ("id", "versionId", "title", "description", "sortOrder", "estimatedMinutes")
              VALUES ('{section_id}', '{version_id}', 'TEST_FIXTURE_ONLY T038 练习环节', '隔离环境的模式筛选与报告校验题。', 1, 5);
            {''.join(item_rows)}
            INSERT INTO "PracticeDelivery" ("id", "practiceVersionId", "schoolId", "classId", "mode", "reRecordPolicy", "mobilePolicy", "status", "createdAt", "updatedAt")
              VALUES ('{delivery_id}', '{version_id}', '{SCHOOL_ID}', '{CLASS_ID}', 'SELF_PRACTICE', '{{"maxAttempts":2}}'::jsonb, '{{"allowed":true}}'::jsonb, 'OPEN', NOW(), NOW());'''
    )
    return {"definitionId": definition_id, "versionId": version_id, "deliveryId": delivery_id, "title": title}


def create_mock_catalog_fixture(run_key):
    return create_practice(
        f"TEST_FIXTURE_ONLY T038 MOCK 目录 {run_key}",
        catalog_type="MOCK",
        requires_recording=False,
        item_versions=[(SEED_CHOICE_VERSION_ID, "CHOICE")],
        description="TEST_FIXTURE_ONLY：仅验证真实服务端 MOCK 分类，不代表官方考试。",
    )


def create_formal_report_fixture(run_key):
    choice_version = create_question_version("CHOICE", run_key)
    speech_version = create_question_version("SPEECH", run_key)
    return create_practice(
        f"TEST_FIXTURE_ONLY T038 人工复核报告 {run_key}",
        catalog_type="COMPREHENSIVE",
        requires_recording=True,
        item_versions=[(choice_version, "CHOICE")] * 19 + [(speech_version, "SPEECH")],
        description="TEST_FIXTURE_ONLY：使用动态题库题目验证标准评分、人工复核与完整正式报告链路。",
    )


def create_attempt(page, headers, definition_id):
    response = page.request.post(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/{definition_id}/attempts",
        headers=headers,
        data={},
    )
    assert response.ok, response.text()
    attempt_id = payload(response).get("attemptId")
    assert uuid.UUID(attempt_id)
    return attempt_id


def response_spec(item):
    spec = item.get("itemConfig") or item.get("prompt") or {}
    if isinstance(spec, str):
        spec = json.loads(spec)
    if not isinstance(spec, dict):
        spec = {}
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
    items = body if isinstance(body, list) else body.get("items", [])
    assert items
    return items


def recording_rows(enrollment_id, attempt_id, item_id):
    prefix = f"runner-{attempt_id}-{item_id}-"
    return sql_rows(
        f'''SELECT id::text, status::text, COALESCE("objectKey", ''), COALESCE("mimeType", ''),
                    COALESCE("durationMs", 0)::text, "idempotencyKey"
               FROM "Recording"
              WHERE "enrollmentId" = '{enrollment_id}'
                AND "idempotencyKey" LIKE '{prefix}%'
              ORDER BY "createdAt";'''
    )


def minio_head_object(object_key):
    node = shutil.which("node")
    assert node, "native runtime PATH must provide its pinned Node.js binary"
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T038_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({ endpoint: process.env.YZ_T038_S3_ENDPOINT, region: process.env.YZ_T038_S3_REGION,
  forcePathStyle: true, credentials: { accessKeyId: process.env.YZ_T038_S3_ACCESS_KEY, secretAccessKey: process.env.YZ_T038_S3_SECRET_KEY } });
(async () => { try { const head = await client.send(new HeadObjectCommand({ Bucket: process.env.YZ_T038_S3_BUCKET, Key: process.env.YZ_T038_OBJECT_KEY }));
  process.stdout.write(JSON.stringify({bytes: head.ContentLength, contentType: head.ContentType, etag: head.ETag}));
} catch (error) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") process.stdout.write(JSON.stringify({missing: true}));
  else { process.stderr.write((error.name || "S3_HEAD_FAILED") + "\n"); process.exitCode = 1; }
} finally { client.destroy(); } })().catch(error => { process.stderr.write((error.name || "S3_HEAD_FAILED") + "\n"); process.exitCode = 1; });'''
    env = {**os.environ, "YZ_T038_OBJECT_KEY": object_key}
    result = subprocess.run(
        [node, "-e", script], cwd=Path(__file__).resolve().parents[3], capture_output=True, text=True, env=env, check=False
    )
    if result.returncode:
        message = result.stderr
        for key in ("YZ_T038_S3_SECRET_KEY",):
            if env.get(key):
                message = message.replace(env[key], "<redacted>")
        raise RuntimeError(f"T038 MinIO HeadObject failed: {message.strip()}")
    return json.loads(result.stdout)


def object_key_from_signed_url(value):
    parts = urlparse(value).path.strip("/").split("/")
    assert parts[0] == BUCKET
    return "/".join(parts[1:])


def catalog_request(request, *, key, value):
    parsed = urlparse(request.url)
    if request.method != "GET" or not parsed.path.endswith(f"/schools/{SCHOOL_ID}/practices"):
        return False
    return parse_qs(parsed.query).get(key) == [value]


def save_responsive_screenshot(page, width, height, name):
    page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(100)
    dimensions = page.evaluate("({viewport: innerWidth, document: document.documentElement.scrollWidth})")
    assert dimensions["document"] <= dimensions["viewport"], f"horizontal overflow at {width}px: {dimensions}"
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    target = EVIDENCE / name
    page.screenshot(path=str(target), full_page=True)
    return {"viewport": width, "scrollWidth": dimensions["document"], "screenshot": target.name}


def complete_speaking_practice(page, headers, enrollment_id, attempt_id, items):
    evidence = {"playedPromptAudio": [], "recordings": [], "offlineAnswerRetry": False, "offlineUploadRetry": False}
    speech_indexes = [index for index, item in enumerate(items) if response_spec(item)["response"]["type"] == "SPEECH"]
    assert len(speech_indexes) >= 2, f"expected at least two spoken answers, got {speech_indexes}"
    choice_indexes = [index for index, item in enumerate(items) if response_spec(item)["response"]["type"] == "CHOICE"]
    text_indexes = [index for index, item in enumerate(items) if response_spec(item)["response"]["type"] == "TEXT"]
    assert choice_indexes and text_indexes
    first_speech_index = speech_indexes[0]

    for index, item in enumerate(items):
        if index:
            page.locator(f'[data-go="{index}"]').click()
            page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)
        spec = response_spec(item)
        stimulus = spec.get("stimulus") or {}
        if stimulus.get("type") == "AUDIO" or spec.get("demoAudioUrl"):
            audio = page.locator(".audio-stimulus audio")
            if audio.count():
                source = audio.get_attribute("src")
                page.evaluate(
                    """async () => { const audio = document.querySelector('.audio-stimulus audio'); audio.muted = true; await audio.play(); }"""
                )
                page.wait_for_function("document.querySelector('.audio-stimulus audio')?.currentTime > 0", timeout=12_000)
                page.locator("[data-audio-player]").get_by_text("正在播放题目音频").wait_for(timeout=5_000)
                page.locator("[data-prompt-audio]").evaluate("audio => audio.pause()")
                evidence["playedPromptAudio"].append({"itemId": item["id"], "sourcePath": urlparse(source or "").path})

        response_type = spec["response"]["type"]
        if response_type == "CHOICE":
            if index == choice_indexes[0]:
                failed = {"seen": False}

                def fail_answer_once(route):
                    if not failed["seen"] and route.request.method == "PUT":
                        failed["seen"] = True
                        route.abort("internetdisconnected")
                    else:
                        route.continue_()

                answer_route = "**/api/v1/schools/*/assessments/sessions/*/items/*/answer"
                page.route(answer_route, fail_answer_once)
                page.locator("[data-choice]").first.click()
                page.locator("[data-retry-save]").wait_for(timeout=15_000)
                page.unroute(answer_route, fail_answer_once)
                assert failed["seen"]
                page.locator("[data-retry-save]").click()
                page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=15_000)
                evidence["offlineAnswerRetry"] = True
            else:
                page.locator("[data-choice]").first.click()
                page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=15_000)
        elif response_type == "TEXT":
            page.locator("[data-text]").fill("TEST_FIXTURE_ONLY 学生本人练习回答")
            page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=15_000)
        elif response_type == "SPEECH":
            page.locator("[data-start-recording]").click()
            page.locator("[data-stop-recording]").wait_for(timeout=15_000)
            page.get_by_text("SIMULATED_MIC", exact=False).wait_for(timeout=5_000)
            page.wait_for_timeout(1_200)
            page.locator("[data-stop-recording]").click()
            page.locator("[data-upload-recording]").wait_for(timeout=15_000)
            preview = page.locator("[data-take-audio]")
            assert (preview.get_attribute("src") or "").startswith("blob:")
            page.evaluate(
                """async () => { const audio = document.querySelector('[data-take-audio]'); audio.muted = true; await audio.play(); }"""
            )
            page.wait_for_function("document.querySelector('[data-take-audio]')?.currentTime > 0", timeout=10_000)
            page.locator("[data-take-audio]").evaluate("audio => audio.pause()")

            fail_this_upload = index == first_speech_index
            failed_put = {"seen": False, "objectKey": ""}
            if fail_this_upload:
                def abort_upload_once(route):
                    request = route.request
                    if not failed_put["seen"] and request.method == "PUT" and BUCKET in request.url:
                        failed_put["seen"] = True
                        failed_put["objectKey"] = object_key_from_signed_url(request.url)
                        route.abort("internetdisconnected")
                    else:
                        route.continue_()

                page.route("**/*", abort_upload_once)
            page.locator("[data-upload-recording]").click()
            if fail_this_upload:
                page.locator('[data-runner-message]:not([hidden])').filter(has_text="上传尚未确认").wait_for(timeout=20_000)
                assert failed_put["seen"]
                page.unroute("**/*", abort_upload_once)
                failed_rows = recording_rows(enrollment_id, attempt_id, item["id"])
                assert len(failed_rows) == 1 and failed_rows[0][1] == "INITIALIZED", failed_rows
                assert minio_head_object(failed_put["objectKey"]) == {"missing": True}
                evidence["offlineUploadRetry"] = True
                page.locator("[data-upload-recording]").click()
            page.get_by_text("服务器已确认保存").wait_for(timeout=30_000)
            rows = recording_rows(enrollment_id, attempt_id, item["id"])
            assert len(rows) == 1, rows
            head = minio_head_object(rows[0][2])
            assert head.get("bytes", 0) > 0 and head.get("contentType", "").startswith("audio/"), head
            evidence["recordings"].append(
                {"itemId": item["id"], "recordingId": rows[0][0], "status": rows[0][1], "objectKey": rows[0][2], **head}
            )

        if index < len(items) - 1:
            page.locator("[data-next]").click()

    page.wait_for_function(
        "count => document.querySelector('[data-progress-copy]')?.textContent.includes(`${count} / ${count} 题已完成`)",
        arg=len(items),
        timeout=20_000,
    )
    return evidence


def test_t038_student_speaking_mock_specialized_recording_review_and_report():
    assert BASE and DATABASE_URL and PASSWORD and API_PACKAGE and BUCKET
    verify_database_identity()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    run_key = uuid.uuid4().hex[:8]
    student_a = create_student_fixture("A")
    student_b = create_student_fixture("B")
    mock_fixture = create_mock_catalog_fixture(run_key)
    page_errors = []
    summary = {"runKey": run_key, "fixturePolicy": "TEST_FIXTURE_ONLY; no production account or source data used"}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["microphone"])
        context.add_init_script("window.__yuzanRunnerMicrophoneSource = 'SIMULATED_MIC';")
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        catalog_requests = []
        page.on(
            "request",
            lambda request: catalog_requests.append(request.url)
            if request.method == "GET" and urlparse(request.url).path.endswith(f"/schools/{SCHOOL_ID}/practices")
            else None,
        )
        try:
            student_session = authenticate(page, student_a["identifier"])
            assert student_session["user"]["id"] == student_a["userId"]
            student_headers = auth_headers(student_session)
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            page.locator(".practice-catalog-head h1").wait_for(timeout=20_000)
            page.locator(".practice-journey").wait_for(timeout=20_000)
            summary["practiceCenter"] = page.url

            mock_button = page.locator('.practice-journey-mock button[data-tab="MOCK"]')
            mock_button.focus()
            with page.expect_request(lambda request: catalog_request(request, key="catalogType", value="MOCK")) as mock_request:
                page.keyboard.press("Enter")
            summary["mockRequest"] = mock_request.value.url
            page.wait_for_function("document.querySelector('.catalog-tabs button[data-tab=MOCK]')?.getAttribute('aria-pressed') === 'true'")
            page.locator(".practice-journey-mock").get_by_text("不是官方考试").wait_for(timeout=10_000)
            page.locator(".practice-mode-note").get_by_text("不代表官方考试").wait_for(timeout=10_000)
            mock_tile = page.locator(f'[data-practice-detail="{mock_fixture["definitionId"]}"]')
            mock_tile.wait_for(timeout=20_000)
            mock_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices?catalogType=MOCK", headers=student_headers
            )
            assert mock_response.ok, mock_response.text()
            mock_items = payload(mock_response)["items"]
            assert mock_items and all(item["catalogType"] == "MOCK" for item in mock_items)
            assert next(item for item in mock_items if item["id"] == mock_fixture["definitionId"])
            summary["mockMode"] = {"query": parse_qs(urlparse(mock_request.value.url).query), "count": len(mock_items), "officialExamDisclaimer": True}

            specialized_button = page.locator('.practice-journey-focus button[data-tab="SPECIALIZED"]')
            with page.expect_request(lambda request: catalog_request(request, key="catalogType", value="SPECIALIZED")) as specialized_request:
                specialized_button.click()
            summary["specializedRequest"] = specialized_request.value.url
            page.wait_for_function("document.querySelector('.catalog-tabs button[data-tab=SPECIALIZED]')?.getAttribute('aria-pressed') === 'true'")
            specialized_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices?catalogType=SPECIALIZED", headers=student_headers
            )
            assert specialized_response.ok, specialized_response.text()
            specialized_items = payload(specialized_response)["items"]
            assert specialized_items and all(item["catalogType"] == "SPECIALIZED" for item in specialized_items)
            rhythm = next(item for item in specialized_items if item["title"] == "停顿与节奏专项训练")
            page.locator(f'[data-practice-detail="{rhythm["id"]}"]').wait_for(timeout=20_000)
            summary["remediationMode"] = {"query": parse_qs(urlparse(specialized_request.value.url).query), "practiceId": rhythm["id"]}

            page.locator('.practice-journey-mock button[data-tab="MOCK"]').click()
            page.wait_for_function("document.querySelector('.catalog-tabs button[data-tab=MOCK]')?.getAttribute('aria-pressed') === 'true'")
            oral_button = page.locator("[data-journey-oral]")
            oral_button.wait_for(timeout=10_000)
            oral_button.focus()
            with page.expect_request(lambda request: catalog_request(request, key="requiresRecording", value="true")) as oral_request:
                page.keyboard.press("Enter")
            oral_params = parse_qs(urlparse(oral_request.value.url).query)
            assert oral_params.get("requiresRecording") == ["true"] and "catalogType" not in oral_params, oral_params
            summary["oralRequest"] = oral_request.value.url
            oral_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices?requiresRecording=true", headers=student_headers
            )
            assert oral_response.ok, oral_response.text()
            oral_items = payload(oral_response)["items"]
            assert oral_items and all(item["requiresRecording"] is True for item in oral_items)
            rhythm = next(item for item in oral_items if item["id"] == rhythm["id"])
            summary["realSpeakingPractice"] = {
                "definitionId": rhythm["id"],
                "title": rhythm["title"],
                "requiresRecording": rhythm["requiresRecording"],
                "catalogType": rhythm["catalogType"],
            }

            viewport_proof = []
            for width, height in [(390, 844), (768, 1024), (1280, 900), (1440, 1000)]:
                viewport_proof.append(save_responsive_screenshot(page, width, height, f"catalog-{width}.png"))
            summary["fourViewports"] = viewport_proof
            page.set_viewport_size({"width": 1440, "height": 1000})
            rhythm_link = page.locator(f'[data-practice-detail="{rhythm["id"]}"] h2 a')
            rhythm_link.focus()
            rhythm_link.press("Enter")
            page.wait_for_url(f"**/student/practices/{rhythm['id']}/", timeout=20_000)
            detail = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/{rhythm['id']}", headers=student_headers)
            assert detail.ok, detail.text()
            detail_data = payload(detail)
            assert detail_data["id"] == rhythm["id"] and detail_data["requiresRecording"] is True
            page.get_by_role("heading", name="停顿与节奏专项训练", exact=True).wait_for(timeout=15_000)
            page.get_by_text("录音须先试听，再确认上传到服务器").wait_for(timeout=10_000)
            for width, height in [(390, 844), (1440, 1000)]:
                summary.setdefault("detailViewports", []).append(
                    save_responsive_screenshot(page, width, height, f"detail-{width}.png")
                )
            page.set_viewport_size({"width": 1440, "height": 1000})

            page.locator("[data-start]").focus()
            page.keyboard.press("Enter")
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            oral_attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            assert uuid.UUID(oral_attempt_id)
            oral_items_for_attempt = get_attempt_items(page, student_headers, oral_attempt_id)
            assert len(oral_items_for_attempt) == 4
            answer_types = [response_spec(item)["response"]["type"] for item in oral_items_for_attempt]
            assert "CHOICE" in answer_types and "TEXT" in answer_types and answer_types.count("SPEECH") >= 2
            summary["realQuestions"] = [
                {"itemId": item["id"], "type": response_spec(item)["response"]["type"], "prompt": str(item.get("prompt", ""))[:120]}
                for item in oral_items_for_attempt
            ]

            unauth_context = playwright.request.new_context()
            unauthenticated = unauth_context.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices")
            unauth_context.dispose()
            foreign_school = page.request.get(
                f"{BASE}/api/v1/schools/{uuid.uuid4()}/practices", headers=student_headers
            )
            student_queue_forbidden = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers=student_headers
            )
            assert unauthenticated.status == 401
            assert foreign_school.status == 403
            assert student_queue_forbidden.status == 403
            summary["authorization"] = {"anonymous": unauthenticated.status, "foreignSchool": foreign_school.status, "studentReviewQueue": student_queue_forbidden.status}

            first_speech_index = next(index for index, kind in enumerate(answer_types) if kind == "SPEECH")
            deny_browser = playwright.chromium.launch(
                headless=True, executable_path=CHROME, args=["--use-fake-device-for-media-stream"]
            )
            deny_page = deny_browser.new_page(viewport={"width": 1280, "height": 900})
            deny_cdp = deny_browser.new_browser_cdp_session()
            deny_cdp.send(
                "Browser.setPermission",
                {"permission": {"name": "microphone"}, "setting": "denied", "origin": BASE},
            )
            authenticate(deny_page, student_a["identifier"])
            deny_page.goto(f"{BASE}/student/practices/attempts/{oral_attempt_id}/runner/", wait_until="networkidle")
            deny_page.locator(f'[data-go="{first_speech_index}"]').click()
            deny_page.locator("[data-start-recording]").click()
            deny_page.get_by_text("麦克风权限被拒绝", exact=False).first.wait_for(timeout=15_000)
            enrollment_a = student_a["enrollmentId"]
            assert recording_rows(enrollment_a, oral_attempt_id, oral_items_for_attempt[first_speech_index]["id"]) == []
            deny_browser.close()
            summary["permissionDenied"] = {"microphone": "denied", "recordingRowsCreated": 0}

            oral_recordings = complete_speaking_practice(
                page, student_headers, enrollment_a, oral_attempt_id, oral_items_for_attempt
            )
            summary["recordingAndAudition"] = oral_recordings
            for width, height in [(390, 844), (768, 1024), (1280, 900), (1440, 1000)]:
                summary.setdefault("runnerViewports", []).append(
                    save_responsive_screenshot(page, width, height, f"runner-{width}.png")
                )
            page.set_viewport_size({"width": 1440, "height": 1000})

            submit_requests = []
            page.on(
                "request",
                lambda request: submit_requests.append(request.url)
                if request.method == "POST" and request.url.endswith(f"/assessments/sessions/{oral_attempt_id}/submit")
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
            page.keyboard.press("Tab")
            page.keyboard.press("Enter")
            page.wait_for_url(f"**/student/practices/attempts/{oral_attempt_id}/processing/", timeout=45_000)
            assert len(submit_requests) == 1, submit_requests
            duplicate_submit = page.request.post(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{oral_attempt_id}/submit",
                headers=student_headers,
                data={},
            )
            assert duplicate_submit.ok, duplicate_submit.text()
            assert payload(duplicate_submit)["id"] == oral_attempt_id
            oral_session = payload(
                page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{oral_attempt_id}", headers=student_headers)
            )
            assert oral_session["status"] == "PROCESSING"
            oral_proof = sql_rows(
                f'''SELECT s."status"::text,
                           (SELECT count(*)::text FROM "AssessmentReport" r WHERE r."sessionId" = s.id),
                           (SELECT count(*)::text FROM "AssessmentItem" i WHERE i."sessionId" = s.id AND i."recordingId" IS NOT NULL AND i."scoredScore" IS NOT NULL),
                           (SELECT count(*)::text FROM "SpeechJob" j WHERE j."assessmentItemId" IN (SELECT i.id FROM "AssessmentItem" i WHERE i."sessionId" = s.id)),
                           (SELECT count(*)::text FROM "SpeechJob" j WHERE j."assessmentItemId" IN (SELECT i.id FROM "AssessmentItem" i WHERE i."sessionId" = s.id) AND j.status = 'CREATED' AND j.result IS NULL)
                      FROM "AssessmentSession" s WHERE s.id = '{oral_attempt_id}';'''
            )[0]
            assert oral_proof == ["PROCESSING", "0", "0", str(answer_types.count("SPEECH")), str(answer_types.count("SPEECH"))], oral_proof
            page.locator(".processing-meta").wait_for(timeout=20_000)
            page.get_by_text("正在等待评分任务进入处理").wait_for(timeout=15_000)
            assert page.get_by_text("报告已生成").count() == 0
            summary["postSubmitHandling"] = {
                "session": oral_proof[0],
                "reportsBeforeReview": int(oral_proof[1]),
                "scoredSpeechItemsBeforeReview": int(oral_proof[2]),
                "speechJobs": int(oral_proof[3]),
                "createdJobsWithoutProviderResult": int(oral_proof[4]),
                "submitPosts": len(submit_requests),
                "automaticSpeechScoring": "disabled; no fabricated score",
            }

            formal_practice = create_formal_report_fixture(run_key)
            formal_attempt_id = create_attempt(page, student_headers, formal_practice["definitionId"])
            page.goto(f"{BASE}/student/practices/attempts/{formal_attempt_id}/runner/", wait_until="domcontentloaded")
            page.locator(".question-shell").wait_for(timeout=20_000)
            formal_items = get_attempt_items(page, student_headers, formal_attempt_id)
            assert len(formal_items) == 20
            formal_speech_indexes = [index for index, item in enumerate(formal_items) if response_spec(item)["response"]["type"] == "SPEECH"]
            assert len(formal_speech_indexes) == 1
            for index, item in enumerate(formal_items):
                if index:
                    page.locator(f'[data-go="{index}"]').click()
                response_type = response_spec(item)["response"]["type"]
                if response_type == "CHOICE":
                    page.locator("[data-choice]").first.click()
                    page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=15_000)
                elif response_type == "SPEECH":
                    page.locator("[data-start-recording]").click()
                    page.locator("[data-stop-recording]").wait_for(timeout=15_000)
                    page.wait_for_timeout(1_100)
                    page.locator("[data-stop-recording]").click()
                    page.locator("[data-upload-recording]").wait_for(timeout=15_000)
                    page.locator("[data-upload-recording]").click()
                    page.get_by_text("服务器已确认保存").wait_for(timeout=30_000)
                if index < len(formal_items) - 1:
                    page.locator("[data-next]").click()
            page.locator("[data-submit]").click()
            page.get_by_role("dialog", name="确认交卷").wait_for(timeout=10_000)
            page.locator("[data-confirm-submit]").click()
            page.wait_for_url(f"**/student/practices/attempts/{formal_attempt_id}/processing/", timeout=45_000)

            teacher_login = page.request.post(
                f"{BASE}/api/v1/auth/login", data={"identifier": "teacher.test", "password": PASSWORD}
            )
            assert teacher_login.ok, teacher_login.text()
            teacher_session = payload(teacher_login)
            teacher_headers = auth_headers(teacher_session)
            queue_response = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers=teacher_headers)
            assert queue_response.ok, queue_response.text()
            queue_items = payload(queue_response)["items"]
            pending = next(
                item for item in queue_items
                if item["sessionId"] == formal_attempt_id and item["strategy"] == "SPEECH_READING"
            )
            review_detail_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{pending['itemId']}", headers=teacher_headers
            )
            assert review_detail_response.ok, review_detail_response.text()
            review_detail = payload(review_detail_response)
            assert review_detail["item"]["scoredScore"] is None
            assert review_detail["item"]["reviewerUserId"] is None
            assert review_detail["evidence"]["speechJobStatus"] == "CREATED"
            assert review_detail["evidence"]["diagnostic"] is None
            report_before_review = int(
                sql(f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId" = '{formal_attempt_id}';''', capture=True)
            )
            assert report_before_review == 0
            summary["reportAndReview"] = {
                "formalAttemptId": formal_attempt_id,
                "pendingReviewItemId": pending["itemId"],
                "pendingQueueState": pending["state"],
                "speechJobStatus": review_detail["evidence"]["speechJobStatus"],
                "diagnostic": review_detail["evidence"]["diagnostic"],
                "reportCountBeforeReview": report_before_review,
            }

            review_comment = "TEST_FIXTURE_ONLY T038：教师人工复核了隔离环境中的录音；未采用自动语音分数。"
            review_response = page.request.put(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews/{pending['itemId']}",
                headers=teacher_headers,
                data={"score": 0, "comment": review_comment},
            )
            assert review_response.ok, review_response.text()
            report_response = page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}/report",
                headers=student_headers,
            )
            assert report_response.ok, report_response.text()
            formal_report = payload(report_response)
            assert formal_report["sessionId"] == formal_attempt_id
            assert formal_report["dataCompleteness"] == 100
            assert formal_report["overallScore"] == 0
            assert any(item["comment"] == review_comment for item in formal_report["teacherFeedback"])
            report_sql = sql_rows(
                f'''SELECT s."status"::text, r.id::text, r."overallScore"::text, r."dataCompleteness"::text,
                           count(i.id)::text, count(i.id) FILTER (WHERE i."scoredScore" IS NOT NULL)::text
                      FROM "AssessmentSession" s JOIN "AssessmentReport" r ON r."sessionId" = s.id
                      JOIN "AssessmentItem" i ON i."sessionId" = s.id WHERE s.id = '{formal_attempt_id}'
                      GROUP BY s."status", r.id, r."overallScore", r."dataCompleteness";'''
            )[0]
            assert report_sql[0] == "COMPLETED" and int(report_sql[2]) == 0 and int(report_sql[3]) == 100
            assert report_sql[4] == report_sql[5] == "20", report_sql

            page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            report_row = page.locator(f'[data-history-session="{formal_attempt_id}"]')
            report_row.wait_for(timeout=30_000)
            report_link = report_row.get_by_role("link", name="查看正式报告")
            assert report_link.get_attribute("href") == f"/student/practices/attempts/{formal_attempt_id}/report/"
            report_link.click()
            page.wait_for_url(f"**/student/practices/attempts/{formal_attempt_id}/report/", timeout=20_000)
            page.get_by_text("正式测评复核评语 · AssessmentReview").wait_for(timeout=20_000)
            page.locator(".teacher-feedback-item").filter(has_text=review_comment).wait_for(timeout=15_000)
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(EVIDENCE / "formal-report-1440.png"), full_page=True)
            summary["formalReport"] = {
                "reportId": report_sql[1],
                "score": int(report_sql[2]),
                "completeness": int(report_sql[3]),
                "completedItems": int(report_sql[4]),
                "reviewedItems": int(report_sql[5]),
                "studentOpenedHistoryLink": True,
                "teacherCommentVisible": True,
                "scoreAuthority": "19 incorrect deterministic choice answers plus one explicit teacher review; no automatic speech score",
            }

            b_context = browser.new_context(viewport={"width": 1280, "height": 900})
            b_page = b_context.new_page()
            student_b_session = authenticate(b_page, student_b["identifier"])
            b_headers = auth_headers(student_b_session)
            denied_attempt = b_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/practices/attempts/{formal_attempt_id}", headers=b_headers
            )
            denied_report = b_page.request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{formal_attempt_id}/report", headers=b_headers
            )
            assert denied_attempt.status in (403, 404)
            assert denied_report.status in (403, 404)
            b_page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            b_page.wait_for_load_state("networkidle")
            assert b_page.locator(f'[data-history-session="{formal_attempt_id}"]').count() == 0
            summary["identityIsolation"] = {
                "studentA": student_a["userId"],
                "studentB": student_b_session["user"]["id"],
                "sameSchoolDifferentEnrollment": student_session["user"]["id"] != student_b_session["user"]["id"],
                "otherStudentAttempt": denied_attempt.status,
                "otherStudentReport": denied_report.status,
                "otherStudentHistoryContainsAttempt": False,
            }
            b_context.close()
            assert page_errors == [], page_errors
            summary["pageErrors"] = page_errors
            summary["screenshots"] = sorted(path.name for path in EVIDENCE.glob("*.png"))
            (EVIDENCE / "e2e-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(summary, ensure_ascii=False, indent=2))
        finally:
            browser.close()
