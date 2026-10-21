import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


WEB_URL = os.environ.get("WEB_URL", "http://frontend:4175").rstrip("/")
LOGIN = os.environ["T109_LOGIN"]
PASSWORD = os.environ["T109_PASSWORD"]
OUT = Path("/evidence")
SCREENSHOTS = OUT / "screenshots"
SOURCE_SHA = "8974c2a7d5842bb20dbfcd091b63cac5674dcc32"
COURSE_TITLE = "T109 真实课程视频验收"
RECOMMENDATION_TITLE = "T109 推荐课程"

responses = []
progress_events = []
console_error_count = 0
page_error_count = 0
request_failed_count = 0
stage = "initialization"
fault_control = {"mode": "pass", "injected": 0}


def short_id(value):
    return value[:8] if isinstance(value, str) else None


def response_category(path, host):
    if host == "minio":
        return "minio-media"
    if "/auth/login" in path:
        return "auth-login"
    if "/student/today" in path:
        return "today-api"
    if "/student/courses" in path and path.rstrip("/").endswith("/student/courses"):
        return "course-list"
    if "/recommendations" in path:
        return "course-recommendations"
    if "/playback-url" in path:
        return "signed-playback-url"
    if "/activities/" in path and path.endswith("/attempt"):
        return "course-activity-progress"
    if "/practices/" in path and "/attempts" in path:
        return "practice-attempt"
    if "/assessments/sessions/" in path and path.endswith("/submit"):
        return "practice-submit"
    if "/assessments/sessions/" in path and path.endswith("/report"):
        return "assessment-report"
    if "/student/profile" in path or "/assessments/history" in path:
        return "growth-api"
    return "application-api"


def record_response(response):
    parsed = urlsplit(response.url)
    host = parsed.hostname or "unknown"
    if host not in {"frontend", "api", "minio"}:
        return
    is_media = host == "minio"
    try:
        has_range = "range" in {key.lower() for key in response.request.headers.keys()}
    except Exception:
        has_range = False
    responses.append({
        "host": host,
        "method": response.request.method,
        "category": response_category(parsed.path, host),
        "status": response.status,
        "rangeRequested": has_range if is_media else None,
    })
    if response_category(parsed.path, host) == "course-activity-progress":
        match = re.search(r"/activities/([0-9a-fA-F-]+)/attempt$", parsed.path)
        if match:
            progress_events.append({"activityId": match.group(1), "status": response.status})


def install_progress_fault(route):
    request = route.request
    parsed = urlsplit(request.url)
    if fault_control["mode"] == "fail" and request.method == "PUT" and "/activities/" in parsed.path and parsed.path.endswith("/attempt"):
        fault_control["injected"] += 1
        route.fulfill(
            status=503,
            content_type="application/json",
            body=json.dumps({"statusCode": 503, "message": "T109 controlled transient progress failure"}),
        )
        return
    route.continue_()


def summarize_responses():
    counts = Counter((entry["host"], entry["method"], entry["category"], entry["status"]) for entry in responses)
    return [
        {"host": host, "method": method, "category": category, "status": status, "count": count}
        for (host, method, category, status), count in sorted(counts.items())
    ]


def api_value(page, method, *args):
    return page.evaluate(
        """async ({method, args}) => {
          const api = window.YuzanApi;
          if (!api || typeof api[method] !== 'function') throw new Error('Expected API method unavailable');
          const result = await api[method](...args);
          return result && typeof result === 'object' && 'data' in result ? result.data : result;
        }""",
        {"method": method, "args": list(args)},
    )


def activity_rows(course):
    rows = []
    for unit in course.get("units", []) or []:
        for lesson in unit.get("lessons", []) or []:
            rows.extend(lesson.get("activities", []) or [])
    return rows


def progress_for(activity):
    progress = activity.get("progress")
    if isinstance(progress, list):
        return progress[0] if progress else None
    return progress if isinstance(progress, dict) else None


