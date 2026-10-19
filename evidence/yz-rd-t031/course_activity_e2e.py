"""Real Chromium + NestJS + PostgreSQL + MinIO proof for YZ-RD-T031."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "e2e" / "assessment"))
import test_yz_rd_t008_student_history as runner_helpers  # noqa: E402

complete_real_attempt = runner_helpers.complete_real_attempt


BASE = os.environ["YZ_T031_BASE_URL"]
API = os.environ["YZ_T031_API_BASE_URL"]
DATABASE_URL = os.environ["DATABASE_URL"]
SCHOOL = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
SEED_STUDENT_ID = "22222222-2222-4222-8222-222222222222"
PASSWORD = os.environ["E2E_TEST_PASSWORD"]
EVIDENCE = Path(os.environ["YZ_T031_EVIDENCE_DIR"])
DATABASE = os.environ["POSTGRES_DB"]
DB_USER = os.environ["POSTGRES_USER"]
DB_PORT = int(os.environ["POSTGRES_PORT"])
PSQL = os.environ["YZ_T031_PSQL"]
API_PACKAGE = os.environ["YZ_T031_API_PACKAGE"]
BUCKET = os.environ["S3_BUCKET"]


def response_body(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def runner_response_spec(item):
    config = item.get("itemConfig") or item.get("prompt") or {}
    if isinstance(config, str):
        config = json.loads(config)
    config = config if isinstance(config, dict) else {}
    kind = item.get("itemType", "")
    if kind == "LISTEN_ONLY":
        response_type = "NONE"
    elif kind in {"READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"}:
        response_type = "SPEECH"
    elif kind in {"CHOICE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"}:
        response_type = "CHOICE"
    else:
        response_type = "TEXT"
    stimulus_text = config.get("targetText") or config.get("prompt") or config.get("stimulus") or config.get("instruction") or ""
    stimulus = {
        "type": "AUDIO" if config.get("demoAudioUrl") else "TEXT",
        "promptText": stimulus_text,
        "instruction": config.get("instruction"),
        "url": config.get("demoAudioUrl"),
    }
    response = {"type": response_type}
    if response_type == "CHOICE":
        response["options"] = config.get("options") or []
    return {**config, "stimulus": stimulus, "response": response}


runner_helpers.response_spec = runner_response_spec


def sql(statement: str) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1" and parsed.port == DB_PORT
    assert parsed.path.lstrip("/") == DATABASE and parsed.username == DB_USER
    password = unquote(parsed.password or "")
    env = {
        **os.environ,
        "PGHOST": "127.0.0.1",
        "PGPORT": str(DB_PORT),
        "PGUSER": DB_USER,
        "PGPASSWORD": password,
        "PGDATABASE": DATABASE,
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
        message = result.stderr.replace(password, "<redacted>")
        raise RuntimeError(f"T031 PostgreSQL evidence query failed: {message.strip()}")
    return result.stdout.strip()


def verify_database():
    identity = sql("SELECT current_database(), current_user, version();").split("|", 2)
    assert identity[0:2] == [DATABASE, DB_USER]
    assert identity[2].startswith("PostgreSQL 17.")


def login(request, identifier):
    response = request.post(f"{API}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, f"test login failed with HTTP {response.status}"
    return response_body(response)


def login_ui(page, identifier):
    page.goto(f"{BASE}/login/")
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null")


def headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def make_student_b():
    user_id, membership_id, enrollment_id = (str(uuid.uuid4()) for _ in range(3))
    identifier = f"t022-student-b-{uuid.uuid4().hex}@test.invalid"
    sql(
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT '{user_id}','{identifier}','T022 fictional student B',"passwordHash",'ACTIVE',now(),now()
              FROM "User" WHERE id='{SEED_STUDENT_ID}';
            INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
              VALUES ('{membership_id}','{SCHOOL}','{user_id}','STUDENT','ACTIVE',now());
            INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
              VALUES ('{enrollment_id}','{SCHOOL}','{CLASS_ID}','{user_id}','STUDENT','ACTIVE',now());'''
    )
    return {"id": user_id, "loginIdentifier": identifier, "enrollmentId": enrollment_id}


def bilingual(text):
    return {"originalText": text, "locale": "zh-CN", "translationSource": "NONE", "reviewStatus": "REVIEWED"}


def make_activity(activity_id, kind, title, instruction, content):
    note = bilingual(f"教师提示：{title}完成后核对服务器学习记录。")
    return {
        "id": activity_id,
        "title": title,
        "type": kind,
        "sortOrder": 0,
        "required": True,
        "resources": [],
        "instruction": bilingual(instruction),
        "teacherNotes": note,
        "studentNotes": bilingual(f"学习要点：{instruction}"),
        "content": content,
    }


def create_teacher_course(page):
    teacher = login(page.request, "teacher.test")
    auth = headers(teacher)
    prefix = f"{API}/api/v1/schools/{SCHOOL}"
    tag = uuid.uuid4().hex[:8]
    objective = bilingual("阅读高原春日课文，听辨真实音频，完成书面作答并记录学习笔记。")
    created = page.request.post(
        f"{prefix}/course-versions",
        headers=auth,
        data={"title": f"T022 高原春声 {tag}", "description": "隔离验收课程，由教师 API 创建并发布。", "gradeBand": "七年级", "coverAsset": "/assets/generated-covers/course-spring-reading.png", "objectives": [objective]},
    )
    assert created.ok, f"teacher course draft create failed with HTTP {created.status}: {created.text()}"
    course = response_body(created)
    detail_response = page.request.get(f"{prefix}/course-versions/{course['id']}", headers=auth)
    assert detail_response.ok, f"teacher course draft read failed with HTTP {detail_response.status}"
    detail = response_body(detail_response)

    ids = {name: str(uuid.uuid4()) for name in ("unit", "lesson", "text", "audio", "video", "missing_video", "choice", "fill", "speech", "practice")}
    activities = [
        make_activity(ids["text"], "TEXT", "河谷春日阅读", "阅读两段课文后确认完成。", {
            "paragraphs": ["春风沿着山脊吹向河谷，雪水在石间汇成清亮的小溪。", "孩子们沿溪观察新芽，也把听见的声音写进学习笔记。"],
            "imageUrl": "/assets/generated-covers/course-spring-reading.png", "imageAlt": "春季阅读课程封面插图", "imageCaption": "课程中的春季阅读插图。",
        }),
        make_activity(ids["audio"], "AUDIO", "听辨溪水与春风", "播放完整听力材料并保存学习进度。", {
            "audioUrl": "/assessment/assets/question-bank/audio/level-1-dictation-1.mp3",
        }),
        make_activity(ids["video"], "VIDEO", "观看山谷春景", "观看真实课程视频后保存进度。", {
            "videoUrl": "/assets/media/video.mp4", "caption": "课程视频资源来自已开放的课程内容。",
        }),
        make_activity(ids["missing_video"], "VIDEO", "无资源时的错误提示", "此活动未配置视频资源。", {}),
        make_activity(ids["choice"], "CHOICE", "选择溪流的来源", "根据课文选择一个答案。", {
            "prompt": "春天流入河谷的小溪水主要来自哪里？", "options": ["融化的积雪", "海边潮汐", "城市喷泉"],
        }),
        make_activity(ids["fill"], "FILL_BLANK", "写下观察所得", "填写一条你从课文中读到的信息。", {
            "prompt": "孩子们沿溪观察到了什么？", "placeholder": "填写你的实际答案",
        }),
        make_activity(ids["speech"], "SPEECH", "朗读春日观察句", "朗读目标文本并上传原始录音。", {
            "targetText": "春风沿着山脊吹向河谷，雪水在石间汇成清亮的小溪。",
        }),
        make_activity(ids["practice"], "CHOICE", "停顿与节奏正式练习", "进入现有正式题库练习执行器。", {
            "prompt": "请进入正式练习完成课程关联题目。", "options": ["进入统一练习"],
        }),
    ]
    for sort_order, activity in enumerate(activities):
        activity["sortOrder"] = sort_order
    units = [{
        "id": ids["unit"], "title": "河谷春日", "sortOrder": 0,
        "lessons": [{"id": ids["lesson"], "title": "听读与表达", "sortOrder": 0, "activities": activities}],
    }]
    updated = page.request.patch(
        f"{prefix}/course-versions/{course['id']}",
        headers=auth,
        data={"expectedUpdatedAt": detail["updatedAt"], "units": units, "coverAsset": "/assets/generated-covers/course-spring-reading.png"},
    )
    assert updated.ok, f"teacher course content update failed with HTTP {updated.status}: {updated.text()}"
    published = page.request.post(f"{prefix}/course-versions/{course['id']}/publish", headers=auth, data={})
    assert published.ok, f"teacher course publish failed with HTTP {published.status}: {published.text()}"
    published_body = response_body(published)
    assert published_body.get("status") == "PUBLISHED"

    now = datetime.now(timezone.utc)
    assignment_response = page.request.post(
        f"{prefix}/assignments",
        headers=auth,
        data={
            "courseVersionId": course["id"],
            "title": f"T022 高原春声任务 {tag}",
            "startsAt": (now - timedelta(minutes=2)).isoformat(),
            "dueAt": (now + timedelta(days=2)).isoformat(),
            "targets": [{"targetType": "CLASS", "classId": CLASS_ID}],
        },
    )
    assert assignment_response.ok, f"teacher assignment create failed with HTTP {assignment_response.status}: {assignment_response.text()}"
    assignment = response_body(assignment_response)
    assert assignment["status"] == "DRAFT" and assignment["revision"] == 1
    scheduled_response = page.request.post(
        f"{prefix}/assignments/{assignment['id']}/schedule", headers=auth, data={"expectedRevision": assignment["revision"]}
    )
    assert scheduled_response.ok, f"teacher assignment schedule failed with HTTP {scheduled_response.status}"
    scheduled = response_body(scheduled_response)
    assert scheduled["status"] == "SCHEDULED"
    opened_response = page.request.post(
        f"{prefix}/assignments/{assignment['id']}/open", headers=auth, data={"expectedRevision": scheduled["revision"]}
    )
    assert opened_response.ok, f"teacher assignment open failed with HTTP {opened_response.status}"
    opened = response_body(opened_response)
    assert opened["status"] == "OPEN"

    # The published course API has no writer for CourseActivityPractice. Link
    # the course to the real imported Level 1 practice already open to this student.
    student_session = login(page.request, "student.test")
    practice_catalog_response = page.request.get(
        f"{prefix}/practices?catalogType=COMPREHENSIVE",
        headers=headers(student_session),
    )
    assert practice_catalog_response.ok, f"active practice catalog failed with HTTP {practice_catalog_response.status}"
    practice_catalog = response_body(practice_catalog_response)
    selected_practice = next(item for item in practice_catalog["items"] if item["title"] == "国家通用语言文字能力｜水平一级综合测评")
    practice_definition_id = selected_practice["id"]
    assert selected_practice["catalogType"] == "COMPREHENSIVE"
    sql(
        f'''INSERT INTO "CourseActivityPractice" (id,"schoolId","activityId","practiceDefinitionId",required)
              VALUES ('{uuid.uuid4()}','{SCHOOL}','{ids["practice"]}','{practice_definition_id}',true);'''
    )
    return {"teacherId": teacher["user"]["id"], "courseVersionId": course["id"], "assignmentId": assignment["id"],
            "activityIds": ids, "practiceDefinitionId": practice_definition_id, "title": course["title"],
            "coverAsset": "/assets/generated-covers/course-spring-reading.png",
            "assignmentStatus": opened["status"], "assignmentRevision": opened["revision"]}


def get_note(request, activity_id, auth_headers):
    response = request.get(f"{API}/api/v1/schools/{SCHOOL}/learning/activities/{activity_id}/note", headers=auth_headers)
    assert response.ok, f"note GET failed with HTTP {response.status}"
    return response_body(response)


def note_sql(enrollment_id, activity_id):
    result = sql(
        f'''SELECT json_build_object('content',content,'revision',revision,'enrollmentId',"enrollmentId",'activityId',"activityId")::text
              FROM "StudentActivityNote"
             WHERE "schoolId"='{SCHOOL}' AND "enrollmentId"='{enrollment_id}' AND "activityId"='{activity_id}' AND "videoTimestamp" IS NULL;'''
    )
    return json.loads(result) if result else None


def progress_sql(enrollment_id, activity_id):
    result = sql(
        f'''SELECT json_build_object('completed',completed,'position',position,'revision',revision,'activityId',"activityId",'enrollmentId',"enrollmentId")::text
              FROM "ActivityProgress" WHERE "activityId"='{activity_id}' AND "enrollmentId"='{enrollment_id}';'''
    )
    return json.loads(result) if result else None


def minio_head(object_key):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T031_API_PACKAGE);
const { HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY,secretAccessKey:process.env.S3_SECRET_KEY}});
(async()=>{try{const v=await client.send(new HeadObjectCommand({Bucket:process.env.S3_BUCKET,Key:process.env.YZ_T031_OBJECT_KEY}));process.stdout.write(JSON.stringify({bytes:v.ContentLength,contentType:v.ContentType,etag:v.ETag}));}catch(e){if(e?.$metadata?.httpStatusCode===404||e?.name==="NotFound"){process.stdout.write(JSON.stringify({missing:true}));}else{process.stderr.write((e?.name||"HEAD_FAILED")+"\n");process.exitCode=1;}}finally{client.destroy();}})().catch(e=>{process.stderr.write((e?.name||"HEAD_FAILED")+"\n");process.exitCode=1;});'''
    env = {**os.environ, "YZ_T031_OBJECT_KEY": object_key}
    result = subprocess.run(["node", "-e", script], cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(f"T031 MinIO HeadObject failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def open_activity(page, assignment_id, submission_id, activity_id):
    url = f"{BASE}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}"
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#learningShell")).to_be_visible(timeout=20_000)
    expect(page.locator("#activityTitle")).not_to_have_text("")
    return url


def complete_simple_activity(page, url, activity_type, payload_value=None):
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#learningShell")).to_be_visible(timeout=20_000)
    if activity_type == "TEXT":
        checkbox = page.locator("#textReadAcknowledged")
        checkbox.focus()
        page.keyboard.press("Space")
        expect(checkbox).to_be_checked()
    elif activity_type == "CHOICE":
        radios = page.locator('input[name="choice"]')
        radios.first.focus()
        page.keyboard.press("ArrowDown")
        expect(radios.nth(1)).to_be_checked()
    elif activity_type == "FILL_BLANK":
        page.locator("#writtenAnswer").fill(payload_value)
    button = page.locator("#completeActivity")
    expect(button).to_be_enabled()
    if activity_type == "CHOICE":
        # Two same-turn clicks prove the browser guard sends one business write.
        button.evaluate("element => { element.click(); element.click(); }")
    else:
        button.focus()
        page.keyboard.press("Enter")
    expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=20_000)
    expect(page.locator("#completeActivity")).to_have_text(re.compile("下一个活动|返回课程"))


def test_t031_real_course_learning_note_media_runner_return_and_isolation():
    verify_database()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshot_dir = EVIDENCE / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    student_b = make_student_b()
    page_errors = []
    navigation_events = []
    runner_api_requests = []
    runner_api_responses = []
    browser_proof = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
        )
        context_a = browser.new_context(viewport={"width": 1280, "height": 980}, permissions=["microphone"])
        page = context_a.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("framenavigated", lambda frame: navigation_events.append(frame.url) if frame == page.main_frame else None)

        def record_runner_request(request):
            path = urlparse(request.url).path
            if "/assessments/sessions/" in path and path.endswith("/submit"):
                runner_api_requests.append({"method": request.method, "path": path})
            elif "practice-attempts/" in path and path.endswith("/complete"):
                runner_api_requests.append({"method": request.method, "path": path})

        def record_runner_response(response):
            path = urlparse(response.url).path
            if path.endswith("/submit") or ("practice-attempts/" in path and path.endswith("/complete")):
                runner_api_responses.append({"status": response.status, "method": response.request.method, "path": path})

        page.on("request", record_runner_request)
        page.on("response", record_runner_response)

        try:
            teacher_course = create_teacher_course(page)
            assignment_id = teacher_course["assignmentId"]
            ids = teacher_course["activityIds"]
            session_a = login(page.request, "student.test")
            headers_a = headers(session_a)
            enrollment_a = sql(f'''SELECT id FROM "Enrollment" WHERE "userId"='{session_a["user"]["id"]}' AND role='STUDENT' AND status='ACTIVE' LIMIT 1;''')
            assert enrollment_a
            authorized_course = page.request.get(f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}", headers=headers_a)
            assert authorized_course.ok
            authorized_course_body = response_body(authorized_course)
            assert authorized_course_body["courseVersion"].get("coverAsset") == teacher_course["coverAsset"]

            # Open the real course in the existing course-detail surface first.
            login_ui(page, "student.test")
            page.goto(f"{BASE}/student/courses/course-detail/?id={assignment_id}", wait_until="domcontentloaded")
            expect(page.locator("#cpHeroTitle")).to_have_text(teacher_course["title"], timeout=20_000)
            page.locator(f'.cp-dir-item[data-activity-id="{ids["text"]}"]').click()
            expect(page.locator(f'.cp-dir-item[data-activity-id="{ids["text"]}"]')).to_have_class(re.compile("current"))
            submission_id = page.evaluate("window.CoursePlayerState.getState().submissionId")
            assert submission_id
            course_detail_url = f"{BASE}/student/courses/course-detail/?id={assignment_id}&activityId={ids['text']}&submissionId={submission_id}"
            text_url = open_activity(page, assignment_id, submission_id, ids["text"])
            expect(page.locator(".course-content-image")).to_be_visible(timeout=20_000)
            page.wait_for_function("""() => {
              const image = document.querySelector('.course-content-image');
              return image && image.complete && image.naturalWidth > 0;
            }""", timeout=20_000)
            assert "course-spring-reading.png" in page.locator("#courseHeading").evaluate("element => getComputedStyle(element).getPropertyValue('--course-cover')")
            visual_proof = {
                "courseCoverAsset": authorized_course_body["courseVersion"]["coverAsset"],
                "courseCoverStyle": page.locator("#courseHeading").evaluate("element => getComputedStyle(element).getPropertyValue('--course-cover')"),
                "contentImage": page.locator(".course-content-image").evaluate("image => ({alt: image.alt, src: new URL(image.currentSrc).pathname, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight})"),
            }

            # The held first request allows the student to type again while an
            # autosave is active; only the last visible text may be confirmed.
            note_fetch_script = f"""(() => {{
              const originalFetch = window.fetch.bind(window);
              window.__t022NotePutCount = 0;
              window.fetch = async (input, init = {{}}) => {{
                const url = typeof input === 'string' ? input : input.url;
                const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
                if (method === 'PUT' && url.includes('/learning/activities/{ids['text']}/note')) {{
                  window.__t022NotePutCount += 1;
                  if (window.__t022HoldNextNotePut) {{
                    window.__t022HoldNextNotePut = false;
                    window.__t022FirstNoteHeld = true;
                    await new Promise(resolve => {{ window.__t022ReleaseFirstNote = resolve; }});
                  }}
                }}
                return originalFetch(input, init);
              }};
            }})()"""
            page.add_init_script(note_fetch_script)
            page.evaluate(note_fetch_script)
            page.evaluate("window.__t022HoldNextNotePut = true")
            note_put_requests = []
            page.on("request", lambda request: note_put_requests.append(request) if request.method == "PUT" and "/learning/activities/" in request.url and request.url.endswith("/note") else None)
            final_note = "第一段：我先听声音，再读正文。\n第二段：保存等待时补充的重点也要写入云端。"
            page.locator("#noteContent").fill("第一段：我先听声音。")
            page.wait_for_function("window.__t022FirstNoteHeld === true", timeout=10_000)
            page.locator("#noteContent").fill(final_note)
            page.wait_for_timeout(850)
            page.evaluate("window.__t022ReleaseFirstNote()")
            expect(page.locator("#noteState")).to_have_text("已保存", timeout=20_000)
            page.wait_for_function("window.__t022NotePutCount >= 2", timeout=10_000)
            assert len(note_put_requests) >= 2
            note_race_put_count = len(note_put_requests)
            note_row = note_sql(enrollment_a, ids["text"])
            assert note_row and note_row["content"] == final_note and note_row["revision"] >= 2, note_row
            api_note = get_note(page.request, ids["text"], headers_a)
            assert api_note["content"] == final_note and api_note["revision"] == note_row["revision"]
            revision_after_race = note_row["revision"]

            # Reload is a fresh API read. No note content is stored in localStorage.
            page.reload(wait_until="domcontentloaded")
            expect(page.locator("#noteContent")).to_have_value(final_note, timeout=20_000)
            assert page.evaluate("text => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes(text))", final_note) is False

            # A stale revision must return 409 and leave PostgreSQL unchanged.
            stale = page.request.put(
                f"{API}/api/v1/schools/{SCHOOL}/learning/activities/{ids['text']}/note",
                headers=headers_a,
                data={"content": "此文本不得覆盖数据库", "revision": 0},
            )
            assert stale.status == 409
            after_stale = note_sql(enrollment_a, ids["text"])
            assert after_stale["content"] == final_note and after_stale["revision"] == revision_after_race

            # A 12-second pending request reports an unknown state, never
            # success. Once the original request returns, the same revision
            # queue confirms the server text.
            timeout_draft = "请求超时等待恢复后仍写入服务器。"
            page.evaluate("window.__t022HoldNextNotePut = true")
            page.locator("#noteContent").fill(timeout_draft)
            page.wait_for_function("window.__t022FirstNoteHeld === true", timeout=10_000)
            page.wait_for_function(
                "document.querySelector('#noteState')?.dataset.tone === 'error' && document.querySelector('#noteState')?.textContent.includes('服务器尚未确认')",
                timeout=20_000,
            )
            assert note_sql(enrollment_a, ids["text"])["content"] == final_note
            page.evaluate("window.__t022ReleaseFirstNote()")
            expect(page.locator("#noteState")).to_have_text("已保存", timeout=20_000)
            timeout_saved = note_sql(enrollment_a, ids["text"])
            assert timeout_saved["content"] == timeout_draft and timeout_saved["revision"] > revision_after_race
            timeout_put_count = len(note_put_requests) - note_race_put_count
            assert timeout_put_count >= 1

            # Two tabs edit one note. Web Locks serializes the same student and
            # the losing draft stays visible until the user accepts server text.
            page_b = context_a.new_page()
            page_b.on("pageerror", lambda error: page_errors.append(str(error)))
            page_b.goto(text_url, wait_until="domcontentloaded")
            expect(page_b.locator("#noteContent")).to_have_value(timeout_draft, timeout=20_000)
            page.locator("#noteContent").fill("来自标签页 A 的新草稿")
            page_b.locator("#noteContent").fill("来自标签页 B 的新草稿")
            conflict_page = None
            deadline = time.time() + 15
            while time.time() < deadline:
                for candidate in (page, page_b):
                    if candidate.locator("#noteRecovery").is_visible():
                        conflict_page = candidate
                        break
                if conflict_page:
                    break
                page.wait_for_timeout(100)
            assert conflict_page is not None, "two-tab edits must expose the actual server version conflict"
            draft_before_resolution = conflict_page.locator("#noteContent").input_value()
            assert draft_before_resolution in {"来自标签页 A 的新草稿", "来自标签页 B 的新草稿"}
            conflict_page.get_by_role("button", name="采用云端版本").click()
            expect(conflict_page.locator("#noteRecovery")).to_be_hidden()
            resolved_note = get_note(page.request, ids["text"], headers_a)
            expect(conflict_page.locator("#noteContent")).to_have_value(resolved_note["content"])
            assert note_sql(enrollment_a, ids["text"])["content"] == resolved_note["content"]
            page_b.close()
            page.reload(wait_until="domcontentloaded")
            expect(page.locator("#noteContent")).to_be_enabled(timeout=20_000)
            expect(page.locator("#noteContent")).to_have_value(resolved_note["content"])

            # Offline writes are visibly unconfirmed, then retry on reconnect.
            before_offline = note_sql(enrollment_a, ids["text"])
            context_a.set_offline(True)
            offline_draft = "断网时的草稿：重新联网后保存到 PostgreSQL。"
            page.locator("#noteContent").fill(offline_draft)
            expect(page.locator("#noteState")).to_have_attribute("data-tone", "error", timeout=15_000)
            assert note_sql(enrollment_a, ids["text"])["content"] == before_offline["content"]
            leave_dialogs = []

            def dismiss_unsaved_leave(dialog):
                leave_dialogs.append(dialog.message)
                dialog.dismiss()

            page.once("dialog", dismiss_unsaved_leave)
            page.locator("#chapterPath .activity-link").nth(1).click()
            page.wait_for_timeout(200)
            assert leave_dialogs and "尚未确认保存" in leave_dialogs[0]
            assert page.url == text_url
            context_a.set_offline(False)
            expect(page.locator("#noteState")).to_have_text("已保存", timeout=30_000)
            offline_saved = note_sql(enrollment_a, ids["text"])
            assert offline_saved["content"] == offline_draft and offline_saved["revision"] > before_offline["revision"]
            # Logout and sign in again; the only restored note source is PostgreSQL.
            page.evaluate("YuzanApi.logout()")
            page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
            login_ui(page, "student.test")
            session_a = login(page.request, "student.test")
            headers_a = headers(session_a)
            open_activity(page, assignment_id, submission_id, ids["text"])
            expect(page.locator("#noteContent")).to_have_value(offline_draft, timeout=20_000)

            # Keyboard acknowledgement completes TEXT with the API's actual
            # schema and the database-backed ActivityProgress response.
            text_checkbox = page.locator("#textReadAcknowledged")
            text_checkbox.focus()
            page.keyboard.press("Space")
            page.locator("#completeActivity").focus()
            page.keyboard.press("Enter")
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=20_000)
            text_progress = progress_sql(enrollment_a, ids["text"])
            assert text_progress and text_progress["completed"] is True and text_progress["revision"] >= 1
            text_attempt = sql(f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{ids["text"]}';''')
            assert json.loads(text_attempt)["value"]["acknowledged"] is True

            # Responsive widths, keyboard focus, status semantics, and reduced motion.
            expect(page.locator("#chapterPath")).to_have_attribute("aria-label", "课程活动")
            expect(page.locator(".progress-seal")).to_have_attribute("role", "progressbar")
            for width, height in ((390, 844), (768, 900), (1280, 980), (1440, 960)):
                page.set_viewport_size({"width": width, "height": height})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"horizontal overflow at {width}px"
                page.screenshot(path=str(screenshot_dir / f"activity-text-{width}.png"), full_page=True)
            page.emulate_media(reduced_motion="reduce")
            assert page.locator("#progressRing").evaluate("element => getComputedStyle(element).transitionDuration") in {"0s", "0.0s"}
            page.emulate_media(reduced_motion="no-preference")

            # Real server-sourced choice and fill answers; duplicate clicks do not duplicate rows.
            choice_url = open_activity(page, assignment_id, submission_id, ids["choice"])
            complete_simple_activity(page, choice_url, "CHOICE")
            choice_progress = progress_sql(enrollment_a, ids["choice"])
            assert choice_progress and choice_progress["completed"] is True
            choice_rows = sql(f'''SELECT count(*) FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{ids["choice"]}';''')
            assert choice_rows == "1"
            stale_progress = page.request.put(
                f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{ids['choice']}/attempt",
                headers=headers_a,
                data={"kind": "CHOICE", "value": {"selectedIndex": 0}, "completed": True, "expectedProgressRevision": 0},
            )
            assert stale_progress.status == 409
            assert progress_sql(enrollment_a, ids["choice"])["revision"] == choice_progress["revision"]

            fill_url = open_activity(page, assignment_id, submission_id, ids["fill"])
            fill_answer = "融化的积雪和新生的草芽。"
            complete_simple_activity(page, fill_url, "FILL_BLANK", fill_answer)
            fill_attempt = sql(f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{ids["fill"]}';''')
            assert json.loads(fill_attempt)["value"]["answers"] == [fill_answer]

            # Missing media returns a real error and cannot be completed.
            missing_url = open_activity(page, assignment_id, submission_id, ids["missing_video"])
            expect(page.get_by_text("此视频活动没有可访问的授权视频资源。", exact=True)).to_be_visible()
            expect(page.locator("#completeActivity")).to_be_disabled()
            assert progress_sql(enrollment_a, ids["missing_video"]) is None

            # Listen to and play actual local course assets returned in the
            # authorized course response, then require the ended event.
            audio_url = open_activity(page, assignment_id, submission_id, ids["audio"])
            audio = page.locator("audio")
            page.wait_for_function("document.querySelector('audio')?.readyState >= 1", timeout=20_000)
            duration = audio.evaluate("element => element.duration")
            assert duration and duration > 0
            page.evaluate("document.querySelector('audio').play()")
            page.wait_for_function("document.querySelector('audio')?.ended === true", timeout=45_000)
            expect(page.locator("#completeActivity")).to_be_enabled()
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=20_000)
            assert progress_sql(enrollment_a, ids["audio"])["completed"] is True

            video_url = open_activity(page, assignment_id, submission_id, ids["video"])
            video = page.locator("video")
            page.wait_for_function("document.querySelector('video')?.readyState >= 1", timeout=20_000)
            video_duration = video.evaluate("element => element.duration")
            assert video_duration and video_duration > 0
            page.evaluate("document.querySelector('video').play()")
            page.wait_for_function("document.querySelector('video')?.ended === true", timeout=60_000)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=20_000)
            assert progress_sql(enrollment_a, ids["video"])["completed"] is True

            # Record a real browser MediaRecorder blob (Chromium test device),
            # inject one failed PUT, then recover the same idempotent Recording.
            speech_url = open_activity(page, assignment_id, submission_id, ids["speech"])
            denied_context = browser.new_context(viewport={"width": 1280, "height": 900})
            denied_page = denied_context.new_page()
            denied_page.add_init_script("Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) });")
            login_ui(denied_page, "student.test")
            open_activity(denied_page, assignment_id, submission_id, ids["speech"])
            denied_page.locator("#courseRecorder .vr-action").click()
            denied_page.wait_for_function("document.querySelector('#courseRecorder')?.dataset.state === 'error'", timeout=15_000)
            expect(denied_page.locator("#syncState")).to_contain_text("麦克风不可用")
            expect(denied_page.locator("#completeActivity")).to_be_disabled()
            assert sql(f'''SELECT count(*) FROM "Recording" WHERE "enrollmentId"='{enrollment_a}' AND "submissionId"='{submission_id}' AND "idempotencyKey"='course:{submission_id}:{ids["speech"]}';''') == "0"
            assert progress_sql(enrollment_a, ids["speech"]) is None
            denied_context.close()

            recorder = page.locator("#courseRecorder")
            recorder.locator(".vr-action").click()
            page.wait_for_function("document.querySelector('#courseRecorder')?.dataset.state === 'recording'", timeout=15_000)
            page.wait_for_timeout(2300)
            upload_fault = {"count": 0}
            recording_init_ids = []

            def capture_recording_init(response):
                if response.request.method == "POST" and response.url.endswith("/recordings/simple") and response.status == 201:
                    try:
                        recording_init_ids.append(response_body(response)["id"])
                    except Exception:
                        pass

            page.on("response", capture_recording_init)

            def fail_first_put(route):
                if route.request.method == "PUT" and "/storage-upload" in route.request.url and upload_fault["count"] == 0:
                    upload_fault["count"] += 1
                    route.abort("internetdisconnected")
                else:
                    route.continue_()

            page.route("**/storage-upload*", fail_first_put)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_have_attribute("data-tone", "error", timeout=20_000)
            expect(page.locator("#syncState")).to_contain_text("原录音仍保存在本机", timeout=10_000)
            assert upload_fault["count"] == 1
            speech_progress_before_retry = progress_sql(enrollment_a, ids["speech"])
            assert speech_progress_before_retry is None
            page.unroute("**/storage-upload*", fail_first_put)

            # The next action injects a signed-URL 403; the page must request
            # a new URL for the same ID before the successful PUT.
            signed_expiry = {"count": 0}

            def expire_first_signed_put(route):
                if route.request.method == "PUT" and "/storage-upload" in route.request.url and signed_expiry["count"] == 0:
                    signed_expiry["count"] += 1
                    route.fulfill(status=403, body="SignatureDoesNotMatch")
                else:
                    route.continue_()

            link_failure = {"count": 0}

            def fail_first_course_link(route):
                if route.request.method == "POST" and route.request.url.endswith("/link") and link_failure["count"] == 0:
                    link_failure["count"] += 1
                    route.fulfill(status=500, content_type="application/json", body=json.dumps({"error": {"message": "injected course recording link failure"}}))
                else:
                    route.continue_()

            page.route("**/storage-upload*", expire_first_signed_put)
            page.route("**/activities/*/recordings/*/link", fail_first_course_link)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_have_attribute("data-tone", "error", timeout=30_000)
            expect(page.locator("#syncState")).to_contain_text("课程活动关联失败", timeout=10_000)
            assert signed_expiry["count"] == 1 and link_failure["count"] == 1
            page.unroute("**/storage-upload*", expire_first_signed_put)
            assert len(recording_init_ids) >= 3 and len(set(recording_init_ids)) == 1, recording_init_ids
            recording_id = recording_init_ids[0]
            unlinked_recording = sql(
                f'''SELECT json_build_object('id',id,'status',status,'objectKey',"objectKey",'activityAttemptId',"activityAttemptId")::text
                      FROM "Recording" WHERE id='{recording_id}' AND "schoolId"='{SCHOOL}' AND "enrollmentId"='{enrollment_a}' AND "submissionId"='{submission_id}';'''
            )
            unlinked_recording = json.loads(unlinked_recording)
            assert unlinked_recording["status"] in {"COMPLETE", "PROCESSING", "READY"}
            assert unlinked_recording["objectKey"] == f"recordings/{recording_id}/full"
            assert unlinked_recording["activityAttemptId"] is None
            object_after_link_failure = minio_head(unlinked_recording["objectKey"])
            assert object_after_link_failure.get("bytes", 0) > 0 and not object_after_link_failure.get("missing")
            assert progress_sql(enrollment_a, ids["speech"]) is None

            # Refresh restores the locally cached blob and the same completed
            # server Recording. Retrying only repairs the missing activity link.
            page.unroute("**/activities/*/recordings/*/link", fail_first_course_link)
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("document.querySelector('#courseRecorder')?.__voiceRecorder?.blob?.size > 0", timeout=20_000)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=30_000)
            assert len(recording_init_ids) >= 3 and len(set(recording_init_ids)) == 1, recording_init_ids
            assert len(recording_init_ids) >= 4
            page.remove_listener("response", capture_recording_init)
            speech_progress = progress_sql(enrollment_a, ids["speech"])
            assert speech_progress and speech_progress["completed"] is True
            course_recording = sql(
                f'''SELECT json_build_object('id',r.id,'status',r.status,'objectKey',r."objectKey",'mimeType',r."mimeType",'durationMs',r."durationMs",'activityAttemptId',r."activityAttemptId",'linkedAttemptId',a.id)::text
                      FROM "Recording" r JOIN "ActivityAttempt" a ON a.id=r."activityAttemptId"
                     WHERE r.id='{recording_id}' AND r."schoolId"='{SCHOOL}' AND r."enrollmentId"='{enrollment_a}' AND r."submissionId"='{submission_id}';'''
            )
            course_recording = json.loads(course_recording)
            assert course_recording["status"] in {"COMPLETE", "PROCESSING", "READY"}
            assert course_recording["objectKey"] == f"recordings/{recording_id}/full"
            assert course_recording["linkedAttemptId"] and course_recording["activityAttemptId"] == course_recording["linkedAttemptId"]
            assert sql(f'''SELECT count(*) FROM "Recording" WHERE "enrollmentId"='{enrollment_a}' AND "submissionId"='{submission_id}' AND "idempotencyKey"='course:{submission_id}:{ids["speech"]}';''') == "1"
            assert sql(f'''SELECT count(*) FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{ids["speech"]}';''') == "1"
            minio_object = minio_head(course_recording["objectKey"])
            assert minio_object.get("bytes", 0) > 0 and not minio_object.get("missing")

            # Re-running the existing initialization/completion/link APIs with
            # the same idempotency identity returns the same Recording.
            init_retry = page.request.post(
                f"{API}/api/v1/schools/{SCHOOL}/recordings/simple",
                headers=headers_a,
                data={"enrollmentId": enrollment_a, "submissionId": submission_id, "mimeType": course_recording["mimeType"], "idempotencyKey": f"course:{submission_id}:{ids['speech']}"},
            )
            assert init_retry.ok and response_body(init_retry)["id"] == recording_id
            complete_retry = page.request.post(
                f"{API}/api/v1/schools/{SCHOOL}/recordings/{recording_id}/complete",
                headers=headers_a,
                data={"durationMs": course_recording["durationMs"], "objectKey": course_recording["objectKey"], "targetText": "春风沿着山脊吹向河谷，雪水在石间汇成清亮的小溪。"},
            )
            assert complete_retry.ok
            link_retry = page.request.post(
                f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{ids['speech']}/recordings/{recording_id}/link",
                headers=headers_a,
                data={},
            )
            assert link_retry.ok and response_body(link_retry)["synced"] is True
            assert sql(f'''SELECT count(*) FROM "Recording" WHERE id='{recording_id}';''') == "1"

            # Enter the existing formal Question Bank Runner with dynamic
            # course context, submit it, then return through the same IDs.
            practice_url = open_activity(page, assignment_id, submission_id, ids["practice"])
            expect(page.locator("#launchPractice")).to_be_visible()
            page.locator("#launchPractice").click()
            page.wait_for_url("**/student/practices/attempts/*/prepare/**", timeout=30_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            attempt_response = page.request.get(f"{API}/api/v1/schools/{SCHOOL}/practices/attempts/{attempt_id}", headers=headers_a)
            assert attempt_response.ok
            runner_attempt = response_body(attempt_response)
            assert runner_attempt["id"] == attempt_id
            assert runner_attempt["courseSubmissionId"] == submission_id and runner_attempt["courseActivityId"] == ids["practice"]
            assert runner_attempt["deliveryId"]
            page.locator("[data-start-session]").click()
            page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/runner/", timeout=30_000)
            runner_back = page.locator(".runner-back")
            expected_return = f"/student/courses/course-detail/?id={assignment_id}&activityId={ids['practice']}&submissionId={submission_id}"
            assert expected_return in unquote(runner_back.get_attribute("href") or "")
            runner_result = complete_real_attempt(page, headers_a, attempt_id, base_url=API, submit=False, exercise_upload_retry=False)
            runner_submit_requests = []
            page.on(
                "request",
                lambda request: runner_submit_requests.append(request)
                if request.method == "POST" and request.url.endswith(f"/assessments/sessions/{attempt_id}/submit")
                else None,
            )
            page.locator("[data-submit]").click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=10_000)
            dialog.get_by_role("button", name="再检查一下").click()
            dialog.wait_for(state="detached", timeout=10_000)
            assert len(runner_submit_requests) == 0, "canceling confirmation must not submit the attempt"

            page.locator("[data-submit]").click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=10_000)
            page.keyboard.press("Escape")
            dialog.wait_for(state="detached", timeout=10_000)
            assert len(runner_submit_requests) == 0, "Escape must not submit the attempt"

            course_completion_faults = {"browserRequests": 0, "firstRequestAborted": False, "backendStatuses": []}

            def fail_then_drop_course_completion(route):
                course_completion_faults["browserRequests"] += 1
                if course_completion_faults["browserRequests"] == 1:
                    course_completion_faults["firstRequestAborted"] = True
                    route.abort("internetdisconnected")
                    return
                server_response = route.fetch()
                course_completion_faults["backendStatuses"].append(server_response.status)
                route.abort("internetdisconnected")

            page.route(f"**/practice-attempts/{attempt_id}/complete", fail_then_drop_course_completion)
            runner_dialogs = []

            def accept_and_record_runner_dialog(dialog):
                runner_dialogs.append(dialog.type)
                if dialog.type == "beforeunload":
                    dialog.accept()
                else:
                    dialog.dismiss()

            page.on("dialog", accept_and_record_runner_dialog)
            page.locator("[data-submit]").click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=10_000)
            confirm_submit = dialog.get_by_role("button", name="确认交卷", exact=True)
            if confirm_submit.count() != 1:
                raise AssertionError(f"Runner still has incomplete items: {dialog.inner_text()}")
            confirm_submit.evaluate("element => { element.click(); element.click(); }")
            expect(page.locator("[data-runner-message]")).to_contain_text("练习已交卷，课程同步待核实", timeout=30_000)
            expect(page.locator("[data-retry-course-sync]")).to_be_visible()
            assert len(runner_submit_requests) == 1
            assert course_completion_faults["browserRequests"] == 1
            assert course_completion_faults["firstRequestAborted"] is True
            pending_context = page.evaluate("attemptId => JSON.parse(localStorage.getItem(`yuzan-course-practice-context:${attemptId}`) || 'null')", attempt_id)
            assert pending_context and pending_context["syncStatus"] == "PENDING" and pending_context["submitStatus"] == "CONFIRMED"
            pending_progress = progress_sql(enrollment_a, ids["practice"])
            assert pending_progress is None or pending_progress["completed"] is not True
            page.locator("[data-retry-course-sync]").click()
            page.wait_for_url(re.compile(r".*/student/courses/course-detail/.*"), timeout=60_000)
            page.unroute(f"**/practice-attempts/{attempt_id}/complete", fail_then_drop_course_completion)
            page.remove_listener("dialog", accept_and_record_runner_dialog)
            assert len(runner_submit_requests) == 1
            assert course_completion_faults == {"browserRequests": 2, "firstRequestAborted": True, "backendStatuses": [201]}
            assert runner_dialogs == [], "Runner submission must not be held by a beforeunload dialog"
            course_runner_requests = [event for event in runner_api_requests if f"/assessments/sessions/{attempt_id}/submit" in event["path"] or f"/practice-attempts/{attempt_id}/complete" in event["path"]]
            assert sum(event["method"] == "POST" and event["path"].endswith("/submit") for event in course_runner_requests) == 1
            assert sum(event["method"] == "POST" and event["path"].endswith("/complete") for event in course_runner_requests) == 2
            course_return_navigations = [url for url in navigation_events if f"practiceAttemptId={attempt_id}" in url]
            assert len(course_return_navigations) == 1, course_return_navigations
            assert f"id={assignment_id}" in page.url
            assert f"activityId={ids['practice']}" in page.url
            assert f"submissionId={submission_id}" in page.url
            assert f"practiceAttemptId={attempt_id}" in page.url
            page.wait_for_function(
                "submissionId => window.CoursePlayerState?.getState().submissionId === submissionId",
                arg=submission_id,
                timeout=30_000,
            )
            assert page.evaluate("window.CoursePlayerState.getState().submissionId") == submission_id
            attempt_count_before_refresh = int(sql(f'''SELECT count(*) FROM "AssessmentSession" WHERE "courseSubmissionId"='{submission_id}' AND "courseActivityId"='{ids['practice']}';'''))
            runner_recording_count_before_refresh = int(sql(f'''SELECT count(*) FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId" WHERE i."sessionId"='{attempt_id}';'''))
            assert attempt_count_before_refresh == 1
            refresh_business_posts = []

            def capture_refresh_business_posts(request):
                path = urlparse(request.url).path
                if request.method == "POST" and (
                    f"/practices/{teacher_course['practiceDefinitionId']}/attempts" in path
                    or path.endswith(f"/assessments/sessions/{attempt_id}/submit")
                    or path.endswith(f"/practice-attempts/{attempt_id}/complete")
                    or path.endswith("/recordings/simple")
                ):
                    refresh_business_posts.append(path)

            page.on("request", capture_refresh_business_posts)
            page.reload(wait_until="domcontentloaded")
            expect(page.locator("#cpHeroTitle")).to_have_text(teacher_course["title"], timeout=20_000)
            page.wait_for_function("submissionId => window.CoursePlayerState?.getState().submissionId === submissionId", arg=submission_id, timeout=20_000)
            page.remove_listener("request", capture_refresh_business_posts)
            assert refresh_business_posts == [], refresh_business_posts
            assert int(sql(f'''SELECT count(*) FROM "AssessmentSession" WHERE "courseSubmissionId"='{submission_id}' AND "courseActivityId"='{ids['practice']}';''')) == attempt_count_before_refresh
            assert int(sql(f'''SELECT count(*) FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId" WHERE i."sessionId"='{attempt_id}';''')) == runner_recording_count_before_refresh
            practice_progress = progress_sql(enrollment_a, ids["practice"])
            assert practice_progress and practice_progress["completed"] is True
            practice_attempt_row = sql(f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{ids["practice"]}';''')
            practice_attempt_row = json.loads(practice_attempt_row)
            assert practice_attempt_row["kind"] == "COURSE_PRACTICE"
            assert practice_attempt_row["value"]["practiceAttemptId"] == attempt_id
            persisted_runner = sql(f'''SELECT json_build_object('id',id,'deliveryId',"deliveryId",'courseActivityId',"courseActivityId",'courseSubmissionId',"courseSubmissionId",'status',status)::text FROM "AssessmentSession" WHERE id='{attempt_id}';''')
            persisted_runner = json.loads(persisted_runner)
            assert persisted_runner["deliveryId"] == runner_attempt["deliveryId"]
            assert persisted_runner["courseSubmissionId"] == submission_id and persisted_runner["courseActivityId"] == ids["practice"]
            assert persisted_runner["status"] in {"SUBMITTED", "PROCESSING", "COMPLETED"}
            runner_item_count = int(sql(f'''SELECT count(*) FROM "AssessmentItem" WHERE "sessionId"='{attempt_id}';'''))
            runner_scored_audio_count = int(sql(f'''SELECT count(*) FROM "AssessmentItem" WHERE "sessionId"='{attempt_id}' AND "recordingId" IS NOT NULL AND "scoredScore" IS NOT NULL;'''))
            runner_report_count = int(sql(f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"='{attempt_id}';'''))
            runner_recordings_sql = sql(f'''SELECT COALESCE(json_agg(json_build_object('recordingId',r.id,'objectKey',r."objectKey",'status',r.status,'mimeType',r."mimeType",'durationMs',r."durationMs",'idempotencyKey',r."idempotencyKey",'speechJobCount',jobs.n) ORDER BY r.id),'[]'::json)::text FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId" LEFT JOIN LATERAL (SELECT count(*)::int AS n FROM "SpeechJob" j WHERE j."recordingId"=r.id) jobs ON true WHERE i."sessionId"='{attempt_id}';''')
            runner_recordings = json.loads(runner_recordings_sql)
            for runner_recording in runner_recordings:
                runner_recording["minioHead"] = minio_head(runner_recording["objectKey"])
                assert runner_recording["minioHead"].get("bytes", 0) > 0
                assert runner_recording["minioHead"]["contentType"].startswith("audio/")
            runner_idempotency_keys = [entry["idempotencyKey"] for entry in runner_recordings]
            assert all(key.startswith(f"runner-{attempt_id}-") for key in runner_idempotency_keys)
            assert len(runner_idempotency_keys) == len(set(runner_idempotency_keys))
            assert all(sql(f'''SELECT count(*) FROM "Recording" WHERE "enrollmentId"='{enrollment_a}' AND "idempotencyKey"='{key}';''') == "1" for key in runner_idempotency_keys)
            assert runner_item_count == runner_result["itemCount"] == 20
            assert len(runner_recordings) == runner_result["recordedAudio"]
            assert runner_scored_audio_count == 0
            assert runner_report_count == 0
            runner_attempt_count = int(sql(f'''SELECT count(*) FROM "AssessmentSession" WHERE "courseSubmissionId"='{submission_id}' AND "courseActivityId"='{ids['practice']}';'''))
            assert runner_attempt_count == 1
            course_version_sql = json.loads(sql(f'''SELECT json_build_object('id',id,'status',status,'version',version)::text FROM "CourseVersion" WHERE id='{teacher_course["courseVersionId"]}';'''))
            assignment_sql = json.loads(sql(f'''SELECT json_build_object('id',id,'status',status,'revision',revision,'courseVersionId',"courseVersionId")::text FROM "Assignment" WHERE id='{assignment_id}';'''))
            submission_sql = json.loads(sql(f'''SELECT json_build_object('id',id,'status',status,'assignmentId',"assignmentId",'enrollmentId',"enrollmentId")::text FROM "Submission" WHERE id='{submission_id}';'''))
            speech_job_count = int(sql(f'''SELECT count(*) FROM "SpeechJob" WHERE "recordingId"='{recording_id}';'''))
            course_practice_link = json.loads(sql(f'''SELECT json_build_object('activityId',"activityId",'practiceDefinitionId',"practiceDefinitionId",'required',required)::text FROM "CourseActivityPractice" WHERE "activityId"='{ids["practice"]}';'''))

            # A/B isolation: B can see the class assignment, but only B's own
            # Submission, note, progress, and recording scope.
            context_b = browser.new_context(viewport={"width": 1280, "height": 900}, permissions=["microphone"])
            page_b = context_b.new_page()
            page_b.on("pageerror", lambda error: page_errors.append(str(error)))
            login_ui(page_b, student_b["loginIdentifier"])
            session_b = login(page_b.request, student_b["loginIdentifier"])
            headers_b = headers(session_b)
            anonymous_runner = playwright.request.new_context()
            course_session_anonymous = anonymous_runner.get(f"{API}/api/v1/schools/{SCHOOL}/assessments/sessions/{attempt_id}")
            anonymous_runner.dispose()
            course_session_b = page_b.request.get(f"{API}/api/v1/schools/{SCHOOL}/assessments/sessions/{attempt_id}", headers=headers_b)
            course_session_missing = page.request.get(f"{API}/api/v1/schools/{SCHOOL}/assessments/sessions/{uuid.uuid4()}", headers=headers_a)
            course_complete_mismatch = page.request.post(
                f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{ids['practice']}/practice-attempts/{uuid.uuid4()}/complete",
                headers=headers_a,
                data={},
            )
            assert course_session_anonymous.status == 401
            assert course_session_b.status == 403
            assert course_session_missing.status == 404
            assert course_complete_mismatch.status == 409
            detail_b_response = page_b.request.get(f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}", headers=headers_b)
            assert detail_b_response.ok
            detail_b = response_body(detail_b_response)
            assert detail_b.get("existingSubmission") is None or detail_b["existingSubmission"]["id"] != submission_id
            activities_b = [activity for unit in detail_b["units"] for lesson in unit["lessons"] for activity in lesson["activities"]]
            text_activity_b = next(activity for activity in activities_b if activity["id"] == ids["text"])
            assert not text_activity_b.get("progress") or text_activity_b["progress"].get("completed") is not True
            assert not text_activity_b.get("personalNotes")
            note_b = get_note(page_b.request, ids["text"], headers_b)
            assert note_b["content"] == "" and note_b["revision"] == 0
            submission_b_response = page_b.request.get(f"{API}/api/v1/schools/{SCHOOL}/submissions/{submission_id}", headers=headers_b)
            assert submission_b_response.status in {403, 404}
            progress_b_response = page_b.request.get(
                f"{API}/api/v1/schools/{SCHOOL}/learning/activities/{ids['text']}/progress?enrollmentId={enrollment_a}",
                headers=headers_b,
            )
            assert progress_b_response.status == 403
            recording_b_response = page_b.request.get(f"{API}/api/v1/schools/{SCHOOL}/recordings/{recording_id}", headers=headers_b)
            assert recording_b_response.status in {403, 404}
            forbidden_attempt = page_b.request.put(
                f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{ids['text']}/attempt",
                headers=headers_b,
                data={"kind": "TEXT", "value": {"acknowledged": True}, "completed": True, "expectedProgressRevision": 0},
            )
            assert forbidden_attempt.status in {403, 404}
            other_school = str(uuid.uuid4())
            assert page_b.request.get(f"{API}/api/v1/schools/{other_school}/student/courses/{assignment_id}", headers=headers_b).status == 403
            anonymous = playwright.request.new_context()
            assert anonymous.get(f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}").status == 401
            anonymous.dispose()
            assert page.request.get(f"{API}/api/v1/schools/{SCHOOL}/student/courses/{uuid.uuid4()}", headers=headers_a).status == 404
            page_b.goto(f"{BASE}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{ids['text']}", wait_until="domcontentloaded")
            expect(page_b.locator("#errorState")).to_be_visible(timeout=20_000)
            assert "没有访问权限" in page_b.locator("#errorState").inner_text() or "课程记录已更新" in page_b.locator("#errorState").inner_text()
            assert note_sql(enrollment_a, ids["text"])["content"] == offline_draft

            # The real Assignment/Submission/Activity/CourseVersion identities
            # and retained SQL/S3 evidence are emitted for the result capsule.
            browser_proof = {
                "courseVersionId": teacher_course["courseVersionId"],
                "courseVersionSql": course_version_sql,
                "assignmentId": assignment_id,
                "assignmentSql": assignment_sql,
                "assignmentStatus": teacher_course["assignmentStatus"],
                "assignmentRevision": teacher_course["assignmentRevision"],
                "submissionId": submission_id,
                "submissionSql": submission_sql,
                "enrollmentA": enrollment_a,
                "enrollmentB": student_b["enrollmentId"],
                "activityIds": ids,
                "practiceDefinitionId": teacher_course["practiceDefinitionId"],
                "note": {"content": offline_draft, "revision": note_sql(enrollment_a, ids["text"])["revision"]},
                "noteDuringSaving": {"putRequests": note_race_put_count, "firstPendingSaveFinalRevision": revision_after_race},
                "noteTimeout": {"putRequests": timeout_put_count, "serverConfirmedAfterRequestReturned": timeout_saved["content"] == timeout_draft, "revision": timeout_saved["revision"]},
                "noteTwoTabConflict": {"preservedDraft": draft_before_resolution, "selectedServerContent": resolved_note["content"]},
                "unsavedLeavePrompt": leave_dialogs[0],
                "noteAfterRelogin": offline_saved,
                "textProgress": text_progress,
                "choiceProgress": choice_progress,
                "fillAnswer": fill_answer,
                "audioProgress": progress_sql(enrollment_a, ids["audio"]),
                "videoProgress": progress_sql(enrollment_a, ids["video"]),
                "mediaSources": {"audio": "/assessment/assets/question-bank/audio/level-1-dictation-1.mp3", "video": "/assets/media/video.mp4"},
                "speechProgress": speech_progress,
                "microphonePermissionDenied": {"uiErrorVisible": True, "recordingsCreated": 0, "progressCreated": False},
                "recording": course_recording,
                "minioHead": minio_object,
                "minioHeadAfterLinkFailure": object_after_link_failure,
                "speechJobCount": speech_job_count,
                "uploadNetworkFailureCount": upload_fault["count"],
                "signedUrl403RetryCount": signed_expiry["count"],
                "courseLinkFailureCount": link_failure["count"],
                "recordingRetryIds": recording_init_ids,
                "practiceAttemptId": attempt_id,
                "practiceAttempt": persisted_runner,
                "practiceAttemptCountForActivity": runner_attempt_count,
                "runnerItemCount": runner_item_count,
                "runnerScoredAudioItemCount": runner_scored_audio_count,
                "runnerAssessmentReportCount": runner_report_count,
                "runnerRecordings": runner_recordings,
                "coursePracticeLink": course_practice_link,
                "practiceProgress": practice_progress,
                "runner": {
                    **runner_result,
                    "submitPosts": len(runner_submit_requests),
                    "courseCompletePosts": sum(event["method"] == "POST" and event["path"].endswith("/complete") for event in course_runner_requests),
                    "confirmationDismissals": 2,
                    "courseCompletionBackendStatuses": course_completion_faults["backendStatuses"],
                    "courseCompletionResponseDrops": len(course_completion_faults["backendStatuses"]),
                    "courseCompletionNetworkFailures": int(course_completion_faults["firstRequestAborted"]),
                    "pendingContextAfterInitialSyncFailure": pending_context,
                    "serverReadbackConfirmedProgress": practice_progress["completed"],
                    "returnNavigationCount": len(course_return_navigations),
                    "returnNavigationUrl": page.url,
                    "returnNavigationUrlEvents": course_return_navigations,
                    "beforeunloadDialogs": runner_dialogs,
                    "apiRequestEvents": course_runner_requests,
                    "apiResponses": [event for event in runner_api_responses if f"/assessments/sessions/{attempt_id}/submit" in event["path"] or f"/practice-attempts/{attempt_id}/complete" in event["path"]],
                    "refreshBusinessPosts": refresh_business_posts,
                    "attemptCountAfterRefresh": int(sql(f'''SELECT count(*) FROM "AssessmentSession" WHERE "courseSubmissionId"='{submission_id}' AND "courseActivityId"='{ids['practice']}';''')),
                    "recordingCountAfterRefresh": int(sql(f'''SELECT count(*) FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId" WHERE i."sessionId"='{attempt_id}';''')),
                },
                "microphoneSource": "SIMULATED_MIC (Chromium fake device; physical microphone not run)",
                "visualProof": visual_proof,
                "browserErrors": page_errors,
                "negativeStatuses": {"noteStale": stale.status, "progressStale": stale_progress.status, "recordingB": recording_b_response.status,
                                     "submissionB": submission_b_response.status, "progressB": progress_b_response.status,
                                     "activityWriteB": forbidden_attempt.status, "wrongSchool": 403, "anonymous": 401, "missingAssignment": 404,
                                     "courseSessionAnonymous": course_session_anonymous.status, "courseSessionStudentB": course_session_b.status,
                                     "courseSessionMissing": course_session_missing.status, "coursePracticeMismatch409": course_complete_mismatch.status},
            }
            assert page_errors == [], page_errors
            (EVIDENCE / "browser-proof.json").write_text(json.dumps(browser_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            page.screenshot(path=str(screenshot_dir / "runner-return-course-1280.png"), full_page=True)
        finally:
            context_a.close()
            browser.close()
