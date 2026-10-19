"""Integrated T026 teacher invitation, student profile and school isolation proof.

The T023 and T021 scenarios are kept in their accepted source test files. This
test runs those flows against one T026-owned native runtime and instruments
real student navigation clicks between Today and Profile on the merged UI.
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import Page


ROOT = Path(__file__).resolve().parents[3]
BASE_URL = os.environ["YZ_T026_BASE_URL"]
API_BASE_URL = os.environ["YZ_T026_API_BASE_URL"]
DATABASE_URL = os.environ["YZ_T026_DATABASE_URL"]
DATABASE_NAME = os.environ["YZ_T026_DATABASE_NAME"]
DATABASE_USER = os.environ["YZ_T026_DATABASE_USER"]
DATABASE_PORT = int(os.environ["YZ_T026_POSTGRES_PORT"])
PSQL = os.environ["YZ_T026_PSQL"]
PG_LIBRARY = os.environ["YZ_T026_PG_LIBRARY"]
PASSWORD = os.environ["YZ_T026_PASSWORD"]
EVIDENCE = Path(os.environ["YZ_T026_EVIDENCE_DIR"])
CHROMIUM = os.environ.get("YZ_T026_CHROMIUM", "/usr/bin/google-chrome")


def sql(statement: str) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1" and parsed.port == DATABASE_PORT
    assert parsed.username == DATABASE_USER
    assert unquote(parsed.path.lstrip("/")) == DATABASE_NAME
    password = unquote(parsed.password or "")
    assert password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": DATABASE_USER,
        "PGPASSWORD": password,
        "PGDATABASE": DATABASE_NAME,
        "LD_LIBRARY_PATH": PG_LIBRARY,
    }
    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>")[-1800:])
    return result.stdout.strip()


def verify_database_identity() -> tuple[str, str, str]:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();")
    name, user, version = identity.split("|", 2)
    if name != DATABASE_NAME or user != DATABASE_USER or not version.startswith("PostgreSQL 17."):
        raise AssertionError("T026 E2E is not connected to its dedicated PostgreSQL 17 database/user")
    return name, user, version.split(",", 1)[0]


def load_source_test(module_name: str, path: Path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load accepted E2E source {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_t026_teacher_to_student_onboarding_and_school_isolation():
    db_name, db_user, db_version = verify_database_identity()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    flow_t023_evidence = EVIDENCE / "t023-browser-flow"
    flow_t021_evidence = EVIDENCE / "t021-profile-isolation"
    flow_t023_evidence.mkdir(parents=True, exist_ok=True)
    flow_t021_evidence.mkdir(parents=True, exist_ok=True)

    # Load the accepted T023 teacher UI flow and T021 profile isolation flow,
    # but point both at this test's independently verified T026 database.
    os.environ.update(
        {
            "YZ_T023_BASE_URL": BASE_URL,
            "YZ_T023_DATABASE_URL": DATABASE_URL,
            "YZ_T023_PASSWORD": PASSWORD,
            "YZ_T023_EVIDENCE_DIR": str(flow_t023_evidence),
            "YZ_T021_BASE_URL": BASE_URL,
            "YZ_T021_API_BASE_URL": API_BASE_URL,
            "YZ_T021_DATABASE_URL": DATABASE_URL,
            "YZ_T021_DATABASE_NAME": DATABASE_NAME,
            "YZ_T021_DATABASE_USER": DATABASE_USER,
            "YZ_T021_POSTGRES_PORT": str(DATABASE_PORT),
            "YZ_T021_PSQL": PSQL,
            "YZ_T021_PG_LIBRARY": PG_LIBRARY,
            "YZ_T021_EVIDENCE_DIR": str(flow_t021_evidence),
            "YZ_T021_CHROMIUM": CHROMIUM,
        }
    )
    t023 = load_source_test(
        "yz_rd_t026_t023_source_flow",
        ROOT / "tests/e2e/assessment/test_yz_rd_t023_teacher_invitation.py",
    )
    t021 = load_source_test(
        "yz_rd_t026_t021_source_flow",
        ROOT / "tests/e2e/assessment/test_yz_rd_t021_student_profile_invitation.py",
    )
    t023.BASE = BASE_URL
    t023.DATABASE_URL = DATABASE_URL
    t023.PASSWORD = PASSWORD
    t023.EVIDENCE_DIR = flow_t023_evidence
    t023.sql = sql
    t023.verify_runtime_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    original_t023_expect = t023.expect

    def expect_merged_profile_wording(actual, *args, **kwargs):
        delegate = original_t023_expect(actual, *args, **kwargs)

        class AssertionAdapter:
            def __getattr__(self, name):
                method = getattr(delegate, name)
                if name != "to_contain_text":
                    return method

                def assert_current_t021_wording(expected, *method_args, **method_kwargs):
                    # Keep assertions semantic across accepted T021 and T024
                    # copy updates without weakening their UI states.
                    expected = {
                        "已加入教师班级": "已加入该班级",
                        "今天的学习": "今天好",
                        "新的学习安排会在有真实任务后出现在这里。": "今天暂时没有待开始的练习",
                        "当前没有可学课程": "当前学籍下没有可继续的课程任务。",
                    }.get(expected, expected)
                    return method(expected, *method_args, **method_kwargs)

                return assert_current_t021_wording

        return AssertionAdapter()

    t023.expect = expect_merged_profile_wording

    navigation_clicks: list[dict[str, str]] = []
    teacher_home_screenshots: list[dict[str, object]] = []
    current_flow = ["T023"]
    original_page_goto = Page.goto
    original_page_locator = Page.locator
    original_page_screenshot = Page.screenshot
    original_t023_login = t023.login_via_browser

    def navigate_by_student_nav(page: Page, url, *args, **kwargs):
        target_path = urlparse(str(url)).path
        current_path = urlparse(page.url).path
        student_routes = {"/student/today/", "/student/profile/"}
        if target_path in student_routes and current_path in student_routes and target_path != current_path:
            link = page.locator(
                f'nav[aria-label="学生功能"] a[data-student-nav][href^="{target_path}"]'
            )
            if link.count():
                link.first.click()
                page.wait_for_url(lambda current: urlparse(current).path == target_path, timeout=30_000)
                navigation_clicks.append({"flow": current_flow[0], "from": current_path, "to": target_path, "action": "clicked shared student navigation"})
                return None
        return original_page_goto(page, url, *args, **kwargs)

    Page.goto = navigate_by_student_nav

    def locator_with_merged_today_selectors(page: Page, selector: str, *args, **kwargs):
        # T024 replaced T023's static Today selectors with current server-derived
        # course-empty and task-action elements.
        selector = {
            ".today-course-empty": ".today-course-section .today-empty-row",
            ".today-cta": "[data-primary-action]",
        }.get(selector, selector)
        return original_page_locator(page, selector, *args, **kwargs)

    Page.locator = locator_with_merged_today_selectors

    def screenshot_with_parchment_mask(page: Page, *args, **kwargs):
        if kwargs.get("mask"):
            kwargs.setdefault("mask_color", "#f3ecdd")
        return original_page_screenshot(page, *args, **kwargs)

    Page.screenshot = screenshot_with_parchment_mask

    def login_with_home_evidence(page: Page, identifier: str, home_pattern: str):
        session = original_t023_login(page, identifier, home_pattern)
        if home_pattern == r".*/teacher/?$" and not teacher_home_screenshots:
            links = page.locator('#classList a[href*="/teacher/classes/"]')
            links.first.wait_for(state="visible", timeout=25_000)
            screenshot_dir = EVIDENCE / "screenshots"
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            for width in (390, 768, 1280, 1440):
                page.set_viewport_size({"width": width, "height": 844 if width == 390 else 960})
                page.wait_for_timeout(100)
                layout = page.evaluate(
                    """() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
                       title:document.title,hasClasses:!!document.querySelector("#classList a[href*='/teacher/classes/']")})"""
                )
                if layout["scrollWidth"] > width + 1 or not layout["hasClasses"]:
                    raise AssertionError(f"Teacher Home layout or class entry failed at {width}px: {layout}")
                name = f"teacher-home-{width}.png"
                page.screenshot(path=str(screenshot_dir / name), full_page=True)
                teacher_home_screenshots.append({"width": width, "documentScrollWidth": layout["scrollWidth"], "screenshot": name})
            page.set_viewport_size({"width": 1440, "height": 1000})
        return session

    t023.login_via_browser = login_with_home_evidence
    try:
        t023.test_t023_teacher_class_invitation_real_browser_and_postgres()
        current_flow[0] = "T021"
        t021.test_student_profile_real_invitation_binding_and_identity_isolation()
    finally:
        Page.goto = original_page_goto
        Page.locator = original_page_locator
        Page.screenshot = original_page_screenshot
        t023.login_via_browser = original_t023_login
        t023.expect = original_t023_expect

    if len(teacher_home_screenshots) != 4 or not navigation_clicks:
        raise AssertionError("T026 did not capture Teacher Home at four widths and click the shared student navigation")

    flow_t023_path = flow_t023_evidence / "browser-database-evidence.json"
    flow_t021_path = flow_t021_evidence / "e2e-summary.json"
    if not flow_t023_path.is_file() or not flow_t021_path.is_file():
        raise AssertionError("Accepted source flows did not write their browser/API/PostgreSQL evidence")
    for path in (flow_t023_path, flow_t021_path):
        report = json.loads(path.read_text(encoding="utf-8"))
        report["t026GlobalNavigationClicks"] = navigation_clicks
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = {
        "taskId": "YZ-RD-T026",
        "nativeE2E": "PASS",
        "pytestCaseCount": 1,
        "sourceScenarios": [
            "T023 real teacher Class Detail invitation create, lost response recheck, real clipboard copy/paste, Student Profile bind, SQL membership/enrollment/audit/usedCount, Teacher roster detail and Student Today",
            "T021 student Profile two-school/three-class isolation, school-switch re-fetch, lost bind/school-switch recovery, distinct Student B identity and 401/403/404/409 negatives",
        ],
        "identityNote": "The T023 linked teacher/student click flow and the T021 multi-school identity-isolation flow use separate fictional test identities in the same task-owned database.",
        "postgres": {"database": db_name, "user": db_user, "version": db_version},
        "teacherHomeScreenshots": teacher_home_screenshots,
        "globalNavigationClicks": navigation_clicks,
        "inviteSecretHandling": "Only screenshots masked with warm parchment #f3ecdd and evidence without the code are persisted; the server code is held in browser memory for clipboard verification.",
        "flowEvidence": [str(flow_t023_path.relative_to(ROOT)), str(flow_t021_path.relative_to(ROOT))],
    }
    (EVIDENCE / "native-e2e-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
