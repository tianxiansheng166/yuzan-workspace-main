"""QB-016 browser proof for the product feedback loop and pilot admin page."""

import os

import pytest
from playwright.sync_api import Page, sync_playwright


BASE = os.environ.get("QB_RELEASE_BASE_URL", "http://127.0.0.1:4175")
PASSWORD = "YuzanTest!2026"


def payload(response):
    body = response.json()
    return body.get("data", body)


def authenticate(page: Page, identifier: str):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    session = payload(response)
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
        }""",
        session,
    )
    return session


@pytest.mark.skipif(not os.environ.get("QB_RELEASE_BASE_URL"), reason="requires the isolated pilot runtime")
def test_qb016_student_admin_feedback_loop():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        student_context = browser.new_context(viewport={"width": 1440, "height": 1100})
        student = student_context.new_page()
        student_session = authenticate(student, "student.test")
        school_id = student_session["activeSchoolId"]
        headers = {"Authorization": f"Bearer {student_session['accessToken']}"}
        catalog = payload(student.request.get(f"{BASE}/api/v1/schools/{school_id}/practices", headers=headers))
        practice = next((item for item in catalog["items"] if item.get("difficulty") == "水平一级"), catalog["items"][0])
        attempt = payload(student.request.post(f"{BASE}/api/v1/schools/{school_id}/practices/{practice['id']}/attempts", headers=headers, data={}))

        student.goto(f"{BASE}/student/practices/attempts/{attempt['attemptId']}/runner/")
        student.locator("[data-feedback-open]").wait_for(timeout=20_000)
        student.locator("[data-feedback-open]").click()
        student.locator("[data-feedback-message]").fill("第一题的图片与题目文字不一致")
        student.locator("[data-feedback-submit]").click()
        student.locator(".runner-feedback-history").get_by_text("待处理").wait_for(timeout=10_000)

        admin_context = browser.new_context(viewport={"width": 1440, "height": 1100})
        admin = admin_context.new_page()
        authenticate(admin, "admin.test")
        admin.goto(f"{BASE}/admin/pilot")
        admin.get_by_role("heading", name="试点运行").wait_for(timeout=20_000)
        admin.get_by_text("开放反馈").wait_for(timeout=10_000)
        admin.get_by_role("button", name="已知悉").click()
        admin.on("dialog", lambda dialog: dialog.accept("已核实并安排修正"))
        admin.get_by_role("button", name="处理完成").click()
        admin.get_by_text("已解决").wait_for(timeout=10_000)

        student.reload()
        student.locator("[data-feedback-open]").click()
        student.locator(".runner-feedback-history").get_by_text("已解决").wait_for(timeout=10_000)
        student.locator(".runner-feedback-history").get_by_text("已核实并安排修正").wait_for(timeout=10_000)

        admin_context.close()
        student_context.close()
        browser.close()
