"""T049 teacher authoring to authorized course practice acceptance flow."""

from __future__ import annotations

import json
import os
import re
import runpy
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
T022_E2E = ROOT / "evidence" / "yz-rd-t022" / "course_activity_e2e.py"
BASE = os.environ["YZ_T049_BASE_URL"]
API = os.environ["YZ_T049_API_BASE_URL"]
EVIDENCE = Path(os.environ["YZ_T049_EVIDENCE_DIR"])
SCHOOL = "11111111-1111-4111-8111-111111111111"


def response_body(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def find_activity(course_version, activity_id):
    return next(
        activity
        for unit in course_version["units"]
        for lesson in unit["lessons"]
        for activity in lesson["activities"]
        if activity["id"] == activity_id
    )


def create_t049_teacher_course(page, helper, screenshots, playwright):
    teacher = helper["login"](page.request, "teacher.test")
    teacher_auth = helper["headers"](teacher)
    prefix = f"{API}/api/v1/schools/{SCHOOL}"
    tag = uuid.uuid4().hex[:8]
    practice_definition_id = "70000000-0000-4000-8000-000000000003"
    objective = helper["bilingual"](
        "阅读高原春日课文，听辨真实音频，完成正式练习并记录学习笔记。"
    )
    created = page.request.post(
        f"{prefix}/course-versions",
        headers=teacher_auth,
        data={
            "title": f"T049 高原春声 {tag}",
            "description": "隔离验收课程，由教师通过正式课程版本 API 创建。",
            "gradeBand": "七年级",
            "coverAsset": "/assets/generated-covers/course-spring-reading.png",
            "objectives": [objective],
        },
    )
    assert created.ok, f"teacher course draft create failed with HTTP {created.status}: {created.text()}"
    course = response_body(created)
    draft_response = page.request.get(f"{prefix}/course-versions/{course['id']}", headers=teacher_auth)
    assert draft_response.ok, f"teacher course draft read failed with HTTP {draft_response.status}"
    draft = response_body(draft_response)

    ids = {name: str(uuid.uuid4()) for name in ("unit", "lesson", "text", "audio", "video", "missing_video", "choice", "fill", "speech", "practice")}
    make_activity = helper["make_activity"]
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
        headers=teacher_auth,
        data={"expectedUpdatedAt": draft["updatedAt"], "units": units, "coverAsset": "/assets/generated-covers/course-spring-reading.png"},
    )
    assert updated.ok, f"teacher course content update failed with HTTP {updated.status}: {updated.text()}"
    draft = response_body(updated)

    options_response = page.request.get(
        f"{prefix}/course-versions/{course['id']}/practice-options",
        headers=teacher_auth,
    )
    assert options_response.ok, f"teacher practice options returned HTTP {options_response.status}"
    options = response_body(options_response)
    option = next((item for item in options if item["id"] == practice_definition_id), None)
    assert option, "the seeded, published course practice was not returned by the authoring API"

    link_url = f"{prefix}/course-versions/{course['id']}/activities/{ids['practice']}/practice"
    write_body = {
        "practiceDefinitionId": practice_definition_id,
        "required": True,
        "expectedUpdatedAt": draft["updatedAt"],
    }
    anonymous_request = playwright.request.new_context()
    unauthorized = anonymous_request.put(link_url, data=write_body)
    anonymous_request.dispose()
    assert unauthorized.status == 401, f"unauthenticated relation write returned {unauthorized.status}"

    student = helper["login"](page.request, "student.test")
    student_auth = helper["headers"](student)
    forbidden = page.request.put(link_url, headers=student_auth, data=write_body)
    assert forbidden.status == 403, f"student relation write returned {forbidden.status}"
    hidden_options = page.request.get(
        f"{prefix}/course-versions/{course['id']}/practice-options",
        headers=student_auth,
    )
    assert hidden_options.status == 403, f"student practice option read returned {hidden_options.status}"
    wrong_school = page.request.put(
        f"{API}/api/v1/schools/22222222-2222-4222-8222-222222222222/course-versions/{course['id']}/activities/{ids['practice']}/practice",
        headers=teacher_auth,
        data=write_body,
    )
    assert wrong_school.status == 403, f"cross-school relation write returned {wrong_school.status}"
    missing_activity = page.request.put(
        f"{prefix}/course-versions/{course['id']}/activities/00000000-0000-4000-8000-000000000099/practice",
        headers=teacher_auth,
        data=write_body,
    )
    assert missing_activity.status == 404, f"unknown activity relation write returned {missing_activity.status}"

    # This real, unrelated Attempt exists before the course relation is written.
    student_b = helper["make_student_b"]()
    student_b_session = helper["login"](page.request, student_b["loginIdentifier"])
    prior_attempt_response = page.request.post(
        f"{prefix}/practices/{practice_definition_id}/attempts",
        headers=helper["headers"](student_b_session),
        data={},
    )
    assert prior_attempt_response.ok, f"pre-existing practice Attempt returned HTTP {prior_attempt_response.status}: {prior_attempt_response.text()}"
    prior_attempt_id = response_body(prior_attempt_response)["attemptId"]

    def read_prior_attempt():
        row = helper["sql"](
            f'''SELECT json_build_object('id',id,'status',status,'practiceDefinitionId',"practiceDefinitionId",'courseSubmissionId',"courseSubmissionId",'courseActivityId',"courseActivityId")::text
                FROM "AssessmentSession" WHERE id='{prior_attempt_id}';'''
        )
        return json.loads(row)

    prior_attempt_before = read_prior_attempt()
    assert prior_attempt_before["courseSubmissionId"] is None
    assert prior_attempt_before["courseActivityId"] is None

    helper["login_ui"](page, "teacher.test")
    page.goto(
        f"{BASE}/teacher/courses/spring/studio/?courseVersionId={course['id']}",
        wait_until="domcontentloaded",
    )
    expect(page.locator('[data-bind="course-title"]')).to_have_text(course["title"], timeout=30_000)
    activity_row = page.locator('[data-bind="structure-tree"] p.activity').filter(has_text="停顿与节奏正式练习")
    expect(activity_row).to_be_visible(timeout=20_000)
    activity_row.click()
    page.locator('button[data-tab="interaction"]').click()
    selector = page.locator("[data-course-practice-definition]")
    expect(selector).to_be_visible()
    selector.select_option(practice_definition_id)
    save = page.locator('[data-action="save-course-practice"]')
    expect(save).to_be_enabled()
    ui_write_responses = []
    page.on(
        "response",
        lambda response: ui_write_responses.append(response.status)
        if response.request.method == "PUT" and response.url.split("?", 1)[0].endswith(f"/activities/{ids['practice']}/practice")
        else None,
    )
    save.click()
    expect(page.locator('[data-bind="course-practice-current"]')).to_contain_text(option["title"], timeout=20_000)
    expect(page.locator('[data-action="save-course-practice"]')).to_have_text("已保存")
    assert ui_write_responses == [200], ui_write_responses

    saved_response = page.request.get(f"{prefix}/course-versions/{course['id']}", headers=teacher_auth)
    assert saved_response.ok
    saved_version = response_body(saved_response)
    saved_reference = find_activity(saved_version, ids["practice"])["practiceReference"]
    assert saved_reference == {
        "practiceDefinitionId": practice_definition_id,
        "title": option["title"],
        "required": True,
    }, saved_reference
    relation_row = json.loads(helper["sql"](
        f'''SELECT json_build_object('id',id,'schoolId',"schoolId",'activityId',"activityId",'practiceDefinitionId',"practiceDefinitionId",'required',required,
                    'relationCount',(SELECT count(*) FROM "CourseActivityPractice" WHERE "activityId"='{ids['practice']}'))::text
            FROM "CourseActivityPractice" WHERE "activityId"='{ids['practice']}';'''
    ))
    assert relation_row["schoolId"] == SCHOOL
    assert relation_row["activityId"] == ids["practice"]
    assert relation_row["practiceDefinitionId"] == practice_definition_id
    assert relation_row["required"] is True and relation_row["relationCount"] == 1

    relation_id_after_link = relation_row["id"]
    title_after_save = f"{course['title']} · 教师已保存"
    page.once("dialog", lambda dialog: dialog.accept(title_after_save))
    page.locator(".edit").click()
    with page.expect_response(
        lambda response: response.request.method == "PATCH"
        and response.url.split("?", 1)[0].endswith(f"/course-versions/{course['id']}")
    ) as course_save_response:
        page.keyboard.press("Control+s")
    assert course_save_response.value.status == 200
    expect(page.locator('[data-bind="course-title"]')).to_have_text(title_after_save, timeout=20_000)
    course["title"] = title_after_save
    saved_after_editor_response = page.request.get(
        f"{prefix}/course-versions/{course['id']}", headers=teacher_auth
    )
    assert saved_after_editor_response.ok
    saved_after_editor = response_body(saved_after_editor_response)
    saved_version = saved_after_editor
    assert find_activity(saved_after_editor, ids["practice"])["practiceReference"] == saved_reference
    relation_row = json.loads(helper["sql"](
        f'''SELECT json_build_object('id',id,'schoolId',"schoolId",'activityId',"activityId",'practiceDefinitionId',"practiceDefinitionId",'required',required,
                    'relationCount',(SELECT count(*) FROM "CourseActivityPractice" WHERE "activityId"='{ids['practice']}'))::text
            FROM "CourseActivityPractice" WHERE "activityId"='{ids['practice']}';'''
    ))
    assert relation_row["relationCount"] == 1
    assert relation_row["practiceDefinitionId"] == practice_definition_id

    duplicate_write = page.request.put(link_url, headers=teacher_auth, data=write_body)
    assert duplicate_write.status == 200, f"same relation retry returned {duplicate_write.status}"
    duplicate_body = response_body(duplicate_write)
    assert duplicate_body["id"] == relation_row["id"]
    stale_write = page.request.put(
        link_url,
        headers=teacher_auth,
        data={**write_body, "required": False},
    )
    assert stale_write.status == 409, f"stale competing relation write returned {stale_write.status}"
    assert read_prior_attempt() == prior_attempt_before

    page.reload(wait_until="domcontentloaded")
    expect(page.locator('[data-bind="course-title"]')).to_have_text(course["title"], timeout=30_000)
    page.locator('[data-bind="structure-tree"] p.activity').filter(has_text="停顿与节奏正式练习").click()
    page.locator('button[data-tab="interaction"]').click()
    expect(page.locator("[data-course-practice-definition]")).to_have_value(practice_definition_id)
    expect(page.locator('[data-bind="course-practice-current"]')).to_contain_text(option["title"])
    screenshots.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(screenshots / "teacher-course-practice-reopened-1440.png"), full_page=True)

    published_response = page.request.post(
        f"{prefix}/course-versions/{course['id']}/publish",
        headers=teacher_auth,
        data={},
    )
    assert published_response.ok, f"course publish failed with HTTP {published_response.status}: {published_response.text()}"
    published = response_body(published_response)
    assert published["status"] == "PUBLISHED" and published["version"] == 1
    immutable_write = page.request.put(
        link_url,
        headers=teacher_auth,
        data={**write_body, "expectedUpdatedAt": saved_version["updatedAt"]},
    )
    assert immutable_write.status == 409, f"published course relation edit returned {immutable_write.status}"

    now = datetime.now(timezone.utc)
    assignment_response = page.request.post(
        f"{prefix}/assignments",
        headers=teacher_auth,
        data={
            "courseVersionId": course["id"],
            "title": f"T049 高原春声任务 {tag}",
            "startsAt": (now - timedelta(minutes=2)).isoformat(),
            "dueAt": (now + timedelta(days=2)).isoformat(),
            "targets": [{"targetType": "CLASS", "classId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}],
        },
    )
    assert assignment_response.ok, f"teacher assignment create failed with HTTP {assignment_response.status}: {assignment_response.text()}"
    assignment = response_body(assignment_response)
    assert assignment["status"] == "DRAFT" and assignment["revision"] == 1
    scheduled_response = page.request.post(
        f"{prefix}/assignments/{assignment['id']}/schedule",
        headers=teacher_auth,
        data={"expectedRevision": assignment["revision"]},
    )
    assert scheduled_response.ok, f"teacher assignment schedule failed with HTTP {scheduled_response.status}"
    scheduled = response_body(scheduled_response)
    opened_response = page.request.post(
        f"{prefix}/assignments/{assignment['id']}/open",
        headers=teacher_auth,
        data={"expectedRevision": scheduled["revision"]},
    )
    assert opened_response.ok, f"teacher assignment open failed with HTTP {opened_response.status}"
    opened = response_body(opened_response)
    assert opened["status"] == "OPEN"

    course_row = json.loads(helper["sql"](
        f'''SELECT json_build_object('id',id,'version',version,'status',status,'title',title)::text
            FROM "CourseVersion" WHERE id='{course['id']}' AND "schoolId"='{SCHOOL}';'''
    ))
    assert course_row == {"id": course["id"], "version": 1, "status": "PUBLISHED", "title": course["title"]}
    assert read_prior_attempt() == prior_attempt_before

    return {
        "teacherId": teacher["user"]["id"],
        "courseVersionId": course["id"],
        "assignmentId": assignment["id"],
        "assignmentStatus": opened["status"],
        "assignmentRevision": opened["revision"],
        "activityIds": ids,
        "practiceDefinitionId": practice_definition_id,
        "practiceTitle": option["title"],
        "title": course["title"],
        "teacherAuthoring": {
            "courseVersionBeforeLink": draft["updatedAt"],
            "apiWriterStatus": ui_write_responses[0],
            "relation": relation_row,
            "rereadPracticeReference": saved_reference,
            "duplicateWriteStatus": duplicate_write.status,
            "staleWriteStatus": stale_write.status,
            "publishedWriteStatus": immutable_write.status,
            "reopenedSelectedPracticeId": practice_definition_id,
            "priorAttemptId": prior_attempt_id,
            "priorAttemptBefore": prior_attempt_before,
            "relationIdAtLink": relation_id_after_link,
            "relationIdAfterCourseEditorSave": relation_row["id"],
            "courseVersionAfterEditorSave": {
                "id": saved_after_editor["id"],
                "version": saved_after_editor["version"],
                "title": saved_after_editor["title"],
            },
        },
        "authStatuses": {
            "unauthenticated": unauthorized.status,
            "studentWrite": forbidden.status,
            "studentOptions": hidden_options.status,
            "wrongSchool": wrong_school.status,
            "missingActivity": missing_activity.status,
        },
        "courseVersionRow": course_row,
    }


def test_yz_rd_t049_teacher_authors_course_practice_and_student_completes_it():
    helper = runpy.run_path(str(T022_E2E))
    helper["verify_database"]()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshots = EVIDENCE / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    page_errors: list[str] = []
    observed_api: list[dict[str, object]] = []
    proof: dict[str, object] = {"task": "YZ-RD-T049", "microphone": "SIMULATED_MIC"}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("YZ_T049_CHROMIUM", "/usr/bin/google-chrome"),
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["microphone"],
        )
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        def record_api(response):
            path = response.url.split("?", 1)[0]
            if "/api/v1/" in path and any(marker in path for marker in ("/course-versions", "/student/courses", "/recordings", "/assessments/sessions")):
                observed_api.append({"status": response.status, "path": path.split("/api/v1", 1)[-1]})

        page.on("response", record_api)
        try:
            course = create_t049_teacher_course(page, helper, screenshots, playwright)
            assignment_id = course["assignmentId"]
            activity_ids = course["activityIds"]
            student = helper["login"](page.request, "student.test")
            auth = helper["headers"](student)
            enrollment_id = helper["sql"](
                f'''SELECT id FROM "Enrollment" WHERE "userId"='{student["user"]["id"]}'
                    AND role='STUDENT' AND status='ACTIVE' ORDER BY id LIMIT 1;'''
            )
            assert enrollment_id

            course_api = page.request.get(
                f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}",
                headers=auth,
            )
            assert course_api.ok, f"authorized course API returned HTTP {course_api.status}"
            course_body = response_body(course_api)
            assert course_body["assignment"]["id"] == assignment_id
            assert course_body["courseVersion"]["status"] == "PUBLISHED"
            student_practice_reference = find_activity(
                {"units": course_body["units"]}, activity_ids["practice"]
            )["practiceReference"]
            assert student_practice_reference == {
                "practiceDefinitionId": course["practiceDefinitionId"],
                "title": course["practiceTitle"],
                "required": True,
            }, student_practice_reference
            wrong_school = page.request.get(
                f"{API}/api/v1/schools/22222222-2222-4222-8222-222222222222/student/courses/{assignment_id}",
                headers=auth,
            )
            assert wrong_school.status == 403

            # Authoring used this browser context as the teacher. Clear that
            # session before the independent student login and course journey.
            page.evaluate("localStorage.clear(); sessionStorage.clear();")
            context.clear_cookies()
            helper["login_ui"](page, "student.test")
            browser_student = page.evaluate("window.YuzanApi.getStoredUser()")
            assert browser_student["id"] == student["user"]["id"], browser_student
            assert page.evaluate("window.YuzanApi.getActiveSchoolId()") == SCHOOL
            page.goto(f"{BASE}/student/today/", wait_until="domcontentloaded")
            expect(page.locator("#todayApp .today-course-section")).to_contain_text(course["title"], timeout=30_000)
            course_link = page.locator(
                f'#todayApp a[href="/student/courses/course-detail/?id={assignment_id}"]'
            )
            expect(course_link).to_be_visible()
            course_link.click()
            expect(page.locator("#cpHeroTitle")).to_have_text(course["title"], timeout=30_000)
            submission_id = page.evaluate("window.CoursePlayerState.getState().submissionId")
            assert submission_id
            page.screenshot(path=str(screenshots / "today-authorized-course-1440.png"), full_page=True)

            audio_entry = page.locator(f'.cp-dir-item[data-activity-id="{activity_ids["audio"]}"]')
            expect(audio_entry).to_be_visible()
            expected_audio_href = (
                f"/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_ids['audio']}"
            )
            expect(audio_entry).to_have_attribute("href", expected_audio_href)
            audio_entry.click()
            page.wait_for_url(f"**{expected_audio_href}", timeout=30_000)
            expect(page.locator("#learningShell")).to_be_visible(timeout=30_000)
            expect(page.locator("#activityType")).to_have_text("听力")
            expect(page.locator("#activityTitle")).to_have_text("听辨溪水与春风")
            audio = page.locator("#activityContent audio")
            expect(audio).to_be_visible()
            page.wait_for_function("document.querySelector('#activityContent audio')?.readyState >= 1", timeout=30_000)
            audio_duration = audio.evaluate("element => element.duration")
            assert audio_duration and audio_duration > 0
            page.screenshot(path=str(screenshots / "course-listening-1440.png"), full_page=True)

            failed_progress = {"injected": False}

            def fail_first_completed_progress(route):
                request = route.request
                if request.method == "PUT" and request.url.endswith("/attempt"):
                    try:
                        payload = request.post_data_json or {}
                    except Exception:
                        payload = {}
                    if payload.get("completed") is True and not failed_progress["injected"]:
                        failed_progress["injected"] = True
                        route.fulfill(
                            status=503,
                            content_type="application/json",
                            body=json.dumps({"error": {"code": "NETWORK_UNAVAILABLE", "message": "网络暂时中断"}}),
                        )
                        return
                route.continue_()

            page.route("**/api/v1/schools/**/student/courses/**/activities/**/attempt", fail_first_completed_progress)
            page.evaluate("document.querySelector('#activityContent audio').play()")
            page.wait_for_function("document.querySelector('#activityContent audio')?.ended === true", timeout=60_000)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_have_attribute("data-tone", "error", timeout=20_000)
            expect(page.locator("#syncState")).to_contain_text("网络暂时中断")
            assert failed_progress["injected"]
            failed_audio_progress = helper["progress_sql"](enrollment_id, activity_ids["audio"])
            assert not failed_audio_progress or failed_audio_progress["completed"] is False
            expect(page.locator("#completeActivity")).to_be_enabled()
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=30_000)
            page.unroute("**/api/v1/schools/**/student/courses/**/activities/**/attempt", fail_first_completed_progress)
            audio_progress = helper["progress_sql"](enrollment_id, activity_ids["audio"])
            assert audio_progress and audio_progress["completed"] is True
            audio_attempt = json.loads(
                helper["sql"](
                    f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt"
                        WHERE "submissionId"='{submission_id}' AND "activityId"='{activity_ids["audio"]}';'''
                )
            )
            assert audio_attempt["kind"] == "AUDIO"
            assert audio_attempt["value"]["listenedToEnd"] is True

            speech_entry = page.locator(f'#chapterPath a[href$="/{activity_ids["speech"]}"]')
            expect(speech_entry).to_be_visible()
            speech_entry.click()
            page.wait_for_url(f"**/activities/{activity_ids['speech']}", timeout=20_000)
            expect(page.locator("#activityType")).to_have_text("口语")
            expect(page.locator("#activityTitle")).to_have_text("朗读春日观察句")
            expect(page.locator("#activityContent blockquote")).to_contain_text("春风沿着山脊吹向河谷")
            assert page.locator("#activityContent .bilingual-toggle").count() == 0
            assert page.locator("#activityContent track[lang='bo']").count() == 0
            page.screenshot(path=str(screenshots / "course-speech-1440.png"), full_page=True)

            recorder = page.locator("#courseRecorder")
            expect(recorder).to_be_visible()
            recorder.locator(".vr-action").click()
            page.wait_for_function(
                "document.querySelector('#courseRecorder')?.__voiceRecorder?.state === 'recording'",
                timeout=15_000,
            )
            page.wait_for_timeout(2_500)
            recorder.locator(".vr-action").click()
            expect(page.locator("#finishCourseRecording")).to_be_visible()
            page.locator("#finishCourseRecording").click()
            page.wait_for_function(
                "document.querySelector('#courseRecorder')?.__voiceRecorder?.blob?.size > 0",
                timeout=15_000,
            )
            expect(page.locator("#previewCourseRecording")).to_be_visible()
            page.locator("#previewCourseRecording").click()
            page.wait_for_function(
                "document.querySelector('#courseRecorder .vr-hidden-audio')?.paused === false",
                timeout=10_000,
            )
            page.locator("#previewCourseRecording").click()
            page.wait_for_function(
                "document.querySelector('#courseRecorder .vr-hidden-audio')?.paused === true",
                timeout=10_000,
            )
            expect(page.locator("#completeActivity")).to_be_enabled()
            page.set_viewport_size({"width": 390, "height": 844})
            page.screenshot(path=str(screenshots / "course-speech-390.png"), full_page=True)
            viewport = page.evaluate("({width: innerWidth, documentWidth: document.documentElement.scrollWidth})")
            assert viewport["documentWidth"] <= viewport["width"], viewport
            page.set_viewport_size({"width": 1440, "height": 1000})

            bucket = os.environ["S3_BUCKET"]
            upload_failure = {"injected": False}
            recording_init_ids: list[str] = []

            def capture_recording_init(response):
                request = response.request
                if request.method != "POST" or not response.url.split("?", 1)[0].endswith("/recordings/simple"):
                    return
                if not response.ok:
                    return
                try:
                    recording_init_ids.append(str(response_body(response)["id"]))
                except Exception:
                    return

            def fail_first_audio_upload(route):
                if route.request.method == "PUT" and f"/{bucket}/recordings/" in route.request.url and not upload_failure["injected"]:
                    upload_failure["injected"] = True
                    route.fulfill(status=503, body="injected offline upload")
                else:
                    route.continue_()

            page.on("response", capture_recording_init)
            page.route("**/recordings/**", fail_first_audio_upload)
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("原录音仍保存在本机", timeout=30_000)
            assert upload_failure["injected"]
            assert helper["progress_sql"](enrollment_id, activity_ids["speech"]) is None
            recording_row = helper["sql"](
                f'''SELECT json_build_object('id',id,'status',status,'objectKey',"objectKey",'idempotencyKey',"idempotencyKey")::text
                    FROM "Recording" WHERE "submissionId"='{submission_id}' AND "idempotencyKey"='course:{submission_id}:{activity_ids["speech"]}';'''
            )
            pending_recording = json.loads(recording_row)
            assert pending_recording["status"] in {"INITIALIZED", "UPLOADING"}
            assert pending_recording["idempotencyKey"] == f"course:{submission_id}:{activity_ids['speech']}"
            expect(page.locator("#previewCourseRecording")).to_be_visible()
            page.locator("#completeActivity").click()
            expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=40_000)
            page.unroute("**/recordings/**", fail_first_audio_upload)
            assert recording_init_ids and set(recording_init_ids) == {pending_recording["id"]}, recording_init_ids
            course_recording_init_ids = list(recording_init_ids)
            page.remove_listener("response", capture_recording_init)

            speech_progress = helper["progress_sql"](enrollment_id, activity_ids["speech"])
            assert speech_progress and speech_progress["completed"] is True
            speech_attempt = json.loads(
                helper["sql"](
                    f'''SELECT json_build_object('id',id,'kind',kind,'value',value)::text FROM "ActivityAttempt"
                        WHERE "submissionId"='{submission_id}' AND "activityId"='{activity_ids["speech"]}';'''
                )
            )
            assert speech_attempt["kind"] == "SPEECH"
            assert speech_attempt["value"]["recordingId"] == pending_recording["id"]
            persisted_recording = json.loads(
                helper["sql"](
                    f'''SELECT json_build_object('id',r.id,'status',r.status,'objectKey',r."objectKey",'mimeType',r."mimeType",'durationMs',r."durationMs",'attemptId',a.id)::text
                        FROM "Recording" r JOIN "ActivityAttempt" a ON a.id=r."activityAttemptId"
                        WHERE r.id='{pending_recording["id"]}' AND r."submissionId"='{submission_id}';'''
                )
            )
            assert persisted_recording["status"] in {"COMPLETE", "PROCESSING", "READY"}
            assert persisted_recording["attemptId"] == speech_attempt["id"]
            assert persisted_recording["objectKey"] == f"recordings/{pending_recording['id']}/full"
            assert persisted_recording["durationMs"] >= 2_000
            object_head = helper["minio_head"](persisted_recording["objectKey"])
            assert object_head.get("bytes", 0) > 0 and not object_head.get("missing")
            speech_jobs = json.loads(
                helper["sql"](
                    f'''SELECT COALESCE(json_agg(json_build_object('status',status,'result',result,'errorCode',"errorCode")), '[]'::json)::text
                        FROM "SpeechJob" WHERE "recordingId"='{pending_recording["id"]}';'''
                )
            )
            assert all(job["result"] is None for job in speech_jobs)

            practice_entry = page.locator(f'#chapterPath a[href$="/{activity_ids["practice"]}"]')
            expect(practice_entry).to_be_visible()
            practice_entry.click()
            page.wait_for_url(f"**/activities/{activity_ids['practice']}", timeout=20_000)
            expect(page.locator("#launchPractice")).to_be_visible()
            page.locator("#launchPractice").click()
            page.wait_for_url("**/student/practices/attempts/*/prepare/**", timeout=30_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            attempt_api = page.request.get(
                f"{API}/api/v1/schools/{SCHOOL}/practices/attempts/{attempt_id}", headers=auth
            )
            assert attempt_api.ok
            attempt_body = response_body(attempt_api)
            assert attempt_body["id"] == attempt_id
            assert attempt_body["courseSubmissionId"] == submission_id
            assert attempt_body["courseActivityId"] == activity_ids["practice"]
            page.locator("[data-start-session]").click()
            page.wait_for_url(f"**/student/practices/attempts/{attempt_id}/runner/", timeout=30_000)
            expected_course_return = (
                f"/student/courses/course-detail/?id={assignment_id}&activityId={activity_ids['practice']}"
                f"&submissionId={submission_id}"
            )
            assert expected_course_return in page.locator(".runner-back").get_attribute("href")
            runner_result = helper["complete_real_attempt"](
                page, auth, attempt_id, base_url=API, submit=False, exercise_upload_retry=True
            )
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
            dialog.get_by_role("button", name="确认交卷", exact=True).click()
            page.wait_for_url(re.compile(r".*/student/courses/course-detail/.*"), timeout=60_000)
            assert len(submit_requests) == 1
            current_url = page.url
            for expected in (
                f"id={assignment_id}",
                f"activityId={activity_ids['practice']}",
                f"submissionId={submission_id}",
                f"practiceAttemptId={attempt_id}",
            ):
                assert expected in current_url, current_url
            expect(page.locator("#cpHeroTitle")).to_have_text(course["title"], timeout=30_000)
            page.wait_for_function(
                "submissionId => window.CoursePlayerState?.getState().submissionId === submissionId",
                arg=submission_id,
                timeout=30_000,
            )
            attempt_row = json.loads(
                helper["sql"](
                    f'''SELECT json_build_object('id',id,'status',status,'submissionId',"courseSubmissionId",'activityId',"courseActivityId")::text
                        FROM "AssessmentSession" WHERE id='{attempt_id}';'''
                )
            )
            assert attempt_row["status"] in {"SUBMITTED", "PROCESSING", "COMPLETED"}
            assert attempt_row["submissionId"] == submission_id
            assert attempt_row["activityId"] == activity_ids["practice"]
            duplicate_submit = page.request.post(
                f"{API}/api/v1/schools/{SCHOOL}/assessments/sessions/{attempt_id}/submit",
                headers=auth,
            )
            assert duplicate_submit.ok, f"idempotent duplicate submit returned HTTP {duplicate_submit.status}"
            duplicate_attempt_body = response_body(duplicate_submit)
            assert duplicate_attempt_body["id"] == attempt_id
            assert duplicate_attempt_body["status"] == attempt_row["status"]
            attempt_count = int(
                helper["sql"](
                    f'''SELECT count(*) FROM "AssessmentSession" WHERE id='{attempt_id}';'''
                )
            )
            assert attempt_count == 1
            linked_relation_after_completion = json.loads(helper["sql"](
                f'''SELECT json_build_object('id',id,'practiceDefinitionId',"practiceDefinitionId",'required',required)::text
                    FROM "CourseActivityPractice" WHERE "activityId"='{activity_ids['practice']}';'''
            ))
            assert linked_relation_after_completion["id"] == course["teacherAuthoring"]["relation"]["id"]
            assert linked_relation_after_completion["practiceDefinitionId"] == course["practiceDefinitionId"]
            prior_attempt_after = json.loads(helper["sql"](
                f'''SELECT json_build_object('id',id,'status',status,'practiceDefinitionId',"practiceDefinitionId",'courseSubmissionId',"courseSubmissionId",'courseActivityId',"courseActivityId")::text
                    FROM "AssessmentSession" WHERE id='{course['teacherAuthoring']['priorAttemptId']}';'''
            ))
            assert prior_attempt_after == course["teacherAuthoring"]["priorAttemptBefore"]
            practice_progress = helper["progress_sql"](enrollment_id, activity_ids["practice"])
            assert practice_progress and practice_progress["completed"] is True
            practice_attempt = json.loads(
                helper["sql"](
                    f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt"
                        WHERE "submissionId"='{submission_id}' AND "activityId"='{activity_ids["practice"]}';'''
                )
            )
            assert practice_attempt["kind"] == "COURSE_PRACTICE"
            assert practice_attempt["value"]["practiceAttemptId"] == attempt_id

            page_errors_copy = list(page_errors)
            assert not page_errors_copy, page_errors_copy
            proof.update(
                {
                    "authorizedCourse": {
                        "assignmentId": assignment_id,
                        "courseVersionId": course["courseVersionId"],
                        "submissionId": submission_id,
                        "todayCourseLink": f"/student/courses/course-detail/?id={assignment_id}",
                        "courseActivityHref": expected_audio_href,
                        "wrongSchoolStatus": wrong_school.status,
                        "practiceReference": student_practice_reference,
                    },
                    "teacherCourseAuthoring": course["teacherAuthoring"],
                    "authorizationStatuses": course["authStatuses"],
                    "databaseParity": {
                        "courseVersion": course["courseVersionRow"],
                        "courseActivityPractice": linked_relation_after_completion,
                        "priorAttemptUnchanged": prior_attempt_after == course["teacherAuthoring"]["priorAttemptBefore"],
                    },
                    "listening": {
                        "activityId": activity_ids["audio"],
                        "durationSeconds": audio_duration,
                        "completedProgress": audio_progress,
                        "activityAttempt": audio_attempt,
                        "failedSaveThenRetry": failed_progress["injected"],
                    },
                    "speechRecording": {
                        "activityId": activity_ids["speech"],
                        "recordingId": pending_recording["id"],
                        "activityAttempt": speech_attempt,
                        "progress": speech_progress,
                        "minioHead": object_head,
                        "speechJobs": speech_jobs,
                        "micSource": "SIMULATED_MIC / Chromium native MediaRecorder",
                        "previewedBeforeUpload": True,
                        "failedUploadRetriedSameRecording": upload_failure["injected"],
                        "recordingInitIds": course_recording_init_ids,
                    },
                    "practiceSubmission": {
                        "attemptId": attempt_id,
                        "attempt": attempt_row,
                        "idempotentDuplicateSubmitStatus": duplicate_submit.status,
                        "duplicateAttemptRowCount": attempt_count,
                        "courseActivityAttempt": practice_attempt,
                        "courseProgress": practice_progress,
                        "submitRequests": len(submit_requests),
                        "runnerResult": runner_result,
                        "returnedUrl": current_url,
                        "returnedToSameSubmission": True,
                    },
                    "bilingualSafety": {
                        "unsafeTibetanSubtitlesPublished": False,
                        "unreviewedToggleCount": 0,
                        "tibetanTrackCount": 0,
                        "scoring": "No automatic speech score or report produced by this flow.",
                    },
                    "mobile390": viewport,
                    "apiResponses": observed_api,
                    "browserErrors": page_errors,
                }
            )
            (EVIDENCE / "native-flow-proof.json").write_text(
                json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        finally:
            context.close()
            browser.close()
