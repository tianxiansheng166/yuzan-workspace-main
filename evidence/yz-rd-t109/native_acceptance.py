import json
import math
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
failed_requests = []
console_error_count = 0
page_error_count = 0
request_failed_count = 0
stage = "initialization"
fault_control = {"mode": "pass", "injected": 0}
login_http_status = None
video_loading_diagnostic = None
video_resource_diagnostic = None
runner_loading_diagnostic = None


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
        "mediaHeaders": ({
            key: response.headers.get(key)
            for key in ("content-type", "content-length", "content-range", "accept-ranges")
            if response.headers.get(key) is not None
        } if is_media else None),
    })
    if response_category(parsed.path, host) == "course-activity-progress":
        match = re.search(r"/activities/([0-9a-fA-F-]+)/attempt$", parsed.path)
        if match:
            progress_events.append({"activityId": match.group(1), "status": response.status})


def record_failed_request(request):
    global request_failed_count
    request_failed_count += 1
    parsed = urlsplit(request.url)
    host = parsed.hostname or "unknown"
    if host not in {"frontend", "api", "minio"}:
        return
    failure = request.failure or ""
    failed_requests.append({
        "host": host,
        "method": request.method,
        "category": response_category(parsed.path, host),
        "resourceType": request.resource_type,
        "failure": str(failure)[:180],
    })


def inspect_video_loading(page):
    return page.evaluate("""() => {
      const video = document.querySelector('#cpVideo');
      const error = document.querySelector('#cpVideoError');
      let sourceHost = null;
      let sourceScheme = null;
      try {
        const source = new URL(video?.currentSrc || '');
        sourceHost = source.hostname;
        sourceScheme = source.protocol;
      } catch {}
      return {
        videoPresent: Boolean(video),
        readyState: video?.readyState ?? null,
        networkState: video?.networkState ?? null,
        durationSeconds: Number.isFinite(video?.duration) ? video.duration : null,
        currentTimeSeconds: Number.isFinite(video?.currentTime) ? video.currentTime : null,
        sourceHost,
        sourceScheme,
        mediaErrorCode: video?.error?.code ?? null,
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        visibleError: Boolean(error && !error.hidden && getComputedStyle(error).display !== 'none'),
        errorMessage: (error?.innerText || '').trim().slice(0, 180),
        sourceElementCount: video?.querySelectorAll('source').length ?? 0
      };
    }""")


