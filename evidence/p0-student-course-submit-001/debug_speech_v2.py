"""Minimal SPEECH activity debug script.
Captures console errors and API traces during the recording flow.
"""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "student.test")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "YuzanTest!2026")

console_entries = []
page_errors = []
api_responses = []

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-fake-device-for-media-stream"],
            headless=True,
        )
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Capture console
        page.on("console", lambda msg: console_entries.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on("response", lambda resp: _track_api(resp))

        # Step 1: Login
        print("=== STEP 1: LOGIN ===")
        page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
        page.locator("#loginAccount").fill(IDENTIFIER)
        page.locator("#loginPassword").fill(PASSWORD)
        page.locator('[data-action="login"]').click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
        page.wait_for_load_state("networkidle")
        print("Login OK")

        # Step 2: Discover course with SPEECH activity
        print("\n=== STEP 2: DISCOVER COURSE ===")
        target = page.evaluate("""async () => {
          const listed = await YuzanApi.listStudentCourses();
          const courses = listed.courses || listed.items || [];
          for (const summary of courses) {
            if (summary.source !== 'TEACHER_ASSIGNED') continue;
            const detail = await YuzanApi.getStudentCourse(summary.assignmentId);
            const units = detail.units || [];
            const activities = [];
            for (const u of units) {
              for (const l of (u.lessons || [])) {
                for (const a of (l.activities || [])) {
                  const t = a.activityType || a.type || '';
                  if (t === 'SPEECH') {
                    activities.push({
                      activityId: a.activityId || a.id,
                      activityType: t,
                      title: a.title || '',
                      isCompleted: !!(a.progress && a.progress.completed)
                    });
                  }
                }
              }
            }
            if (activities.length > 0) {
              return {
                assignmentId: summary.assignmentId,
                courseTitle: detail.courseVersion?.title || summary.title || '',
                speechActivities: activities
              };
            }
          }
          return null;
        }""")
        if not target:
            print("No course with SPEECH activity found!")
            browser.close()
            return
        print(f"Found course: {target['courseTitle']}")
        print(f"SPEECH activities: {json.dumps(target['speechActivities'], indent=2)}")

        # Step 3: Navigate to course
        print("\n=== STEP 3: NAVIGATE TO COURSE ===")
        assignment_id = target["assignmentId"]
        page.goto(f"{BASE_URL}/student/courses/course-detail/?id={assignment_id}", wait_until="networkidle")
        page.wait_for_function(
            "(assignmentId) => { const s = window.CoursePlayerState?.getState?.(); return Boolean(s && !s.loading && s.assignmentId === assignmentId && s.submissionId); }",
            arg=assignment_id, timeout=20_000
        )
        state = page.evaluate("() => CoursePlayerState.getState()")
        print(f"Course loaded. submissionId={state.get('submissionId')}, enrollmentId={state.get('enrollmentId')}")

        # Step 4: Switch to SPEECH activity
        speech = target["speechActivities"][0]
        if speech["isCompleted"]:
            print("SPEECH already completed, skipping")
            browser.close()
            return

        print(f"\n=== STEP 4: SWITCH TO SPEECH ACTIVITY {speech['activityId']} ===")
        page.evaluate("(aid) => CoursePlayerState.setCurrentActivity(aid)", speech["activityId"])
        page.wait_for_timeout(1000)
        page.wait_for_load_state("networkidle")

        # Step 5: Try recording
        print("\n=== STEP 5: START RECORDING ===")
        record_btn = page.locator(".cp-exercise-oral .cp-exercise-oral-btn.record")
        if not record_btn.is_visible():
            print("Record button NOT visible!")
            # Take screenshot
            page.screenshot(path=str(Path(__file__).parent / "debug_no_record_btn.png"))
            _dump_all()
            browser.close()
            return

        print("Record button visible, clicking...")
        record_btn.click()
        page.wait_for_timeout(2000)

        # Check state
        is_recording = page.evaluate(
            "() => { const btn = document.querySelector('.cp-exercise-oral-btn.record'); return btn ? btn.classList.contains('recording') : false; }"
        )
        print(f"Is recording: {is_recording}")

        if not is_recording:
            print("Recording state NOT activated after click!")
            _dump_all()
            page.screenshot(path=str(Path(__file__).parent / "debug_not_recording.png"))
            browser.close()
            return

        # Record for 3+ seconds
        print("Recording for 3.2 seconds...")
        time.sleep(3.2)

        # Stop recording
        print("Stopping recording...")
        record_btn.click()
        page.wait_for_timeout(5000)

        # Check status
        status_after = page.evaluate(
            "() => { const s = document.querySelector('.cp-exercise-oral-status'); return s ? { text: s.textContent, className: s.className } : null; }"
        )
        print(f"Status after stop: {json.dumps(status_after)}")

        # Wait longer for upload
        print("Waiting 30s for upload to complete...")
        try:
            completed = page.locator(".cp-exercise-oral .cp-exercise-oral-status.completed")
            completed.wait_for(state="visible", timeout=30_000)
            print("SPEECH ACTIVITY COMPLETED SUCCESSFULLY!")
        except Exception as e:
            print(f"Timeout waiting for completed status: {e}")
            # Check current state
            final_status = page.evaluate(
                "() => { const s = document.querySelector('.cp-exercise-oral-status'); const btn = document.querySelector('.cp-exercise-oral-btn.record'); return { status: s ? { text: s.textContent, className: s.className } : null, btn: btn ? { text: btn.textContent, className: btn.className, disabled: btn.disabled } : null }; }"
            )
            print(f"Final state: {json.dumps(final_status, indent=2)}")

        page.screenshot(path=str(Path(__file__).parent / "debug_speech_result.png"))
        _dump_all()
        browser.close()


def _track_api(response):
    url = response.url
    if "/api/v1/" in url:
        api_responses.append({
            "method": response.request.method,
            "url": url,
            "status": response.status,
        })


def _dump_all():
    print("\n=== CONSOLE ENTRIES (errors/warnings only) ===")
    for entry in console_entries:
        if entry["type"] in ("error", "warning"):
            print(f"  [{entry['type']}] {entry['text']}")

    print(f"\n=== PAGE ERRORS ({len(page_errors)}) ===")
    for err in page_errors:
        print(f"  {err}")

    print(f"\n=== API RESPONSES ({len(api_responses)}) ===")
    for r in api_responses:
        if r["status"] >= 400:
            print(f"  ** {r['method']} {r['url']} -> {r['status']}")
        else:
            print(f"  {r['method']} {r['url'].split('/api/v1/')[1][:60]} -> {r['status']}")

    # Write full dump
    dump = {
        "console_errors": [e for e in console_entries if e["type"] == "error"],
        "console_warnings": [e for e in console_entries if e["type"] == "warning"],
        "page_errors": page_errors,
        "api_responses": api_responses,
    }
    out_path = Path(__file__).parent / "debug_speech_dump.json"
    out_path.write_text(json.dumps(dump, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFull dump written to {out_path}")


if __name__ == "__main__":
    main()
