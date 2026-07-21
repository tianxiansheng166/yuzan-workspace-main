# -*- coding: utf-8 -*-
import json
from pathlib import Path
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
API = "http://127.0.0.1:4002/api/v1"
WEB = "http://127.0.0.1:4176"

def api(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{API}{path}", data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    return json.loads(urlopen(request).read().decode())

login = api("POST", "/auth/login", {"identifier": "student.test", "password": "YuzanTest!2026"})["data"]
token, school = login["accessToken"], login["activeSchoolId"]
practices = api("GET", f"/schools/{school}/practices", token=token)["data"]
assert len(practices) == 3, practices
attempt = api("POST", f"/schools/{school}/practices/{practices[0]['id']}/attempts", {}, token)["data"]
items = api("GET", f"/schools/{school}/practices/attempts/{attempt['attemptId']}/items", token=token)["data"]
assert len(items) == 5, items

results = {"practiceCount": len(practices), "attemptId": attempt["attemptId"], "itemCount": len(items), "screenshots": []}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, width, height, url in [
        ("catalog-desktop", 1440, 1100, "/student/practices/"),
        ("catalog-tablet", 1024, 1000, "/student/practices/"),
        ("detail-mobile", 390, 844, f"/student/practices/{practices[0]['id']}/"),
        ("prepare-desktop", 1440, 1100, f"/student/practices/attempts/{attempt['attemptId']}/prepare/"),
    ]:
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        console = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: console.append(f"{message.type}: {message.text}"))
        page.goto(f"{WEB}{url}", wait_until="networkidle")
        page.evaluate("""([token, school]) => { localStorage.setItem('yuzan-access-token', token); localStorage.setItem('yuzan-active-school-id', school); }""", [token, school])
        page.reload(wait_until="networkidle")
        if name.startswith("catalog"):
            assert page.locator("a.task-card").count() == 3, (page.locator("#app").inner_text(), console)
        if name == "detail-mobile":
            assert page.locator(".flow-list .flow").count() == 5
            assert page.locator("[data-start]").count() == 1
        if name == "prepare-desktop":
            assert page.locator("[data-device-list]").count() == 1
        assert not errors, errors
        image = ROOT / f"{name}.png"
        page.screenshot(path=str(image), full_page=True)
        results["screenshots"].append(image.name)
        page.close()
    browser.close()

(ROOT / "browser-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False))
