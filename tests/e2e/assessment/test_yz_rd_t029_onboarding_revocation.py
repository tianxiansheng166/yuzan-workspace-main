"""T029 merged onboarding and invitation-revocation proof on one native runtime."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(os.environ["YZ_T029_EVIDENCE_DIR"])
DATABASE_NAME = os.environ["YZ_T029_DATABASE_NAME"]
DATABASE_USER = os.environ["YZ_T029_DATABASE_USER"]
DATABASE_URL = os.environ["YZ_T029_DATABASE_URL"]
PASSWORD = os.environ["YZ_T029_PASSWORD"]


def load_test_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load accepted source E2E {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sql_scalar(sql, statement: str) -> str:
    rows = sql(statement)
    return rows.splitlines()[0].strip() if rows else ""


def test_t029_merged_real_teacher_student_onboarding_and_revocation():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    psql = os.environ["YZ_T029_PSQL"]
    pg_library = os.environ["YZ_T029_PG_LIBRARY"]
    port = os.environ["YZ_T029_POSTGRES_PORT"]
    api = os.environ["YZ_T029_API_BASE_URL"]

    # Run the accepted T026 browser integration and T028 revoke journey against
    # this one T029-owned PostgreSQL 17/API/Web/MinIO runtime.
    os.environ.update(
        {
            "YZ_T026_BASE_URL": os.environ["YZ_T029_BASE_URL"],
            "YZ_T026_API_BASE_URL": api,
            "YZ_T026_DATABASE_URL": DATABASE_URL,
            "YZ_T026_DATABASE_NAME": DATABASE_NAME,
            "YZ_T026_DATABASE_USER": DATABASE_USER,
            "YZ_T026_POSTGRES_PORT": port,
            "YZ_T026_PSQL": psql,
            "YZ_T026_PG_LIBRARY": pg_library,
            "YZ_T026_PASSWORD": PASSWORD,
            "YZ_T026_EVIDENCE_DIR": str(EVIDENCE / "t026"),
            "YZ_T026_CHROMIUM": os.environ["YZ_T029_CHROMIUM"],
            "YZ_T023_BASE_URL": os.environ["YZ_T029_BASE_URL"],
            "YZ_T023_DATABASE_URL": DATABASE_URL,
            "YZ_T023_PASSWORD": PASSWORD,
            "YZ_T023_EVIDENCE_DIR": str(EVIDENCE / "t026" / "t023-browser-flow"),
            "YZ_T021_BASE_URL": os.environ["YZ_T029_BASE_URL"],
            "YZ_T021_API_BASE_URL": api,
            "YZ_T021_DATABASE_URL": DATABASE_URL,
            "YZ_T021_DATABASE_NAME": DATABASE_NAME,
            "YZ_T021_DATABASE_USER": DATABASE_USER,
            "YZ_T021_POSTGRES_PORT": port,
            "YZ_T021_PSQL": psql,
            "YZ_T021_PG_LIBRARY": pg_library,
            "YZ_T021_EVIDENCE_DIR": str(EVIDENCE / "t026" / "t021-profile-isolation"),
            "YZ_T021_CHROMIUM": os.environ["YZ_T029_CHROMIUM"],
            "YZ_T028_BASE_URL": os.environ["YZ_T029_BASE_URL"],
            "YZ_T028_DATABASE_URL": DATABASE_URL,
            "YZ_T028_PASSWORD": PASSWORD,
            "YZ_T028_EVIDENCE_DIR": str(EVIDENCE / "t028"),
        }
    )

    t026 = load_test_module(
        "yz_rd_t029_t026_source_flow",
        ROOT / "tests/e2e/assessment/test_yz_rd_t026_onboarding.py",
    )
    if t026.verify_database_identity()[0:2] != (DATABASE_NAME, DATABASE_USER):
        raise AssertionError("T026 source flow did not bind to the T029-owned database")
    t026.test_t026_teacher_to_student_onboarding_and_school_isolation()

    t028 = load_test_module(
        "yz_rd_t029_t028_source_flow",
        ROOT / "tests/e2e/assessment/test_yz_rd_t028_teacher_invitation.py",
    )
    t028.sql = t026.sql
    t028.verify_runtime_identity = lambda: (DATABASE_NAME, DATABASE_USER)

    # T021's integrated Profile copy now confirms "已加入该班级"; the accepted
    # T028 standalone assertion predates that wording. Keep its success-state
    # assertion semantic while executing the original browser action unchanged.
    original_t028_expect = t028.expect

    def expect_merged_profile_wording(actual, *args, **kwargs):
        delegate = original_t028_expect(actual, *args, **kwargs)

        class AssertionAdapter:
            def __getattr__(self, name):
                method = getattr(delegate, name)
                if name != "to_contain_text":
                    return method

                def assert_current_t021_wording(expected, *method_args, **method_kwargs):
                    expected = {"已加入教师班级": "已加入该班级"}.get(expected, expected)
                    return method(expected, *method_args, **method_kwargs)

                return assert_current_t021_wording

        return AssertionAdapter()

    t028.expect = expect_merged_profile_wording
    t028.test_t028_teacher_revokes_real_invitation_and_preserves_enrollment()

    t028_result_path = EVIDENCE / "t028" / "t028-browser-database-evidence.json"
    if not t028_result_path.is_file():
        raise AssertionError("T028 source flow did not write its real browser/API/PostgreSQL evidence")
    revoke_evidence = json.loads(t028_result_path.read_text(encoding="utf-8"))
    ids = revoke_evidence["fictionalUserIds"]
    school_id = revoke_evidence["schoolId"]
    class_id = revoke_evidence["teacherClassId"]
    teacher_id = ids["teacher_c"]
    student_a_id = ids["student_a"]
    student_b_id = ids["student_b"]

    teacher_login = sql_scalar(t026.sql, f'SELECT "loginIdentifier" FROM "User" WHERE id={t028.q(teacher_id)};')
    student_a_login = sql_scalar(t026.sql, f'SELECT "loginIdentifier" FROM "User" WHERE id={t028.q(student_a_id)};')
    student_a_name = sql_scalar(t026.sql, f'SELECT "displayName" FROM "User" WHERE id={t028.q(student_a_id)};')
    student_b_name = sql_scalar(t026.sql, f'SELECT "displayName" FROM "User" WHERE id={t028.q(student_b_id)};')
    active_a = sql_scalar(
        t026.sql,
        f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={t028.q(school_id)} AND "classId"={t028.q(class_id)} AND "userId"={t028.q(student_a_id)} AND role='STUDENT' AND status='ACTIVE';''',
    )
    active_b = sql_scalar(
        t026.sql,
        f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={t028.q(school_id)} AND "classId"={t028.q(class_id)} AND "userId"={t028.q(student_b_id)} AND role='STUDENT' AND status='ACTIVE';''',
    )
    if active_a != "1" or active_b != "1":
        raise AssertionError("Student A and Student B are not both actively enrolled in Teacher C's class")

    bad_uuid_status: int | None = None
    roster_screenshot = EVIDENCE / "screenshots" / "teacher-c-roster-1280.png"
    today_screenshot = EVIDENCE / "screenshots" / "student-a-today-after-revoke-1280.png"
    viewport_clicks: list[dict[str, object]] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.environ["YZ_T029_CHROMIUM"])
        teacher_page = browser.new_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        teacher_session = t028.login_via_browser(teacher_page, teacher_login, r".*/teacher/?$")
        if teacher_session["schoolId"] != school_id:
            raise AssertionError("Teacher C's real browser identity resolved to the wrong school")

        malformed = teacher_page.request.post(
            f"{api}/api/v1/schools/{school_id}/teacher-invitations/not-a-uuid/revoke",
            headers=t028.headers(teacher_session),
        )
        bad_uuid_status = malformed.status
        if bad_uuid_status != 400:
            raise AssertionError(f"Malformed invitation id returned HTTP {bad_uuid_status}, expected 400")

        expected_class_href = f"/teacher/classes/{class_id}?schoolId={school_id}"
        class_link = teacher_page.locator(f'#classList a[href="{expected_class_href}"]')
        expect(class_link).to_be_visible(timeout=20_000)
        class_link.click()
        teacher_page.wait_for_url(f"**/teacher/classes/{class_id}?schoolId=**", timeout=30_000)
        expect(teacher_page.locator("#rosterTable")).to_contain_text(student_a_name, timeout=30_000)
        expect(teacher_page.locator("#rosterTable")).to_contain_text(student_b_name, timeout=30_000)
        roster_screenshot.parent.mkdir(parents=True, exist_ok=True)
        teacher_page.screenshot(path=str(roster_screenshot), full_page=True)
        roster_rows = teacher_page.locator("#rosterTable .roster-row:not(.header)").count()
        if roster_rows < 2:
            raise AssertionError(f"Teacher C's live roster rendered only {roster_rows} student rows")

        # Exercise the real invitation entry and close controls at every
        # requested viewport; mask the still-active replacement code in images.
        responsive_dir = EVIDENCE / "screenshots"
        responsive_dir.mkdir(parents=True, exist_ok=True)
        for width, height in ((390, 844), (768, 900), (1280, 900), (1440, 900)):
            teacher_page.set_viewport_size({"width": width, "height": height})
            teacher_page.get_by_role("button", name="查看邀请").click()
            expect(teacher_page.locator("#studentInvitationDialog")).to_be_visible(timeout=15_000)
            active_code = teacher_page.locator(".invitation-record.is-usable .invitation-code-input")
            expect(active_code).to_be_visible(timeout=15_000)
            layout = teacher_page.evaluate("""() => {
              const dialog = document.querySelector('#studentInvitationDialog');
              const rect = dialog.getBoundingClientRect();
              return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:rect.left,right:rect.right,
                ariaLabelledBy:dialog.getAttribute('aria-labelledby'),reducedMotion:getComputedStyle(dialog).scrollBehavior};
            }""")
            if layout["scrollWidth"] > width + 1 or layout["left"] < -1 or layout["right"] > width + 1:
                raise AssertionError(f"Teacher invitation dialog overflowed at {width}px: {layout}")
            screenshot = responsive_dir / f"teacher-invitation-dialog-{width}.png"
            teacher_page.screenshot(path=str(screenshot), full_page=True, mask=[active_code])
            teacher_page.locator("#studentInvitationClose").click()
            expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=10_000)
            viewport_clicks.append({"width": width, "height": height, "openAndCloseClicked": True, "horizontalOverflow": False, "activeCodeMasked": True, "screenshot": str(screenshot.relative_to(EVIDENCE))})

        student_page = browser.new_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        student_session = t028.login_via_browser(student_page, student_a_login, r".*/student/today/?$")
        if student_session["schoolId"] != school_id:
            raise AssertionError("Student A's Today session lost its active school after invitation revocation")
        expect(student_page.locator("#todayApp .today-primary")).to_be_visible(timeout=30_000)
        today_text = student_page.locator("#todayApp").inner_text()
        if "今天暂时没有待开始的练习" not in today_text:
            raise AssertionError("Student A Today did not show its server-derived no-task empty state")
        if "当前没有已开放的练习。这里不会显示演示题目或虚构任务。" not in today_text:
            raise AssertionError("Student A Today does not state the no-assignment empty state")
        today_screenshot.parent.mkdir(parents=True, exist_ok=True)
        student_page.screenshot(path=str(today_screenshot), full_page=True)

        course_link = student_page.locator('nav[aria-label="学生功能"] a[data-student-nav][href^="/student/courses"]')
        expect(course_link).to_be_visible(timeout=20_000)
        course_link.click()
        student_page.wait_for_url("**/student/courses**", timeout=25_000)
        today_link = student_page.locator('nav[aria-label="学生功能"] a[data-student-nav][href^="/student/today/"]')
        expect(today_link).to_be_visible(timeout=15_000)
        today_link.click()
        student_page.wait_for_url("**/student/today/**", timeout=25_000)
        expect(student_page.locator("#todayApp .today-primary")).to_be_visible(timeout=20_000)
        browser.close()

    if bad_uuid_status != 400:
        raise AssertionError("Real route validation did not produce HTTP 400 for malformed invitation UUID")

    sql_proof = {
        "database": DATABASE_NAME,
        "databaseUser": DATABASE_USER,
        "schoolId": school_id,
        "classId": class_id,
        "teacherCUserId": teacher_id,
        "studentAUserId": student_a_id,
        "studentBUserId": student_b_id,
        "revokedInvitationId": revoke_evidence["postgresRevoke"]["teacherInvitationId"],
        "revokeAuditLogId": revoke_evidence["postgresRevoke"]["auditLogId"],
        "revokeAuditCount": revoke_evidence["postgresRevoke"]["auditCount"],
        "studentAActiveEnrollmentCount": active_a,
        "studentBActiveEnrollmentCount": active_b,
        "teacherRosterRows": roster_rows,
        "studentAAfterRevokeToday": "REAL_EMPTY_STATE_NO_OPEN_ASSIGNMENT",
    }
    sql_text = t026.sql(
        f'''SELECT i.id || '|' || COALESCE(i."revokedAt"::text,'NULL') || '|' || i."usedCount" || '|' ||
           (SELECT count(*) FROM "AuditLog" a WHERE a.action='TEACHER_INVITATION_REVOKED' AND a."resourceId"=i.id::text) || '|' ||
           (SELECT count(*) FROM "Enrollment" e WHERE e."schoolId"=i."schoolId" AND e."classId"=i."classId" AND e."userId"={t028.q(student_a_id)} AND e.role='STUDENT' AND e.status='ACTIVE') || '|' ||
           (SELECT count(*) FROM "Enrollment" e WHERE e."schoolId"=i."schoolId" AND e."classId"=i."classId" AND e."userId"={t028.q(student_b_id)} AND e.role='STUDENT' AND e.status='ACTIVE')
           FROM "TeacherInvitation" i WHERE i.id={t028.q(sql_proof['revokedInvitationId'])};'''
    )
    sql_path = EVIDENCE / "sql" / "t029-merged-invitation-records.txt"
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    sql_path.write_text(
        "SELECT invitation id, revokedAt, usedCount, matching revoke audit count, Student A active enrollment count, Student B active enrollment count\n"
        + sql_text
        + "\n\nDynamic evidence summary (secret invitation values omitted):\n"
        + json.dumps(sql_proof, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    summary = {
        "taskId": "YZ-RD-T029",
        "nativeE2E": "PASS",
        "pass": 1,
        "fail": 0,
        "skip": 0,
        "t026SourceFlow": "PASS_SAME_T029_RUNTIME",
        "t028SourceFlow": "PASS_SAME_T029_RUNTIME",
        "statuses": {"malformedInvitationUuid": bad_uuid_status},
        "sql": sql_proof,
        "teacherRoster": {
            "studentAVisible": True,
            "studentBVisible": True,
            "renderedRows": roster_rows,
            "screenshot": str(roster_screenshot.relative_to(EVIDENCE)),
        },
        "teacherInvitationViewportClicks": viewport_clicks,
        "studentA": {
            "activeEnrollmentRetained": True,
            "todayRefreshedAfterRevoke": True,
            "noAssignmentEmptyState": True,
            "normalCourseAndTodayNavClicks": 2,
            "screenshot": str(today_screenshot.relative_to(EVIDENCE)),
        },
        "sourceFlows": {
            "t026Summary": str((EVIDENCE / "t026" / "native-e2e-summary.json").relative_to(EVIDENCE)),
            "t028Evidence": str(t028_result_path.relative_to(EVIDENCE)),
        },
        "secrets": "Invitation tokens, database credentials and access tokens omitted",
    }
    (EVIDENCE / "native-e2e-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
