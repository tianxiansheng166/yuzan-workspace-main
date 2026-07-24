"""Quick SPEECH activity test to debug the recording flow."""

import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:4175"
IDENTIFIER = "student.test"
PASSWORD = "YuzanTest!2026"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    )
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        permissions=["microphone"],
        base_url=BASE_URL,
    )
    page = ctx.new_page()

    # Collect console errors
    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append(f"[PAGE_ERROR] {err}"))

    # Step 1: Login
    page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
    page.locator("#loginAccount").fill(IDENTIFIER)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
    print("LOGIN OK")

    # Step 2: Find course with SPEECH activity
    target = page.evaluate("""async () => {
      const listed = await YuzanApi.listStudentCourses();
      const courses = listed.courses || listed.items || [];
      for (const s of courses) {
        if (s.source !== 'TEACHER_ASSIGNED') continue;
        const d = await YuzanApi.getStudentCourse(s.assignmentId);
        const acts = [];
        for (const u of (d.units || [])) {
          for (const l of (u.lessons || [])) {
            for (const a of (l.activities || [])) {
              const t = a.activityType || a.type || '';
              if (t === 'SPEECH') {
                acts.push({ activityId: a.activityId || a.id, type: t, isCompleted: !!a.progress?.completed });
              }
            }
          }
        }
        if (acts.length > 0) return { assignmentId: s.assignmentId, activities: acts };
      }
      return null;
    }""")
    print(f"COURSE: {target}")

    if not target:
        print("NO SPEECH COURSE FOUND")
        browser.close()
        exit(1)

    # Step 3: Navigate to course
    page.goto(f"{BASE_URL}/student/courses/course-detail/?id={target['assignmentId']}", wait_until="networkidle")
    page.wait_for_function(
        f"() => Boolean(window.CoursePlayerState?.getState?.()?.submissionId)",
        timeout=20_000,
    )
    state = page.evaluate("() => CoursePlayerState.getState()")
    print(f"STATE: assignmentId={state.get('assignmentId')}, submissionId={state.get('submissionId')}")

    # Step 4: Switch to SPEECH activity
    speech_act = target["activities"][0]
    print(f"SPEECH activityId: {speech_act['activityId']}, isCompleted: {speech_act['isCompleted']}")

    page.evaluate(f"(aid) => CoursePlayerState.setCurrentActivity(aid)", speech_act["activityId"])
    page.wait_for_timeout(1500)

    # Check if oral exercise is rendered
    oral_div = page.locator(".cp-exercise-oral")
    try:
        oral_div.wait_for(state="visible", timeout=10_000)
        print("ORAL DIV VISIBLE")
    except:
        print("ORAL DIV NOT VISIBLE - checking page content")
        html = page.evaluate("() => document.querySelector('.cp-exercise-oral') ? 'YES' : document.body.innerHTML.substring(0, 500)")
        print(f"HTML snippet: {html}")

    # Check the record button
    record_btn = page.locator(".cp-exercise-oral-btn.record")
    try:
        record_btn.wait_for(state="visible", timeout=10_000)
        print(f"RECORD BTN VISIBLE: text={record_btn.inner_text()}")
    except:
        print("RECORD BTN NOT FOUND")
        # List all buttons on page
        buttons = page.evaluate("() => Array.from(document.querySelectorAll('button')).map(b => b.className + '|' + b.textContent).join('\\n')")
        print(f"ALL BUTTONS:\n{buttons}")

    # Step 5: Click to start recording
    if record_btn.is_visible():
        print("CLICKING RECORD...")
        record_btn.click()
        page.wait_for_timeout(2000)

        # Check if recording state activated
        is_recording = page.evaluate(
            "() => { const btn = document.querySelector('.cp-exercise-oral-btn.record'); return btn ? btn.classList.contains('recording') : false; }"
        )
        print(f"IS RECORDING: {is_recording}")

        status_text = page.evaluate(
            "() => { const s = document.querySelector('.cp-exercise-oral-status'); return s ? s.textContent : 'no status div'; }"
        )
        print(f"STATUS TEXT: {status_text}")

        if is_recording:
            # Record for 3+ seconds
            print("RECORDING FOR 3.2 SECONDS...")
            time.sleep(3.2)

            # Click to stop recording
            print("CLICKING STOP...")
            record_btn.click()
            page.wait_for_timeout(5000)

            # Check status after stop
            status_after = page.evaluate(
                "() => { const s = document.querySelector('.cp-exercise-oral-status'); return s ? { text: s.textContent, className: s.className } : null; }"
            )
            print(f"STATUS AFTER STOP: {status_after}")

            # Wait more for upload completion
            print("WAITING FOR UPLOAD COMPLETION (30s)...")
            try:
                completed = page.locator(".cp-exercise-oral-status.completed")
                completed.wait_for(state="visible", timeout=30_000)
                print("RECORDING COMPLETED!")
            except:
                # Check status again
                final_status = page.evaluate(
                    "() => { const s = document.querySelector('.cp-exercise-oral-status'); return s ? { text: s.textContent, className: s.className } : null; }"
                )
                print(f"FINAL STATUS: {final_status}")

    print(f"\nCONSOLE ERRORS ({len(errors)}):")
    for e in errors[:20]:
        print(f"  {e}")

    browser.close()
