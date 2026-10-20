"""T040 course-to-speech browser/API/PostgreSQL/MinIO acceptance flow."""

from __future__ import annotations

import json
import os
import re
import runpy
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
T022_E2E = ROOT / "evidence" / "yz-rd-t022" / "course_activity_e2e.py"
BASE = os.environ["YZ_T040_BASE_URL"]
API = os.environ["YZ_T040_API_BASE_URL"]
EVIDENCE = Path(os.environ["YZ_T040_EVIDENCE_DIR"])
SCHOOL = "11111111-1111-4111-8111-111111111111"


def response_body(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def test_yz_rd_t040_today_to_course_audio_speech_and_return():
    helper = runpy.run_path(str(T022_E2E))
    helper["verify_database"]()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshots = EVIDENCE / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    page_errors: list[str] = []
    observed_api: list[dict[str, object]] = []
    proof: dict[str, object] = {"task": "YZ-RD-T040", "microphone": "SIMULATED_MIC"}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("YZ_T040_CHROMIUM", "/usr/bin/google-chrome"),
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
            if "/api/v1/" in path and any(marker in path for marker in ("/student/courses", "/recordings", "/assessments/sessions")):
                observed_api.append({"status": response.status, "path": path.split("/api/v1", 1)[-1]})

        page.on("response", record_api)
        try:
            course = helper["create_teacher_course"](page)
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
            wrong_school = page.request.get(
                f"{API}/api/v1/schools/22222222-2222-4222-8222-222222222222/student/courses/{assignment_id}",
                headers=auth,
            )
            assert wrong_school.status == 403

            helper["login_ui"](page, "student.test")
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
