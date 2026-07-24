"""Quick smoke test: login, select-school, discover course via browser."""
from __future__ import annotations
import json, os, sys
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "student.test")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "YuzanTest!2026")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        permissions=["microphone"],
    )
    page = ctx.new_page()

    # Step 1: Login
    print("1. Navigating to login...")
    page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
    print(f"   URL: {page.url}")

    print("2. Filling login form...")
    page.locator("#loginAccount").fill(IDENTIFIER)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()

    print("3. Waiting for redirect...")
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
    page.wait_for_load_state("networkidle")
    print(f"   URL after login: {page.url}")

    # Check if on select-school page
    if "/select-school" in page.url:
        print("4. On select-school page, clicking first school...")
        # Wait for school cards to appear
        school_cards = page.locator(".school-card, .school-item, [data-school-id]")
        if school_cards.count() > 0:
            school_cards.first.click()
            page.wait_for_url(lambda url: "/select-school" not in url, timeout=10_000)
            page.wait_for_load_state("networkidle")
            print(f"   URL after school selection: {page.url}")
        else:
            print("   No school cards found, trying auto-select...")
            # Maybe there's only one school and it auto-selects
            page.wait_for_timeout(3000)
            print(f"   URL after wait: {page.url}")

    # Step 4: Check token
    token_present = page.evaluate("() => Boolean(localStorage.getItem('yuzan-access-token'))")
    print(f"5. Token present: {token_present}")

    # Step 5: Try to discover course via YuzanApi
    if token_present:
        print("6. Trying to discover courses via YuzanApi...")
        try:
            result = page.evaluate("""async () => {
                try {
                    const listed = await YuzanApi.listStudentCourses();
                    return {success: true, data: listed};
                } catch(e) {
                    return {success: false, error: e.message || String(e)};
                }
            }""")
            if result.get("success"):
                courses = result["data"].get("courses", result["data"].get("items", []))
                print(f"   Found {len(courses)} courses")
                for c in courses[:5]:
                    print(f"   - {c.get('assignmentId', 'N/A')}: {c.get('title', c.get('courseTitle', 'N/A'))} (source={c.get('source', 'N/A')})")
            else:
                print(f"   API error: {result.get('error')}")
        except Exception as e:
            print(f"   Evaluation error: {e}")
    else:
        print("6. Skipped - no token")

    # Step 6: Navigate to student courses page
    print("7. Navigating to /student/courses/...")
    page.goto(f"{BASE_URL}/student/courses/", wait_until="networkidle")
    page.wait_for_timeout(3000)
    print(f"   URL: {page.url}")
    print(f"   Title: {page.title()}")

    # Take screenshot
    page.screenshot(path="D:/program/test_program/yuzanxinsheng/three/worktrees/P0-STUDENT-COURSE-SUBMIT-001/evidence/p0-student-course-submit-001/smoke_test.png")
    print("8. Screenshot saved to smoke_test.png")

    browser.close()
    print("Done!")