def inspect_runner_loading(page, attempt_id):
    return page.evaluate(r"""({attemptId}) => {
      const app = document.querySelector('#app');
      const error = app?.querySelector('.runner-error');
      const path = location.pathname.replace(/(\/attempts\/)[^/]+/, '$1[test-id]');
      const context = localStorage.getItem(`yuzan-course-practice-context:${attemptId}`);
      return {
        route: path,
        pageTitle: document.title,
        runnerPagePresent: Boolean(document.querySelector('.runner-page')),
        submitButtonCount: app?.querySelectorAll('[data-submit]').length ?? 0,
        questionMapButtonCount: app?.querySelectorAll('.runner-map [data-go]').length ?? 0,
        errorVisible: Boolean(error),
        errorText: (error?.innerText || '').trim().slice(0, 300),
        coursePracticeContextPresent: Boolean(context),
        appHeading: (app?.querySelector('h1, h2')?.innerText || '').trim().slice(0, 120)
      };
    }""", {"attemptId": attempt_id})


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
    media_headers = {}
    for entry in responses:
        key = (entry["host"], entry["method"], entry["category"], entry["status"])
        if entry.get("mediaHeaders"):
            media_headers[key] = entry["mediaHeaders"]
    return [
        {
            "host": host,
            "method": method,
            "category": category,
            "status": status,
            "count": count,
            "mediaHeaders": media_headers.get((host, method, category, status)),
        }
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


def course_player_activity_state(page):
    return page.evaluate("""() => {
      const activity = window.CoursePlayerState?.getState()?.currentActivity;
      const resources = (activity?.resources || []).map((entry) => entry?.resource || entry);
      return {
        activityIdPrefix: typeof activity?.activityId === 'string' ? activity.activityId.slice(0, 8) : null,
        activityType: activity?.activityType || activity?.type || null,
        videoUrlPresent: Boolean(activity?.videoUrl),
        resourceCount: resources.length,
        resources: resources.map((resource) => ({
          kind: resource?.kind || null,
          mediaType: resource?.mediaType || null,
          originalName: resource?.originalName || null,
          idPrefix: typeof resource?.id === 'string' ? resource.id.slice(0, 8) : null
        }))
      };
    }""")


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
    global console_error_count, page_error_count, request_failed_count, stage, login_http_status, video_loading_diagnostic, video_resource_diagnostic, runner_loading_diagnostic
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
        page.on("requestfailed", record_failed_request)

        try:
            stage = "real-login"
            page.goto(f"{WEB_URL}/login", wait_until="commit", timeout=30000)
            page.locator("#loginPanel").wait_for(state="visible", timeout=15000)
            page.locator("#loginAccount").fill(LOGIN)
            page.locator("#loginPassword").fill(PASSWORD)
            with page.expect_response(lambda response: "/auth/login" in response.url and response.request.method == "POST", timeout=30000) as login_response:
                page.locator('#loginPanel [data-action="login"]').click()
            login_status = login_response.value.status
            login_http_status = login_status
            result["loginHttpStatus"] = login_status
            if login_status != 200:
                raise RuntimeError("real student login did not return HTTP 200")
            page.wait_for_url(re.compile(r".*/student/today/?(?:\?.*)?$"), wait_until="commit", timeout=30000)
            safe_wait_network_idle(page)
            page.wait_for_timeout(400)
            result["realLogin"] = {"status": "PASS", "http": login_status, "route": "student-login-ui"}

            stage = "today-page"
            page.goto(f"{WEB_URL}/student/today", wait_until="commit", timeout=30000)
            page.locator("#todayApp").wait_for(state="visible", timeout=15000)
            page.wait_for_function(
                "() => Boolean(document.querySelector('#todayApp h1'))",
                timeout=20000,
            )
            safe_wait_network_idle(page)
            today_api = [entry for entry in responses if entry["category"] == "today-api"]
            if not today_api or not any(entry["status"] == 200 for entry in today_api):
                raise RuntimeError("Today did not render from a successful live API response")
            desktop["today1440"] = capture(page, "today-1440x900.png", 1440, 900)
            desktop["today1280"] = capture(page, "today-1280x900.png", 1280, 900)
            mobile["today390"] = capture(page, "today-390x844.png", 390, 844)

            stage = "growth-page"
            page.goto(f"{WEB_URL}/student/growth/", wait_until="commit", timeout=30000)
            page.wait_for_function("() => document.querySelector('#root')?.children.length > 0", timeout=20000)
            safe_wait_network_idle(page)
            page.wait_for_timeout(300)
            desktop["growth1440"] = capture(page, "growth-1440x900.png", 1440, 900)
            desktop["growth1280"] = capture(page, "growth-1280x900.png", 1280, 900)
            mobile["growth390"] = capture(page, "growth-390x844.png", 390, 844)

            stage = "courses-api-and-dynamic-route"
            page.goto(f"{WEB_URL}/student/courses/", wait_until="commit", timeout=30000)
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
            with page.expect_navigation(url=re.compile(r"/student/courses/course-detail/"), wait_until="commit", timeout=30000):
                course_card.click()
            if parse_qs(urlsplit(page.url).query).get("id", [None])[0] != assignment_id:
                raise RuntimeError("course detail route did not preserve the dynamic assignment ID")

            stage = "course-detail-api-and-media-source"
            page.locator("#cpHeroTitle").wait_for(state="visible", timeout=30000)
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
            api_resources = [entry.get("resource", entry) for entry in (video_activity.get("resources") or []) if isinstance(entry, dict)]
            video_resource_diagnostic = {
                "activityIdPrefix": short_id(video_activity_id),
                "activityType": video_activity.get("activityType", video_activity.get("type")),
                "videoUrlPresentInActivityDto": bool(video_activity.get("videoUrl")),
                "resourceCount": len(api_resources),
                "resources": [{
                    "idPrefix": short_id(resource.get("id")),
                    "kind": resource.get("kind"),
                    "mediaType": resource.get("mediaType"),
                    "originalName": resource.get("originalName"),
                } for resource in api_resources],
                "playerState": course_player_activity_state(page),
            }
            video_item = page.locator(f'li[data-activity-id="{video_activity_id}"]')
            video_item.wait_for(state="visible", timeout=10000)
            video_item.click()
            page.wait_for_function(
                "id => window.CoursePlayerState?.getState()?.currentActivityId === id",
                arg=video_activity_id,
                timeout=10000,
            )
            video_resource_diagnostic["playerStateAfterVideoSelection"] = course_player_activity_state(page)
            if not any(resource.get("kind") == "VIDEO" for resource in api_resources):
                video_loading_diagnostic = inspect_video_loading(page)
                page.screenshot(path=str(SCREENSHOTS / "course-detail-video-load-failure.png"), full_page=False)
                raise RuntimeError("live course-detail API did not return an attached VIDEO resource")
            try:
                page.wait_for_function(
                    """() => {
                      const video = document.querySelector('#cpVideo');
                      return video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
                    }""",
                    timeout=30000,
                )
            except PlaywrightTimeoutError:
                video_loading_diagnostic = inspect_video_loading(page)
                page.screenshot(path=str(SCREENSHOTS / "course-detail-video-load-failure.png"), full_page=False)
                raise
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
                desktop["courseDetailVideoPlaying1440"] = capture(
                    page, "course-detail-video-playing-1440x900.png", 1440, 900
                )
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
            duration_seconds = float(partial_state["duration"])
            if not math.isfinite(duration_seconds) or duration_seconds <= 0:
                raise RuntimeError("decoded video did not expose a finite positive duration after playback")
            video_metadata["durationSeconds"] = duration_seconds

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
            if not isinstance(saved_fraction, (int, float)) or not math.isfinite(float(saved_fraction)):
                raise RuntimeError("server did not return a persisted fractional video position")
            page.reload(wait_until="commit", timeout=30000)
            page.wait_for_function(
                """() => {
                  const video = document.querySelector('#cpVideo');
                  return video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
                }""",
                timeout=30000,
            )
            restored_time = page.evaluate("() => document.querySelector('#cpVideo').currentTime")
            expected_time = float(saved_fraction) * duration_seconds
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
            page.go_back(wait_until="commit", timeout=30000)
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
            with page.expect_navigation(url=re.compile(r"/student/practices/attempts/.*/prepare/"), wait_until="commit", timeout=30000):
                practice_button.click()
            prepare_parts = [part for part in urlsplit(page.url).path.split("/") if part]
            try:
                course_entry_attempt_id = prepare_parts[prepare_parts.index("attempts") + 1]
            except (ValueError, IndexError):
                raise RuntimeError("course practice did not navigate to a dynamic preparation attempt")
            page.locator("[data-start-session]").wait_for(state="visible", timeout=20000)
            prepare_start_enabled = page.locator("[data-start-session]").is_enabled()
            desktop["coursePracticePrepare1440"] = capture(page, "course-practice-prepare-1440x900.png", 1440, 900)

            stage = "practice-center-to-runner"
            practice_detail_url = f"{WEB_URL}/student/practices/{practice_definition_id}/"
            page.goto(practice_detail_url, wait_until="commit", timeout=30000)
            page.locator('[data-start]').wait_for(state="visible", timeout=20000)
            practice_detail_title = page.locator(".practice-detail-hero h1").inner_text()
            if "T109 情境问候练习" not in practice_detail_title:
                raise RuntimeError("practice detail did not show the API-returned T109 practice")
            desktop["practiceDetail1440"] = capture(page, "practice-detail-1440x900.png", 1440, 900)
            with page.expect_navigation(url=re.compile(r"/student/practices/attempts/.*/runner/"), wait_until="commit", timeout=30000):
                page.locator('[data-start]').click()
            runner_parts = [part for part in urlsplit(page.url).path.split("/") if part]
            try:
                attempt_id = runner_parts[runner_parts.index("attempts") + 1]
            except (ValueError, IndexError):
                raise RuntimeError("practice center did not navigate to a dynamic runner attempt")
            page.locator(".runner-page").wait_for(state="visible", timeout=30000)
            runner_attempt_api = api_value(page, "getPracticeAttempt", attempt_id)
            runner_items_api = api_value(page, "getPracticeAttemptItems", attempt_id)
            if isinstance(runner_items_api, dict):
                runner_items_api = runner_items_api.get("items", [])
            runner_items_api = runner_items_api if isinstance(runner_items_api, list) else []
            runner_loading_diagnostic = {
                "attempt": {
                    "status": runner_attempt_api.get("status") if isinstance(runner_attempt_api, dict) else None,
                    "courseActivityLinked": bool(runner_attempt_api.get("courseActivityId")) if isinstance(runner_attempt_api, dict) else False,
                    "courseSubmissionLinked": bool(runner_attempt_api.get("courseSubmissionId")) if isinstance(runner_attempt_api, dict) else False,
                },
                "itemCount": len(runner_items_api),
                "itemTypes": sorted({item.get("itemType") for item in runner_items_api if isinstance(item, dict)}),
                "maxScores": [item.get("maxScore") for item in runner_items_api if isinstance(item, dict)],
                "recordingIdCount": sum(1 for item in runner_items_api if isinstance(item, dict) and item.get("recordingId")),
                "dom": inspect_runner_loading(page, attempt_id),
            }
            try:
                # The native Runner offers submit only on its final question.
                # Keep the actual all-blank test intact while navigating there
                # through the rendered question map instead of treating the
                # initial question's "Next" button as a missing submit control.
                question_count = len(runner_items_api)
                if question_count != 20:
                    raise RuntimeError(f"T109 all-blank fixture expected 20 live items, received {question_count}")
                page.locator(f'.runner-map [data-go="{question_count - 1}"]').click()
                page.locator('[data-submit]').wait_for(state="visible", timeout=15000)
                runner_loading_diagnostic = {
                    **runner_loading_diagnostic,
                    "selectedQuestionNumber": question_count,
                    "submitControlVisible": True,
                    "dom": inspect_runner_loading(page, attempt_id),
                }
            except PlaywrightTimeoutError:
                runner_loading_diagnostic = inspect_runner_loading(page, attempt_id)
                page.screenshot(path=str(SCREENSHOTS / "runner-load-failure.png"), full_page=False)
                raise
            runner_context = api_value(page, "getCoursePracticeContext", attempt_id)
            desktop["runner1440"] = capture(page, "runner-1440x900.png", 1440, 900)
            desktop["runner1280"] = capture(page, "runner-1280x900.png", 1280, 900)
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
            if submit_status not in (200, 201):
                raise RuntimeError(f"normal unanswered submit returned unexpected HTTP {submit_status}")
            page.wait_for_url(re.compile(r"/student/practices/attempts/.*/processing/"), wait_until="commit", timeout=30000)
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
            max_scores = [item.get("maxScore") for item in items if isinstance(item, dict)] if isinstance(items, list) else []
            student_answers = [item.get("studentAnswer") for item in items if isinstance(item, dict)] if isinstance(items, list) else []
            recording_ids = [item.get("recordingId") for item in items if isinstance(item, dict)] if isinstance(items, list) else []
            if not isinstance(report, dict) or not isinstance(summary, dict):
                raise RuntimeError("submitted practice report was not available through the real API")
            if session.get("status") != "COMPLETED":
                raise RuntimeError("submitted attempt did not reach the completed report state")
            if summary.get("unansweredItems") != 20 or summary.get("answeredItems") != 0 or len(items) != 20:
                raise RuntimeError("valid all-blank 20-item attempt did not retain the expected unanswered item contract")
            if any(score != 5 for score in max_scores) or any(answer is not None for answer in student_answers):
                raise RuntimeError("all blank synthetic items did not retain valid maxScore and empty answer values")
            if report.get("overallScore") != 0 or summary.get("totalItems") != 20:
                raise RuntimeError("completed report did not reflect the all-unanswered zero-score contract")
            if any(recording_id is not None for recording_id in recording_ids) or any(
                item.get("recordingStatus") is not None for item in items if isinstance(item, dict)
            ):
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
                    "resourceFromLiveCourseApi": video_resource_diagnostic,
                    "coursePercentAfterVideoOnly": end_course_progress.get("progressPercent"),
                    "practiceProgressAfterVideoOnly": switched_practice_progress,
                    "coursePercentAfterPracticeSubmit": final_course_progress.get("progressPercent"),
                    "practiceCompletedAfterServerSync": (
                        (progress_for(final_practice_activity) or {}).get("completed") is True
                        if isinstance(runner_context, dict) and runner_context.get("assignmentId")
                        else None
                    ),
                    "runnerAttemptLinkedToCourseContext": bool(
                        isinstance(runner_context, dict) and runner_context.get("assignmentId")
                    ),
                },
                "coursePractice": {
                    "status": "PASS",
                    "courseEntryRoute": "/student/practices/attempts/[dynamic]/prepare/",
                    "courseEntryAttemptIdPrefix": short_id(course_entry_attempt_id),
                    "prepareStartButtonEnabled": prepare_start_enabled,
                    "practiceCenterStartNavigatedToRunner": True,
                    "practiceDetailTitle": practice_detail_title,
                    "runnerLoadingDiagnostic": runner_loading_diagnostic,
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
                        "itemMaxScore": max_scores,
                        "studentAnswerPersisted": any(answer is not None for answer in student_answers),
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
        safe_message = str(error)
        for secret in (LOGIN, PASSWORD):
            if secret:
                safe_message = safe_message.replace(secret, "[redacted]")
        safe_message = re.sub(r"(?i)bearer\s+\S+", "Bearer [redacted]", safe_message)
        safe_message = re.sub(
            r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
            "[test-id]",
            safe_message,
        )
        failure = {
            "taskId": "YZ-RD-T109",
            "sourceT108Sha": SOURCE_SHA,
            "runtimeProject": "yz-rd-t109",
            "status": "FAIL",
            "stage": stage,
            "loginHttpStatus": login_http_status,
            "errorClass": type(error).__name__,
            "errorMessage": safe_message[:1000],
            "consoleErrorCount": console_error_count,
            "pageErrorCount": page_error_count,
            "requestFailedCount": request_failed_count,
            "failedRequests": failed_requests,
            "responseSummary": summarize_responses(),
            "videoResourceDiagnostic": video_resource_diagnostic,
            "videoLoadingDiagnostic": video_loading_diagnostic,
            "runnerLoadingDiagnostic": runner_loading_diagnostic,
            "diagnosticScreenshot": (
                "evidence/yz-rd-t109/screenshots/course-detail-video-load-failure.png"
                if video_loading_diagnostic else None
            ),
            "injectedProgress503Count": fault_control["injected"],
        }
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "native-e2e-failure.json").write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(failure, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
