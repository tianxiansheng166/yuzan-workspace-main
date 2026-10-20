"""Native browser acceptance for teacher-authored course speech practice."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

import test_yz_rd_t048_teacher_speech_review as t048
import test_yz_rd_t008_student_history as t008


BASE = os.environ.get("YZ_T053_BASE_URL", "")
API_ROOT = os.environ.get("YZ_T053_API_BASE_URL", "").rstrip("/")
API = f"{API_ROOT}/api/v1" if API_ROOT else ""
DATABASE_URL = os.environ.get("YZ_T053_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T053_PASSWORD", "")
EVIDENCE = Path(os.environ.get("YZ_T053_EVIDENCE_DIR", "."))
SCHOOL_ID = t048.SCHOOL_ID
CLASS_ID = t048.CLASS_ID

pytestmark = pytest.mark.skipif(
    not BASE or not API or not DATABASE_URL or not PASSWORD,
    reason="requires the isolated YZ-RD-T053 native Chromium/API/PostgreSQL/MinIO runtime",
)


def payload(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def sql_rows(statement: str) -> list[list[str]]:
    return t048.sql_rows(statement)


def sql_scalar(statement: str) -> str:
    return t048.sql_scalar(statement)


def capture_viewports(page, name: str, heights=(844, 1024, 900, 1000)) -> list[dict[str, object]]:
    result = []
    for (width, height) in zip((390, 768, 1280, 1440), heights):
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(150)
        dimensions = page.evaluate("""() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          overflowNodes: [...document.querySelectorAll('body *')].flatMap(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || (rect.right <= innerWidth + 1 && rect.left >= -1)) return [];
            const style = getComputedStyle(element);
            return [{tag: element.tagName, id: element.id, className: String(element.className || ''), left: rect.left, right: rect.right, width: rect.width, position: style.position}];
          }).slice(0, 12),
        })""")
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(EVIDENCE / f"{name}-{width}.png"), full_page=True)
        assert max(dimensions["document"], dimensions["body"]) <= width + 1, {"width": width, **dimensions}
        result.append({"width": width, "height": height, **dimensions, "horizontalOverflow": False})
    return result


def find_activity(version: dict, activity_id: str) -> dict:
    return next(
        activity
        for unit in version["units"]
        for lesson in unit["lessons"]
        for activity in lesson["activities"]
        if activity["id"] == activity_id
    )


def browser_login(page, identifier: str) -> dict:
    session = t048.authenticate(page, identifier)
    page.goto(f"{BASE}/student/today/", wait_until="domcontentloaded")
    page.wait_for_function(
        "window.__studentTodayData !== undefined || document.querySelector('#todayApp[data-state=error]')",
        timeout=40_000,
    )
    return session


def complete_course_linked_attempt(page, student_headers: dict, attempt_id: str) -> dict:
    original_wait = page.wait_for_function

    def wait_for_audio_played(expression, *args, **kwargs):
        if expression == "document.querySelector('.audio-stimulus audio')?.currentTime > 0":
            expression = "document.querySelector('.audio-stimulus audio')?.played?.length > 0"
        return original_wait(expression, *args, **kwargs)

    page.wait_for_function = wait_for_audio_played
    try:
        completion = t008.complete_real_attempt(
            page,
            student_headers,
            attempt_id,
            base_url=BASE,
            submit=False,
            exercise_upload_retry=True,
        )
    finally:
        page.wait_for_function = original_wait

    submit_requests: list[str] = []
    page.on(
        "request",
        lambda request: submit_requests.append(request.url)
        if request.method == "POST" and request.url.endswith(f"/assessments/sessions/{attempt_id}/submit")
        else None,
    )
    page.locator("[data-submit]").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(timeout=10_000)
    assert f"已完成 {completion['itemCount']} / {completion['itemCount']} 题" in dialog.inner_text(), dialog.inner_text()
    dialog.get_by_role("button", name="确认交卷", exact=True).click()
    page.wait_for_url(re.compile(r".*/student/courses/course-detail/.*"), timeout=60_000)
    assert len(submit_requests) == 1, submit_requests
    duplicate = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/submit",
        headers=student_headers,
        data={},
    )
    assert duplicate.ok, duplicate.text()
    assert payload(duplicate)["id"] == attempt_id
    completion["submitPosts"] = len(submit_requests)
    completion["duplicateSubmitId"] = payload(duplicate)["id"]
    return completion


@pytest.fixture(scope="module")
def t053_native_flow():
    t048.verify_runtime_identity()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    student = t048.create_student_fixture("T053课程闭环", CLASS_ID)
    teacher_other = t048.create_teacher_fixture("T053跨班")
    student_other = t048.create_student_fixture("T053非授权班", teacher_other["class"])
    foreign_teacher = t048.create_cross_school_teacher()
    page_errors: list[str] = []
    proof: dict[str, object] = {
        "task": "YZ-RD-T053",
        "fixturePolicy": "TEST_FIXTURE_ONLY; no real student records",
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("YZ_T053_CHROMIUM", "/usr/bin/google-chrome"),
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["microphone"],
            has_touch=True,
        )
        context.add_init_script("window.__yuzanRunnerMicrophoneSource = 'SIMULATED_MIC';")
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(type(error).__name__))
        try:
            teacher = t048.authenticate(page, "teacher.test")
            teacher_headers = t048.headers(teacher)
            teacher_id = teacher["user"]["id"]

            # Create a new course version and its speech/practice activities in the teacher UI.
            page.goto(f"{BASE}/teacher/courses/spring/studio/", wait_until="domcontentloaded")
            expect(page.locator("[data-action='new-course']")).to_be_visible(timeout=30_000)
            title = f"TEST_FIXTURE_ONLY T053 听说课程 {uuid.uuid4().hex[:8]}"
            objective = "听辨示范音频，朗读目标文本，并完成关联的正式听说练习。"
            page.locator("[data-action='new-course']").click()
            page.locator("#createCourseDialog").wait_for(state="visible")
            page.locator("#createCourseForm [name='title']").fill(title)
            page.locator("#createCourseForm [name='objective']").fill(objective)
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.split("?", 1)[0].endswith("/course-versions")
            ) as created_response:
                page.locator("#createCourseForm [type='submit']").click()
            created = payload(created_response.value)
            course_version_id = created["id"]
            expect(page.locator("[data-bind='course-title']")).to_have_text(title, timeout=30_000)
            expect(page.locator("[data-bind='status-label']")).to_have_text("课程草稿")
            course_practice_options = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/course-versions/{course_version_id}/practice-options",
                headers=teacher_headers,
            )
            assert course_practice_options.ok, course_practice_options.text()
            options = payload(course_practice_options)
            level_one_practice = next(
                (option for option in options if option["title"] == "国家通用语言文字能力｜水平一级综合测评"),
                None,
            )
            assert level_one_practice and level_one_practice["requiresRecording"] is True, options
            practice_definition_id = level_one_practice["id"]

            page.locator("[data-action='add-unit']").click()
            page.locator("[data-action='add-activity']").click()
            speech_title = "朗读春日观察句"
            speech_text = "春风沿着山脊吹向河谷，雪水在石间汇成清亮的小溪。"
            speech_instruction = "先听辨句子节奏，再录下自己的朗读并试听。"
            page.locator("#createActivityForm [name='type']").select_option("SPEECH")
            page.locator("#createActivityForm [name='title']").fill(speech_title)
            page.locator("#createActivityForm [name='instruction']").fill(speech_instruction)
            page.locator("#createActivityForm [name='targetText']").fill(speech_text)
            page.locator("#createActivityForm [name='teacherNotes']").fill("听辨句间停顿，提示学生放慢句尾。")
            page.locator("#createActivityForm [name='studentNotes']").fill("先试听示范，再朗读并试听自己的录音。")
            page.locator("#createActivityForm [type='submit']").click()
            speech_row = page.locator("[data-bind='structure-tree'] p.activity").filter(has_text=speech_title)
            expect(speech_row).to_be_visible()

            page.locator("[data-action='add-activity']").click()
            practice_title = "本课正式听说练习"
            page.locator("#createActivityForm [name='type']").select_option("CHOICE")
            page.locator("#createActivityForm [name='title']").fill(practice_title)
            page.locator("#createActivityForm [name='instruction']").fill("进入本校已发布的正式听说练习并完成提交。")
            page.locator("#createActivityForm [name='teacherNotes']").fill("复核学生录音后再查看正式报告。")
            page.locator("#createActivityForm [name='studentNotes']").fill("完成录音题并提交，教师复核后可查看正式报告。")
            page.locator("#createActivityForm [type='submit']").click()
            practice_row = page.locator("[data-bind='structure-tree'] p.activity").filter(has_text=practice_title)
            expect(practice_row).to_be_visible()

            with page.expect_response(
                lambda response: response.request.method == "PATCH"
                and response.url.split("?", 1)[0].endswith(f"/course-versions/{course_version_id}")
            ) as saved_response:
                page.keyboard.press("Control+s")
            assert saved_response.value.status == 200, saved_response.value.text()
            saved_version = payload(saved_response.value)
            speech_activity = next(
                activity
                for unit in saved_version["units"]
                for lesson in unit["lessons"]
                for activity in lesson["activities"]
                if activity["title"] == speech_title
            )
            practice_activity = next(
                activity
                for unit in saved_version["units"]
                for lesson in unit["lessons"]
                for activity in lesson["activities"]
                if activity["title"] == practice_title
            )
            speech_activity_id = speech_activity["id"]
            practice_activity_id = practice_activity["id"]
            saved_at_before_relation = saved_version["updatedAt"]

            practice_row.click()
            page.locator("button[data-tab='interaction']").click()
            selector = page.locator("[data-course-practice-definition]")
            expect(selector).to_be_enabled()
            selector.select_option(practice_definition_id)
            save_relation_button = page.locator("[data-action='save-course-practice']")
            expect(save_relation_button).to_be_enabled()
            relation_url = (
                f"{API}/schools/{SCHOOL_ID}/course-versions/{course_version_id}"
                f"/activities/{practice_activity_id}/practice"
            )
            try:
                with page.expect_response(
                    lambda response: response.request.method == "PUT"
                    and response.url.split("?", 1)[0].endswith(
                        f"/course-versions/{course_version_id}/activities/{practice_activity_id}/practice"
                    ),
                    timeout=10_000,
                ) as relation_response:
                    save_relation_button.click()
            except Exception:
                editor_state = page.evaluate("""() => ({
                  selectedActivityId: document.querySelector('[data-bind="editor-head"]')?.textContent,
                  status: document.querySelector('[data-bind="status-label"]')?.textContent,
                  selectedPracticeId: document.querySelector('[data-course-practice-definition]')?.value,
                  practiceOptions: [...(document.querySelector('[data-course-practice-definition]')?.options || [])].map(option => option.value),
                  saveButton: (() => { const button = document.querySelector('[data-action="save-course-practice"]'); return button && {disabled: button.disabled, text: button.textContent}; })(),
                  currentRelation: document.querySelector('[data-bind="course-practice-current"]')?.textContent,
                  toast: document.querySelector('[role="status"], .toast')?.textContent
                })""")
                print("T053 relation authoring debug:", json.dumps({"url": relation_url, "state": editor_state, "pageErrors": page_errors}, ensure_ascii=False))
                raise
            assert relation_response.value.status == 200, relation_response.value.text()
            relation = payload(relation_response.value)
            expect(page.locator("[data-bind='course-practice-current']")).to_contain_text(relation["title"])

            anonymous = playwright.request.new_context()
            try:
                anonymous_write = anonymous.put(relation_url, data={
                    "practiceDefinitionId": practice_definition_id,
                    "required": True,
                    "expectedUpdatedAt": saved_at_before_relation,
                })
                assert anonymous_write.status == 401
            finally:
                anonymous.dispose()

            student_headers = t048.headers(t048.login_api(page, student["login"]))
            student_write = page.request.put(relation_url, headers=student_headers, data={
                "practiceDefinitionId": practice_definition_id,
                "required": True,
                "expectedUpdatedAt": saved_at_before_relation,
            })
            hidden_options = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/course-versions/{course_version_id}/practice-options",
                headers=student_headers,
            )
            assert student_write.status == hidden_options.status == 403
            wrong_school = page.request.put(
                f"{API}/schools/22222222-2222-4222-8222-222222222222/course-versions/{course_version_id}"
                f"/activities/{practice_activity_id}/practice",
                headers=teacher_headers,
                data={"practiceDefinitionId": practice_definition_id, "required": True, "expectedUpdatedAt": saved_at_before_relation},
            )
            missing_activity = page.request.put(
                relation_url.replace(practice_activity_id, "00000000-0000-4000-8000-000000000099"),
                headers=teacher_headers,
                data={"practiceDefinitionId": practice_definition_id, "required": True, "expectedUpdatedAt": saved_at_before_relation},
            )
            stale_write = page.request.put(relation_url, headers=teacher_headers, data={
                "practiceDefinitionId": practice_definition_id,
                "required": False,
                "expectedUpdatedAt": saved_at_before_relation,
            })
            assert wrong_school.status == 403
            assert missing_activity.status == 404
            assert stale_write.status == 409

            relation_row = json.loads(sql_scalar(
                f'''SELECT json_build_object('id',id,'schoolId',"schoolId",'activityId',"activityId",
                     'practiceDefinitionId',"practiceDefinitionId",'required',required,
                     'relationCount',(SELECT count(*) FROM "CourseActivityPractice" WHERE "activityId"={q(practice_activity_id)}))::text
                    FROM "CourseActivityPractice" WHERE "activityId"={q(practice_activity_id)};'''
            ))
            assert relation_row["schoolId"] == SCHOOL_ID
            assert relation_row["practiceDefinitionId"] == practice_definition_id
            assert relation_row["required"] is True and relation_row["relationCount"] == 1
            teacher_studio_viewports = capture_viewports(page, "teacher-course-studio")
            page.set_viewport_size({"width": 1440, "height": 1000})

            with page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.split("?", 1)[0].endswith(f"/course-versions/{course_version_id}/publish")
            ) as publish_response:
                page.locator("[data-action='publish-course-version']").click()
            assert publish_response.value.status == 200, publish_response.value.text()
            expect(page.locator("[data-bind='status-label']")).to_have_text("已发布", timeout=20_000)
            published = payload(publish_response.value)
            assert published["status"] == "PUBLISHED"
            immutable_write = page.request.put(relation_url, headers=teacher_headers, data={
                "practiceDefinitionId": practice_definition_id,
                "required": True,
                "expectedUpdatedAt": relation.get("courseVersionUpdatedAt", saved_at_before_relation),
            })
            assert immutable_write.status == 409

            page.goto(f"{BASE}/teacher/assignments/?new=1", wait_until="domcontentloaded")
            expect(page.locator("#taskForm select[name='courseVersionId'] option").filter(has_text=title)).to_have_count(1, timeout=30_000)
            page.locator("#taskForm [name='title']").fill(f"TEST_FIXTURE_ONLY T053 听说任务 {uuid.uuid4().hex[:8]}")
            page.locator("#taskForm [name='courseVersionId']").select_option(course_version_id)
            page.locator("#taskForm [name='classId']").select_option(CLASS_ID)
            with page.expect_response(
                lambda response: response.request.method == "POST" and response.url.split("?", 1)[0].endswith("/assignments")
            ) as assignment_response:
                page.locator("#taskForm .save").click()
            assignment = payload(assignment_response.value)
            assert assignment_response.value.status in (200, 201)
            assignment_id = assignment["id"]
            row = page.locator(f".row[data-id='{assignment_id}']")
            expect(row).to_have_attribute("data-status", "DRAFT", timeout=30_000)
            if not page.locator(f".row[data-id='{assignment_id}'] + .dynamic-detail").count():
                row.click()
            schedule_button = page.locator(f".row[data-id='{assignment_id}'] + .dynamic-detail [data-transition='schedule']")
            expect(schedule_button).to_be_visible(timeout=20_000)
            schedule_button.click()
            expect(page.locator(f".row[data-id='{assignment_id}']")).to_have_attribute("data-status", "SCHEDULED", timeout=30_000)
            row = page.locator(f".row[data-id='{assignment_id}']")
            row.click()
            open_button = page.locator(f".row[data-id='{assignment_id}'] + .dynamic-detail [data-transition='open']")
            expect(open_button).to_be_visible(timeout=20_000)
            open_button.click()
            expect(page.locator(f".row[data-id='{assignment_id}']")).to_have_attribute("data-status", "OPEN", timeout=30_000)
            assignment_read = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assignments/{assignment_id}", headers=teacher_headers
            )
            assert assignment_read.ok
            opened_assignment = payload(assignment_read)
            assert opened_assignment["status"] == "OPEN"
            assert any(target.get("classId") == CLASS_ID for target in opened_assignment["targets"])
            teacher_ui_viewports = capture_viewports(page, "teacher-assignment-published")

            # An unrelated student in another class cannot open the published course assignment.
            other_student_headers = t048.headers(t048.login_api(page, student_other["login"]))
            other_course = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/student/courses/{assignment_id}", headers=other_student_headers
            )
            assert other_course.status in (403, 404)

            student_session = browser_login(page, student["login"])
            student_headers = t048.headers(student_session)
            today_data = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/student/today", headers=student_headers
            )
            assert today_data.ok
            expect(page.locator(".today-primary")).to_be_visible(timeout=20_000)
            assert page.locator(".today-skill-card").count() == 0
            today_course_link = page.locator(f".today-course-item a[href*='{assignment_id}']")
            expect(today_course_link).to_be_visible(timeout=30_000)
            today_viewports = capture_viewports(page, "student-today")
            today_course_link.click()
            page.wait_for_url(f"**/student/courses/course-detail/?id={assignment_id}", timeout=30_000)
            page.locator("#cpMain").wait_for(state="visible", timeout=30_000)
            expect(page.locator("#cpHeroTitle")).to_contain_text(title)
            submission_id = page.evaluate("window.CoursePlayerState.getState().submissionId")
            assert submission_id
            course_detail_viewports = capture_viewports(page, "student-course-detail")
            page.set_viewport_size({"width": 1440, "height": 1000})

            speech_entry = page.locator(f".cp-dir-item[data-activity-id='{speech_activity_id}']")
            expect(speech_entry).to_be_visible(timeout=20_000)
            speech_entry.click()
            page.wait_for_url(f"**/activities/{speech_activity_id}", timeout=30_000)
            expect(page.locator("#activityType")).to_have_text("口语")
            expect(page.locator("#activityContent blockquote")).to_contain_text(speech_text)
            course_speech_viewports = capture_viewports(page, "student-course-speech")

            course_recording_inits: list[str] = []

            def capture_course_recording(response):
                if response.request.method != "POST" or not response.url.split("?", 1)[0].endswith("/recordings/simple"):
                    return
                if response.ok:
                    course_recording_inits.append(str(payload(response)["id"]))

            page.on("response", capture_course_recording)
            recorder = page.locator("#courseRecorder")
            expect(recorder).to_be_visible()
            recorder.locator(".vr-action").click()
            page.wait_for_function("document.querySelector('#courseRecorder')?.__voiceRecorder?.state === 'recording'", timeout=15_000)
            page.wait_for_timeout(2_000)
            recorder.locator(".vr-action").click()
            page.locator("#finishCourseRecording").click()
            page.wait_for_function("document.querySelector('#courseRecorder')?.__voiceRecorder?.blob?.size > 0", timeout=15_000)
            page.locator("#previewCourseRecording").click()
            page.wait_for_function("document.querySelector('#courseRecorder .vr-hidden-audio')?.paused === false", timeout=10_000)
            page.locator("#previewCourseRecording").click()
            page.wait_for_function("document.querySelector('#courseRecorder .vr-hidden-audio')?.paused === true", timeout=10_000)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=40_000)
            page.remove_listener("response", capture_course_recording)
            assert len(course_recording_inits) == 1, course_recording_inits
            course_recording_id = course_recording_inits[0]
            course_recording_row = json.loads(sql_scalar(
                f'''SELECT json_build_object('id',id,'objectKey',"objectKey",'mimeType',"mimeType",'status',status::text)::text
                    FROM "Recording" WHERE id={q(course_recording_id)} AND "submissionId"={q(submission_id)};'''
            ))
            course_recording_object = t048.minio_head_object(course_recording_row["objectKey"])
            assert course_recording_object.get("bytes", 0) > 0
            assert course_recording_object.get("contentType", "").startswith("audio/")

            practice_entry = page.locator(f"#chapterPath a[href$='/{practice_activity_id}']")
            expect(practice_entry).to_be_visible(timeout=20_000)
            practice_entry.click()
            page.wait_for_url(f"**/activities/{practice_activity_id}", timeout=20_000)
            page.locator("#launchPractice").click()
            page.wait_for_url("**/student/practices/attempts/*/prepare/**", timeout=30_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            attempt_read = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/attempts/{attempt_id}", headers=student_headers
            )
            assert attempt_read.ok, attempt_read.text()
            attempt_context = payload(attempt_read)
            assert attempt_context["courseSubmissionId"] == submission_id
            assert attempt_context["courseActivityId"] == practice_activity_id
            page.locator("[data-start-session]").click()
            page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/runner/", timeout=30_000)
            runner_viewports = capture_viewports(page, "student-course-practice-runner")
            page.set_viewport_size({"width": 1440, "height": 1000})
            completion = complete_course_linked_attempt(page, student_headers, attempt_id)
            assert completion["itemCount"] == 20
            assert completion["recordedAudio"] >= 4
            assert completion["uploadRetries"] == completion["recordedAudio"]
            assert completion["submitPosts"] == 1

            attempt_rows = sql_rows(
                f'''SELECT s.status::text,s."schoolId",e."userId",s."courseSubmissionId",s."courseActivityId"
                    FROM "AssessmentSession" s JOIN "Enrollment" e ON e.id=s."enrollmentId"
                    WHERE s.id={q(attempt_id)};'''
            )
            assert len(attempt_rows) == 1
            assert attempt_rows[0] == ["PROCESSING", SCHOOL_ID, student["user"], submission_id, practice_activity_id]
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            pending_recordings = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r."mimeType",r.status::text
                    FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                    WHERE i."sessionId"={q(attempt_id)} ORDER BY i."sortOrder";'''
            )
            assert pending_recordings and all(row[3].startswith("audio/") for row in pending_recordings)
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)}
                    AND "recordingId" IS NOT NULL AND "scoredScore" IS NOT NULL;'''
            ) == "0"
            practice_recording_objects = []
            for item_id, recording_id, object_key, mime_type, recording_status in pending_recordings:
                assert recording_status in {"READY", "PROCESSING", "COMPLETE"}
                head = t048.minio_head_object(object_key)
                assert head.get("bytes", 0) > 0 and head.get("contentType", "").startswith("audio/")
                practice_recording_objects.append({
                    "itemId": item_id,
                    "recordingId": recording_id,
                    "bytes": head["bytes"],
                    "contentType": head["contentType"],
                })
            no_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report", headers=student_headers
            )
            assert no_report.ok and payload(no_report) is None

            proof.update({
                "teacherUserId": teacher_id,
                "teacherAuthoring": {
                    "courseVersionId": course_version_id,
                    "courseVersionTitle": title,
                    "courseActivityIds": {"speech": speech_activity_id, "practice": practice_activity_id},
                    "createdThroughStudioUi": True,
                    "savedThroughCourseVersionPatch": saved_response.value.status,
                    "practiceDefinitionId": practice_definition_id,
                    "practiceTitle": level_one_practice["title"],
                    "practiceRelationStatus": relation_response.value.status,
                    "practiceRelationDatabaseRow": relation_row,
                    "publishStatus": published["status"],
                },
                "publication": {
                    "assignmentId": assignment_id,
                    "assignmentStatus": opened_assignment["status"],
                    "authorizedClassId": CLASS_ID,
                    "teacherUiCreatedAndOpened": True,
                },
                "authorizationStatuses": {
                    "anonymousPracticeLinkWrite": anonymous_write.status,
                    "studentPracticeLinkWrite": student_write.status,
                    "studentPracticeOptions": hidden_options.status,
                    "crossSchoolPracticeLinkWrite": wrong_school.status,
                    "missingActivityPracticeLinkWrite": missing_activity.status,
                    "stalePracticeLinkWrite": stale_write.status,
                    "publishedPracticeLinkWrite": immutable_write.status,
                    "otherClassStudentCourseRead": other_course.status,
                },
                "student": {
                    "userId": student["user"],
                    "enrollmentId": student["enrollment"],
                    "todayCourseAssignmentId": assignment_id,
                    "submissionId": submission_id,
                    "courseRecordingId": course_recording_id,
                    "courseRecording": course_recording_row,
                    "courseRecordingMinioHead": course_recording_object,
                    "practiceAttemptId": attempt_id,
                    "attemptContext": attempt_context,
                    "attemptStateBeforeReview": attempt_rows[0][0],
                    "practiceRecordingObjects": practice_recording_objects,
                    "runnerCompletion": completion,
                    "reportBeforeReview": payload(no_report),
                },
                "viewports": {
                    "teacherCourseStudio": teacher_studio_viewports,
                    "teacherAssignments": teacher_ui_viewports,
                    "studentToday": today_viewports,
                    "studentCourseDetail": course_detail_viewports,
                    "courseSpeech": course_speech_viewports,
                    "coursePracticeRunner": runner_viewports,
                },
                "pageErrors": page_errors,
            })
            (EVIDENCE / "t053-course-speech-proof.json").write_text(
                json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            yield {
                "playwright": playwright,
                "browser": browser,
                "context": context,
                "page": page,
                "student": student,
                "student_other": student_other,
                "teacher_other": teacher_other,
                "foreign_teacher": foreign_teacher,
                "teacher_headers": teacher_headers,
                "student_headers": student_headers,
                "assignment_id": assignment_id,
                "course_version_id": course_version_id,
                "practice_activity_id": practice_activity_id,
                "submission_id": submission_id,
                "attempt_id": attempt_id,
                "speech_title": speech_title,
                "course_title": title,
                "proof": proof,
                "page_errors": page_errors,
            }
        finally:
            context.close()
            browser.close()


def test_t053_teacher_authors_links_and_opens_course_then_student_submits_speech(t053_native_flow):
    flow = t053_native_flow
    proof = flow["proof"]
    assert proof["teacherAuthoring"]["createdThroughStudioUi"] is True
    assert proof["teacherAuthoring"]["practiceRelationStatus"] == 200
    assert proof["teacherAuthoring"]["publishStatus"] == "PUBLISHED"
    assert proof["publication"]["assignmentStatus"] == "OPEN"
    assert proof["student"]["attemptStateBeforeReview"] == "PROCESSING"
    assert proof["student"]["runnerCompletion"]["recordedAudio"] >= 1
    assert proof["student"]["reportBeforeReview"] is None
    assert proof["authorizationStatuses"] == {
        "anonymousPracticeLinkWrite": 401,
        "studentPracticeLinkWrite": 403,
        "studentPracticeOptions": 403,
        "crossSchoolPracticeLinkWrite": 403,
        "missingActivityPracticeLinkWrite": 404,
        "stalePracticeLinkWrite": 409,
        "publishedPracticeLinkWrite": 409,
        "otherClassStudentCourseRead": proof["authorizationStatuses"]["otherClassStudentCourseRead"],
    }
    assert proof["authorizationStatuses"]["otherClassStudentCourseRead"] in (403, 404)


def test_t053_teacher_reviews_course_linked_audio_and_student_reads_same_report(t053_native_flow):
    flow = t053_native_flow
    page = flow["page"]
    student = flow["student"]
    attempt_id = flow["attempt_id"]
    student_name = student["name"]
    proof = flow["proof"]

    anonymous = flow["playwright"].request.new_context()
    try:
        anonymous_queue = anonymous.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews")
        assert anonymous_queue.status == 401
    finally:
        anonymous.dispose()
    student_queue = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=flow["student_headers"]
    )
    assert student_queue.status == 403
    initial_queue = t048.item_queue(page.request, flow["teacher_headers"], student_name)
    assert initial_queue and any(item["strategy"] == "SPEECH_READING" for item in initial_queue)
    audio_item = next(item for item in initial_queue if item["strategy"] == "SPEECH_READING")
    audio_id = audio_item["itemId"]
    review_url = f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}"
    student_write = page.request.put(review_url, headers=flow["student_headers"], data={"score": 0, "comment": "TEST_FIXTURE_ONLY"})
    missing_review = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{uuid.uuid4()}", headers=flow["teacher_headers"]
    )
    other_teacher = t048.login_api(page, flow["teacher_other"]["login"])
    cross_class_review = page.request.get(
        review_url, headers=t048.headers(other_teacher)
    )
    foreign_teacher = t048.login_api(page, flow["foreign_teacher"]["login"])
    cross_school_review = page.request.get(
        review_url, headers=t048.headers(foreign_teacher)
    )
    assert student_write.status == 403
    assert missing_review.status == 404
    assert cross_class_review.status == cross_school_review.status == 403

    assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
    teacher = t048.authenticate(page, "teacher.test")
    teacher_headers = t048.headers(teacher)
    manual_reviews = []
    comments: dict[str, str] = {}
    for index, item in enumerate(initial_queue):
        item_id = item["itemId"]
        page.goto(f"{BASE}/teacher/reviews/", wait_until="domcontentloaded")
        page.locator("[data-student-filter]").fill(student_name)
        row = page.locator(f'.review-row[href^="/teacher/reviews/{item_id}"]')
        row.wait_for(timeout=20_000)
        if item_id == audio_id:
            capture_viewports(page, "teacher-review-queue")
        row.click()
        t048.wait_for_review_item(page, item_id)
        if item_id == audio_id:
            page.wait_for_function("document.querySelector('[data-review-audio]')?.readyState >= 3", timeout=30_000)
            player = page.locator("[data-review-audio]")
            player.evaluate("audio => { audio.muted = true; return audio.play(); }")
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            player.evaluate("audio => audio.pause()")
            expect(page.locator("[data-audio-state]")).to_contain_text("录音已暂停")
            page.locator("[data-audio-replay]").click()
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            player.evaluate("audio => audio.pause()")
            capture_viewports(page, "teacher-review-detail")

        score = page.locator("[data-review-score]")
        expect(score).to_be_visible()
        score.fill("0")
        comment = (
            "听音复核：按本题人工量表核对了实际录音。\n"
            f"教学建议：继续练习句间停顿（题目 {index + 1}）。"
        )
        page.locator("[data-review-comment]").fill(comment)
        page.locator("[data-review-submit]").click()
        page.get_by_text("服务器已保存正式得分 0 分").wait_for(timeout=20_000)
        manual_reviews.append({"itemId": item_id, "score": 0, "reviewerUserId": teacher["user"]["id"]})
        comments[item_id] = comment

    report_rows = sql_rows(
        f'''SELECT r.id,r."overallScore"::text,s.status::text,s.purpose::text
            FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId"
            WHERE r."sessionId"={q(attempt_id)};'''
    )
    assert len(report_rows) == 1 and report_rows[0][2:] == ["COMPLETED", "STANDARD"], report_rows
    report_id = report_rows[0][0]
    reviewed = sql_rows(
        f'''SELECT i."scoredScore"::text,i."reviewerUserId",i.status::text
            FROM "AssessmentItem" i JOIN "QuestionBankItemVersion" qv ON qv.id=i."questionVersionId"
            WHERE i."sessionId"={q(attempt_id)} AND qv."scoringSpec"->>'strategy'='SPEECH_READING';'''
    )
    assert reviewed and all(row == ["0", teacher["user"]["id"], "REVIEWED"] for row in reviewed), reviewed

    student_session = browser_login(page, student["login"])
    student_headers = t048.headers(student_session)
    page.goto(f"{BASE}/student/practices/history/", wait_until="domcontentloaded")
    history_row = page.locator(f"[data-history-session='{attempt_id}']")
    history_row.wait_for(timeout=30_000)
    report_link = history_row.get_by_role("link", name="查看正式报告")
    report_href = report_link.get_attribute("href")
    assert report_href and attempt_id in report_href and report_href.endswith("/report/")
    report_link.click()
    page.wait_for_url(f"**{report_href}", timeout=20_000)
    page.locator("[data-report-teacher-feedback]").wait_for(timeout=20_000)
    student_report_response = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report", headers=student_headers
    )
    assert student_report_response.ok
    student_report = payload(student_report_response)
    assert student_report["id"] == report_id
    assert {entry["comment"] for entry in student_report["teacherFeedback"]} == set(comments.values())
    report_viewports = capture_viewports(page, "student-course-formal-report")
    other_student = t048.login_api(page, flow["student_other"]["login"])
    foreign_report = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
        headers=t048.headers(other_student),
    )
    foreign_history = page.request.get(
        f"{API}/schools/{SCHOOL_ID}/assessments/history?enrollmentId={student['enrollment']}",
        headers=t048.headers(other_student),
    )
    assert foreign_report.status in (403, 404) and foreign_history.status == 403
    assert flow["page_errors"] == [], flow["page_errors"]

    proof.update({
        "manualReview": {
            "queueItemCount": len(initial_queue),
            "teacherHeardRecording": True,
            "teacherReplayedRecording": True,
            "reviewedItems": manual_reviews,
            "reportCountBeforeReview": 0,
            "reportId": report_id,
            "reportOverallScore": student_report["overallScore"],
            "studentOpenedSameReportFromHistory": True,
            "studentReportViewports": report_viewports,
            "authorizationStatuses": {
                "anonymousReviewQueue": anonymous_queue.status,
                "studentReviewQueue": student_queue.status,
                "studentReviewWrite": student_write.status,
                "missingReviewDetail": missing_review.status,
                "crossClassTeacherReview": cross_class_review.status,
                "crossSchoolTeacherReview": cross_school_review.status,
                "otherStudentReport": foreign_report.status,
                "otherStudentHistory": foreign_history.status,
            },
        },
        "pageErrors": flow["page_errors"],
    })
    (EVIDENCE / "t053-course-speech-proof.json").write_text(
        json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
