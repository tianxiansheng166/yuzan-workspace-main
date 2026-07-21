from pathlib import Path
import os
from playwright.sync_api import sync_playwright


BASE = os.environ.get("YUZAN_WEB_BASE", "http://127.0.0.1:4175")
AUTH_BASE = os.environ.get("YUZAN_AUTH_BASE", BASE)
OUT = Path("evidence/p0-course-learning-closure/screenshots")
OUT.mkdir(parents=True, exist_ok=True)


def login(page):
    response = page.request.post(f"{AUTH_BASE}/api/v1/auth/login", data={"identifier": "student.test", "password": "YuzanTest!2026"})
    assert response.ok, {"status": response.status, "body": response.text()}
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate("""payload => {
      localStorage.setItem('yuzan-access-token', payload.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    responses = []
    page.on("console", lambda message: errors.append({"type": message.type, "text": message.text}) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append({"type": "pageerror", "text": str(error)}))
    page.on("response", lambda response: responses.append({"url": response.url, "status": response.status}) if "/api/" in response.url else None)
    try:
        login(page)
    except Exception:
        print({"loginErrors": errors, "loginResponses": responses, "loginUrl": page.url, "pageText": page.locator("body").inner_text()[-1200:]})
        raise
    page.goto(f"{BASE}/student/courses/")
    try:
        page.locator(".course-row").first.wait_for(timeout=10000)
    except Exception:
        page.screenshot(path=str(OUT / "catalog-debug.png"), full_page=True)
        print({"errors": errors, "responses": responses, "state": page.locator("#catalogState").inner_text(), "url": page.url})
        raise
    assert page.locator(".course-row").count() == 4
    assert "spring-2" not in page.content()
    page.screenshot(path=str(OUT / "catalog-1440.png"), full_page=True)

    page.get_by_role("button", name="古诗文", exact=True).click()
    assert page.locator(".course-row").count() == 1
    page.get_by_role("button", name="全部", exact=True).click()
    page.locator(".course-row").nth(2).click()
    page.wait_for_url("**/student/courses/*")
    page.locator("#detailTitle").wait_for()
    assert page.locator(".outline-activity").count() >= 4
    assignment_url = page.url
    page.screenshot(path=str(OUT / "detail-1440.png"), full_page=True)
    page.reload()
    page.locator("#detailTitle").wait_for()
    assert page.url == assignment_url
    for width, height in [(1024, 900), (390, 844)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(f"{BASE}/student/courses/")
        page.locator(".course-row").first.wait_for(timeout=10000)
        page.screenshot(path=str(OUT / f"catalog-{width}.png"), full_page=True)
        page.locator(".course-row").first.click()
        page.locator("#detailTitle").wait_for(timeout=10000)
        page.screenshot(path=str(OUT / f"detail-{width}.png"), full_page=True)
    assert errors == [], errors
    print({"courses": 4, "detailUrl": assignment_url, "consoleErrors": errors})
    browser.close()
