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
SCREENSHOT = OUT / "screenshots" / "course-detail-video-load-failure.png"
responses = []


def response_handler(response):
    parsed = urlsplit(response.url)
    host = parsed.hostname or "unknown"
    if host not in {"frontend", "api", "minio"}:
        return
    headers = response.headers
    responses.append({
        "host": host,
        "method": response.request.method,
        "status": response.status,
        "category": (
            "auth-login" if "/auth/login" in parsed.path else
            "course-list" if "/student/courses" in parsed.path and parsed.path.rstrip("/").endswith("/student/courses") else
            "signed-playback-url" if "/playback-url" in parsed.path else
            "minio-media" if host == "minio" else
            "application-api"
        ),
        "mediaHeaders": ({key: headers.get(key) for key in ("content-type", "content-length", "content-range", "accept-ranges") if headers.get(key)} if host == "minio" else None),
    })


def media_state(page):
    return page.evaluate("""() => {
      const video = document.querySelector('#cpVideo');
      const error = document.querySelector('#cpVideoError');
      let sourceHost = null;
      try { sourceHost = new URL(video?.currentSrc || '').hostname; } catch {}
      return {
        videoPresent: Boolean(video),
        readyState: video?.readyState ?? null,
        networkState: video?.networkState ?? null,
        mediaErrorCode: video?.error?.code ?? null,
        currentTimeSeconds: Number.isFinite(video?.currentTime) ? video.currentTime : null,
        sourceHost,
        visibleError: Boolean(error && !error.hidden && getComputedStyle(error).display !== 'none'),
        errorMessage: (error?.innerText || '').trim().slice(0, 180)
      };
    }""")


def api_value(page, method, *args):
    return page.evaluate(
        """async ({method, args}) => {
          const api = window.YuzanApi;
          if (!api || typeof api[method] !== 'function') throw new Error('Expected T109 API method unavailable');
          const value = await api[method](...args);
          return value && typeof value === 'object' && 'data' in value ? value.data : value;
        }""",
        {"method": method, "args": list(args)},
    )


def activities(course):
    return [activity for unit in course.get("units", []) or []
            for lesson in unit.get("lessons", []) or []
            for activity in lesson.get("activities", []) or []]


def summarize_responses():
    counts = Counter((row["host"], row["method"], row["category"], row["status"]) for row in responses)
    media_headers = {}
    for row in responses:
        if row.get("mediaHeaders"):
            media_headers[(row["host"], row["method"], row["category"], row["status"])] = row["mediaHeaders"]
    return [{
        "host": host, "method": method, "category": category, "status": status,
        "count": count, "mediaHeaders": media_headers.get((host, method, category, status)),
    } for (host, method, category, status), count in sorted(counts.items())]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    result = {"taskId": "YZ-RD-T109", "sourceT108Sha": "8974c2a7d5842bb20dbfcd091b63cac5674dcc32", "runtimeProject": "yz-rd-t109", "status": "FAIL"}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = context.new_page()
        page.on("response", response_handler)
        try:
            page.goto(f"{WEB_URL}/login", wait_until="commit", timeout=30000)
            page.locator("#loginPanel").wait_for(state="visible", timeout=15000)
            page.locator("#loginAccount").fill(LOGIN)
            page.locator("#loginPassword").fill(PASSWORD)
            with page.expect_response(lambda r: "/auth/login" in r.url and r.request.method == "POST", timeout=30000) as login_response:
                page.locator('#loginPanel [data-action="login"]').click()
            if login_response.value.status != 200:
                raise RuntimeError("T109 test-student UI login did not return HTTP 200")
            page.wait_for_url(re.compile(r".*/student/today/?(?:\?.*)?$"), wait_until="commit", timeout=30000)

            page.goto(f"{WEB_URL}/student/courses/", wait_until="commit", timeout=30000)
            card = page.locator("#courseGrid .cc-card").filter(has_text="T109 真实课程视频验收")
            card.wait_for(state="visible", timeout=20000)
            assignment_id = card.get_attribute("data-assignment-id")
            if not assignment_id:
                raise RuntimeError("T109 live course card did not expose its assignment ID")
            with page.expect_navigation(url=re.compile(r"/student/courses/course-detail/"), wait_until="commit", timeout=30000):
                card.click()
            if parse_qs(urlsplit(page.url).query).get("id", [None])[0] != assignment_id:
                raise RuntimeError("Course Detail did not retain the dynamic T109 assignment ID")
            page.locator("#cpHeroTitle").wait_for(state="visible", timeout=20000)
            course = api_value(page, "getStudentCourse", assignment_id)
            video = next((row for row in activities(course) if row.get("activityType", row.get("type")) == "VIDEO"), None)
            video_id = (video or {}).get("activityId") or (video or {}).get("id")
            resources = [(entry.get("resource") or entry) for entry in (video or {}).get("resources", []) if isinstance(entry, dict)]
            if not video_id or not any(row.get("mediaType") == "video/mp4" for row in resources):
                raise RuntimeError("T109 course API did not return the temporarily selected MP4 resource")
            page.locator(f'li[data-activity-id="{video_id}"]').click()
            page.wait_for_function("id => window.CoursePlayerState?.getState()?.currentActivityId === id", arg=video_id, timeout=10000)
            page.wait_for_function(
                """() => {
                  const video = document.querySelector('#cpVideo');
                  const error = document.querySelector('#cpVideoError');
                  return (video?.error?.code > 0) || (error && !error.hidden && error.innerText.trim());
                }""",
                timeout=20000,
            )
            first_state = media_state(page)
            if not first_state["visibleError"] or not first_state["errorMessage"]:
                raise RuntimeError("MP4 media failure did not render a visible error message")
            page.wait_for_timeout(3000)
            second_state = media_state(page)
            page.screenshot(path=str(SCREENSHOT), full_page=False, animations="disabled")
            minio_ranges = [row for row in responses if row["host"] == "minio" and row["status"] == 206]
            if not second_state["visibleError"] or second_state["errorMessage"] != first_state["errorMessage"]:
                raise RuntimeError("MP4 media failure message did not remain visible for the observation interval")
            if second_state["mediaErrorCode"] != 4 or second_state["sourceHost"] != "minio" or not minio_ranges:
                raise RuntimeError("MP4 failure was not bound to the real MinIO media response and browser decoder")

            result.update({
                "status": "PASS",
                "loginHttpStatus": 200,
                "assignmentIdPrefix": assignment_id[:8],
                "videoActivityIdPrefix": video_id[:8],
                "liveApiMediaType": "video/mp4",
                "firstState": first_state,
                "afterThreeSeconds": second_state,
                "minio206Count": len(minio_ranges),
                "networkSummary": summarize_responses(),
                "screenshot": "evidence/yz-rd-t109/screenshots/course-detail-video-load-failure.png",
                "browserVersion": browser.version,
                "noRecordingAttempted": True,
            })
            (OUT / "mp4-error-capture.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            print(json.dumps(result, ensure_ascii=False))
            return 0
        except Exception as error:
            safe_message = str(error)
            for secret in (LOGIN, PASSWORD):
                if secret:
                    safe_message = safe_message.replace(secret, "[redacted]")
            result.update({"errorClass": type(error).__name__, "errorMessage": safe_message[:500], "networkSummary": summarize_responses()})
            (OUT / "mp4-error-capture.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            print(json.dumps(result, ensure_ascii=False))
            return 1
        finally:
            context.clear_cookies()
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
