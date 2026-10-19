"""T028 real Chromium, NestJS and PostgreSQL invitation revocation acceptance."""

from __future__ import annotations

import concurrent.futures
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T028_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T028_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T028_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T028_EVIDENCE_DIR", ""))
TEACHER_TEMPLATE_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222"


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def pg_env() -> dict[str, str]:
    parsed = urlparse(DATABASE_URL)
    return {
        **os.environ,
        "PGHOST": parsed.hostname or "",
        "PGPORT": str(parsed.port or ""),
        "PGUSER": parsed.username or "",
        "PGPASSWORD": parsed.password or "",
        "PGDATABASE": parsed.path.lstrip("/"),
    }


def sql(statement: str) -> str:
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t028"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t028_native"
    password = parsed.password or ""
    assert password and password == os.environ["POSTGRES_PASSWORD"]
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=pg_env(),
        check=False,
    )
    if result.returncode:
        raise RuntimeError("T028 PostgreSQL verification query failed: " + result.stderr.replace(password, "<redacted>")[-1200:])
    return result.stdout.strip()


def sql_scalar(statement: str) -> str:
    rows = sql(statement)
    return rows.splitlines()[0].strip() if rows else ""


def verify_runtime_identity() -> tuple[str, str]:
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    pieces = identity.split("|", 2)
    if len(pieces) != 3 or pieces[:2] != ["yuzan_t028_native", "yz_t028"] or not pieces[2].startswith("PostgreSQL 17."):
        raise AssertionError("Chromium E2E is not connected to the task-owned PostgreSQL 17 database and user")
    return pieces[0], pieces[1]


def seed_fixture() -> dict[str, object]:
    suffix = uuid.uuid4().hex[:10]
    keys = (
        "school", "school_other", "term_main", "term_b", "term_x", "class_main", "class_b", "class_x",
        "teacher_c", "teacher_b", "teacher_x", "student_a", "student_b", "student_c", "student_d",
        "teacher_enrollment_main", "teacher_enrollment_b", "teacher_enrollment_x",
        "membership_teacher_c", "membership_teacher_b", "membership_teacher_x",
        "membership_student_a", "membership_student_b", "membership_student_c", "membership_student_d",
    )
    ids = {key: str(uuid.uuid4()) for key in keys}
    logins = {
        "teacher_c": f"teacher.t028.c.{suffix}@test.invalid",
        "teacher_b": f"teacher.t028.b.{suffix}@test.invalid",
        "teacher_x": f"teacher.t028.x.{suffix}@test.invalid",
        "student_a": f"student.t028.a.{suffix}@test.invalid",
        "student_b": f"student.t028.b.{suffix}@test.invalid",
        "student_c": f"student.t028.c.{suffix}@test.invalid",
        "student_d": f"student.t028.d.{suffix}@test.invalid",
    }
    names = {key: f"TEST_FIXTURE_ONLY T028 {key} {suffix}" for key in logins}
    school_rows = [
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
          VALUES ({q(ids['school'])},{q('YZ-T028-'+suffix)},{q('TEST_FIXTURE_ONLY T028 测试学校 '+suffix)},'TEST',NOW(),NOW());''',
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
          VALUES ({q(ids['school_other'])},{q('YZ-T028-X-'+suffix)},{q('TEST_FIXTURE_ONLY T028 跨校测试 '+suffix)},'TEST',NOW(),NOW());''',
    ]
    user_rows = []
    for key in logins:
        template = TEACHER_TEMPLATE_ID if key.startswith("teacher_") else STUDENT_TEMPLATE_ID
        user_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
              SELECT {q(ids[key])},{q(logins[key])},{q(names[key])},"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(template)};'''
        )
    membership_rows = []
    for key, role, school_key in (
        ("teacher_c", "TEACHER", "school"), ("teacher_b", "TEACHER", "school"),
        ("teacher_x", "TEACHER", "school_other"), ("student_a", "STUDENT", "school"),
        ("student_b", "STUDENT", "school"), ("student_c", "STUDENT", "school"),
        ("student_d", "STUDENT", "school"),
    ):
        membership_rows.append(
            f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
              VALUES ({q(ids['membership_'+key])},{q(ids[school_key])},{q(ids[key])},{q(role)},'ACTIVE',NOW());'''
        )
    term_rows = []
    for key, school_key, label in (
        ("term_main", "school", "丙教师主班"), ("term_b", "school", "乙教师班"), ("term_x", "school_other", "跨校教师班"),
    ):
        term_rows.append(
            f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
              VALUES ({q(ids[key])},{q(ids[school_key])},{q('TEST_FIXTURE_ONLY T028 '+label+' 学期 '+suffix)},'2026-01-01','2036-12-31',true,NOW());'''
        )
    class_rows = []
    for key, school_key, term_key, label in (
        ("class_main", "school", "term_main", "丙教师主班"),
        ("class_b", "school", "term_b", "乙教师班"),
        ("class_x", "school_other", "term_x", "跨校教师班"),
    ):
        class_rows.append(
            f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
              VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[term_key])},{q('TEST_FIXTURE_ONLY T028 '+label+' '+suffix)},'七年级',NOW(),NOW());'''
        )
    enrollment_rows = []
    for enrollment_key, school_key, class_key, user_key in (
        ("teacher_enrollment_main", "school", "class_main", "teacher_c"),
        ("teacher_enrollment_b", "school", "class_b", "teacher_b"),
        ("teacher_enrollment_x", "school_other", "class_x", "teacher_x"),
    ):
        enrollment_rows.append(
            f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
              VALUES ({q(ids[enrollment_key])},{q(ids[school_key])},{q(ids[class_key])},{q(ids[user_key])},'TEACHER','ACTIVE',NOW());'''
        )
    sql("BEGIN;\n" + "\n".join(school_rows + user_rows + membership_rows + term_rows + class_rows + enrollment_rows) + "\nCOMMIT;")
    if sql_scalar(f'''SELECT count(*) FROM "User" WHERE id IN ({','.join(q(ids[key]) for key in logins)});''') != str(len(logins)):
        raise AssertionError("T028 fictional user fixtures were not all created")

    inactive_ids = {key: str(uuid.uuid4()) for key in ("expired_invitation", "exhausted_invitation", "foreign_invitation")}
    inactive_codes = {key: "TC-" + uuid.uuid4().hex[:5].upper() + "-" + uuid.uuid4().hex[:5].upper() for key in inactive_ids}
    inactive_rows = [
        f'''INSERT INTO "TeacherInvitation" (id,"schoolId","classId","teacherUserId",code,"maxUses","usedCount","expiresAt","revokedAt","createdAt","updatedAt")
          VALUES ({q(inactive_ids['expired_invitation'])},{q(ids['school'])},{q(ids['class_main'])},{q(ids['teacher_c'])},{q(inactive_codes['expired_invitation'])},3,0,NOW()-INTERVAL '2 days',NULL,NOW(),NOW());''',
        f'''INSERT INTO "TeacherInvitation" (id,"schoolId","classId","teacherUserId",code,"maxUses","usedCount","expiresAt","revokedAt","createdAt","updatedAt")
          VALUES ({q(inactive_ids['exhausted_invitation'])},{q(ids['school'])},{q(ids['class_main'])},{q(ids['teacher_c'])},{q(inactive_codes['exhausted_invitation'])},1,1,NOW()+INTERVAL '30 days',NULL,NOW(),NOW());''',
        f'''INSERT INTO "TeacherInvitation" (id,"schoolId","classId","teacherUserId",code,"maxUses","usedCount","expiresAt","revokedAt","createdAt","updatedAt")
          VALUES ({q(inactive_ids['foreign_invitation'])},{q(ids['school_other'])},{q(ids['class_x'])},{q(ids['teacher_x'])},{q(inactive_codes['foreign_invitation'])},3,0,NOW()+INTERVAL '30 days',NULL,NOW(),NOW());''',
    ]
    sql("BEGIN;\n" + "\n".join(inactive_rows) + "\nCOMMIT;")
    ids.update(logins=logins, names=names, suffix=suffix, inactive_ids=inactive_ids)
    return ids


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def login_via_browser(page, identifier: str, home_pattern: str) -> dict[str, object]:
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('#loginPanel button[type="submit"]').click()
    page.wait_for_url(re.compile(home_pattern), timeout=45_000)
    session = page.evaluate("""() => ({
      token: localStorage.getItem('yuzan-access-token') || '',
      schoolId: localStorage.getItem('yuzan-active-school-id') || '',
      user: JSON.parse(localStorage.getItem('yuzan-current-user') || 'null')
    })""")
    if not session["token"] or not session["schoolId"]:
        raise AssertionError("Real browser login did not establish an authenticated school session")
    return session


