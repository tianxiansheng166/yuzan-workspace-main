from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    visited = []
    page.on("framenavigated", lambda frame: visited.append(frame.url) if frame == page.main_frame else None)
    page.goto(f"{BASE}/login/")
    page.wait_for_load_state("networkidle")
    page.locator('#loginPanel input[name="account"]').fill("student.test")
    page.locator('#loginPanel input[name="password"]').fill("YuzanTest!2026")
    page.locator('#loginPanel button[type="submit"]').click()
    page.wait_for_url("**/student/**", timeout=12000)
    page.wait_for_load_state("networkidle")
    assert "/select-school" not in page.url, page.url
    assert "/login" not in page.url, page.url

    # Reproduce a previously issued tenant-less token. The picker must recover
    # from stored login memberships instead of bouncing back to /login.
    page.evaluate("localStorage.removeItem('yuzan-active-school-id')")
    page.goto(f"{BASE}/select-school/")
    page.wait_for_url("**/student/courses**", timeout=10000)
    assert "/login" not in page.url, page.url
    assert "/select-school" not in page.url, page.url
    print({"finalUrl": page.url, "visited": visited})
    browser.close()
