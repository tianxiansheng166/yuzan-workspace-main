"""SPEECH activity debug v3: Test recording with proper chromium flags and permissions.

Key differences from v2:
- Added --use-fake-ui-for-media-stream (auto-grant permission prompt)
- Added permissions=["microphone"] on context
- Detailed logging of getUserMedia result
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
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
            ],
            headless=True,
        )
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            permissions=["microphone"],
        )
        page = ctx.new_page()

        # Capture events
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

        # Step 2: Find course with SPEECH
        print("\n=== STEP 2: FIND COURSE WITH SPEECH ===")
        target = page.evaluate("""async () => {
          const listed = await YuzanApi.listStudentCourses();
          const courses = listed.courses || listed.items || [];
          for (const summary of courses) {
            if (summary.source !== 'TEACHER_ASSIGNED') continue;
            const detail = await YuzanApi.getStudentCourse(summary.assignmentId);
            const units = detail.units || [];
            const speechActs = [];
            for (const u of units) {
              for (const l of (u.lessons || [])) {
                for (const a of (l.activities || [])) {
                  const t = a.activityType || a.type || '';
                  if (t === 'SPEECH') {
                    speechActs.push({
                      activityId: a.activityId || a.id,
                      activityType: t,
                      title: a.title || '',
                      isCompleted: !!(a.progress && a.progress.completed)
                    });
                  }
                }
              }
            }
            if (speechActs.length > 0) {
              return {
                assignmentId: summary.assignmentId,
                courseTitle: detail.courseVersion?.title || summary.title || '',
                speechActivities: speechActs
              };
            }
          }
          return null;
        }""")
        if not target:
            print("No SPEECH course found!")
            _dump_all()
            browser.close()
            return

        print(f"Found: {target['courseTitle']}")
        for sa in target["speechActivities"]:
            print(f"  - {sa['activityId']}: {sa['title']} (completed={sa['isCompleted']})")

        # Step 3: Navigate to course
        print("\n=== STEP 3: NAVIGATE TO COURSE ===")
        assignment_id = target["assignmentId"]
        page.goto(f"{BASE_URL}/student/courses/course-detail/?id={assignment_id}", wait_until="networkidle")
        page.wait_for_function(
            "(assignmentId) => { const s = window.CoursePlayerState?.getState?.(); return Boolean(s && !s.loading && s.assignmentId === assignmentId && s.submissionId); }",
            arg=assignment_id, timeout=20_000
        )
        state = page.evaluate("() => CoursePlayerState.getState()")
        print(f"Course loaded. submissionId={state.get('submissionId')}")

        # Step 4: Switch to first incomplete SPEECH activity
        speech = None
        for sa in target["speechActivities"]:
            if not sa["isCompleted"]:
                speech = sa
                break
        if not speech:
            print("All SPEECH activities already completed!")
            browser.close()
            return

        print(f"\n=== STEP 4: SWITCH TO SPEECH {speech['activityId']} ===")
        page.evaluate("(aid) => CoursePlayerState.setCurrentActivity(aid)", speech["activityId"])
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")

        # Step 5: Check if recording UI rendered
        print("\n=== STEP 5: CHECK RECORDING UI ===")
        record_btn_count = page.locator(".cp-exercise-oral-btn.record").count()
        print(f"Record button count: {record_btn_count}")

        if record_btn_count == 0:
            # Check what's visible
            exercise_html = page.evaluate("() => document.getElementById('exerciseSection')?.innerHTML?.substring(0, 500) || 'NO EXERCISE SECTION'")
            print(f"Exercise section HTML: {exercise_html}")
            page.screenshot(path=str(Path(__file__).parent / "debug_v3_no_record_btn.png"))
            _dump_all()
            browser.close()
            return

        # Step 6: Test getUserMedia availability first
        print("\n=== STEP 6: TEST getUserMedia ===")
        gum_result = page.evaluate("""async () => {
          try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              return { available: false, error: 'getUserMedia not available' };
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const tracks = stream.getTracks();
            const info = tracks.map(t => ({ kind: t.kind, label: t.label, readyState: t.readyState }));
            stream.getTracks().forEach(t => t.stop());
            return { available: true, tracks: info };
          } catch (err) {
            return { available: false, error: err.name + ': ' + err.message };
          }
        }""")
        print(f"getUserMedia result: {json.dumps(gum_result, indent=2)}")

        if not gum_result.get("available"):
            print("getUserMedia FAILED - recording will not work!")
            _dump_all()
            browser.close()
            return

        # Step 7: Click record button and observe
        print("\n=== STEP 7: CLICK RECORD BUTTON ===")
        record_btn = page.locator(".cp-exercise-oral-btn.record")
        record_btn.click()
        page.wait_for_timeout(3000)

        # Check button state
        btn_state = page.evaluate("""() => {
          const btn = document.querySelector('.cp-exercise-oral-btn.record');
          if (!btn) return null;
          return {
            innerHTML: btn.innerHTML.substring(0, 80),
            className: btn.className,
            disabled: btn.disabled,
            classList: Array.from(btn.classList)
          };
        }""")
        print(f"Button state after click: {json.dumps(btn_state, indent=2)}")

        is_recording = btn_state and 'recording' in (btn_state.get('classList') or [])
        print(f"Is recording: {is_recording}")

        if not is_recording:
            print("Recording NOT activated! Checking recordingState...")
            rs = page.evaluate("""() => {
              // Try to find the recordingState from the closure - we can't directly
              // but we can check the DOM state
              const status = document.querySelector('.cp-exercise-oral-status');
              return {
                statusText: status ? status.textContent : null,
                statusClass: status ? status.className : null
              };
            }""")
            print(f"Status div: {json.dumps(rs, indent=2)}")

            # Check console for getUserMedia errors
            gum_errors = [e for e in console_entries if 'getUserMedia' in e.get('text', '') or 'microphone' in e.get('text', '').lower() or 'media' in e.get('text', '').lower()]
            print(f"Related console entries: {json.dumps(gum_errors, indent=2)}")

            page.screenshot(path=str(Path(__file__).parent / "debug_v3_not_recording.png"))
            _dump_all()
            browser.close()
            return

        # Step 8: Record for 3 seconds then stop
        print("\n=== STEP 8: RECORDING FOR 3.2 SECONDS ===")
        time.sleep(3.2)

        print("Stopping recording...")
        record_btn.click()
        page.wait_for_timeout(5000)

        # Check upload status
        status_after = page.evaluate("""() => {
          const s = document.querySelector('.cp-exercise-oral-status');
          const btn = document.querySelector('.cp-exercise-oral-btn.record');
          return {
            status: s ? { text: s.textContent, className: s.className } : null,
            btn: btn ? { text: btn.textContent, className: btn.className, disabled: btn.disabled } : null
          };
        }""")
        print(f"Status after stop: {json.dumps(status_after, indent=2)}")

        # Wait for upload completion
        print("Waiting for upload (max 60s)...")
        try:
            completed = page.locator(".cp-exercise-oral .cp-exercise-oral-status.completed")
            completed.wait_for(state="visible", timeout=60_000)
            print("SPEECH RECORDING COMPLETED SUCCESSFULLY!")
        except Exception as e:
            print(f"Upload timeout: {e}")
            final = page.evaluate("""() => {
              const s = document.querySelector('.cp-exercise-oral-status');
              const btn = document.querySelector('.cp-exercise-oral-btn.record');
              return {
                status: s ? { text: s.textContent, className: s.className } : null,
                btn: btn ? { text: btn.textContent, className: btn.className, disabled: btn.disabled } : null
              };
            }""")
            print(f"Final state: {json.dumps(final, indent=2)}")

        page.screenshot(path=str(Path(__file__).parent / "debug_v3_result.png"))
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
    print("\n=== CONSOLE ERRORS ===")
    for e in console_entries:
        if e["type"] in ("error", "warning"):
            print(f"  [{e['type']}] {e['text']}")

    print(f"\n=== PAGE ERRORS ({len(page_errors)}) ===")
    for err in page_errors:
        print(f"  {err}")

    print(f"\n=== FAILED API CALLS ===")
    for r in api_responses:
        if r["status"] >= 400:
            print(f"  ** {r['method']} {r['url']} -> {r['status']}")

    dump = {
        "console_errors": [e for e in console_entries if e["type"] == "error"],
        "page_errors": page_errors,
        "api_responses": api_responses,
    }
    out = Path(__file__).parent / "debug_v3_dump.json"
    out.write_text(json.dumps(dump, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDump -> {out}")


if __name__ == "__main__":
    main()