def headers(session: dict[str, object]) -> dict[str, str]:
    token = session.get("token") or session.get("accessToken")
    if not isinstance(token, str) or not token:
        raise AssertionError("T028 fixture login did not return an access token")
    return {"Authorization": f"Bearer {token}"}


def expect_status(response, expected: int, label: str) -> None:
    if response.status != expected:
        raise AssertionError(f"{label}: HTTP {response.status}, expected {expected}")


def api_call(path: str, session: dict[str, object] | None, body: dict[str, object] | None = None) -> tuple[int, dict[str, object]]:
    request_headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if session is not None:
        request_headers.update(headers(session))
    request = urllib.request.Request(
        f"{BASE}/api/v1{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=request_headers,
        method="POST",
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read().decode("utf-8"))
        except Exception:
            return error.code, {}


def create_invitation(page, session: dict[str, object], school_id: str, class_id: str, max_uses: int = 3) -> dict[str, object]:
    response = page.request.post(
        f"{BASE}/api/v1/schools/{school_id}/teacher-invitations",
        headers=headers(session),
        data={"classId": class_id, "maxUses": max_uses, "expiresInDays": 30},
    )
    expect_status(response, 201, "teacher invitation create")
    return payload(response)


def wait_for_invitation_waiters(minimum: int) -> None:
    deadline = time.monotonic() + 15
    query = '''SELECT count(*) FROM pg_stat_activity
      WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock'
        AND query ILIKE 'UPDATE %"TeacherInvitation"%';'''
    while time.monotonic() < deadline:
        if int(sql_scalar(query) or "0") >= minimum:
            return
        time.sleep(0.05)
    raise AssertionError("Concurrent invitation request did not reach the deterministic PostgreSQL row-lock queue")


def start_invitation_row_lock(invitation_id: str) -> subprocess.Popen[str]:
    process = subprocess.Popen(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=pg_env(),
    )
    assert process.stdin and process.stdout
    process.stdin.write(f'''BEGIN;\nSELECT id FROM "TeacherInvitation" WHERE id={q(invitation_id)} FOR UPDATE;\n''')
    process.stdin.flush()
    if process.stdout.readline().strip() != invitation_id:
        process.kill()
        raise AssertionError("Could not acquire the task-owned invitation row lock for a deterministic race test")
    return process