def course_progress(course):
    return course.get("studentProgress") or course.get("courseCompletion") or course.get("progress") or {}


def page_dimensions(page):
    return page.evaluate("""() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
      verticallyScrollable: document.documentElement.scrollHeight > window.innerHeight + 1
    })""")


def capture(page, name, width=None, height=900):
    if width is not None:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(300)
    path = SCREENSHOTS / name
    page.screenshot(path=str(path), full_page=False, animations="disabled")
    dimensions = page_dimensions(page)
    if width == 390:
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        page.wait_for_timeout(100)
        dimensions["bottomScrollReached"] = page.evaluate(
            "() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2"
        )
        page.evaluate("window.scrollTo(0, 0)")
    return {"path": f"evidence/yz-rd-t109/screenshots/{name}", **dimensions}


def safe_wait_network_idle(page, timeout=5000):
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except PlaywrightTimeoutError:
        pass


def is_course_progress(response, activity_id=None):
    parsed = urlsplit(response.url)
    return (
        response.request.method == "PUT"
        and "/student/courses/" in parsed.path
        and "/activities/" in parsed.path
        and parsed.path.endswith("/attempt")
        and (activity_id is None or f"/activities/{activity_id}/attempt" in parsed.path)
    )


def run():
    global console_error_count, page_error_count, request_failed_count, stage
    OUT.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    desktop = {}
    mobile = {}
    result = {
        "taskId": "YZ-RD-T109",
        "sourceT108Sha": SOURCE_SHA,
        "runtimeProject": "yz-rd-t109",
        "status": "FAIL",
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        result["browserVersion"] = browser.version
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = context.new_page()
        page.on("response", record_response)
        page.on("console", lambda message: globals().__setitem__("console_error_count", console_error_count + 1) if message.type == "error" else None)
        page.on("pageerror", lambda _error: globals().__setitem__("page_error_count", page_error_count + 1))
        page.on("requestfailed", lambda _request: globals().__setitem__("request_failed_count", request_failed_count + 1))

        try:
            stage = "real-login"
            page.goto(f"{WEB_URL}/login", wait_until="domcontentloaded", timeout=30000)
            page.locator("#loginAccount").fill(LOGIN)
            page.locator("#loginPassword").fill(PASSWORD)
            with page.expect_response(lambda response: "/auth/login" in response.url and response.request.method == "POST", timeout=30000) as login_response:
                page.locator('#loginPanel [data-action="login"]').click()
            login_status = login_response.value.status
            if login_status != 200:
                raise RuntimeError("real student login did not return HTTP 200")
            page.wait_for_url("**/student/today*", timeout=30000)
            safe_wait_network_idle(page)
            page.wait_for_timeout(400)
            result["realLogin"] = {"status": "PASS", "http": login_status, "route": "student-login-ui"}

            stage = "today-page"
            page.goto(f"{WEB_URL}/student/today", wait_until="domcontentloaded", timeout=30000)
            safe_wait_network_idle(page)
            desktop["today1440"] = capture(page, "today-1440x900.png", 1440, 900)
            desktop["today1280"] = capture(page, "today-1280x900.png", 1280, 900)
            mobile["today390"] = capture(page, "today-390x844.png", 390, 844)

            stage = "growth-page"
            page.goto(f"{WEB_URL}/student/growth/", wait_until="domcontentloaded", timeout=30000)
            safe_wait_network_idle(page)
            page.wait_for_timeout(300)
            desktop["growth1440"] = capture(page, "growth-1440x900.png", 1440, 900)
            mobile["growth390"] = capture(page, "growth-390x844.png", 390, 844)

            stage = "courses-api-and-dynamic-route"
            page.goto(f"{WEB_URL}/student/courses/", wait_until="domcontentloaded", timeout=30000)
            page.locator("#catalogContent").wait_for(state="visible", timeout=30000)
            course_card = page.locator("#courseGrid .cc-card").filter(has_text=COURSE_TITLE)
            course_card.wait_for(state="visible", timeout=30000)
            assignment_id = course_card.get_attribute("data-assignment-id")
            if not assignment_id:
                raise RuntimeError("course card did not expose its API assignment ID")
            desktop["courses1440"] = capture(page, "courses-1440x900.png", 1440, 900)
            desktop["courses1280"] = capture(page, "courses-1280x900.png", 1280, 900)
            mobile["courses390"] = capture(page, "courses-390x844.png", 390, 844)
            page.set_viewport_size({"width": 1440, "height": 900})
            with page.expect_navigation(url=re.compile(r"/student/courses/course-detail/"), wait_until="domcontentloaded", timeout=30000):
                course_card.click()
            if parse_qs(urlsplit(page.url).query).get("id", [None])[0] != assignment_id:
                raise RuntimeError("course detail route did not preserve the dynamic assignment ID")

            stage = "course-detail-api-and-media-source"
            page.locator("#cpHeroTitle").wait_for(state="visible", timeout=30000)
            page.wait_for_function(
                """() => {
                  const video = document.querySelector('#cpVideo');
                  return video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
                }""",
                timeout=30000,
            )
            course = api_value(page, "getStudentCourse", assignment_id)
            activities = activity_rows(course)
            video_activity = next((item for item in activities if item.get("activityType", item.get("type")) == "VIDEO"), None)
            practice_activity = next((item for item in activities if item.get("practiceReference")), None)
            if not video_activity or not practice_activity:
                raise RuntimeError("live course detail did not return both video and practice activities")
            video_activity_id = video_activity.get("activityId") or video_activity.get("id")
            practice_activity_id = practice_activity.get("activityId") or practice_activity.get("id")
            practice_definition_id = practice_activity.get("practiceReference", {}).get("practiceDefinitionId")
            if not video_activity_id or not practice_activity_id or not practice_definition_id:
                raise RuntimeError("live course activity is missing a dynamic practice/video ID")

            video_metadata = page.evaluate("""() => {
              const video = document.querySelector('#cpVideo');
              let sourceHost = null;
              try { sourceHost = new URL(video.currentSrc).hostname; } catch {}
              return {
                durationSeconds: video.duration,
                readyState: video.readyState,
                sourceHost,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                mediaErrorCode: video.error ? video.error.code : null
              };
            }""")
            desktop["courseDetail1440"] = capture(page, "course-detail-1440x900.png", 1440, 900)
            desktop["courseDetail1280"] = capture(page, "course-detail-1280x900.png", 1280, 900)
            mobile["courseDetail390"] = capture(page, "course-detail-390x844.png", 390, 844)
            page.set_viewport_size({"width": 1440, "height": 900})

            stage = "partial-video-progress-save"
            with page.expect_response(lambda response: is_course_progress(response, video_activity_id), timeout=20000) as partial_response:
                page.locator("#cpPlayBig").click()
                page.wait_for_function("() => document.querySelector('#cpVideo')?.currentTime >= 1.6", timeout=15000)
                page.locator("#cpPlayBtn").click()
            partial_status = partial_response.value.status
            if partial_status != 200:
                raise RuntimeError("real partial course progress save did not return HTTP 200")
            decoded_media = page.evaluate("""() => {
              const video = document.querySelector('#cpVideo');
              let frameCount = 0;
              try { frameCount = video.getVideoPlaybackQuality().totalVideoFrames; } catch {}
              return {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                totalVideoFrames: frameCount,
                mediaErrorCode: video.error ? video.error.code : null
              };
            }""")
            if decoded_media["videoWidth"] <= 0 or decoded_media["videoHeight"] <= 0 or decoded_media["totalVideoFrames"] <= 0 or decoded_media["mediaErrorCode"] is not None:
                raise RuntimeError("browser did not decode frames from the signed MinIO media URL")
            partial_state = page.evaluate("""() => {
              const video = document.querySelector('#cpVideo');
              return { currentTime: video.currentTime, duration: video.duration, paused: video.paused };
            }""")

            stage = "progress-failure-visible-and-safe-retry"
            fault_control["mode"] = "fail"
            page.route("**/api/v1/schools/*/student/courses/*/submissions/*/activities/*/attempt", install_progress_fault)
            saved_before_fault = page.evaluate("() => document.querySelector('#cpVideo').currentTime")
            with page.expect_response(lambda response: is_course_progress(response, video_activity_id), timeout=20000):
                page.locator("#cpPlayBtn").click()
                page.wait_for_function(
                    "saved => document.querySelector('#cpVideo')?.currentTime >= saved + 0.45",
                    arg=saved_before_fault,
                    timeout=12000,
                )
                page.locator("#cpPlayBtn").click()
            page.locator("#cpProgressError").wait_for(state="visible", timeout=15000)
            error_message_visible = bool((page.locator("#cpProgressErrorMessage").inner_text() or "").strip())
            retry_visible = page.locator("#cpProgressRetryBtn").is_visible()
            page.wait_for_timeout(500)
            still_visible = page.locator("#cpProgressError").is_visible()
            if not error_message_visible or not retry_visible or not still_visible:
                raise RuntimeError("media progress failure did not remain visible with a retry control")
            if fault_control["injected"] < 1:
                raise RuntimeError("T109 transient progress failure was not injected")
            fault_control["mode"] = "pass"
            with page.expect_response(lambda response: is_course_progress(response, video_activity_id) and response.status == 200, timeout=20000) as retry_response:
                page.locator("#cpProgressRetryBtn").click()
            retry_status = retry_response.value.status
            page.locator("#cpProgressError").wait_for(state="hidden", timeout=10000)
            after_retry_course = api_value(page, "getStudentCourse", assignment_id)
            after_retry_activity = next(
                item for item in activity_rows(after_retry_course)
                if (item.get("activityId") or item.get("id")) == video_activity_id
            )
            after_retry_progress = progress_for(after_retry_activity) or {}

            stage = "progress-restore-after-refresh"
            saved_fraction = after_retry_progress.get("position")
            if not isinstance(saved_fraction, (int, float)):
                raise RuntimeError("server did not return a persisted fractional video position")
            page.reload(wait_until="domcontentloaded", timeout=30000)
            page.wait_for_function(
                """() => {
                  const video = document.querySelector('#cpVideo');
                  return video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
                }""",
                timeout=30000,
            )
            restored_time = page.evaluate("() => document.querySelector('#cpVideo').currentTime")
            expected_time = float(saved_fraction) * float(video_metadata["durationSeconds"])
            if abs(float(restored_time) - expected_time) > 0.65:
                raise RuntimeError("server-saved video position was not restored after refresh")

            stage = "activity-switch-isolation"
            practice_item = page.locator(f'li[data-activity-id="{practice_activity_id}"]')
            practice_item.click()
            page.wait_for_function(
                "id => window.CoursePlayerState?.getState()?.currentActivityId === id",
                arg=practice_activity_id,
                timeout=10000,
            )
            page.wait_for_timeout(500)
            switch_course = api_value(page, "getStudentCourse", assignment_id)
            switch_activities = activity_rows(switch_course)
            switched_video = next(item for item in switch_activities if (item.get("activityId") or item.get("id")) == video_activity_id)
            switched_practice = next(item for item in switch_activities if (item.get("activityId") or item.get("id")) == practice_activity_id)
            switched_video_progress = progress_for(switched_video) or {}
            switched_practice_progress = progress_for(switched_practice)
            practice_activity_writes_before_ended = sum(
                1 for event in progress_events if event["activityId"] == practice_activity_id
            )
            if practice_activity_writes_before_ended != 0:
                raise RuntimeError("activity switch wrote video progress to the other activity")

            stage = "video-ended-server-confirmation"
            page.locator(f'li[data-activity-id="{video_activity_id}"]').click()
            page.wait_for_function(
                "id => window.CoursePlayerState?.getState()?.currentActivityId === id",
                arg=video_activity_id,
                timeout=10000,
            )
            page.wait_for_function("() => document.querySelector('#cpVideo')?.readyState >= 1", timeout=20000)
            with page.expect_response(lambda response: is_course_progress(response, video_activity_id) and response.status == 200, timeout=20000) as ended_response:
                page.locator("#cpPlayBig").click()
                page.wait_for_function("() => document.querySelector('#cpVideo')?.ended === true", timeout=15000)
            ended_status = ended_response.value.status
            page.wait_for_timeout(300)
            ended_course = api_value(page, "getStudentCourse", assignment_id)
            ended_activities = activity_rows(ended_course)
            ended_video = next(item for item in ended_activities if (item.get("activityId") or item.get("id")) == video_activity_id)
            ended_practice = next(item for item in ended_activities if (item.get("activityId") or item.get("id")) == practice_activity_id)
            ended_video_progress = progress_for(ended_video) or {}
            ended_practice_progress = progress_for(ended_practice)
            end_course_progress = course_progress(ended_course)
            completed_ids = end_course_progress.get("completedActivityIds") or []
            only_video_completed = video_activity_id in completed_ids and practice_activity_id not in completed_ids
            if ended_status != 200 or ended_video_progress.get("completed") is not True or not only_video_completed:
                raise RuntimeError("ended playback did not remain server-confirmed and activity-scoped")
            minio_statuses = [entry["status"] for entry in responses if entry["host"] == "minio"]
            if 206 not in minio_statuses:
                raise RuntimeError("MinIO did not serve an HTTP 206 media range response")

            stage = "real-recommendation-navigation"
            recommendation_link = page.locator('#cpSectionRecommendations a[href*="course-detail"]').first
            recommendation_link.wait_for(state="visible", timeout=20000)
            recommendation_href = recommendation_link.get_attribute("href") or ""
            recommendation_id = parse_qs(urlsplit(recommendation_href).query).get("id", [None])[0]
            if not recommendation_id:
                raise RuntimeError("recommendation did not return a dynamic assignment ID")
            recommendation_link.click()
            page.wait_for_function(
                "id => new URL(location.href).searchParams.get('id') === id",
                arg=recommendation_id,
                timeout=15000,
            )
            page.locator("#cpHeroTitle").wait_for(state="visible", timeout=20000)
            recommendation_title = page.locator("#cpHeroTitle").inner_text()
            if RECOMMENDATION_TITLE not in recommendation_title:
                raise RuntimeError("recommendation click did not open its returned course detail")
            page.go_back(wait_until="domcontentloaded", timeout=30000)
            page.wait_for_function(
                "id => new URL(location.href).searchParams.get('id') === id",
                arg=assignment_id,
                timeout=15000,
            )
            page.locator("#cpHeroTitle").wait_for(state="visible", timeout=20000)

            stage = "course-practice-entry-and-runner"
            page.locator(f'li[data-activity-id="{practice_activity_id}"]').click()
            page.wait_for_function(
                "id => window.CoursePlayerState?.getState()?.currentActivityId === id",
                arg=practice_activity_id,
                timeout=10000,
            )
            practice_button = page.locator("#cpPracticeGoBtn")
            practice_button.wait_for(state="visible", timeout=10000)
            with page.expect_navigation(url=re.compile(r"/student/practices/attempts/.*/runner/"), wait_until="domcontentloaded", timeout=30000):
                practice_button.click()
            runner_parts = [part for part in urlsplit(page.url).path.split("/") if part]
            try:
                attempt_id = runner_parts[runner_parts.index("attempts") + 1]
            except (ValueError, IndexError):
                raise RuntimeError("course practice did not navigate to a dynamic runner attempt")
            page.locator(".runner-page").wait_for(state="visible", timeout=30000)
            page.locator('[data-submit]').wait_for(state="visible", timeout=15000)
            runner_context = api_value(page, "getCoursePracticeContext", attempt_id)
            desktop["runner1440"] = capture(page, "runner-1440x900.png", 1440, 900)
            mobile["runner390"] = capture(page, "runner-390x844.png", 390, 844)
            page.set_viewport_size({"width": 1440, "height": 900})

            stage = "unanswered-submit-and-complete-report"
            page.locator('[data-submit]').click()
            page.get_by_role("dialog").wait_for(state="visible", timeout=10000)
            unanswered_copy = page.locator("#runner-submit-copy").inner_text()
            if "未作答" not in unanswered_copy or "零分" not in unanswered_copy:
                raise RuntimeError("Runner did not truthfully offer an unanswered submission")
            desktop["runnerUnansweredConfirm"] = capture(page, "runner-unanswered-confirm-1440x900.png", 1440, 900)
            with page.expect_response(lambda response: "/assessments/sessions/" in response.url and response.url.endswith("/submit") and response.request.method == "POST", timeout=30000) as submit_response:
                page.locator("[data-confirm-submit]").click()
            submit_status = submit_response.value.status
            if submit_status != 200:
                raise RuntimeError("normal unanswered submit did not return HTTP 200")
            page.wait_for_url(re.compile(r"/student/practices/attempts/.*/processing/"), timeout=30000)
            page.wait_for_timeout(1000)

            session = api_value(page, "getAssessmentSession", attempt_id)
            report = api_value(page, "getAssessmentReport", attempt_id)
            deadline = time.time() + 15
            while (not isinstance(report, dict) or session.get("status") != "COMPLETED") and time.time() < deadline:
                page.wait_for_timeout(500)
                session = api_value(page, "getAssessmentSession", attempt_id)
                report = api_value(page, "getAssessmentReport", attempt_id)
            items = api_value(page, "getPracticeAttemptItems", attempt_id)
            if isinstance(items, dict):
                items = items.get("items", [])
            summary = report.get("summary") if isinstance(report, dict) else None
            first_item = items[0] if isinstance(items, list) and items else {}
            max_score = first_item.get("maxScore") if isinstance(first_item, dict) else None
            student_answer = first_item.get("studentAnswer") if isinstance(first_item, dict) else None
            if not isinstance(report, dict) or not isinstance(summary, dict):
                raise RuntimeError("submitted practice report was not available through the real API")
            if session.get("status") != "COMPLETED":
                raise RuntimeError("submitted attempt did not reach the completed report state")
            if summary.get("unansweredItems") != 1 or max_score != 5 or student_answer is not None:
                raise RuntimeError("valid blank attempt did not retain the expected unanswered item contract")
            if report.get("overallScore") != 0 or summary.get("totalItems") != 1:
                raise RuntimeError("completed report did not reflect the one unanswered test item")
            if first_item.get("recordingId") is not None or first_item.get("recordingStatus") is not None:
                raise RuntimeError("the unanswered practice attempt unexpectedly contains recording evidence")

            page.wait_for_timeout(400)
            desktop["runnerResult1440"] = capture(page, "runner-result-1440x900.png", 1440, 900)
            final_course = api_value(page, "getStudentCourse", assignment_id)
            final_practice_activity = next(
                item for item in activity_rows(final_course)
                if (item.get("activityId") or item.get("id")) == practice_activity_id
            )
            final_course_progress = course_progress(final_course)

            result.update({
                "status": "PASS_NATIVE",
                "realLogin": {"status": "PASS", "http": login_status, "route": "student-login-ui"},
                "pages": {
                    "today": "PASS",
                    "courses": "PASS",
                    "courseDetail": "PASS",
                    "growth": "PASS",
                    "runner": "PASS",
                },
                "course": {
                    "assignmentIdPrefix": short_id(assignment_id),
                    "videoActivityIdPrefix": short_id(video_activity_id),
                    "practiceActivityIdPrefix": short_id(practice_activity_id),
                    "recommendationAssignmentIdPrefix": short_id(recommendation_id),
                    "recommendationNavigated": True,
                    "recommendationTitle": recommendation_title,
                },
                "video": {
                    "status": "PASS",
                    "playbackHost": video_metadata.get("sourceHost"),
                    "durationSeconds": round(float(video_metadata["durationSeconds"]), 3),
                    "decodedFrame": {
                        "width": decoded_media.get("videoWidth"),
                        "height": decoded_media.get("videoHeight"),
                        "totalVideoFrames": decoded_media.get("totalVideoFrames"),
                    },
                    "minioHttpStatuses": minio_statuses,
                    "partialPlaybackSeconds": round(float(partial_state["currentTime"]), 3),
                    "partialSaveHttp": partial_status,
                    "transientFailureInjected503": fault_control["injected"],
                    "persistentFailureMessageVisible": error_message_visible and still_visible,
                    "safeRetryHttp": retry_status,
                    "restoredAfterRefreshSeconds": round(float(restored_time), 3),
                    "endedSaveHttp": ended_status,
                    "endedServerConfirmed": ended_video_progress.get("completed") is True,
                    "otherRequiredActivityStillIncompleteAfterVideo": practice_activity_id not in completed_ids,
                    "coursePercentAfterVideoOnly": end_course_progress.get("progressPercent"),
                    "practiceProgressAfterVideoOnly": switched_practice_progress,
                    "coursePercentAfterPracticeSubmit": final_course_progress.get("progressPercent"),
                    "practiceCompletedAfterServerSync": (progress_for(final_practice_activity) or {}).get("completed") is True,
                },
                "coursePractice": {
                    "status": "PASS",
                    "attemptIdPrefix": short_id(attempt_id),
                    "courseContext": {
                        "assignmentIdPrefix": short_id((runner_context or {}).get("assignmentId")) if isinstance(runner_context, dict) else None,
                        "activityIdPrefix": short_id((runner_context or {}).get("activityId")) if isinstance(runner_context, dict) else None,
                    },
                    "submitHttp": submit_status,
                    "sessionStatus": session.get("status"),
                    "report": {
                        "present": True,
                        "totalItems": summary.get("totalItems"),
                        "answeredItems": summary.get("answeredItems"),
                        "unansweredItems": summary.get("unansweredItems"),
                        "overallScore": report.get("overallScore"),
                        "itemMaxScore": max_score,
                        "studentAnswerPersisted": student_answer is not None,
                        "recordingEvidence": False,
                    },
                },
                "activitySwitch": {
                    "practiceActivityWritesBeforePracticeLaunch": practice_activity_writes_before_ended,
                    "videoProgressCompletedAfterServerAcknowledgement": ended_video_progress.get("completed") is True,
                    "practiceProgressIncompleteBeforePracticeLaunch": not bool((switched_practice_progress or {}).get("completed")),
                },
                "screenshots": {"desktop": desktop, "mobile": mobile},
                "browserErrors": {"consoleErrorCount": console_error_count, "pageErrorCount": page_error_count, "requestFailedCount": request_failed_count},
                "faultInjection": {"scope": "T109 browser route only; one real progress write was intercepted before API", "httpStatus": 503, "retryReachedApi": retry_status == 200},
            })
            (OUT / "native-e2e-summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            (OUT / "browser-network-summary.json").write_text(json.dumps(summarize_responses(), ensure_ascii=False, indent=2) + "\n")
            return result
        finally:
            context.clear_cookies()
            browser.close()


def main():
    try:
        result = run()
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result.get("status") == "PASS_NATIVE" else 1
    except Exception as error:
        failure = {
            "taskId": "YZ-RD-T109",
            "sourceT108Sha": SOURCE_SHA,
            "runtimeProject": "yz-rd-t109",
            "status": "FAIL",
            "stage": stage,
            "errorClass": type(error).__name__,
            "consoleErrorCount": console_error_count,
            "pageErrorCount": page_error_count,
            "requestFailedCount": request_failed_count,
            "injectedProgress503Count": fault_control["injected"],
        }
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "native-e2e-failure.json").write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(failure, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
