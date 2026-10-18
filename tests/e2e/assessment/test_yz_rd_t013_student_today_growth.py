"""Real Chromium + NestJS + isolated PostgreSQL proof for T013 student data."""

import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import Page, sync_playwright


BASE = os.environ.get("YZ_T013_BASE_URL", "")
API = os.environ.get("YZ_T013_API_BASE_URL", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T013_TEST_PASSWORD", "")
DATABASE_NAME = "yuzan_t013_native"
DATABASE_USER = "yz_t013"
DATABASE_PORT = 55631
SCHOOL_A = "11111111-1111-4111-8111-111111111111"
CLASS_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
SEED_STUDENT = "22222222-2222-4222-8222-222222222222"
PRACTICE_TEACHER = "70000000-0000-4000-8000-000000000001"
PRACTICE_SELF = "70000000-0000-4000-8000-000000000002"
PRACTICE_REVIEW = "70000000-0000-4000-8000-000000000003"
PRACTICE_UNREVIEWED = "70000000-0000-4000-8000-000000000004"
PSQL = os.environ.get(
    "YZ_T013_PSQL",
    "/home/tian/code/yuzan-workspace-main/runtime-local/native-web/toolchain/pgdg/usr/lib/postgresql/17/bin/psql",
)
CHROME = os.environ.get("YZ_T013_CHROMIUM", "/usr/bin/google-chrome")
EVIDENCE = Path(__file__).resolve().parents[3] / "evidence" / "yz-rd-t013"


def sql(statement: str, *, capture: bool = False) -> str:
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == DATABASE_PORT
    assert parsed.username == DATABASE_USER
    assert unquote(parsed.path.lstrip("/")) == DATABASE_NAME
    assert parsed.password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": unquote(parsed.password),
        "PGDATABASE": DATABASE_NAME,
    }
    pg_library = os.environ.get("YZ_T013_PG_LIBRARY", str(Path(PSQL).parents[3] / "x86_64-linux-gnu"))
    env["LD_LIBRARY_PATH"] = ":".join(filter(None, [pg_library, env.get("LD_LIBRARY_PATH", "")]))
    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        message = result.stderr.replace(env["PGPASSWORD"], "<redacted>")
        raise RuntimeError(message)
    return result.stdout.strip() if capture else ""


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def payload(response):
    body = response.json()
    return body.get("data", body)


def verify_database_identity() -> None:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();", capture=True)
    assert identity.startswith("yuzan_t013_native|yz_t013|PostgreSQL 17."), identity.split("|", 2)[:2]


