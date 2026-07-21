from pathlib import Path
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("YUZAN_WEB_BASE", "http://127.0.0.1:4175")
OUT = Path("evidence/p0-course-learning-closure/screenshots")
ROUTE = "/student/courses/85000000-0000-4000-8000-000000000001/submissions/4cde288e-c451-415b-b369-c4a4b96ed1ac/activities/84000000-0000-4000-8000-000000000101"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1024, "height": 900})
    response = page.request.post(f"{BASE}/api/v1/auth/login", data={"identifier": "student.test", "password": "YuzanTest!2026"})
    assert response.ok
    payload = response.json()["data"]
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate("""payload => {
      localStorage.setItem('yuzan-access-token', payload.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)
    for width, height in [(1024, 900), (390, 844)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(f"{BASE}{ROUTE}", wait_until="domcontentloaded")
        page.locator("#learningShell:not([hidden])").wait_for(timeout=10000)
        assert page.locator("#chapterPath a").count() == 4
        assert page.locator("#coursePoints li").count() == 2
        assert "理解" in page.locator("#noteContent").input_value()
        page.screenshot(path=str(OUT / f"player-{width}.png"), full_page=True)
    print({"chapterSteps": 4, "noteRestored": True, "viewports": [1024, 390]})
    browser.close()
