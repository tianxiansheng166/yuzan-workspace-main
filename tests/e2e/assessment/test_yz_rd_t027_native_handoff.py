"""Native student-course contract, chooser handoff, and persistence proof."""

from __future__ import annotations

import json
import os
import runpy
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
T022_E2E = ROOT / "evidence" / "yz-rd-t022" / "course_activity_e2e.py"
BASE = os.environ["YZ_T027_BASE_URL"]
API = os.environ["YZ_T027_API_BASE_URL"]
EVIDENCE = Path(os.environ["YZ_T027_EVIDENCE_DIR"])
SCHOOL = "11111111-1111-4111-8111-111111111111"
PASSWORD = os.environ["E2E_TEST_PASSWORD"]


def response_body(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def activities_for(course):
    return [
        activity
        for unit in course.get("units", [])
        for lesson in unit.get("lessons", [])
        for activity in lesson.get("activities", [])
    ]


def text_contract_fields(value):
    if not isinstance(value, dict):
        return []
    fields = ("originalText", "translation", "locale", "translationLocale", "translationSource", "reviewStatus")
    return sorted(key for key in fields if key in value)


def native_course_fixture(sql):
    statement = f'''SELECT json_build_object(
        'assignmentId', a.id,
        'submissionId', s.id,
        'courseVersionId', a."courseVersionId",
        'sessionId', session.id,
        'sessionStatus', session.status,
        'textActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='TEXT' ORDER BY la."sortOrder" LIMIT 1),
        'audioActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='AUDIO' ORDER BY la."sortOrder" LIMIT 1),
        'videoActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='VIDEO' ORDER BY la."sortOrder" LIMIT 1),
        'choiceActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='CHOICE' AND NOT EXISTS (SELECT 1 FROM "CourseActivityPractice" cap WHERE cap."activityId"=la.id) ORDER BY la."sortOrder" LIMIT 1),
        'fillActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='FILL_BLANK' ORDER BY la."sortOrder" LIMIT 1),
        'speechActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" WHERE un."courseVersionId"=a."courseVersionId" AND la.type='SPEECH' ORDER BY la."sortOrder" LIMIT 1),
        'practiceActivityId', (SELECT la.id FROM "LearningActivity" la JOIN "Lesson" le ON le.id=la."lessonId" JOIN "Unit" un ON un.id=le."unitId" JOIN "CourseActivityPractice" cap ON cap."activityId"=la.id WHERE un."courseVersionId"=a."courseVersionId" ORDER BY la."sortOrder" LIMIT 1)
      )::text
      FROM "AssessmentSession" session
      JOIN "Submission" s ON s.id=session."courseSubmissionId"
      JOIN "Assignment" a ON a.id=s."assignmentId"
      WHERE a.title LIKE 'T022 高原春声任务 %'
        AND session.status IN ('SUBMITTED', 'PROCESSING', 'COMPLETED')
      ORDER BY session."updatedAt" DESC
      LIMIT 1;'''
    value = sql(statement)
    if not value:
        raise AssertionError("No real teacher-published T022 course/submission fixture exists in the T027 database")
    return json.loads(value)


def test_yz_rd_t027_native_authorized_handoff_and_course_state():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshots = EVIDENCE / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    helper = runpy.run_path(str(T022_E2E))
    sql = helper["sql"]
    fixture = native_course_fixture(sql)
    assignment_id = fixture["assignmentId"]
    submission_id = fixture["submissionId"]
    activity_ids = {
        "text": fixture["textActivityId"],
        "audio": fixture["audioActivityId"],
        "video": fixture["videoActivityId"],
        "choice": fixture["choiceActivityId"],
        "fill": fixture["fillActivityId"],
        "speech": fixture["speechActivityId"],
        "practice": fixture["practiceActivityId"],
    }
    assert all(activity_ids.values())
    student_b = helper["make_student_b"]()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 960})
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        session_a = helper["login"](page.request, "student.test")
        auth_a = helper["headers"](session_a)
        enrollment_a = sql(
            f'''SELECT id FROM "Enrollment" WHERE "userId"='{session_a["user"]["id"]}' AND role='STUDENT' AND status='ACTIVE' LIMIT 1;'''
        )
        assert enrollment_a
        course_response = page.request.get(
            f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}",
            headers=auth_a,
        )
        assert course_response.ok, f"authorized CourseVersion read failed with HTTP {course_response.status}"
        course = response_body(course_response)
        activities = activities_for(course)
        text_activity = next(item for item in activities if item["id"] == activity_ids["text"])
        audio_activity = next(item for item in activities if item["id"] == activity_ids["audio"])
        video_activity = next(item for item in activities if item["id"] == activity_ids["video"])
        objective = (course.get("courseVersion", {}).get("objectives") or [{}])[0]
        instruction = text_activity.get("instruction") or {}
        paragraphs = text_activity.get("content", {}).get("paragraphs", [])
        body = paragraphs[0] if paragraphs else ""
        body_original = body.get("originalText", "") if isinstance(body, dict) else body

        student_b_session = helper["login"](page.request, student_b["loginIdentifier"])
        auth_b = helper["headers"](student_b_session)
        course_b_response = page.request.get(
            f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}",
            headers=auth_b,
        )
        assert course_b_response.ok
        course_b = response_body(course_b_response)
        submission_b_id = (course_b.get("existingSubmission") or {}).get("id")
        assert submission_b_id != submission_id
        note_b = helper["get_note"](page.request, activity_ids["text"], auth_b)
        assert note_b["content"] == "" and note_b["revision"] == 0
        assert page.request.get(
            f"{API}/api/v1/schools/{SCHOOL}/submissions/{submission_id}", headers=auth_b
        ).status in {403, 404}
        assert page.request.get(
            f"{API}/api/v1/schools/{SCHOOL}/learning/activities/{activity_ids['text']}/progress?enrollmentId={enrollment_a}",
            headers=auth_b,
        ).status == 403
        assert page.request.get(
            f"{API}/api/v1/schools/{'22222222-2222-4222-8222-222222222222'}/student/courses/{assignment_id}",
            headers=auth_a,
        ).status == 403
        anonymous = playwright.request.new_context()
        assert anonymous.get(f"{API}/api/v1/schools/{SCHOOL}/student/courses/{assignment_id}").status == 401
        anonymous.dispose()

        # The authorized course directory opens the focused Activity Player
        # with the same server-created Course Submission.
        helper["login_ui"](page, "student.test")
        page.goto(f"{BASE}/student/courses/course-detail/?id={assignment_id}", wait_until="domcontentloaded")
        expect(page.locator("#cpHeroTitle")).not_to_have_text("", timeout=20_000)
        submission_id = page.evaluate("window.CoursePlayerState.getState().submissionId")
        assert submission_id
        page.locator(f'.cp-dir-item[data-activity-id="{activity_ids["audio"]}"]').click()
        expected_audio_url = f"{BASE}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_ids['audio']}"
        page.wait_for_url(expected_audio_url, timeout=20_000)
        expect(page.locator("#learningShell")).to_be_visible(timeout=20_000)
        assert page.locator("#activityType").inner_text() == "听力"
        page.screenshot(path=str(screenshots / "course-directory-opens-activity-1280.png"), full_page=True)

        text_url = f"{BASE}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_ids['text']}"
        page.goto(text_url, wait_until="domcontentloaded")
        expect(page.locator("#learningShell")).to_be_visible(timeout=20_000)
        expect(page.locator("#activityInstruction")).to_contain_text(instruction.get("originalText", ""))
        assert page.locator(".bilingual-toggle").count() == 0
        if body_original:
            assert page.locator(".reading-paragraph").first.inner_text() == body_original

        note_value = f"T027 native CourseVersion note verification {datetime.now(timezone.utc).isoformat()}"
        page.locator("#noteContent").fill(note_value)
        saved_note = None
        for _ in range(80):
            saved_note = helper["get_note"](page.request, activity_ids["text"], auth_a)
            if saved_note["content"] == note_value:
                break
            page.wait_for_timeout(250)
        assert saved_note["content"] == note_value and saved_note["revision"] >= 1
        expect(page.locator("#noteState")).to_have_text("已保存", timeout=20_000)
        note_row = helper["note_sql"](enrollment_a, activity_ids["text"])
        assert note_row["content"] == note_value and note_row["revision"] == saved_note["revision"]
        page.reload(wait_until="domcontentloaded")
        expect(page.locator("#noteContent")).to_have_value(note_value, timeout=20_000)
        page.screenshot(path=str(screenshots / "api-original-only-1280.png"), full_page=True)

        media_progress = {}
        for activity_id, kind, locator in (
            (activity_ids["audio"], "AUDIO", "audio"),
            (activity_ids["video"], "VIDEO", "video"),
        ):
            page.goto(
                f"{BASE}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}",
                wait_until="domcontentloaded",
            )
            expect(page.locator("#learningShell")).to_be_visible(timeout=20_000)
            media = page.locator(locator)
            expect(media).to_be_visible(timeout=20_000)
            page.wait_for_function(f"document.querySelector('{locator}')?.readyState >= 1", timeout=20_000)
            assert page.locator("track").count() == 0
            assert "自动转写" not in page.locator("#activityContent").inner_text()
            page.evaluate(f"document.querySelector('{locator}').play()")
            page.wait_for_function(f"document.querySelector('{locator}')?.ended === true", timeout=60_000)
            current_progress = helper["progress_sql"](enrollment_a, activity_id)
            if not current_progress or not current_progress.get("completed"):
                page.locator("#completeActivity").click()
                expect(page.locator("#syncState")).to_contain_text("服务器已保存", timeout=20_000)
            progress = helper["progress_sql"](enrollment_a, activity_id)
            assert progress and progress["completed"] is True
            media_progress[kind] = progress

        speech_record_json = sql(
            f'''SELECT json_build_object('id',id,'status',status,'objectKey',"objectKey",'mimeType',"mimeType",'idempotencyKey',"idempotencyKey")::text
                  FROM "Recording" WHERE "submissionId"='{submission_id}' AND "idempotencyKey"='course:{submission_id}:{activity_ids["speech"]}'
                  ORDER BY "createdAt" DESC LIMIT 1;'''
        )
        assert speech_record_json, "native speech attempt must retain its idempotent Recording"
        speech_recording = json.loads(speech_record_json)
        assert speech_recording["idempotencyKey"] == f"course:{submission_id}:{activity_ids['speech']}"
        assert speech_recording["objectKey"] == f"recordings/{speech_recording['id']}/full"
        s3_head = helper["minio_head"](speech_recording["objectKey"])
        assert s3_head.get("bytes", 0) > 0 and not s3_head.get("missing")
        practice_progress = helper["progress_sql"](enrollment_a, activity_ids["practice"])
        assert practice_progress and practice_progress["completed"] is True
        activity_progress = {
            kind: helper["progress_sql"](enrollment_a, activity_id)
            for kind, activity_id in activity_ids.items()
        }
        assert all(progress and progress["completed"] is True for progress in activity_progress.values())
        runner_attempt_row = json.loads(
            sql(
                f'''SELECT json_build_object('id',id,'status',status,'courseSubmissionId',"courseSubmissionId",'courseActivityId',"courseActivityId")::text
                      FROM "AssessmentSession" WHERE id='{fixture["sessionId"]}';'''
            )
        )
        course_practice_attempt = json.loads(
            sql(
                f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt"
                      WHERE "submissionId"='{submission_id}' AND "activityId"='{activity_ids["practice"]}';'''
            )
        )
        assert runner_attempt_row["courseSubmissionId"] == submission_id
        assert runner_attempt_row["courseActivityId"] == activity_ids["practice"]
        assert course_practice_attempt["kind"] == "COURSE_PRACTICE"
        assert course_practice_attempt["value"]["practiceAttemptId"] == fixture["sessionId"]

        api_fields = {
            "method": "GET",
            "path": "/api/v1/schools/{schoolId}/student/courses/{assignmentId}",
            "status": course_response.status,
            "courseVersionId": course.get("courseVersion", {}).get("id"),
            "courseVersionNumber": course.get("courseVersion", {}).get("version"),
            "courseVersionStatus": course.get("courseVersion", {}).get("status"),
            "acceptedT022BaseSha": "e456eac9b02a5abb4851525685cc5bd130d9af91",
            "objectiveFields": text_contract_fields(objective),
            "activityInstructionFields": text_contract_fields(instruction),
            "activityBodyFields": text_contract_fields(body),
            "translationLocaleInStudentResponse": any(
                "translationLocale" in text_contract_fields(value) for value in (objective, instruction, body)
            ),
            "translationLocaleInAcceptedBilingualType": False,
            "authorizedSubtitleResources": {
                "AUDIO": [r.get("id") for r in audio_activity.get("resources", []) if r.get("kind") == "SUBTITLE" and r.get("rightsStatus") == "APPROVED"],
                "VIDEO": [r.get("id") for r in video_activity.get("resources", []) if r.get("kind") == "SUBTITLE" and r.get("rightsStatus") == "APPROVED"],
            },
            "serverBilingualFullE2E": "NOT_RUN / BLOCKED_UPSTREAM_T005_CONTRACT",
            "apiRequest": (
                "In CourseVersion BilingualContent, declare and validate translationLocale beside originalText, "
                "translation, locale, translationSource, and reviewStatus. Return it from GET "
                "/api/v1/schools/{schoolId}/student/courses/{assignmentId} for objectives, Activity.instruction, "
                "notes, and bilingual content values; T022 currently returns TEXT content.paragraphs as plain strings. "
                "For Tibetan subtitle tracks, expose only approved SUBTITLE ResourceRefs with rightsStatus=APPROVED "
                "and the same exact zh->bo review metadata; the accepted ResourceRef mapper currently omits it."
            ),
        }
        type_source = (ROOT / "backend/api/src/modules/curriculum/domain/course-version.types.ts").read_text(encoding="utf-8")
        interface_start = type_source.find("export interface BilingualContent")
        interface_end = type_source.find("\n}", interface_start)
        api_fields["translationLocaleInAcceptedBilingualType"] = "translationLocale" in type_source[interface_start:interface_end]
        (EVIDENCE / "api-contract-proof.json").write_text(json.dumps(api_fields, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        native_proof = {
            "task": "YZ-RD-T027",
            "sourceCourseVersion": fixture["courseVersionId"],
            "assignmentId": assignment_id,
            "submissionId": submission_id,
            "sessionId": fixture["sessionId"],
            "studentAEnrollment": enrollment_a,
            "studentBEnrollment": student_b["enrollmentId"],
            "studentBSubmissionId": submission_b_id,
            "activityIds": activity_ids,
            "courseDetailChooserClick": {"selectedActivityId": activity_ids["audio"], "pathname": f"/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_ids['audio']}", "nativeRunnerLinkPass": True},
            "directAuthorizedActivityRoute": text_url,
            "note": {"revision": saved_note["revision"], "content": saved_note["content"]},
            "progress": {kind.upper(): progress for kind, progress in activity_progress.items()},
            "recording": speech_recording,
            "minioHead": s3_head,
            "practiceRunner": runner_attempt_row,
            "automaticRunnerReturn": "Not asserted by this native handoff case; covered by YZ-RD-T040 course submission E2E",
            "practiceActivityAttempt": course_practice_attempt,
            "studentBIsolation": {"ownSubmissionId": submission_b_id, "noteContent": note_b["content"], "submissionARead": "403/404", "activityAProgressRead": 403},
            "unauthorizedTranslationVisibility": "no toggle for real unilingual API fields; machine/missing-field negatives in UI fixture",
            "browserErrors": page_errors,
        }
        assert page_errors == [], page_errors
        (EVIDENCE / "native-handoff-proof.json").write_text(json.dumps(native_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        browser.close()
