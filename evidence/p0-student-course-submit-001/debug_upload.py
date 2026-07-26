"""Debug recording upload chain: init -> upload -> complete -> link -> saveActivityAttempt.
Tracks every step and captures exact error messages.
"""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "student.test")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "YuzanTest!2026")

console_entries = []
page_errors = []

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
            headless=True,
        )
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            permissions=["microphone"],
        )
        page = ctx.new_page()

        page.on("console", lambda msg: console_entries.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # Login
        print("=== LOGIN ===")
        page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
        page.locator("#loginAccount").fill(IDENTIFIER)
        page.locator("#loginPassword").fill(PASSWORD)
        page.locator('[data-action="login"]').click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
        page.wait_for_load_state("networkidle")
        print("OK")

        # Find SPEECH course
        print("\n=== FIND COURSE ===")
        target = page.evaluate("""async () => {
          const listed = await YuzanApi.listStudentCourses();
          const courses = listed.courses || listed.items || [];
          for (const summary of courses) {
            if (summary.source !== 'TEACHER_ASSIGNED') continue;
            const detail = await YuzanApi.getStudentCourse(summary.assignmentId);
            const units = detail.units || [];
            for (const u of units) {
              for (const l of (u.lessons || [])) {
                for (const a of (l.activities || [])) {
                  const t = a.activityType || a.type || '';
                  if (t === 'SPEECH' && !(a.progress && a.progress.completed)) {
                    return {
                      assignmentId: summary.assignmentId,
                      activityId: a.activityId || a.id,
                      courseTitle: detail.courseVersion?.title || ''
                    };
                  }
                }
              }
            }
          }
          return null;
        }""")
        if not target:
            print("No incomplete SPEECH found!")
            browser.close()
            return
        print(f"Found: {target['courseTitle']}, activityId={target['activityId']}")

        # Navigate to course
        assignment_id = target["assignmentId"]
        page.goto(f"{BASE_URL}/student/courses/course-detail/?id={assignment_id}", wait_until="networkidle")
        page.wait_for_function(
            "(assignmentId) => { const s = window.CoursePlayerState?.getState?.(); return Boolean(s && !s.loading && s.assignmentId === assignmentId && s.submissionId); }",
            arg=assignment_id, timeout=20_000
        )

        # Switch to SPEECH
        page.evaluate("(aid) => CoursePlayerState.setCurrentActivity(aid)", target["activityId"])
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")

        # Inject debugging hook into uploadOralRecording
        print("\n=== INJECT DEBUG HOOK ===")
        page.evaluate("""() => {
          // Add global error listener for unhandled promise rejections
          window.addEventListener('unhandledrejection', function(e) {
            console.error('UNHANDLED_REJECTION: ' + (e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'unknown'));
          });

          // Monkey-patch XMLHttpRequest to log all requests
          const origOpen = XMLHttpRequest.prototype.open;
          const origSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function(method, url) {
            this._debugMethod = method;
            this._debugUrl = url;
            return origOpen.apply(this, arguments);
          };
          XMLHttpRequest.prototype.send = function() {
            const self = this;
            this.addEventListener('load', function() {
              if (self._debugUrl && !self._debugUrl.includes('/api/v1/')) {
                console.log('XHR: ' + self._debugMethod + ' ' + self._debugUrl + ' -> ' + self.status);
              }
            });
            this.addEventListener('error', function() {
              console.error('XHR_ERROR: ' + self._debugMethod + ' ' + self._debugUrl);
            });
            return origSend.apply(this, arguments);
          };
        }""")

        # Click record button
        record_btn = page.locator(".cp-exercise-oral-btn.record")
        if record_btn.count() == 0:
            print("No record button!")
            browser.close()
            return

        print("\n=== START RECORDING ===")
        record_btn.click()
        page.wait_for_function(
            "() => { const btn = document.querySelector('.cp-exercise-oral-btn.record'); return btn && btn.classList.contains('recording'); }",
            timeout=10_000
        )
        print("Recording started!")

        # Record for 3.2 seconds
        time.sleep(3.2)

        print("\n=== STOP RECORDING ===")
        record_btn.click()

        # Wait and monitor state transitions
        print("Monitoring upload chain...")
        for i in range(30):
            page.wait_for_timeout(2000)
            state = page.evaluate("""() => {
              const status = document.querySelector('.cp-exercise-oral-status');
              const btn = document.querySelector('.cp-exercise-oral-btn.record');
              return {
                statusText: status ? status.textContent : null,
                statusClass: status ? status.className : null,
                btnText: btn ? btn.textContent.trim() : null,
                btnDisabled: btn ? btn.disabled : null,
                btnClassList: btn ? Array.from(btn.classList) : null
              };
            }""")

            status_text = state.get('statusText', '')
            is_completed = 'completed' in (state.get('statusClass') or '')
            is_uploading = 'uploading' in (state.get('statusClass') or '')

            if i % 5 == 0 or is_completed or (status_text and status_text != '待录音'):
                print(f"  [{i*2}s] status={status_text}, class={state.get('statusClass')}, btn={'disabled' if state.get('btnDisabled') else state.get('btnText')}")

            if is_completed:
                print("\nSPEECH COMPLETED SUCCESSFULLY!")
                break

            # If back to idle with no activity, upload failed
            if state.get('statusClass') == 'cp-exercise-oral-status' and status_text == '待录音' and i > 3:
                print(f"\nUpload FAILED - state returned to idle at {i*2}s")
                break
        else:
            print("\nTimeout waiting for completion")

        # Dump console
        print("\n=== ALL CONSOLE ENTRIES (non-log) ===")
        for e in console_entries:
            if e["type"] != "log" or "XHR" in e["text"] or "upload" in e["text"].lower():
                print(f"  [{e['type']}] {e['text'][:200]}")

        print(f"\n=== PAGE ERRORS ({len(page_errors)}) ===")
        for err in page_errors:
            print(f"  {err}")

        page.screenshot(path=str(Path(__file__).parent / "debug_upload_result.png"))
        browser.close()


if __name__ == "__main__":
    main()
