import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"
OUT = Path("evidence/p0-reusable-practice-flow")


def authenticate(page):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """payload => {
          localStorage.setItem('yuzan-access-token', payload.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
          localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
        }""",
        payload,
    )


def create_or_resume_first_practice(page):
    return page.evaluate(
        """async () => {
          const schoolId = localStorage.getItem('yuzan-active-school-id');
          const headers = {
            Authorization: `Bearer ${localStorage.getItem('yuzan-access-token')}`,
            'Content-Type': 'application/json',
          };
          const practicesResponse = await fetch(`/api/v1/schools/${schoolId}/practices`, { headers });
          const practicesPayload = await practicesResponse.json();
          const catalog = practicesPayload.data || practicesPayload;
          const practices = catalog.items || catalog;
          const practice = practices.find(item => item.title === '古诗文朗读与理解训练');
          if (!practice) throw new Error('找不到古诗文练习');
          const attemptResponse = await fetch(`/api/v1/schools/${schoolId}/practices/${practice.id}/attempts`, {
            method: 'POST', headers, body: '{}',
          });
          const attemptPayload = await attemptResponse.json();
          const attempt = attemptPayload.data || attemptPayload;
          if (!attempt.attemptId) throw new Error(JSON.stringify(attemptPayload));
          return attempt.attemptId;
        }"""
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.add_init_script(
        """Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: { getUserMedia: async () => ({ getTracks: () => [] }) },
        });"""
    )
    page = context.new_page()
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    authenticate(page)
    attempt_id = create_or_resume_first_practice(page)
    page.goto(f"{BASE}/student/practices/attempts/{attempt_id}/prepare/")
    page.locator("[data-start-session]").wait_for(timeout=10_000)
    page.locator("[data-start-session]").click()
    page.wait_for_url("**/student/practices/attempts/*/reading/**", timeout=10_000)
    first_item_url = page.url
    page.locator("[data-listen-complete]").click()
    page.wait_for_url("**/student/practices/attempts/*/reading/**", timeout=10_000)
    second_item_url = page.url

    assert "/prepare" not in second_item_url
    assert first_item_url != second_item_url
    assert page_errors == [], page_errors
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / "continuous-practice-flow.png"), full_page=True)
    print(json.dumps({"attemptId": attempt_id, "first": first_item_url, "second": second_item_url}, ensure_ascii=False))
    browser.close()
