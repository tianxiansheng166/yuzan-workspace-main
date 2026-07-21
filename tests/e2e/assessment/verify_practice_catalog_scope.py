import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"
OUT = Path("evidence/p0-practice-catalog-scope-correction")


def authenticate(page):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate(
        """payload => {
          localStorage.setItem('yuzan-access-token', payload.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
          localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
        }""",
        payload,
    )


def wait_catalog(page):
    page.locator(".practice-tile").first.wait_for(timeout=12_000)
    page.wait_for_timeout(250)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()
    page_errors, bad_responses = [], []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "response",
        lambda response: bad_responses.append(f"{response.status} {response.url}")
        if "/api/v1/schools/" in response.url and "/00000000-0000-4000-8000-000000000099/" not in response.url and response.status >= 400
        else None,
    )

    authenticate(page)
    page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
    wait_catalog(page)
    titles = page.locator(".practice-tile h2").all_inner_texts()
    expected = {
        "古诗文朗读与理解训练",
        "现代文朗读与信息提取",
        "停顿与节奏专项训练",
        "声母发音专项训练",
        "声调听辨与跟读",
        "听后复述入门",
    }
    assert expected.issubset(set(titles)), titles
    assert page.locator(".student-topbar").count() == 1
    assert page.locator(".sidebar, .global-sidebar").count() == 0
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / "catalog-desktop.png"), full_page=True)
    print("catalog desktop verified", flush=True)

    # Search is served by the catalog API, not by a front-end fixture.
    page.locator("[data-search-input]").fill("声母")
    page.locator("[data-search-form]").press("Enter")
    wait_catalog(page)
    assert page.locator(".practice-tile h2").all_inner_texts() == ["声母发音专项训练"]
    print("search verified", flush=True)

    page.locator("[data-search-input]").fill("")
    page.locator("[data-search-form]").press("Enter")
    wait_catalog(page)
    page.locator('[data-filter-key="abilityCategory"][data-filter-value="古诗文"]').click()
    wait_catalog(page)
    filtered_titles = page.locator(".practice-tile h2").all_inner_texts()
    assert "古诗文朗读与理解训练" in filtered_titles, filtered_titles
    print("filter verified", flush=True)

    page.locator("[data-clear-all]").click()
    wait_catalog(page)
    page.locator("[data-sort]").select_option("DURATION_ASC")
    wait_catalog(page)
    durations = page.locator(".practice-tile-meta").all_inner_texts()
    assert "10 分钟" in durations[0], durations

    page.locator("[data-view='list']").click()
    page.locator(".practice-list").wait_for(timeout=5_000)
    page.screenshot(path=str(OUT / "catalog-list-desktop.png"), full_page=True)
    print("sort and list verified", flush=True)

    # Detail lists sections and rules but never item prompts or runtime IDs.
    page.locator(".practice-row a").filter(has_text="进入练习").first.click()
    page.locator(".practice-detail-hero").wait_for(timeout=10_000)
    page.wait_for_timeout(900)
    detail_text = page.locator("#app").inner_text()
    assert "练习目录" in detail_text and "开始前了解这些" in detail_text
    assert "万里赴戎机" not in detail_text
    assert "Session ID" not in detail_text and "Item ID" not in detail_text
    page.screenshot(path=str(OUT / "practice-detail-desktop.png"), full_page=True)
    print("detail verified", flush=True)

    # API contracts include server-side facets, filter result, and tenant denial.
    api_result = page.evaluate(
        """async () => {
          const schoolId = localStorage.getItem('yuzan-active-school-id');
          const headers = { Authorization: `Bearer ${localStorage.getItem('yuzan-access-token')}` };
          const selected = await fetch(`/api/v1/schools/${schoolId}/practices?abilityCategory=发音基础&sort=DURATION_ASC`, {headers});
          const selectedBody = await selected.json();
          const denied = await fetch('/api/v1/schools/00000000-0000-4000-8000-000000000099/practices', {headers});
          return { selectedStatus: selected.status, selected: selectedBody.data || selectedBody, deniedStatus: denied.status };
        }"""
    )
    assert api_result["selectedStatus"] == 200, api_result
    assert api_result["selected"]["total"] == 2, api_result
    assert api_result["selected"]["facets"]["abilityCategory"], api_result
    assert api_result["deniedStatus"] == 403, api_result
    print("API facets and tenant denial verified", flush=True)

    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    authenticate(mobile)
    mobile.goto(f"{BASE}/student/practices/", wait_until="networkidle")
    wait_catalog(mobile)
    mobile.screenshot(path=str(OUT / "catalog-mobile.png"), full_page=True)
    assert mobile.locator(".practice-tile").count() >= 6
    print("mobile verified", flush=True)

    assert page_errors == [], page_errors
    assert bad_responses == [], bad_responses
    print(json.dumps({"titles": titles, "api": api_result, "screenshots": sorted(path.name for path in OUT.glob("*.png"))}, ensure_ascii=False))
    browser.close()