def create_user_fixture(label: str, school_id: str, class_id: str) -> dict[str, str]:
    user_id = str(uuid.uuid4())
    enrollment_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    identifier = f"yz-rd-t013-{label.lower()}-{uuid.uuid4().hex}@test.invalid"
    display_name = f"TEST_FIXTURE_ONLY T013 学生{label}"
    sql(
        f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
              SELECT '{user_id}', '{identifier}', '{display_name}', "passwordHash", 'ACTIVE', NOW(), NOW()
                FROM "User" WHERE "id" = '{SEED_STUDENT}';
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{school_id}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ('{enrollment_id}', '{school_id}', '{class_id}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return {
        "id": user_id,
        "enrollmentId": enrollment_id,
        "identifier": identifier,
        "displayName": display_name,
        "schoolId": school_id,
        "classId": class_id,
    }


def create_school_b_fixture() -> tuple[str, str]:
    school_id = str(uuid.uuid4())
    term_id = str(uuid.uuid4())
    class_id = str(uuid.uuid4())
    code = f"T013-{uuid.uuid4().hex[:16]}"
    sql(
        f'''INSERT INTO "School" ("id", "code", "name", "createdAt", "updatedAt")
              VALUES ('{school_id}', '{code}', 'TEST_FIXTURE_ONLY T013 学校乙', NOW(), NOW());
            INSERT INTO "Term" ("id", "schoolId", "name", "startsAt", "endsAt", "isActive", "createdAt")
              VALUES ('{term_id}', '{school_id}', 'T013 虚构学期', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', true, NOW());
            INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt")
              VALUES ('{class_id}', '{school_id}', '{term_id}', 'TEST_FIXTURE_ONLY 乙班', '八年级', NOW(), NOW());'''
    )
    return school_id, class_id


def authenticate(page: Page, identifier: str) -> dict:
    response = page.request.post(f"{API}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, response.text()
    session = payload(response)
    assert session.get("accessToken")
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


def create_attempt(page: Page, session: dict, school_id: str, practice_id: str) -> str:
    response = page.request.post(
        f"{API}/api/v1/schools/{school_id}/practices/{practice_id}/attempts",
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        data={},
    )
    assert response.ok, response.text()
    attempt_id = payload(response)["attemptId"]
    assert uuid.UUID(attempt_id)
    return attempt_id


def assert_no_horizontal_overflow(page: Page) -> None:
    dimensions = page.evaluate(
        """() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })"""
    )
    assert max(dimensions["document"], dimensions["body"]) <= dimensions["viewport"] + 1, dimensions


@pytest.mark.skipif(not BASE or not API or not DATABASE_URL or not PASSWORD, reason="requires isolated T013 native API/PostgreSQL/Chromium runtime")
def test_student_today_growth_attempt_identity_and_school_isolation():
    verify_database_identity()
    school_b, class_b = create_school_b_fixture()
    student_a = create_user_fixture("甲", SCHOOL_A, CLASS_A)
    student_b = create_user_fixture("乙", school_b, class_b)
    assert student_a["schoolId"] != student_b["schoolId"]
    assert student_a["enrollmentId"] != student_b["enrollmentId"]
    assert sql(
        f'''SELECT count(*) FROM "PracticeDelivery"
              WHERE "schoolId" = '{SCHOOL_A}' AND "classId" = '{CLASS_A}' AND "status" = 'OPEN';''',
        capture=True,
    ) == "6"

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, locale="zh-CN")
        page = context.new_page()
        session_a = authenticate(page, student_a["identifier"])
        assert session_a["activeSchoolId"] == SCHOOL_A

        primary_attempt = create_attempt(page, session_a, SCHOOL_A, PRACTICE_TEACHER)
        processing_attempt = create_attempt(page, session_a, SCHOOL_A, PRACTICE_SELF)
        completed_without_report = create_attempt(page, session_a, SCHOOL_A, PRACTICE_REVIEW)
        unreviewed_attempt = create_attempt(page, session_a, SCHOOL_A, PRACTICE_UNREVIEWED)
        started = page.request.post(
            f"{API}/api/v1/schools/{SCHOOL_A}/assessments/sessions/{primary_attempt}/start",
            headers={"Authorization": f"Bearer {session_a['accessToken']}"},
        )
        assert started.ok, started.text()

        # Persisted edge-state fixtures cover processing, a completed record with
        # no report, and a provisional speech report marked NEEDS_REVIEW. These
        # edge cases are read back through real APIs; they are not scoring flows.
        sql(
            f'''UPDATE "AssessmentSession"
                   SET "status" = 'PROCESSING', "submittedAt" = NOW(), "updatedAt" = NOW()
                 WHERE "id" = '{processing_attempt}' AND "enrollmentId" = '{student_a['enrollmentId']}';
                UPDATE "AssessmentSession"
                   SET "status" = 'COMPLETED', "completedAt" = NOW(), "updatedAt" = NOW()
                 WHERE "id" = '{completed_without_report}' AND "enrollmentId" = '{student_a['enrollmentId']}';
                    UPDATE "AssessmentSession"
                       SET "status" = 'COMPLETED', "completedAt" = NOW(), "updatedAt" = NOW()
                 WHERE "id" = '{unreviewed_attempt}' AND "enrollmentId" = '{student_a['enrollmentId']}';'''
        )
        review_item = sql_rows(
            f'''SELECT "id", "maxScore" FROM "AssessmentItem"
                 WHERE "sessionId" = '{unreviewed_attempt}'
                   AND "itemType" IN ('READING', 'SPEECH', 'LISTEN_REPEAT', 'READ_ALOUD')
                 ORDER BY "sortOrder" LIMIT 1;'''
        )
        assert review_item and review_item[0][1]
        provisional_score = float(review_item[0][1])
        sql(
            f'''UPDATE "AssessmentItem"
                   SET "status" = 'FLAGGED', "scoredScore" = {provisional_score},
                       "autoResult" = '{{"state":"NEEDS_REVIEW"}}'::jsonb, "updatedAt" = NOW()
                 WHERE "id" = '{review_item[0][0]}';
                INSERT INTO "AssessmentReport" ("id", "sessionId", "schoolId", "overallScore", "summary", "dataCompleteness", "generatedAt", "createdAt", "updatedAt")
                VALUES ('{uuid.uuid4()}', '{unreviewed_attempt}', '{SCHOOL_A}', {provisional_score},
                        '{{"requiresTeacherReview":true,"scoringState":"NEEDS_REVIEW"}}'::jsonb,
                        100, NOW(), NOW(), NOW());'''
        )
        proof = sql_rows(
            f'''SELECT "id", "enrollmentId", "classId", "practiceDefinitionId", "status", "purpose"
                  FROM "AssessmentSession"
                     WHERE "id" IN ('{primary_attempt}', '{processing_attempt}', '{completed_without_report}', '{unreviewed_attempt}')
                 ORDER BY "id";'''
        )
        assert len(proof) == 4
        assert all(row[1] == student_a["enrollmentId"] and row[2] == CLASS_A for row in proof)
        assert {row[4] for row in proof} == {"IN_PROGRESS", "PROCESSING", "COMPLETED"}
        print(
            "T013_FIXTURE_A",
            f"user={student_a['id']}",
            f"school={student_a['schoolId']}",
            f"class={student_a['classId']}",
            f"enrollment={student_a['enrollmentId']}",
        )
        print(
            "T013_FIXTURE_B",
            f"user={student_b['id']}",
            f"school={student_b['schoolId']}",
            f"class={student_b['classId']}",
            f"enrollment={student_b['enrollmentId']}",
        )
        print(
            "T013_ATTEMPTS",
            f"in_progress={primary_attempt}",
            f"processing_fixture={processing_attempt}",
            f"completed_no_report_fixture={completed_without_report}",
            f"unreviewed_report_fixture={unreviewed_attempt}",
        )

        headers_a = {"Authorization": f"Bearer {session_a['accessToken']}"}
        today_response = page.request.get(f"{API}/api/v1/schools/{SCHOOL_A}/student/today", headers=headers_a)
        assert today_response.ok, today_response.text()
        today_data = payload(today_response)
        assert today_data["primaryAction"]["kind"] == "RESUME_ASSESSMENT"
        assert today_data["primaryAction"]["target"]["href"] == f"/assessment/sessions/{primary_attempt}/"
        unreviewed_report_response = page.request.get(
            f"{API}/api/v1/schools/{SCHOOL_A}/assessments/sessions/{unreviewed_attempt}/report",
            headers=headers_a,
        )
        assert unreviewed_report_response.ok, unreviewed_report_response.text()
        unreviewed_report = payload(unreviewed_report_response)
        assert unreviewed_report["overallScore"] == provisional_score
        assert unreviewed_report["summary"]["requiresTeacherReview"] is True

        page.goto(f"{BASE}/student/today/")
        page.locator("#todayApp[data-state='processing']").wait_for(timeout=20_000)
        page.locator(".today-header h1").wait_for()
        page.wait_for_function("name => document.querySelector('.today-header h1')?.textContent.includes(name)", arg=student_a["displayName"])
        assert student_a["schoolId"] not in page.locator(".today-school-line").inner_text()
        assert "语赞测试学校" in page.locator(".today-school-line").inner_text()
        assert page.locator(".today-primary").get_attribute("data-action-kind") == "RESUME_ASSESSMENT"
        primary_link = page.locator("a[data-primary-action]")
        assert primary_link.get_attribute("href") == today_data["primaryAction"]["target"]["href"]
        assert page.locator(f'a[href="/student/practices/attempts/{primary_attempt}/runner/"]').count() >= 1
        processing_link = page.locator(f'a[href="/assessment/sessions/{processing_attempt}/processing/"]')
        assert processing_link.count() == 1
        teacher_card = page.locator(".today-practice-card").filter(has_text="古诗文朗读与理解训练")
        assert teacher_card.count() == 1
        assert "老师开放" in teacher_card.inner_text()
        assert "连续学习天" not in page.locator("body").inner_text()
        assert "还没有正式测评结果" in page.locator(".today-summary").inner_text()
        assert page.locator(".today-score").count() == 0
        assert_no_horizontal_overflow(page)
        page.screenshot(path=str(EVIDENCE / "today-a-1440.png"), full_page=True)

        attempt_responses: list[tuple[str, int]] = []
        page.on("response", lambda response: attempt_responses.append((response.url, response.status)))
        primary_link.focus()
        page.keyboard.press("Enter")
        page.wait_for_url(f"**/assessment/sessions/{primary_attempt}/", timeout=15_000)
        page.wait_for_function("document.querySelector('#app')?.textContent.length > 0", timeout=15_000)
        assert any(
            f"/assessment/sessions/{primary_attempt}" in url and status == 200
            for url, status in attempt_responses
        ), "Chromium must load the dynamic Attempt from the real API"
        page.go_back()
        page.locator("#todayApp").wait_for()
        page.locator(f'a[href="/assessment/sessions/{primary_attempt}/"]').wait_for()

        page.set_viewport_size({"width": 1280, "height": 900})
        assert_no_horizontal_overflow(page)
        page.screenshot(path=str(EVIDENCE / "today-a-1280.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        assert_no_horizontal_overflow(page)
        page.screenshot(path=str(EVIDENCE / "today-a-390.png"), full_page=True)

        growth_a = context.new_page()
        growth_a.set_viewport_size({"width": 1440, "height": 1000})
        growth_a.goto(f"{BASE}/student/growth/")
        growth_a.locator("#growthApp[data-state='ready']").wait_for(timeout=20_000)
        growth_a.locator(".growth-header h1").wait_for()
        growth_a.wait_for_function("name => document.querySelector('.growth-header h1')?.textContent.includes(name)", arg=student_a["displayName"])
        assert "语赞测试学校" in growth_a.locator(".growth-school-line").inner_text()
        assert "已完成记录" in growth_a.locator(".growth-summary-grid").inner_text()
        assert "未完成 Attempt" in growth_a.locator(".growth-summary-grid").inner_text()
        assert "1 条已完成记录尚未生成正式报告" in growth_a.locator(".growth-not-generated:not(.review)").inner_text()
        assert "1 条报告正在等待教师复核" in growth_a.locator(".growth-not-generated.review").inner_text()
        assert "0 分" not in growth_a.locator(".growth-report-list").inner_text()
        assert f"{provisional_score:g} 分" not in growth_a.locator(".growth-report-list").inner_text()
        assert "继续练习" in growth_a.locator(".growth-practice-list").inner_text()
        assert not growth_a.locator('svg[role="img"]').count(), "one completed record is not enough for a growth curve"
        assert_no_horizontal_overflow(growth_a)
        growth_a.screenshot(path=str(EVIDENCE / "growth-a-1440.png"), full_page=True)

        growth_a.set_viewport_size({"width": 1280, "height": 900})
        assert_no_horizontal_overflow(growth_a)
        growth_a.screenshot(path=str(EVIDENCE / "growth-a-1280.png"), full_page=True)

        growth_a.set_viewport_size({"width": 390, "height": 844})
        assert_no_horizontal_overflow(growth_a)
        growth_a.screenshot(path=str(EVIDENCE / "growth-a-390.png"), full_page=True)

        history_page = context.new_page()
        history_page.goto(f"{BASE}/assessment/history/")
        history_page.locator("#app").wait_for()
        history_page.locator(f'a[href*="{primary_attempt}"]').wait_for(timeout=20_000)
        assert "我的学习记录" in history_page.locator("#app").inner_text()

        profile_a = context.new_page()
        profile_a.set_viewport_size({"width": 1280, "height": 900})
        profile_a.goto(f"{BASE}/student/profile/")
        profile_a.wait_for_function("name => document.querySelector('#profileName')?.textContent.includes(name)", arg=student_a["displayName"], timeout=20_000)
        assert "语赞测试学校" in profile_a.locator("#profileMeta").inner_text()
        assert profile_a.locator("#statStreak").count() == 0
        assert_no_horizontal_overflow(profile_a)
        profile_a.screenshot(path=str(EVIDENCE / "profile-a-1280.png"), full_page=True)

        unauth_request = playwright.request.new_context()
        school_b_response = unauth_request.get(f"{API}/api/v1/schools/{school_b}/student/today")
        assert school_b_response.status == 401
        unauth_request.dispose()
        headers_b_session = page.request.post(
            f"{API}/api/v1/auth/login",
            data={"identifier": student_b["identifier"], "password": PASSWORD},
        )
        assert headers_b_session.ok, headers_b_session.text()
        session_b = payload(headers_b_session)
        assert session_b["activeSchoolId"] == school_b
        headers_b = {"Authorization": f"Bearer {session_b['accessToken']}"}
        b_today_response = page.request.get(f"{API}/api/v1/schools/{school_b}/student/today", headers=headers_b)
        assert b_today_response.ok, b_today_response.text()
        b_today = payload(b_today_response)
        assert b_today["primaryAction"] is None
        assert b_today["legacyTasks"] == []
        b_catalog_response = page.request.get(f"{API}/api/v1/schools/{school_b}/practices", headers=headers_b)
        assert b_catalog_response.ok, b_catalog_response.text()
        assert payload(b_catalog_response)["items"] == []

        cross_school = page.request.get(
            f"{API}/api/v1/schools/{SCHOOL_A}/practices/attempts/{primary_attempt}",
            headers=headers_b,
        )
        assert cross_school.status == 403
        cross_student = page.request.get(
            f"{API}/api/v1/schools/{school_b}/practices/attempts/{primary_attempt}",
            headers=headers_b,
        )
        assert cross_student.status == 404
        missing_attempt = page.request.get(
            f"{API}/api/v1/schools/{school_b}/practices/attempts/{uuid.uuid4()}",
            headers=headers_b,
        )
        assert missing_attempt.status == 404
        print("T013_NEGATIVES", "unauthenticated=401", f"cross_school={cross_school.status}", f"cross_student={cross_student.status}", f"missing_attempt={missing_attempt.status}")

        switcher = context.new_page()
        switcher.goto(f"{BASE}/login/")
        switcher.evaluate(
            """session => {
              localStorage.setItem('yuzan-access-token', session.accessToken);
              localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
              localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
            }""",
            session_b,
        )
        page.wait_for_function("name => document.querySelector('.today-header h1')?.textContent.includes(name)", arg=student_b["displayName"], timeout=20_000)
        page.locator("#todayApp[data-state='empty']").wait_for(timeout=20_000)
        assert "TEST_FIXTURE_ONLY T013 学生甲" not in page.locator("body").inner_text()
        assert primary_attempt not in page.locator("body").inner_text()
        page.screenshot(path=str(EVIDENCE / "today-b-390.png"), full_page=True)
        growth_a.wait_for_function("name => document.querySelector('.growth-header h1')?.textContent.includes(name)", arg=student_b["displayName"], timeout=20_000)
        growth_a.locator("#growthApp[data-state='empty']").wait_for(timeout=20_000)
        assert "TEST_FIXTURE_ONLY T013 学生甲" not in growth_a.locator("body").inner_text()
        assert primary_attempt not in growth_a.locator("body").inner_text()
        growth_a.screenshot(path=str(EVIDENCE / "growth-b-390.png"), full_page=True)
        profile_a.wait_for_function("name => document.querySelector('#profileName')?.textContent.includes(name)", arg=student_b["displayName"], timeout=20_000)
        assert "语赞测试学校" not in profile_a.locator("#profileMeta").inner_text()
        assert "TEST_FIXTURE_ONLY T013 学生甲" not in profile_a.locator("body").inner_text()

        # A B token paired with A's school is rejected by the real tenant guard;
        # all open student pages clear B's data while the mismatch is active.
        switcher.evaluate("schoolId => localStorage.setItem('yuzan-active-school-id', schoolId)", SCHOOL_A)
        page.locator("#todayApp[data-state='error']").wait_for(timeout=20_000)
        assert "没有访问权限" in page.locator("#todayApp").inner_text()
        assert "TEST_FIXTURE_ONLY T013 学生乙" not in page.locator("#todayApp").inner_text()
        growth_a.locator("#growthApp[data-state='error']").wait_for(timeout=20_000)
        assert "无权查看" in growth_a.locator("#growthApp").inner_text()
        assert "TEST_FIXTURE_ONLY T013 学生乙" not in growth_a.locator("#growthApp").inner_text()
        profile_a.get_by_text("个人档案暂不可用", exact=False).wait_for(timeout=20_000)
        assert "TEST_FIXTURE_ONLY T013 学生甲" not in profile_a.locator("body").inner_text()
        switcher.evaluate("schoolId => localStorage.setItem('yuzan-active-school-id', schoolId)", school_b)
        page.locator("#todayApp[data-state='empty']").wait_for(timeout=20_000)
        growth_a.locator("#growthApp[data-state='empty']").wait_for(timeout=20_000)
        profile_a.wait_for_function("name => document.querySelector('#profileName')?.textContent.includes(name)", arg=student_b["displayName"], timeout=20_000)
        page.reload()
        page.locator("#todayApp[data-state='empty']").wait_for(timeout=20_000)
        growth_a.reload()
        growth_a.locator("#growthApp[data-state='empty']").wait_for(timeout=20_000)
        profile_a.reload()
        profile_a.wait_for_function("name => document.querySelector('#profileName')?.textContent.includes(name)", arg=student_b["displayName"], timeout=20_000)

        # A browser page authenticated as B cannot open A's dynamic Attempt.
        page.goto(f"{BASE}/student/practices/attempts/{primary_attempt}/runner/")
        page.locator(".runner-error").wait_for(timeout=15_000)
        assert "加载练习失败" in page.locator(".runner-error").inner_text()
        assert "古诗文朗读与理解训练" not in page.locator("body").inner_text()

        # Simulate a real network loss by aborting the request; no previous
        # identity or task survives, and the page's own Retry recovers.
        offline_pattern = f"**/api/v1/schools/{school_b}/student/today"
        page.route(offline_pattern, lambda route: route.abort("internetdisconnected"))
        page.goto(f"{BASE}/student/today/")
        page.locator("#todayApp[data-state='error']").wait_for(timeout=15_000)
        assert "网络连接失败" in page.locator("#todayApp").inner_text()
        assert "TEST_FIXTURE_ONLY T013 学生甲" not in page.locator("#todayApp").inner_text()
        page.unroute(offline_pattern)
        page.locator("[data-today-retry]").click()
        page.locator("#todayApp[data-state='empty']").wait_for(timeout=20_000)

        history_offline = f"**/api/v1/schools/{school_b}/assessments/history*"
        growth_a.route(history_offline, lambda route: route.abort("internetdisconnected"))
        growth_a.reload()
        growth_a.locator("#growthApp[data-state='error']").wait_for(timeout=15_000)
        assert "网络连接失败" in growth_a.locator("#growthApp").inner_text()
        growth_a.unroute(history_offline)
        growth_a.locator("[data-growth-retry]").click()
        growth_a.locator("#growthApp[data-state='empty']").wait_for(timeout=20_000)

        unauth_context = browser.new_context(viewport={"width": 390, "height": 844})
        unauth_page = unauth_context.new_page()
        unauth_page.goto(f"{BASE}/login/")
        unauth_page.evaluate(
            """() => {
              localStorage.removeItem('yuzan-access-token');
              localStorage.removeItem('yuzan-current-user');
              localStorage.removeItem('yuzan-active-school-id');
            }"""
        )
        unauth_page.goto(f"{BASE}/student/today/")
        unauth_page.wait_for_url("**/login/", timeout=10_000)
        unauth_context.close()

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(f"{BASE}/student/today/")
        page.locator("#todayApp[data-state='empty']").wait_for(timeout=20_000)
        assert "TEST_FIXTURE_ONLY T013 学生乙" in page.locator("body").inner_text()
        assert_no_horizontal_overflow(page)
        page.screenshot(path=str(EVIDENCE / "today-b-1440.png"), full_page=True)
        browser.close()
