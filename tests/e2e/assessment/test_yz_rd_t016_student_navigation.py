"""Native Chromium/API/PostgreSQL proof for YZ-RD-T016 student navigation."""

from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ["YZ_T016_BASE_URL"].rstrip("/")
DATABASE_URL = os.environ["YZ_T016_DATABASE_URL"]
PASSWORD = os.environ["YZ_T016_PASSWORD"]
PSQL = os.environ["YZ_T016_PSQL"]
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
STUDENT_SEED_ID = "22222222-2222-4222-8222-222222222222"
SCREENSHOT_DIR = Path(os.environ.get("YZ_T016_SCREENSHOT_DIR", ROOT / "evidence/yz-rd-t016/screenshots"))
BASE_SHA = "4d971c9683664c09e533069ec001b00d0dc239af"

NAV_ROUTES = [
    ("今日学习", "/student/today/", "#todayApp .today-header", "/student/today"),
    ("课程中心", "/student/courses/", "#catalogContent", "/student/courses"),
    ("练习中心", "/student/practices/", "#app .practice-catalog-head", "/practices"),
    ("学习历史", "/student/practices/history/", "#app .history-record-panel", "/assessments/history"),
    ("我的成长", "/student/growth/", "#growthApp h1", "/assessments/sessions"),
    ("个人中心", "/student/profile/", "#profileName", "/student/profile"),
]


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def q(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["YZ_T016_POSTGRES_PORT"])
    assert parsed.username == os.environ["YZ_T016_POSTGRES_USER"]
    assert parsed.path.lstrip("/") == os.environ["YZ_T016_POSTGRES_DB"]
    password = unquote(parsed.password or "")
    assert password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    return result.stdout.strip() if capture else ""