def release_invitation_row_lock(process: subprocess.Popen[str], *, commit: bool = True) -> None:
    if process.poll() is not None:
        return
    assert process.stdin
    process.stdin.write(("COMMIT;\n" if commit else "ROLLBACK;\n") + "\\q\n")
    process.stdin.flush()
    process.stdin.close()
    process.wait(timeout=10)
    if process.returncode != 0:
        raise AssertionError("Deterministic invitation race lock did not close cleanly")


def run_ordered_race(
    *, invitation_id: str, code: str, bind_session: dict[str, object],
    teacher_session: dict[str, object], school_id: str, first_kind: str,
) -> dict[str, object]:
    lock = start_invitation_row_lock(invitation_id)
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)
    try:
        if first_kind == "bind":
            first = pool.submit(api_call, "/student/teacher-invitations/bind", bind_session, {"code": code})
            wait_for_invitation_waiters(1)
            second = pool.submit(api_call, f"/schools/{school_id}/teacher-invitations/{invitation_id}/revoke", teacher_session, {})
            wait_for_invitation_waiters(2)
            release_invitation_row_lock(lock)
            bind_status = first.result(timeout=30)[0]
            revoke_status = second.result(timeout=30)[0]
        else:
            first = pool.submit(api_call, f"/schools/{school_id}/teacher-invitations/{invitation_id}/revoke", teacher_session, {})
            wait_for_invitation_waiters(1)
            second = pool.submit(api_call, "/student/teacher-invitations/bind", bind_session, {"code": code})
            wait_for_invitation_waiters(2)
            release_invitation_row_lock(lock)
            revoke_status = first.result(timeout=30)[0]
            bind_status = second.result(timeout=30)[0]
    finally:
        if lock.poll() is None:
            release_invitation_row_lock(lock, commit=False)
        pool.shutdown(wait=True, cancel_futures=True)
    return {"firstLockOwner": first_kind, "invitationId": invitation_id, "bindStatus": bind_status, "revokeStatus": revoke_status}


def responsive_screenshots(page, widths: tuple[int, ...], evidence_dir: Path) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for width in widths:
        height = 844 if width == 390 else 900
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(80)
        state = page.evaluate("""() => {
          const dialog = document.querySelector('#studentInvitationDialog');
          const records = [...document.querySelectorAll('.invitation-record')];
          const bounds = element => { const r = element.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; };
          return {
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            dialogOpen: dialog.open,
            dialog: bounds(dialog),
            recordCount: records.length,
            revokedCount: document.querySelectorAll('.invitation-record.is-revoked').length,
            codeInputCount: document.querySelectorAll('.invitation-code-input').length,
            copyButtonCount: document.querySelectorAll('[data-copy-invitation]').length,
            revokeButtonCount: document.querySelectorAll('[data-revoke-invitation]').length,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
          };
        }""")
        if state["width"] != width or state["scrollWidth"] > width + 1 or not state["dialogOpen"]:
            raise AssertionError(f"Class invitation modal overflowed or closed at {width}px")
        if state["dialog"]["left"] < -1 or state["dialog"]["right"] > width + 1:
            raise AssertionError(f"Class invitation modal is outside the viewport at {width}px")
        if state["codeInputCount"] or state["copyButtonCount"] or state["revokeButtonCount"]:
            raise AssertionError("A revoked invitation exposed code or active actions in a responsive view")
        if not state["reducedMotion"] or not state["revokedCount"]:
            raise AssertionError("Revoked responsive view lost its server state or reduced-motion preference")
        screenshot = evidence_dir / f"revoke-class-detail-{width}.png"
        page.screenshot(path=str(screenshot))
        results.append({"width": width, "height": height, "documentScrollWidth": state["scrollWidth"], "revokedCards": state["revokedCount"], "codeInputs": 0, "copyButtons": 0, "revokeButtons": 0, "screenshot": screenshot.name})
    return results