def create_student_fixtures():
    suffix = uuid.uuid4().hex[:8]
    values = {
        "student_a_id": str(uuid.uuid4()),
        "student_a_membership": str(uuid.uuid4()),
        "student_a_enrollment": str(uuid.uuid4()),
        "student_a_secondary_membership": str(uuid.uuid4()),
        "student_a_secondary_enrollment": str(uuid.uuid4()),
        "student_b_id": str(uuid.uuid4()),
        "student_b_membership": str(uuid.uuid4()),
        "student_b_enrollment": str(uuid.uuid4()),
        "school_b_id": str(uuid.uuid4()),
        "term_b_id": str(uuid.uuid4()),
        "class_b_before_id": str(uuid.uuid4()),
        "class_b_after_id": str(uuid.uuid4()),
        "school_b_code": "T016-" + suffix,
        "school_b_name": "T016测试学校-" + suffix,
        "class_b_before_name": "T016学生甲转入班-" + suffix,
        "class_b_after_name": "T016学生甲转班后-" + suffix,
        "student_a_login": "student.t016.a." + suffix + "@test.invalid",
        "student_a_name": "甲同学 T016-" + suffix,
        "student_b_login": "student.t016.b." + suffix + "@test.invalid",
        "student_b_name": "乙同学 T016-" + suffix,
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(values["student_a_id"])},{q(values["student_a_login"])},{q(values["student_a_name"])},
                 "passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_SEED_ID)};
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {q(values["student_b_id"])},{q(values["student_b_login"])},{q(values["student_b_name"])},
                 "passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_SEED_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES
            ({q(values["student_a_membership"])},{q(SCHOOL_ID)},{q(values["student_a_id"])},'STUDENT','ACTIVE',NOW()),
            ({q(values["student_b_membership"])},{q(SCHOOL_ID)},{q(values["student_b_id"])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES
            ({q(values["student_a_enrollment"])},{q(SCHOOL_ID)},{q(CLASS_ID)},{q(values["student_a_id"])},'STUDENT','ACTIVE',NOW()),
            ({q(values["student_b_enrollment"])},{q(SCHOOL_ID)},{q(CLASS_ID)},{q(values["student_b_id"])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "School" (id,code,name,"createdAt","updatedAt")
          VALUES ({q(values["school_b_id"])},{q(values["school_b_code"])},{q(values["school_b_name"])},NOW(),NOW());
        INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
          VALUES ({q(values["term_b_id"])},{q(values["school_b_id"])},{q("T016测试学期-" + suffix)},
                  '2026-01-01','2036-12-31',true,NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES
            ({q(values["class_b_before_id"])},{q(values["school_b_id"])},{q(values["term_b_id"])},
             {q(values["class_b_before_name"])},'八年级',NOW(),NOW()),
            ({q(values["class_b_after_id"])},{q(values["school_b_id"])},{q(values["term_b_id"])},
             {q(values["class_b_after_name"])},'九年级',NOW(),NOW());
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({q(values["student_a_secondary_membership"])},{q(values["school_b_id"])},
                  {q(values["student_a_id"])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({q(values["student_a_secondary_enrollment"])},{q(values["school_b_id"])},
                  {q(values["class_b_before_id"])},{q(values["student_a_id"])},'STUDENT','ACTIVE',NOW());
        COMMIT;'''
    )
    return values


def delete_student_fixtures(values):
    if not values:
        return
    sql(
        f'''DELETE FROM "User"
            WHERE id IN ({q(values["student_a_id"])},{q(values["student_b_id"])});
            DELETE FROM "School" WHERE id={q(values["school_b_id"])};'''
    )


def login_api(page, identifier: str):
    response = page.request.post(
        BASE + "/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    session = payload(response)
    assert session.get("accessToken") and session.get("user")
    return session


def select_school(page, session, school_id: str):
    response = page.request.post(
        BASE + "/api/v1/auth/select-school",
        headers={"Authorization": "Bearer " + session["accessToken"]},
        data={"schoolId": school_id},
    )
    assert response.ok, response.text()
    selected = payload(response)
    assert selected.get("activeSchoolId") == school_id
    assert selected.get("accessToken")
    return selected


def set_session(page, session):
    page.goto(BASE + "/")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId || '');
        }""",
        session,
    )


def assert_route_content(page, label: str):
    selector = next(item[2] for item in NAV_ROUTES if item[0] == label)
    page.locator(selector).first.wait_for(state="visible", timeout=25_000)
    if label == "个人中心":
        expect(page.locator("#profileName")).to_contain_text("同学")
    if label == "我的成长":
        expect(page.locator("#growthApp h1")).to_contain_text("成长")


def assert_current_route(page, label: str):
    current = page.locator('.sn-link[aria-current="page"]')
    expect(current).to_have_count(1)
    expect(current).to_have_text(label)


def assert_no_horizontal_overflow(page):
    dimensions = page.evaluate(
        """() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          x: window.scrollX
        })"""
    )
    assert dimensions["document"] <= dimensions["viewport"], dimensions
    assert dimensions["body"] <= dimensions["viewport"], dimensions
    assert dimensions["x"] == 0, dimensions


def read_base_file(relative_path: str) -> str:
    result = subprocess.run(
        ["git", "show", BASE_SHA + ":" + relative_path],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def install_base_nav(page):
    base_js = read_base_file("frontend/shared/student-nav.js")
    base_css = read_base_file("frontend/shared/student-nav.css")

    def fulfill_asset(route):
        if urlparse(route.request.url).path.endswith(".js"):
            route.fulfill(status=200, content_type="application/javascript", headers={"cache-control": "no-store"}, body=base_js)
        else:
            route.fulfill(status=200, content_type="text/css", headers={"cache-control": "no-store"}, body=base_css)

    page.route("**/shared/student-nav.js*", fulfill_asset)
    page.route("**/shared/student-nav.css*", fulfill_asset)


def install_live_nav(page):
    page.unroute("**/shared/student-nav.js*")
    page.unroute("**/shared/student-nav.css*")


def store_session_in_other_page(switcher, session):
    switcher.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId || '');
        }""",
        session,
    )


def api_profile(page, session, school_id):
    response = page.request.get(
        BASE + "/api/v1/schools/" + school_id + "/student/profile",
        headers={"Authorization": "Bearer " + session["accessToken"]},
    )
    return response


def test_t016_student_nav_real_routes_identity_keyboard_and_viewports():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    fixtures = {}
    try:
        fixtures = create_student_fixtures()
        identity = sql(
            "SELECT current_database() || '|' || current_user || '|' || version();",
            capture=True,
        )
        expected_database = os.environ["YZ_T016_POSTGRES_DB"]
        expected_user = os.environ["YZ_T016_POSTGRES_USER"]
        assert identity.startswith(f"{expected_database}|{expected_user}|PostgreSQL 17."), identity.split("|", 2)[:2]

        with sync_playwright() as playwright:
            browser_path = os.environ.get("YZ_T016_CHROME", "/usr/bin/google-chrome")
            browser = playwright.chromium.launch(headless=True, executable_path=browser_path)
            context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="no-preference")
            page = context.new_page()
            responses = []
            history_payloads = []

            def capture_api_response(response):
                if "/api/v1/" not in response.url:
                    return
                responses.append((response.url, response.status))
                if urlparse(response.url).path.rstrip("/").endswith("/assessments/history") and 200 <= response.status < 300:
                    try:
                        history_payloads.append(payload(response))
                    except Exception:
                        pass

            page.on("response", capture_api_response)

            student_a_login = login_api(page, fixtures["student_a_login"])
            student_a_primary = select_school(page, student_a_login, SCHOOL_ID)
            set_session(page, student_a_primary)

            # Capture the exact baseline nav served from the requested base commit.
            install_base_nav(page)
            page.goto(BASE + "/student/today/", wait_until="domcontentloaded")
            page.locator("#todayApp .today-header").wait_for(state="visible", timeout=25_000)
            expect(page.locator(".sn-menu-toggle")).to_have_attribute("aria-expanded", "false")
            page.screenshot(path=str(SCREENSHOT_DIR / "before-390-menu-closed.png"), full_page=False)
            page.locator(".sn-menu-toggle").click()
            expect(page.locator(".sn-menu-toggle")).to_have_attribute("aria-expanded", "false")
            page.screenshot(path=str(SCREENSHOT_DIR / "before-390-menu-click-no-open.png"), full_page=False)
            install_live_nav(page)

            page.reload(wait_until="domcontentloaded")
            page.locator("#todayApp .today-header").wait_for(state="visible", timeout=25_000)
            page.wait_for_function("document.querySelector('.sn-name')?.textContent.includes('甲同学')", timeout=20_000)
            assert_current_route(page, "今日学习")
            assert_no_horizontal_overflow(page)
            assert not page.locator(".sn-offline").count()
            page.screenshot(path=str(SCREENSHOT_DIR / "after-390-menu-closed.png"), full_page=False)

            toggle = page.locator(".sn-menu-toggle")
            expect(toggle).to_have_attribute("aria-controls", "student-navigation")
            toggle.click()
            expect(toggle).to_have_attribute("aria-expanded", "true")
            toggle.click()
            expect(toggle).to_have_attribute("aria-expanded", "false")
            expect(toggle).to_be_focused()
            page.wait_for_function("document.querySelector('#student-navigation').hidden")
            toggle.focus()
            page.keyboard.press("Enter")
            expect(toggle).to_have_attribute("aria-expanded", "true")
            for label, _, _, _ in NAV_ROUTES:
                expect(page.locator(".sn-link").filter(has_text=label)).to_be_visible()
            page.wait_for_function("getComputedStyle(document.querySelector('.sn-menu-panel')).opacity === '1'")
            page.screenshot(path=str(SCREENSHOT_DIR / "after-390-menu-open.png"), full_page=False)
            page.keyboard.press("Tab")
            expect(page.locator(".sn-link").first).to_be_focused()
            page.keyboard.press("Escape")
            expect(toggle).to_have_attribute("aria-expanded", "false")
            expect(toggle).to_be_focused()
            page.wait_for_function("document.querySelector('#student-navigation').hidden")

            toggle.click()
            expect(toggle).to_have_attribute("aria-expanded", "true")
            page.mouse.click(375, 790)
            expect(toggle).to_have_attribute("aria-expanded", "false")
            page.wait_for_function("document.querySelector('#student-navigation').hidden")

            for label, route, selector, api_marker in NAV_ROUTES:
                start_index = len(responses)
                if not toggle.is_visible():
                    page.set_viewport_size({"width": 390, "height": 844})
                toggle = page.locator(".sn-menu-toggle")
                toggle.click()
                expect(toggle).to_have_attribute("aria-expanded", "true")
                link = page.locator(".sn-link").filter(has_text=label)
                expect(link).to_be_visible()
                expect(link).to_have_attribute("href", route)
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30_000):
                    link.click()
                page.wait_for_load_state("networkidle", timeout=30_000)
                assert page.url.split(BASE, 1)[1].split("?", 1)[0] == route
                assert_current_route(page, label)
                page.locator(selector).first.wait_for(state="visible", timeout=25_000)
                new_api = responses[start_index:]
                assert any(api_marker in url and 200 <= status < 300 for url, status in new_api), {
                    "route": route,
                    "marker": api_marker,
                    "responses": new_api,
                }
                assert_no_horizontal_overflow(page)
                if label == "课程中心":
                    for index in range(page.locator("#courseGrid [data-offline]").count()):
                        expect(page.locator("#courseGrid [data-offline]").nth(index)).to_be_hidden()
                if label == "个人中心":
                    page.screenshot(path=str(SCREENSHOT_DIR / "after-390-profile.png"), full_page=False)

            first_history = history_payloads[-1] if history_payloads else None
            assert first_history is not None, "the student history route did not load its real history response"
            history_start = len(history_payloads)
            page.goto(BASE + "/assessment/history/", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle", timeout=30_000)
            page.locator("#app .history-record-panel").first.wait_for(state="visible", timeout=25_000)
            assert len(history_payloads) > history_start, "the compatibility history route did not load the API"
            assert history_payloads[-1] == first_history, "history aliases returned different authenticated learning records"
            assert_current_route(page, "学习历史")

            # Refresh, back, and forward keep browser history and current-route state aligned.
            page.reload(wait_until="networkidle")
            assert_current_route(page, "学习历史")
            page.go_back(wait_until="networkidle")
            assert_current_route(page, "个人中心")
            page.go_forward(wait_until="networkidle")
            assert_current_route(page, "学习历史")
            assert_route_content(page, "学习历史")

            # At 768px, the complete menu remains available; resizing to desktop restores inline nav.
            page.set_viewport_size({"width": 768, "height": 1024})
            toggle = page.locator(".sn-menu-toggle")
            expect(toggle).to_be_visible()
            toggle.click()
            for label, _, _, _ in NAV_ROUTES:
                expect(page.locator(".sn-link").filter(has_text=label)).to_be_visible()
            assert_no_horizontal_overflow(page)
            page.wait_for_function("getComputedStyle(document.querySelector('.sn-menu-panel')).opacity === '1'")
            page.screenshot(path=str(SCREENSHOT_DIR / "after-768-menu-open.png"), full_page=False)

            tablet_api_start = len(responses)
            with page.expect_navigation(wait_until="domcontentloaded", timeout=30_000):
                page.locator(".sn-link").filter(has_text="今日学习").click()
            page.wait_for_load_state("networkidle", timeout=30_000)
            assert_current_route(page, "今日学习")
            assert any("/student/today" in url and 200 <= status < 300 for url, status in responses[tablet_api_start:])
            page.go_back(wait_until="networkidle")
            assert_current_route(page, "学习历史")

            # Reduced-motion preference keeps the menu immediate and accessible.
            page.emulate_media(reduced_motion="reduce")
            toggle = page.locator(".sn-menu-toggle")
            toggle.click()
            page.wait_for_function("getComputedStyle(document.querySelector('.sn-menu-panel')).opacity === '1'")
            durations = page.locator(".sn-menu-panel").evaluate(
                "element => getComputedStyle(element).transitionDuration.split(',').map(value => value.trim())"
            )
            seconds = [float(value[:-2]) / 1000 if value.endswith("ms") else float(value[:-1]) for value in durations]
            assert max(seconds, default=0) < 0.001, durations
            page.keyboard.press("Escape")
            page.wait_for_function("document.querySelector('#student-navigation').hidden")
            page.emulate_media(reduced_motion="no-preference")

            page.set_viewport_size({"width": 1280, "height": 900})
            expect(toggle).to_be_hidden()
            expect(page.locator(".sn-menu-panel")).to_be_visible()
            expect(toggle).to_have_attribute("aria-expanded", "false")
            assert_current_route(page, "学习历史")
            assert_no_horizontal_overflow(page)
            page.screenshot(path=str(SCREENSHOT_DIR / "after-1280-desktop.png"), full_page=False)

            page.set_viewport_size({"width": 1440, "height": 1000})
            assert_current_route(page, "学习历史")
            assert_no_horizontal_overflow(page)
            page.screenshot(path=str(SCREENSHOT_DIR / "after-1440-desktop.png"), full_page=False)

            page.locator('.sn-link[aria-current="page"]').focus()
            page.set_viewport_size({"width": 768, "height": 1024})
            expect(toggle).to_be_visible()
            expect(toggle).to_be_focused()
            expect(page.locator("#student-navigation")).to_be_hidden()

            # Slow only the browser-side request by a short interval; every response still comes from NestJS.
            page.evaluate(
                """() => {
                  const realFetch = window.fetch.bind(window);
                  window.fetch = async (...args) => {
                    if (String(args[0]).includes('/student/profile')) {
                      await new Promise(resolve => setTimeout(resolve, 650));
                    }
                    return realFetch(...args);
                  };
                }"""
            )
            switcher = context.new_page()
            switcher.goto(BASE + "/")
            student_a_secondary = select_school(page, student_a_primary, fixtures["school_b_id"])
            store_session_in_other_page(switcher, student_a_secondary)
            page.wait_for_function("document.querySelector('.sn-name')?.textContent === '正在确认身份'", timeout=5_000)
            expect(page.locator(".sn-name")).not_to_contain_text(fixtures["student_a_name"])
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_before_name"])
            page.wait_for_function(
                "name => document.querySelector('.sn-name')?.textContent === name",
                arg=fixtures["student_a_name"],
                timeout=10_000,
            )
            expect(page.locator(".sn-detail")).to_contain_text(fixtures["school_b_name"])
            expect(page.locator(".sn-detail")).to_contain_text(fixtures["class_b_before_name"])
            assert api_profile(page, student_a_secondary, fixtures["school_b_id"]).status == 200

            # A database-side enrollment switch is reflected on the next page focus/profile read.
            sql(
                f'''UPDATE "Enrollment" SET "classId"={q(fixtures["class_b_after_id"])}
                    WHERE id={q(fixtures["student_a_secondary_enrollment"])};'''
            )
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_function("document.querySelector('.sn-name')?.textContent === '正在确认身份'", timeout=5_000)
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_before_name"])
            page.wait_for_function(
                "identity => document.querySelector('.sn-name')?.textContent === identity.name && document.querySelector('.sn-detail')?.textContent.includes(identity.className)",
                arg={"name": fixtures["student_a_name"], "className": fixtures["class_b_after_name"]},
                timeout=10_000,
            )
            expect(page.locator(".sn-detail")).to_contain_text(fixtures["class_b_after_name"])
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_before_name"])

            student_b = login_api(page, fixtures["student_b_login"])
            store_session_in_other_page(switcher, student_b)
            page.wait_for_function("document.querySelector('.sn-name')?.textContent === '正在确认身份'", timeout=5_000)
            expect(page.locator(".sn-name")).not_to_contain_text(fixtures["student_a_name"])
            page.wait_for_function(
                "name => document.querySelector('.sn-name')?.textContent === name",
                arg=fixtures["student_b_name"],
                timeout=10_000,
            )
            expect(page.locator(".sn-avatar")).to_have_text("乙")
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_after_name"])

            # The status reports only Chromium's online/offline signal. No download affordance claims success.
            context.set_offline(True)
            expect(page.locator(".sn-state-copy")).to_have_text("网络状态 · 离线")
            assert not page.locator(".sn-offline").count()
            context.set_offline(False)
            expect(page.locator(".sn-state-copy")).to_have_text("网络状态 · 在线")

            teacher = login_api(page, "teacher.test")
            forbidden = api_profile(page, teacher, SCHOOL_ID)
            assert forbidden.status == 403
            anonymous = playwright.request.new_context()
            try:
                unauthenticated = anonymous.get(BASE + "/api/v1/schools/" + SCHOOL_ID + "/student/profile")
                assert unauthenticated.status == 401
            finally:
                anonymous.dispose()

            # A cross-school active-scope change clears the confirmed B identity immediately.
            store_session_in_other_page(switcher, student_b)
            switcher.evaluate("schoolId => localStorage.setItem('yuzan-active-school-id', schoolId)", fixtures["school_b_id"])
            page.wait_for_function("document.querySelector('.sn-name')?.textContent === '身份未确认'", timeout=5_000)
            expect(page.locator(".sn-name")).not_to_contain_text(fixtures["student_b_name"])
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_before_name"])
            expect(page.locator(".sn-detail")).not_to_contain_text(fixtures["class_b_after_name"])

            # Remove browser credentials in a second tab and verify the visible identity clears.
            switcher.evaluate(
                """() => {
                  localStorage.removeItem('yuzan-access-token');
                  localStorage.removeItem('yuzan-current-user');
                  localStorage.removeItem('yuzan-active-school-id');
                }"""
            )
            page.wait_for_function("document.querySelector('.sn-name')?.textContent === '未登录'", timeout=5_000)

            switcher.close()
            context.close()
            browser.close()
    finally:
        delete_student_fixtures(fixtures)