def test_t028_teacher_revokes_real_invitation_and_preserves_enrollment():
    assert BASE.startswith("http://127.0.0.1:")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    database_name, database_user = verify_runtime_identity()
    fixture = seed_fixture()
    evidence: dict[str, object] = {
        "database": {"name": database_name, "user": database_user, "version": "PostgreSQL 17"},
        "schoolId": fixture["school"], "otherSchoolId": fixture["school_other"],
        "teacherClassId": fixture["class_main"], "teacherBOtherClassId": fixture["class_b"],
        "fictionalUserIds": {key: fixture[key] for key in ("teacher_c", "teacher_b", "teacher_x", "student_a", "student_b", "student_c", "student_d")},
        "browserActions": [], "apiStatuses": [], "apiEvents": [], "responsive": [],
    }
    api_events: list[dict[str, object]] = []
    page_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        teacher_context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["clipboard-read", "clipboard-write"], reduced_motion="reduce")
        teacher_page = teacher_context.new_page()
        teacher_page.on("pageerror", lambda error: page_errors.append(type(error).__name__))

        def record_response(response):
            path = urlparse(response.url).path
            if "teacher-invitations" not in path and not path.endswith("/student/today"):
                return
            operation = "list-mine" if path.endswith("/mine") else "student-bind" if path.endswith("/bind") else "teacher-revoke" if path.endswith("/revoke") else "teacher-create" if path.endswith("/teacher-invitations") else "student-today"
            api_events.append({"method": response.request.method, "operation": operation, "status": response.status})

        teacher_page.on("response", record_response)
        teacher_session = login_via_browser(teacher_page, fixture["logins"]["teacher_c"], r".*/teacher/?$")
        if teacher_session["schoolId"] != fixture["school"]:
            raise AssertionError("Teacher C did not enter the T028 test school")
        evidence["browserActions"].append("Teacher C authenticated through the real browser login form")

        teacher_b_context = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        teacher_b_page = teacher_b_context.new_page()
        teacher_b_session = login_via_browser(teacher_b_page, fixture["logins"]["teacher_b"], r".*/teacher/?$")
        if teacher_b_session["schoolId"] != fixture["school"]:
            raise AssertionError("Teacher B did not enter the T028 test school")

        student_pages: dict[str, object] = {}
        student_sessions: dict[str, dict[str, object]] = {}
        for key in ("student_a", "student_b", "student_c", "student_d"):
            context = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
            page = context.new_page()
            page.on("response", record_response)
            session = login_via_browser(page, fixture["logins"][key], r".*/student/today/?$")
            student_pages[key] = page
            student_sessions[key] = session

        # Authentication and teacher/class/school ownership negatives.
        anonymous = playwright.request.new_context()
        no_auth = anonymous.post(f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/{fixture['inactive_ids']['expired_invitation']}/revoke")
        expect_status(no_auth, 401, "unauthenticated revoke")
        anonymous.dispose()
        evidence["apiStatuses"].append({"case": "unauthenticated-revoke", "status": no_auth.status})

        student_forbidden = student_pages["student_b"].request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/{fixture['inactive_ids']['expired_invitation']}/revoke",
            headers=headers(student_sessions["student_b"]),
        )
        expect_status(student_forbidden, 403, "student revoke")
        evidence["apiStatuses"].append({"case": "student-revoke", "status": student_forbidden.status})

        teacher_b_forbidden = teacher_b_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/{fixture['inactive_ids']['expired_invitation']}/revoke",
            headers=headers(teacher_b_session),
        )
        expect_status(teacher_b_forbidden, 403, "different-class Teacher B revoke")
        evidence["apiStatuses"].append({"case": "teacher-B-other-class-revoke", "status": teacher_b_forbidden.status})

        cross_school_forbidden = teacher_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school_other']}/teacher-invitations/{fixture['inactive_ids']['foreign_invitation']}/revoke",
            headers=headers(teacher_session),
        )
        expect_status(cross_school_forbidden, 403, "cross-school teacher revoke")
        evidence["apiStatuses"].append({"case": "cross-school-revoke", "status": cross_school_forbidden.status})

        unknown = teacher_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/{uuid.uuid4()}/revoke",
            headers=headers(teacher_session),
        )
        expect_status(unknown, 404, "unknown invitation revoke")
        evidence["apiStatuses"].append({"case": "unknown-invitation-revoke", "status": unknown.status})

        for label, invitation_id in fixture["inactive_ids"].items():
            if label == "foreign_invitation":
                continue
            inactive = teacher_page.request.post(
                f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/{invitation_id}/revoke",
                headers=headers(teacher_session),
            )
            expect_status(inactive, 409, f"{label} invitation revoke")
            evidence["apiStatuses"].append({"case": f"{label}-revoke", "status": inactive.status})

        main_href = f"/teacher/classes/{fixture['class_main']}?schoolId={fixture['school']}"
        teacher_page.locator(f'#classList a[href="{main_href}"]').click()
        teacher_page.wait_for_url(re.compile(rf".*/teacher/classes/{re.escape(fixture['class_main'])}\?schoolId=.*"), timeout=30_000)
        expect(teacher_page.locator(".class-title h1")).to_contain_text("TEST_FIXTURE_ONLY T028 丙教师主班", timeout=25_000)
        evidence["browserActions"].append("Teacher C opened their authorized Class Detail from the real teacher class list")

        # The invitation GET has an independent retry control.
        list_failure = {"count": 0}

        def abort_first_list(route):
            list_failure["count"] += 1
            route.abort("failed")

        list_pattern = f"**/api/v1/schools/{fixture['school']}/teacher-invitations/mine"
        teacher_page.route(list_pattern, abort_first_list)
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator("#invitationStatus")).to_contain_text("服务器读取失败", timeout=15_000)
        teacher_page.unroute(list_pattern, abort_first_list)
        teacher_page.locator("#invitationRetry").click()
        expect(teacher_page.locator("#invitationEmpty")).to_be_visible(timeout=15_000)
        if list_failure["count"] != 1:
            raise AssertionError("The one-shot independent GET list failure was not injected exactly once")
        evidence["apiStatuses"].append({"case": "initial-list-failure-retry", "abortedGets": list_failure["count"], "retry": "GET only"})

        initial_rows = teacher_page.request.get(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/mine", headers=headers(teacher_session),
        )
        expect_status(initial_rows, 200, "teacher list before creation")
        inactive_items = payload(initial_rows).get("items", [])
        for invitation_id in fixture["inactive_ids"].values():
            if invitation_id == fixture["inactive_ids"]["foreign_invitation"]:
                continue
            row = next(item for item in inactive_items if item["id"] == invitation_id)
            if row["code"] is not None:
                raise AssertionError("Inactive invitation list exposed a secret code")

        teacher_page.locator("#invitationShowCreate").click()
        teacher_page.locator('#invitationCreateForm select[name="maxUses"]').select_option("10")
        teacher_page.locator('#invitationCreateForm select[name="expiresInDays"]').select_option("30")
        teacher_page.locator("#invitationCreateButton").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=25_000)
        active_rows = teacher_page.request.get(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/mine", headers=headers(teacher_session),
        )
        expect_status(active_rows, 200, "teacher list after UI creation")
        main_invitation = next(item for item in payload(active_rows).get("items", []) if item["class"]["id"] == fixture["class_main"] and item["status"] == "ACTIVE")
        invitation_id = main_invitation["id"]
        real_code = main_invitation["code"]
        if not re.fullmatch(r"TC-[A-F0-9]{5}-[A-F0-9]{5}", real_code):
            raise AssertionError("Class Detail did not create a server-issued student invitation")
        if main_invitation["usedCount"] != 0 or main_invitation["maxUses"] != 10:
            raise AssertionError("Server returned unexpected initial use accounting")
        evidence["browserActions"].append("Teacher created an active code from Class Detail; its token stayed in process memory only")

        # Keep T023's real Clipboard success and failure recovery behavior.
        teacher_page.evaluate("""() => {
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); },
            readText: async () => ''
          } });
        }""")
        teacher_page.locator(".invitation-record.is-usable .invitation-copy-button").click()
        expect(teacher_page.locator(".invitation-copy-feedback")).to_contain_text("复制失败", timeout=15_000)
        clipboard_failure = teacher_page.evaluate("""() => ({
          selected: document.activeElement?.classList.contains('invitation-code-input') === true,
          length: document.activeElement?.value?.length || 0,
          selectionLength: (document.activeElement?.selectionEnd || 0) - (document.activeElement?.selectionStart || 0),
          toast: document.querySelector('#toast')?.textContent || ''
        })""")
        if not clipboard_failure["selected"] or not clipboard_failure["length"] or clipboard_failure["selectionLength"] != clipboard_failure["length"] or "已复制" in clipboard_failure["toast"]:
            raise AssertionError("Clipboard failure did not select the actual code or incorrectly showed success")
        teacher_page.evaluate("delete navigator.clipboard")
        teacher_page.locator(".invitation-record.is-usable .invitation-copy-button").click()
        expect(teacher_page.locator(".invitation-copy-feedback")).to_contain_text("邀请码已复制", timeout=15_000)
        copied_code = teacher_page.evaluate("navigator.clipboard.readText()")
        if copied_code != real_code:
            raise AssertionError("Chromium Clipboard did not contain the active server-issued code after a real copy action")
        evidence["clipboard"] = {"writeTextResolved": True, "failedWriteSelectedInput": True, "token": "TC-•••••-•••••"}
        evidence["browserActions"].append("Teacher tested a denied Clipboard write and successful real copy without exposing the code in evidence")

        student_a_page = student_pages["student_a"]
        student_a_page.goto(f"{BASE}/student/profile/", wait_until="domcontentloaded")
        expect(student_a_page.locator("#bindTeacherForm")).to_be_visible(timeout=20_000)
        student_a_page.locator("#teacherCode").fill(real_code)
        student_a_page.locator("#bindTeacherBtn").click()
        expect(student_a_page.locator("#bindMessage")).to_contain_text("已加入教师班级", timeout=20_000)
        student_a_membership_before = sql_scalar(f'''SELECT id || '|' || status FROM "Membership" WHERE "schoolId"={q(fixture['school'])} AND "userId"={q(student_sessions['student_a']['user']['id'])} AND role='STUDENT';''')
        student_a_enrollment_before = sql_scalar(f'''SELECT id || '|' || status FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_a']['user']['id'])} AND role='STUDENT';''')
        used_before_revoke = sql_scalar(f'''SELECT "usedCount"::text FROM "TeacherInvitation" WHERE id={q(invitation_id)};''')
        if not student_a_membership_before.endswith("|ACTIVE") or not student_a_enrollment_before.endswith("|ACTIVE") or used_before_revoke != "1":
            raise AssertionError("Student A profile binding did not create active membership/enrollment and consume one use")
        evidence["browserActions"].append("Student A used the existing Profile form to bind before revocation")

        # A failed revoke transport must not claim success or mask the server's
        # still-active invitation after its one GET reconciliation.
        uncommitted_revoke = {"postCount": 0}

        def abort_uncommitted_revoke(route):
            uncommitted_revoke["postCount"] += 1
            route.abort("failed")

        uncommitted_pattern = f"**/api/v1/schools/{fixture['school']}/teacher-invitations/{invitation_id}/revoke"
        teacher_page.route(uncommitted_pattern, abort_uncommitted_revoke)
        teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] [data-revoke-invitation]').click()
        teacher_page.get_by_role("button", name="确认撤销邀请码").click()
        expect(teacher_page.locator("#invitationStatus")).to_contain_text("服务器未确认撤销", timeout=20_000)
        teacher_page.unroute(uncommitted_pattern, abort_uncommitted_revoke)
        active_after_failure = teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"]')
        if uncommitted_revoke["postCount"] != 1 or active_after_failure.locator(".invitation-state-tag").get_attribute("data-status") != "ACTIVE" or active_after_failure.locator(".invitation-code-input").input_value() != real_code:
            raise AssertionError("A pre-commit network failure did not reconcile back to the server's ACTIVE code")
        if "已确认邀请码撤销" in teacher_page.locator("#toast").inner_text():
            raise AssertionError("A failed revoke request displayed false success")
        evidence["networkUncommittedFailure"] = {"postCount": uncommitted_revoke["postCount"], "serverCommitted": False, "getReconciliation": "ACTIVE", "falseSuccess": False}

        revoke_selector = f'.invitation-record[data-invitation-id="{invitation_id}"] [data-revoke-invitation]'
        teacher_page.locator(revoke_selector).click()
        expect(teacher_page.locator("#invitationRevokeDialog")).to_be_visible()
        warning = teacher_page.locator("#invitationRevokeWarning").inner_text()
        if warning != "撤销后不能再让新学生加入；已经入班的学生不会移除":
            raise AssertionError("Revocation confirmation omitted the retained-enrollment warning")
        focus_probe = teacher_page.evaluate("""() => ({
          labelled: document.querySelector('#invitationRevokeDialog').getAttribute('aria-labelledby'),
          described: document.querySelector('#invitationRevokeDialog').getAttribute('aria-describedby'),
          initial: document.activeElement?.id
        })""")
        if focus_probe != {"labelled": "invitationRevokeTitle", "described": "invitationRevokeWarning", "initial": "invitationRevokeCancel"}:
            raise AssertionError("Revocation confirmation did not receive an accessible name, description and safe initial focus")
        teacher_page.keyboard.press("Shift+Tab")
        if teacher_page.evaluate("document.activeElement?.id") != "invitationRevokeConfirm":
            raise AssertionError("Revocation confirmation focus did not loop from the first to the last action")
        teacher_page.keyboard.press("Tab")
        if teacher_page.evaluate("document.activeElement?.id") != "invitationRevokeCancel":
            raise AssertionError("Revocation confirmation focus did not loop from the last to the first action")
        teacher_page.keyboard.press("Escape")
        expect(teacher_page.locator("#invitationRevokeDialog")).not_to_be_visible()
        if teacher_page.locator(f'{revoke_selector}').count() != 1:
            raise AssertionError("Escape unexpectedly revoked or removed the active invitation")
        evidence["accessibility"] = {"warningExact": True, "labelledDialog": True, "focusLoop": True, "escapeCancels": True, "reducedMotion": "Chromium emulated reduce"}

        # Simulate a committed server request whose HTTP response is dropped.
        revoke_network = {"count": 0, "serverStatus": None, "requestId": None}

        def drop_committed_revoke_response(route):
            upstream = route.fetch()
            revoke_network["count"] += 1
            revoke_network["serverStatus"] = upstream.status
            revoke_network["requestId"] = upstream.headers.get("x-request-id")
            upstream.dispose()
            route.abort("failed")

        revoke_pattern = f"**/api/v1/schools/{fixture['school']}/teacher-invitations/{invitation_id}/revoke"
        teacher_page.route(revoke_pattern, drop_committed_revoke_response)
        teacher_page.locator(revoke_selector).click()
        teacher_page.get_by_role("button", name="确认撤销邀请码").click()
        expect(teacher_page.locator("#invitationStatus")).to_contain_text("服务器已确认邀请码撤销", timeout=25_000)
        teacher_page.unroute(revoke_pattern, drop_committed_revoke_response)
        if revoke_network["count"] != 1 or revoke_network["serverStatus"] != 200 or not revoke_network["requestId"]:
            raise AssertionError("The dropped-response revoke did not commit exactly one server request")
        try:
            teacher_page.wait_for_function("document.activeElement?.id === 'studentInvitationClose'", timeout=3_000)
        except Exception as error:
            focus_state = teacher_page.evaluate("""() => ({tag:document.activeElement?.tagName,id:document.activeElement?.id,inside:document.activeElement?.closest('dialog')?.id || ''})""")
            raise AssertionError(f"Confirmed revocation did not restore keyboard focus inside the invitation dialog: {focus_state}") from error
        expect(teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] .invitation-state-tag')).to_contain_text("已撤销")
        if teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] .invitation-code-input').count() or teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] [data-copy-invitation]').count() or teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] [data-revoke-invitation]').count():
            raise AssertionError("Confirmed revoked card still exposed code, copy or revoke actions")
        if teacher_page.locator("#invitationItems").inner_text().find(real_code) >= 0:
            raise AssertionError("The old token remained in the teacher DOM after server confirmation")
        evidence["network"] = {"revokeResponseDropped": True, "upstreamStatus": revoke_network["serverStatus"], "postCount": revoke_network["count"], "reconciliation": "GET mine confirmed REVOKED; no POST retry"}
        evidence["browserActions"].append("Teacher clicked revoke and confirmed; the committed response was dropped and GET mine confirmed REVOKED")
        evidence["responsive"] = responsive_screenshots(teacher_page, (390, 768, 1280, 1440), EVIDENCE_DIR)
        teacher_page.set_viewport_size({"width": 1440, "height": 1000})

        list_response = teacher_page.request.get(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/mine", headers=headers(teacher_session),
        )
        expect_status(list_response, 200, "GET mine after revoke")
        revoked_row = next(item for item in payload(list_response).get("items", []) if item["id"] == invitation_id)
        if revoked_row["status"] != "REVOKED" or revoked_row["code"] is not None or revoked_row["usedCount"] != 1:
            raise AssertionError("GET mine did not return redacted REVOKED server state and current usage")

        repeated = teacher_page.request.post(revoke_pattern.replace("**/api/v1", f"{BASE}/api/v1"), headers=headers(teacher_session))
        expect_status(repeated, 200, "idempotent repeated revoke")
        repeated_body = payload(repeated)
        if repeated_body.get("status") != "REVOKED" or repeated_body.get("code") is not None:
            raise AssertionError("Repeated revoke did not return sanitized REVOKED state")

        audit_row = sql_scalar(
            f'''SELECT id || '|' || "resourceId" || '|' || ("afterSummary"->>'classId') || '|' || ("afterSummary"->>'revokedAt') || '|' || "requestId"
                 FROM "AuditLog" WHERE action='TEACHER_INVITATION_REVOKED' AND "resourceType"='TeacherInvitation'
                   AND "resourceId"={q(invitation_id)} AND "schoolId"={q(fixture['school'])};'''
        )
        revoke_audit_count = sql_scalar(f'''SELECT count(*) FROM "AuditLog" WHERE action='TEACHER_INVITATION_REVOKED' AND "resourceId"={q(invitation_id)} AND "schoolId"={q(fixture['school'])};''')
        revoked_at = sql_scalar(f'''SELECT "revokedAt"::text FROM "TeacherInvitation" WHERE id={q(invitation_id)};''')
        if not audit_row or revoke_audit_count != "1" or audit_row.split("|")[1:3] != [invitation_id, fixture["class_main"]] or not revoked_at:
            raise AssertionError("PostgreSQL does not show one exact-id/class revoke audit and durable revokedAt")
        audit_parts = audit_row.split("|", 4)
        audit_timestamp = audit_parts[3]
        if not audit_timestamp.endswith("Z") or audit_parts[4] != revoke_network["requestId"] or audit_parts[4] == "request-id":
            raise AssertionError("Revoke audit did not use the request's actual ID and UTC ISO timestamp")
        evidence["postgresRevoke"] = {"teacherInvitationId": invitation_id, "revokedAt": revoked_at, "auditLogId": audit_parts[0], "auditCount": revoke_audit_count, "auditAction": "TEACHER_INVITATION_REVOKED", "auditClassId": audit_parts[2], "auditSummaryRevokedAtUtc": audit_timestamp, "requestId": audit_parts[4], "usedCountAfterRevoke": revoked_row["usedCount"]}
        evidence["apiStatuses"].extend([
            {"case": "revoke", "status": revoke_network["serverStatus"], "browserResponseDropped": True},
            {"case": "get-mine-revoked", "status": list_response.status, "code": "redacted"},
            {"case": "repeated-revoke", "status": repeated.status, "auditCount": revoke_audit_count},
        ])

        student_b_page = student_pages["student_b"]
        student_b_page.goto(f"{BASE}/student/profile/", wait_until="domcontentloaded")
        expect(student_b_page.locator("#bindTeacherForm")).to_be_visible(timeout=20_000)
        student_b_membership_before = sql_scalar(f'''SELECT id || '|' || status FROM "Membership" WHERE "schoolId"={q(fixture['school'])} AND "userId"={q(student_sessions['student_b']['user']['id'])} AND role='STUDENT';''')
        student_b_enrollments_before = sql_scalar(f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_b']['user']['id'])} AND role='STUDENT';''')
        student_b_page.locator("#teacherCode").fill(real_code)
        student_b_page.locator("#bindTeacherBtn").click()
        expect(student_b_page.locator("#bindMessage")).to_contain_text("已撤销", timeout=20_000)
        if not student_b_page.url.endswith("/student/profile/"):
            raise AssertionError("Student B did not remain on Profile after the revoked-code conflict")
        student_b_old_status = next(event["status"] for event in reversed(api_events) if event["operation"] == "student-bind")
        student_b_membership_after = sql_scalar(f'''SELECT id || '|' || status FROM "Membership" WHERE "schoolId"={q(fixture['school'])} AND "userId"={q(student_sessions['student_b']['user']['id'])} AND role='STUDENT';''')
        student_b_enrollments_after = sql_scalar(f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_b']['user']['id'])} AND role='STUDENT';''')
        used_after_old_attempt = sql_scalar(f'''SELECT "usedCount"::text FROM "TeacherInvitation" WHERE id={q(invitation_id)};''')
        if student_b_old_status != 409 or student_b_membership_after != student_b_membership_before or student_b_enrollments_after != student_b_enrollments_before or student_b_enrollments_after != "0" or used_after_old_attempt != "1":
            raise AssertionError("Student B's revoked-code attempt changed membership, enrollment or usedCount")

        # Both lock orderings are deterministic: the first claimant is queued
        # on the row before the second request is issued.
        bind_wins_invitation = create_invitation(teacher_page, teacher_session, fixture["school"], fixture["class_main"], 3)
        bind_wins = run_ordered_race(
            invitation_id=bind_wins_invitation["id"], code=bind_wins_invitation["code"],
            bind_session=student_sessions["student_c"],
            teacher_session=teacher_session, school_id=fixture["school"], first_kind="bind",
        )
        if bind_wins["bindStatus"] != 201 or bind_wins["revokeStatus"] != 200:
            raise AssertionError("A bind queued before revoke did not commit first and leave a legitimate enrollment")
        student_c_enrollment = sql_scalar(f'''SELECT id || '|' || status FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_c']['user']['id'])} AND role='STUDENT';''')
        if not student_c_enrollment.endswith("|ACTIVE"):
            raise AssertionError("The bind-first concurrent student did not retain active enrollment")

        revoke_wins_invitation = create_invitation(teacher_page, teacher_session, fixture["school"], fixture["class_main"], 3)
        revoke_wins = run_ordered_race(
            invitation_id=revoke_wins_invitation["id"], code=revoke_wins_invitation["code"],
            bind_session=student_sessions["student_d"],
            teacher_session=teacher_session, school_id=fixture["school"], first_kind="revoke",
        )
        if revoke_wins["revokeStatus"] != 200 or revoke_wins["bindStatus"] != 409:
            raise AssertionError("A revoke queued before bind did not reject the later student claim")
        student_d_enrollments = sql_scalar(f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_d']['user']['id'])} AND role='STUDENT';''')
        revoke_wins_used = sql_scalar(f'''SELECT "usedCount"::text FROM "TeacherInvitation" WHERE id={q(revoke_wins_invitation['id'])};''')
        revoke_wins_audit_count = sql_scalar(f'''SELECT count(*) FROM "AuditLog" WHERE action='TEACHER_INVITATION_REVOKED' AND "resourceId"={q(revoke_wins_invitation['id'])};''')
        if student_d_enrollments != "0" or revoke_wins_used != "0" or revoke_wins_audit_count != "1":
            raise AssertionError("Revoke-first race changed Student D enrollment/useCount or lost its single audit")
        evidence["concurrency"] = {
            "bindBeforeRevoke": {**bind_wins, "studentCEnrollmentId": student_c_enrollment.split("|")[0], "studentCEnrollmentStatus": "ACTIVE"},
            "revokeBeforeBind": {**revoke_wins, "studentDEnrollmentCount": student_d_enrollments, "usedCount": revoke_wins_used, "revokeAuditCount": revoke_wins_audit_count},
        }

        # The revoked history now permits a UI-created replacement invitation.
        teacher_page.locator("#studentInvitationClose").click()
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator("#invitationShowCreate")).to_be_visible(timeout=15_000)
        teacher_page.locator("#invitationShowCreate").click()
        teacher_page.locator('#invitationCreateForm select[name="maxUses"]').select_option("10")
        teacher_page.locator('#invitationCreateForm select[name="expiresInDays"]').select_option("30")
        teacher_page.locator("#invitationCreateButton").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=25_000)
        replacement_response = teacher_page.request.get(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations/mine", headers=headers(teacher_session),
        )
        expect_status(replacement_response, 200, "teacher list after replacement creation")
        replacement = next(item for item in payload(replacement_response).get("items", []) if item["status"] == "ACTIVE" and item["class"]["id"] == fixture["class_main"])
        if replacement["id"] == invitation_id or not replacement.get("code"):
            raise AssertionError("Replacement invitation was not a new server-issued active code")
        replacement_code = replacement["code"]

        student_b_page.locator("#teacherCode").fill(replacement_code)
        student_b_page.locator("#bindTeacherBtn").click()
        expect(student_b_page.locator("#bindMessage")).to_contain_text("已加入教师班级", timeout=20_000)
        replacement_usage = sql_scalar(f'''SELECT "usedCount"::text FROM "TeacherInvitation" WHERE id={q(replacement['id'])};''')
        student_b_new_enrollment = sql_scalar(f'''SELECT id || '|' || status FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND "userId"={q(student_sessions['student_b']['user']['id'])} AND role='STUDENT';''')
        replacement_bind_audit = sql_scalar(f'''SELECT count(*) FROM "AuditLog" WHERE action='STUDENT_BOUND_TEACHER_INVITATION' AND "resourceId"={q(replacement['id'])} AND "actorUserId"={q(student_sessions['student_b']['user']['id'])};''')
        if replacement_usage != "1" or not student_b_new_enrollment.endswith("|ACTIVE") or replacement_bind_audit != "1":
            raise AssertionError("Student B did not join with the replacement invitation and write its use/audit state")
        evidence["studentB"] = {"oldCodeBindStatus": student_b_old_status, "membershipBefore": student_b_membership_before, "membershipAfter": student_b_membership_after, "oldCodeEnrollmentBefore": student_b_enrollments_before, "oldCodeEnrollmentAfter": student_b_enrollments_after, "oldCodeUsedCountAfterAttempt": used_after_old_attempt, "replacementInvitationId": replacement["id"], "replacementCode": "TC-•••••-•••••", "replacementBindStatus": 201, "replacementUsedCount": replacement_usage, "replacementEnrollmentId": student_b_new_enrollment.split("|")[0], "replacementEnrollmentStatus": "ACTIVE", "replacementBindAuditCount": replacement_bind_audit}
        evidence["postgresStudentA"] = {"membership": student_a_membership_before, "enrollment": student_a_enrollment_before, "stillActiveAfterRevoke": sql_scalar(f'''SELECT count(*) FROM "Enrollment" WHERE id={q(student_a_enrollment_before.split('|')[0])} AND status='ACTIVE';''') == "1"}
        if not evidence["postgresStudentA"]["stillActiveAfterRevoke"]:
            raise AssertionError("Revocation removed Student A's earlier active enrollment")
        evidence["apiStatuses"].extend([
            {"case": "student-B-old-code-profile-bind", "status": student_b_old_status, "membershipChanged": False, "enrollmentCreated": False, "usedCountChanged": False},
            {"case": "student-B-replacement-profile-bind", "status": 201, "usedCount": replacement_usage, "bindAuditCount": replacement_bind_audit},
        ])
        evidence["browserActions"].append("Student B received Profile 409 for the revoked code without enrollment/use changes, then bound the UI-created replacement code")

        # The secret-free revoked screenshots were captured before any replacement was created.
        teacher_page.bring_to_front()
        expect(teacher_page.locator("#studentInvitationDialog")).to_be_visible()

        # Account and school switch while an active replacement is visible must clear it.
        teacher_page.set_viewport_size({"width": 1440, "height": 1000})
        teacher_page.evaluate("token => localStorage.setItem('yuzan-access-token', token)", teacher_b_session["token"])
        expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=5_000)
        if teacher_page.locator("#invitationItems").inner_text().strip():
            raise AssertionError("Switching teacher account retained invitation content")
        teacher_page.evaluate("token => localStorage.setItem('yuzan-access-token', token)", teacher_session["token"])
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=20_000)
        teacher_page.evaluate("school => localStorage.setItem('yuzan-active-school-id', school)", fixture["school_other"])
        expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=5_000)
        if teacher_page.locator("#invitationItems").inner_text().strip():
            raise AssertionError("Switching school retained the previous school's invitation content")
        evidence["identitySwitch"] = {"teacherAccountSwitchCleared": True, "schoolSwitchCleared": True}
        evidence["apiEvents"] = api_events
        evidence["browserErrors"] = page_errors
        if page_errors:
            raise AssertionError("Chromium reported a page error during the T028 real-user flow")
        (EVIDENCE_DIR / "t028-browser-database-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        browser.close()
