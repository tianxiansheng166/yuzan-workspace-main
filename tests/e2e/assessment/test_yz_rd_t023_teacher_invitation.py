"""T023 real teacher → class invitation → student bind acceptance."""

from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T023_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T023_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T023_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T023_EVIDENCE_DIR", ""))
TEACHER_TEMPLATE_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222"


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str) -> str:
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t023"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t023_native"
    password = parsed.password or ""
    assert password and password == os.environ["POSTGRES_PASSWORD"]
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError("T023 PostgreSQL verification query failed: " + result.stderr.replace(password, "<redacted>")[-1500:])
    return result.stdout.strip()


def sql_scalar(statement: str) -> str:
    rows = sql(statement)
    return rows.splitlines()[0].strip() if rows else ""


def verify_runtime_identity() -> tuple[str, str]:
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    pieces = identity.split("|", 2)
    if len(pieces) != 3 or pieces[:2] != ["yuzan_t023_native", "yz_t023"] or not pieces[2].startswith("PostgreSQL 17."):
        raise AssertionError("Chromium E2E is not connected to the fresh T023 PostgreSQL 17 database/user")
    return pieces[0], pieces[1]


def seed_fixture() -> dict[str, str]:
    suffix = uuid.uuid4().hex[:10]
    keys = (
        "school", "term_main", "term_other", "term_b", "class_main", "class_other", "class_b",
        "teacher_c", "teacher_b", "student_a", "student_b", "teacher_enrollment_main",
        "teacher_enrollment_other", "teacher_enrollment_b", "student_enrollment_a",
        "student_enrollment_b", "membership_teacher_c", "membership_teacher_b",
        "membership_student_a", "membership_student_b",
    )
    ids = {key: str(uuid.uuid4()) for key in keys}
    logins = {
        "teacher_c": f"teacher.t023.c.{suffix}@test.invalid",
        "teacher_b": f"teacher.t023.b.{suffix}@test.invalid",
        "student_a": f"student.t023.a.{suffix}@test.invalid",
        "student_b": f"student.t023.b.{suffix}@test.invalid",
    }
    names = {
        "teacher_c": f"TEST_FIXTURE_ONLY T023 教师丙 {suffix}",
        "teacher_b": f"TEST_FIXTURE_ONLY T023 教师乙 {suffix}",
        "student_a": f"TEST_FIXTURE_ONLY T023 学生甲 {suffix}",
        "student_b": f"TEST_FIXTURE_ONLY T023 学生乙 {suffix}",
    }
    school = f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
      VALUES ({q(ids['school'])},{q('YZ-T023-'+suffix)},{q('TEST_FIXTURE_ONLY T023 测试学校 '+suffix)},'TEST',NOW(),NOW());'''
    user_rows = []
    for key, template in (("teacher_c", TEACHER_TEMPLATE_ID), ("teacher_b", TEACHER_TEMPLATE_ID), ("student_a", STUDENT_TEMPLATE_ID), ("student_b", STUDENT_TEMPLATE_ID)):
        user_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
              SELECT {q(ids[key])},{q(logins[key])},{q(names[key])},"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(template)};'''
        )
    membership_rows = []
    for key, role in (("teacher_c", "TEACHER"), ("teacher_b", "TEACHER"), ("student_a", "STUDENT"), ("student_b", "STUDENT")):
        membership_rows.append(
            f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
              VALUES ({q(ids['membership_'+key])},{q(ids['school'])},{q(ids[key])},{q(role)},'ACTIVE',NOW());'''
        )
    term_rows = []
    for key, label in (("term_main", "主班"), ("term_other", "另一班"), ("term_b", "乙教师班")):
        term_rows.append(
            f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
              VALUES ({q(ids[key])},{q(ids['school'])},{q('TEST_FIXTURE_ONLY T023 '+label+' 学期 '+suffix)},'2026-01-01','2036-12-31',true,NOW());'''
        )
    class_rows = []
    for key, term_key, label in (("class_main", "term_main", "丙教师主班"), ("class_other", "term_other", "丙教师另一班"), ("class_b", "term_b", "乙教师班")):
        class_rows.append(
            f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
              VALUES ({q(ids[key])},{q(ids['school'])},{q(ids[term_key])},{q('TEST_FIXTURE_ONLY T023 '+label+' '+suffix)},'七年级',NOW(),NOW());'''
        )
    enrollment_rows = []
    for enrollment_key, class_key, user_key, role in (
        ("teacher_enrollment_main", "class_main", "teacher_c", "TEACHER"),
        ("teacher_enrollment_other", "class_other", "teacher_c", "TEACHER"),
        ("teacher_enrollment_b", "class_b", "teacher_b", "TEACHER"),
    ):
        enrollment_rows.append(
            f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
              VALUES ({q(ids[enrollment_key])},{q(ids['school'])},{q(ids[class_key])},{q(ids[user_key])},{q(role)},'ACTIVE',NOW());'''
        )
    sql("BEGIN;\n" + school + "\n" + "\n".join(user_rows + membership_rows + term_rows + class_rows + enrollment_rows) + "\nCOMMIT;")
    if sql_scalar(f'''SELECT count(*) FROM "User" WHERE id IN ({q(ids['teacher_c'])},{q(ids['teacher_b'])},{q(ids['student_a'])},{q(ids['student_b'])});''') != "4":
        raise AssertionError("T023 fictional test identities were not all created")
    ids.update(logins=logins, names=names, suffix=suffix)
    return ids


def payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def login_via_browser(page, identifier: str, home_pattern: str) -> dict[str, str]:
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


def headers(session: dict[str, str]) -> dict[str, str]:
    token = session.get("token") or session.get("accessToken")
    if not isinstance(token, str) or not token:
        raise AssertionError("Authenticated T023 fixture did not return an access token")
    return {"Authorization": f"Bearer {token}"}


def expect_status(response, expected: int, label: str) -> None:
    if response.status != expected:
        raise AssertionError(f"{label}: HTTP {response.status}, expected {expected}")


def invitation_rows_from_api(page, school_id: str, session: dict[str, str]):
    response = page.request.get(
        f"{BASE}/api/v1/schools/{school_id}/teacher-invitations/mine",
        headers=headers(session),
    )
    expect_status(response, 200, "teacher invitation list")
    data = payload(response)
    return data.get("items", []) if isinstance(data, dict) else []


def add_inactive_invitation_fixtures(ids: dict[str, str]) -> dict[str, str]:
    codes = {key: "TC-" + uuid.uuid4().hex[:5].upper() + "-" + uuid.uuid4().hex[:5].upper() for key in ("expired", "revoked", "exhausted")}
    rows = []
    records = (
        ("expired", "NOW()-INTERVAL '2 days'", "NULL", 0, 3),
        ("revoked", "NOW()+INTERVAL '30 days'", "NOW()", 0, 3),
        ("exhausted", "NOW()+INTERVAL '30 days'", "NULL", 1, 1),
    )
    for key, expires, revoked, used, maximum in records:
        rows.append(
            f'''INSERT INTO "TeacherInvitation" (id,"schoolId","classId","teacherUserId",code,"maxUses","usedCount","expiresAt","revokedAt","createdAt","updatedAt")
              VALUES ({q(str(uuid.uuid4()))},{q(ids['school'])},{q(ids['class_main'])},{q(ids['teacher_c'])},{q(codes[key])},{maximum},{used},{expires},{revoked},NOW(),NOW());'''
        )
    sql("BEGIN;\n" + "\n".join(rows) + "\nCOMMIT;")
    return codes


def save_responsive_proof(page, widths: tuple[int, ...], fixture: dict[str, str]) -> list[dict[str, object]]:
    proof = []
    code_input = page.locator(".invitation-record.is-usable .invitation-code-input")
    for width in widths:
        page.set_viewport_size({"width": width, "height": 900 if width > 600 else 844})
        page.wait_for_timeout(120)
        layout = page.evaluate("""() => {
          const dialog = document.querySelector('#studentInvitationDialog');
          const copy = document.querySelector('.invitation-copy-button');
          const bounds = element => { const r = element.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}; };
          return {
            viewport: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            dialog: bounds(dialog),
            copy: bounds(copy),
            dialogOpen: dialog.open,
            labelled: dialog.getAttribute('aria-labelledby'),
            background: getComputedStyle(document.querySelector('.growth-map')).backgroundImage,
            activeCode: document.querySelector('.invitation-code-input')?.value || '',
            overflowing: [...document.querySelectorAll('body *')].filter(element => {
              const r = element.getBoundingClientRect();
              return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
            }).slice(0, 12).map(element => ({tag:element.tagName,id:element.id,className:String(element.className).slice(0,90),left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right),position:getComputedStyle(element).position}))
          };
        }""")
        if layout["viewport"] != width or layout["scrollWidth"] > width + 1:
            raise AssertionError(f"Responsive horizontal overflow at {width}px: {layout['scrollWidth']} / {layout['overflowing']}")
        if not layout["dialogOpen"] or layout["dialog"]["left"] < 0 or layout["dialog"]["right"] > width + 1:
            raise AssertionError(f"Invitation dialog is outside the viewport at {width}px")
        if layout["copy"]["left"] < 0 or layout["copy"]["right"] > width + 1:
            raise AssertionError(f"Copy control is outside the viewport at {width}px")
        if "class-growth-map.png" not in layout["background"] or layout["labelled"] != "studentInvitationTitle":
            raise AssertionError(f"Class backdrop or dialog labelling changed at {width}px")
        if layout["activeCode"] != code_input.input_value():
            raise AssertionError("Responsive state changed the server-issued code unexpectedly")
        path = EVIDENCE_DIR / f"class-invitation-{width}.png"
        page.screenshot(path=str(path), mask=[code_input])
        proof.append({
            "width": width,
            "height": 844 if width == 390 else 900,
            "documentScrollWidth": layout["scrollWidth"],
            "dialogBounds": {key: round(value, 1) for key, value in layout["dialog"].items()},
            "copyBounds": {key: round(value, 1) for key, value in layout["copy"].items()},
            "screenshot": path.name,
            "codeScreenshotMask": "server-issued code input masked",
        })
    return proof


def test_t023_teacher_class_invitation_real_browser_and_postgres():
    assert BASE.startswith("http://127.0.0.1:")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    db_identity = verify_runtime_identity()
    fixture = seed_fixture()
    evidence: dict[str, object] = {
        "database": {"name": db_identity[0], "user": db_identity[1], "version": "PostgreSQL 17"},
        "schoolId": fixture["school"],
        "teacherClassId": fixture["class_main"],
        "teacherOtherClassId": fixture["class_other"],
        "teacherOtherClassEnrollmentId": fixture["teacher_enrollment_other"],
        "teacherBClassId": fixture["class_b"],
        "browserActions": [],
        "apiStatuses": [],
        "responsive": [],
    }
    api_events: list[dict[str, object]] = []
    browser_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        teacher_context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["clipboard-read", "clipboard-write"],
            reduced_motion="reduce",
        )
        teacher_page = teacher_context.new_page()
        teacher_page.on("pageerror", lambda error: browser_errors.append(type(error).__name__))

        def record_response(response):
            path = urlparse(response.url).path
            if "teacher-invitations" not in path and not path.endswith("/student/today"):
                return
            if path.endswith("/mine"):
                operation = "list-mine"
            elif path.endswith("/bind"):
                operation = "student-bind"
            elif path.endswith("/teacher-invitations"):
                operation = "teacher-create"
            else:
                operation = "student-today"
            api_events.append({"method": response.request.method, "operation": operation, "status": response.status})

        def record_request_failure(request):
            path = urlparse(request.url).path
            if "teacher-invitations" in path or path.endswith("/student/today"):
                api_events.append({"method": request.method, "operation": "request-failed", "route": path.rsplit("/", 1)[-1]})

        teacher_page.on("response", record_response)
        teacher_page.on("requestfailed", record_request_failure)
        teacher_session = login_via_browser(teacher_page, fixture["logins"]["teacher_c"], r".*/teacher/?$")
        if teacher_session["schoolId"] != fixture["school"]:
            raise AssertionError("Teacher C did not enter the T023 test school")
        evidence["teacherCUserId"] = teacher_session["user"]["id"]
        evidence["teacherCMainEnrollmentId"] = fixture["teacher_enrollment_main"]
        evidence["browserActions"].append("Teacher C authenticated through the browser login form")

        # Create a real invitation for Teacher C's other class so the page has
        # to filter the GET /mine list by item.class.id.
        other_invite = teacher_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations",
            headers=headers(teacher_session),
            data={"classId": fixture["class_other"], "maxUses": 3, "expiresInDays": 30},
        )
        expect_status(other_invite, 201, "fixture invitation for teacher's other class")
        evidence["apiStatuses"].append({"case": "teacher-C-other-class-create", "status": other_invite.status})

        # A second, real browser login supplies Teacher B's scoped credentials.
        b_context = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        b_page = b_context.new_page()
        teacher_b_session = login_via_browser(b_page, fixture["logins"]["teacher_b"], r".*/teacher/?$")
        if teacher_b_session["schoolId"] != fixture["school"]:
            raise AssertionError("Teacher B did not enter the same T023 test school")
        evidence["teacherBUserId"] = teacher_b_session["user"]["id"]
        evidence["teacherBClassEnrollmentId"] = fixture["teacher_enrollment_b"]

        anonymous_api = playwright.request.new_context()
        no_auth = anonymous_api.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations",
            data={"classId": fixture["class_main"], "maxUses": 1, "expiresInDays": 30},
        )
        expect_status(no_auth, 401, "unauthenticated teacher invitation creation")
        anonymous_api.dispose()
        evidence["apiStatuses"].append({"case": "unauthenticated-create", "status": no_auth.status})

        wrong_teacher = teacher_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations",
            headers=headers(teacher_b_session),
            data={"classId": fixture["class_main"], "maxUses": 1, "expiresInDays": 30},
        )
        expect_status(wrong_teacher, 403, "Teacher B creating for Teacher C's class")
        evidence["apiStatuses"].append({"case": "teacher-B-create-for-C-class", "status": wrong_teacher.status})

        missing_class = teacher_page.request.get(
            f"{BASE}/api/v1/schools/{fixture['school']}/classes/{uuid.uuid4()}/dashboard",
            headers=headers(teacher_session),
        )
        expect_status(missing_class, 404, "nonexistent class read")
        evidence["apiStatuses"].append({"case": "nonexistent-class", "status": missing_class.status})

        main_href = f"/teacher/classes/{fixture['class_main']}?schoolId={fixture['school']}"
        teacher_page.locator(f'#classList a[href="{main_href}"]').click()
        teacher_page.wait_for_url(re.compile(rf".*/teacher/classes/{re.escape(fixture['class_main'])}\?schoolId=.*"), timeout=30_000)
        expect(teacher_page.locator(".class-title h1")).to_contain_text("TEST_FIXTURE_ONLY T023 丙教师主班", timeout=25_000)
        evidence["browserActions"].append("Clicked Teacher C's own class from the teacher home class list")

        # The first list read is interrupted; the UI must show a server error,
        # then allow an explicit GET retry without stale data.
        failed_list = {"count": 0}

        def abort_first_list(route):
            failed_list["count"] += 1
            route.abort("failed")

        list_pattern = f"**/api/v1/schools/{fixture['school']}/teacher-invitations/mine"
        teacher_page.route(list_pattern, abort_first_list)
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator("#invitationStatus")).to_contain_text("服务器读取失败", timeout=15_000)
        expect(teacher_page.locator("#invitationReadError")).to_be_visible()
        expect(teacher_page.locator("#invitationItems .invitation-record")).to_have_count(0)
        teacher_page.unroute(list_pattern, abort_first_list)
        teacher_page.locator("#invitationRetry").click()
        expect(teacher_page.locator("#invitationEmpty")).to_be_visible(timeout=15_000)
        expect(teacher_page.locator("#invitationItems .invitation-record")).to_have_count(0)
        if failed_list["count"] != 1:
            raise AssertionError("The one-shot list failure was not injected exactly once")
        evidence["browserActions"].append("Observed real server-read failure, then clicked retry; other-class code stayed hidden")
        evidence["network"] = {"teacher-list-abort-count": failed_list["count"], "retry-result": "empty list for current class"}

        # A Student role cannot create, even if it submits a valid class ID.
        student_page = teacher_context.new_page()
        student_page.on("response", record_response)
        student_session = login_via_browser(student_page, fixture["logins"]["student_a"], r".*/student/today/?$")
        student_create = student_page.request.post(
            f"{BASE}/api/v1/schools/{fixture['school']}/teacher-invitations",
            headers=headers(student_session),
            data={"classId": fixture["class_main"], "maxUses": 1, "expiresInDays": 30},
        )
        expect_status(student_create, 403, "student creating a teacher invitation")
        evidence["apiStatuses"].append({"case": "student-create", "status": student_create.status})
        student_page.goto(f"{BASE}/student/profile/", wait_until="domcontentloaded")
        expect(student_page.locator("#bindTeacherForm")).to_be_visible(timeout=20_000)

        invalid_bind = student_page.request.post(
            f"{BASE}/api/v1/student/teacher-invitations/bind",
            headers=headers(student_session),
            data={"code": "TC-" + uuid.uuid4().hex[:5].upper() + "-" + uuid.uuid4().hex[:5].upper()},
        )
        expect_status(invalid_bind, 404, "invalid student invitation code")
        evidence["apiStatuses"].append({"case": "invalid-code", "status": invalid_bind.status})

        # Return to Teacher C's class page, then simulate a server commit whose
        # POST response is lost in transit. The UI must re-GET before any retry.
        teacher_page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
        teacher_session = login_via_browser(teacher_page, fixture["logins"]["teacher_c"], r".*/teacher/?$")
        teacher_page.locator(f'#classList a[href="{main_href}"]').click()
        teacher_page.wait_for_url(re.compile(rf".*/teacher/classes/{re.escape(fixture['class_main'])}\?schoolId=.*"), timeout=30_000)
        teacher_page.goto(f"{BASE}{main_href}", wait_until="domcontentloaded")
        expect(teacher_page.locator(".class-title h1")).to_contain_text("TEST_FIXTURE_ONLY T023 丙教师主班", timeout=25_000)
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator("#invitationEmpty")).to_be_visible(timeout=20_000)
        teacher_page.locator("#invitationShowCreate").click()
        teacher_page.locator('#invitationCreateForm select[name="maxUses"]').select_option("1")
        teacher_page.locator('#invitationCreateForm select[name="expiresInDays"]').select_option("30")
        create_loss = {"count": 0, "serverStatus": None}

        def drop_create_response(route):
            upstream = route.fetch()
            create_loss["count"] += 1
            create_loss["serverStatus"] = upstream.status
            upstream.dispose()
            route.abort("failed")

        create_pattern = f"**/api/v1/schools/{fixture['school']}/teacher-invitations"
        teacher_page.route(create_pattern, drop_create_response)
        teacher_page.locator("#invitationCreateButton").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=25_000)
        teacher_page.unroute(create_pattern, drop_create_response)
        if create_loss["count"] != 1 or create_loss["serverStatus"] not in (200, 201):
            raise AssertionError("The invitation create response-loss scenario did not reach one successful server POST")
        expect(teacher_page.locator("#invitationStatus")).to_contain_text("服务器已读取本班", timeout=10_000)
        evidence["network"].update({"create-response-lost": True, "create-server-status": create_loss["serverStatus"], "post-count": create_loss["count"], "retry-action": "GET confirmed the created invitation; no second POST"})
        evidence["browserActions"].append("Selected use limit and validity; submitted from UI; server commit survived a dropped response and UI re-read the real invitation")

        # Record the real server-issued code only in process memory. All saved
        # screenshots, logs and JSON below mask or omit the code.
        clipboard_denial = """() => {
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); }, readText: async () => '' } });
          return {ownClipboard: Object.hasOwn(navigator, 'clipboard'), denialInstalled: navigator.clipboard.writeText.toString().includes('denied')};
        }"""
        denial_probe = teacher_page.evaluate(clipboard_denial)
        if not denial_probe["ownClipboard"] or not denial_probe["denialInstalled"]:
            raise AssertionError("Chromium clipboard failure could not be injected into the page")
        teacher_page.locator(".invitation-record.is-usable .invitation-copy-button").click()
        try:
            teacher_page.wait_for_function("document.querySelector('.invitation-copy-feedback')?.textContent.includes('复制失败')", timeout=10_000)
        except Exception:
            pass
        denial_result = teacher_page.evaluate("""() => ({
          feedback: document.querySelector('.invitation-copy-feedback')?.textContent || '',
          toast: document.querySelector('#toast')?.textContent || '',
          denialInstalled: navigator.clipboard.writeText.toString().includes('denied')
        })""")
        if "复制失败" not in denial_result["feedback"]:
            raise AssertionError(f"Clipboard rejection did not reach its failure state: feedback={denial_result['feedback']!r}, toast={denial_result['toast']!r}, pageErrors={browser_errors!r}")
        expect(teacher_page.locator(".invitation-copy-feedback")).to_contain_text("复制失败", timeout=15_000)
        selection = teacher_page.evaluate("""() => ({
          selected: document.activeElement?.classList.contains('invitation-code-input') === true,
          length: document.activeElement?.value?.length || 0,
          selectionLength: (document.activeElement?.selectionEnd || 0) - (document.activeElement?.selectionStart || 0)
        })""")
        if not selection["selected"] or selection["length"] == 0 or selection["selectionLength"] != selection["length"]:
            raise AssertionError("Clipboard failure did not leave the real code selected for manual copying")
        denied_toast = teacher_page.locator("#toast").inner_text()
        if "已复制" in denied_toast:
            raise AssertionError("Clipboard denial incorrectly produced a success toast")
        evidence["browserActions"].append("Denied clipboard write; UI reported failure and selected the real input for manual copy")

        teacher_page.evaluate("delete navigator.clipboard")
        code_input = teacher_page.locator(".invitation-record.is-usable .invitation-code-input")
        real_server_code = code_input.input_value()
        if not re.fullmatch(r"TC-[A-F0-9]{5}-[A-F0-9]{5}", real_server_code):
            raise AssertionError("The displayed value does not match a server-issued TeacherInvitation code shape")
        teacher_page.locator(".invitation-record.is-usable .invitation-copy-button").click()
        expect(teacher_page.locator(".invitation-copy-feedback")).to_contain_text("邀请码已复制", timeout=15_000)
        try:
            copied_code = teacher_page.evaluate("navigator.clipboard.readText()")
        except Exception as error:
            raise AssertionError("Chromium could not read the completed clipboard write") from error
        if copied_code != real_server_code:
            raise AssertionError("Chromium clipboard does not contain the server-returned code")
        evidence["clipboard"] = {"writeText-resolved": True, "failure-selected-input": True, "evidence-code": "TC-•••••-•••••"}
        evidence["browserActions"].append("Clicked copy; awaited Clipboard API success; read back the exact code in Chromium without logging it")

        evidence["responsive"] = save_responsive_proof(teacher_page, (390, 768, 1280, 1440), fixture)
        teacher_page.set_viewport_size({"width": 1440, "height": 1000})
        teacher_page.keyboard.press("Tab")
        focus_in_dialog = teacher_page.evaluate("document.activeElement?.closest('dialog#studentInvitationDialog') !== null")
        if not focus_in_dialog:
            raise AssertionError("Keyboard tab focus escaped the modal invitation dialog")
        teacher_page.keyboard.press("Escape")
        expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=5_000)
        expect(teacher_page.locator("#invitationItems .invitation-record")).to_have_count(0, timeout=5_000)
        focus_restored = teacher_page.evaluate("document.activeElement?.matches('[data-action=class-invitation]') === true")
        if not focus_restored:
            focus_state = teacher_page.evaluate("""() => ({tag:document.activeElement?.tagName,id:document.activeElement?.id,action:document.activeElement?.dataset?.action,text:document.activeElement?.textContent?.slice(0,32)})""")
            raise AssertionError(f"Escape close failed to restore focus: focus={focus_state}")
        evidence["accessibility"] = {"dialog-labelled": True, "keyboard-tab-contained": True, "escape-closes-and-clears": True, "reduced-motion": "Chromium context emulated reduce"}

        # Same-school teacher account switch and school switch must both erase
        # the active code while its dialog is open.
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=20_000)
        teacher_page.evaluate("token => localStorage.setItem('yuzan-access-token', token)", teacher_b_session["token"])
        expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=4_000)
        if teacher_page.locator("#invitationItems").inner_text().strip():
            raise AssertionError("Switching teacher accounts retained the previous teacher's code")
        teacher_page.evaluate("token => localStorage.setItem('yuzan-access-token', token)", teacher_session["token"])
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator(".invitation-record.is-usable")).to_have_count(1, timeout=20_000)
        teacher_page.evaluate("school => localStorage.setItem('yuzan-active-school-id', school)", str(uuid.uuid4()))
        expect(teacher_page.locator("#studentInvitationDialog")).not_to_be_visible(timeout=4_000)
        if teacher_page.locator("#invitationItems").inner_text().strip():
            raise AssertionError("Switching schools retained the previous school's code")
        teacher_page.evaluate("school => localStorage.setItem('yuzan-active-school-id', school)", fixture["school"])
        evidence["identitySwitch"] = {"teacher-account-switch-cleared": True, "school-switch-cleared": True}

        # Copy is shared into the real student browser page through Ctrl+V.
        student_page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
        student_session = login_via_browser(student_page, fixture["logins"]["student_a"], r".*/student/today/?$")
        student_page.goto(f"{BASE}/student/profile/", wait_until="domcontentloaded")
        expect(student_page.locator("#bindTeacherForm")).to_be_visible(timeout=20_000)
        student_code = student_page.locator("#teacherCode")
        student_code.focus()
        student_code.press("Control+V")
        pasted_code = student_code.input_value()
        if pasted_code != real_server_code:
            raise AssertionError("Student browser paste did not carry the copied server invitation")
        expect(student_code).to_have_value(re.compile(r"^TC-[A-F0-9]{5}-[A-F0-9]{5}$"))
        student_page.locator("#bindTeacherBtn").click()
        expect(student_page.locator("#bindMessage")).to_contain_text("已加入教师班级", timeout=20_000)
        evidence["browserActions"].append("Student A logged in through the browser, pasted the copied code in /student/profile/, and submitted the bind form")

        membership_row = sql_scalar(
            f'''SELECT id || '|' || status FROM "Membership" WHERE "schoolId"={q(fixture['school'])}
                 AND "userId"={q(student_session['user']['id'])} AND role='STUDENT';'''
        )
        enrollment = sql_scalar(
            f'''SELECT id || '|' || status || '|' || role || '|' || "schoolId" || '|' || "classId"
                  FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])}
                   AND "userId"={q(student_session['user']['id'])} AND role='STUDENT';'''
        )
        invite_row = sql_scalar(
            f'''SELECT id || '|' || "usedCount"::text || '|' || "maxUses"::text || '|' || "expiresAt"::text
                  FROM "TeacherInvitation" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])}
                   AND "teacherUserId"={q(teacher_session['user']['id'])} AND "maxUses"=1
                 ORDER BY "createdAt" DESC LIMIT 1;'''
        )
        if not membership_row or not enrollment or not invite_row:
            raise AssertionError("PostgreSQL does not show the expected active student membership, enrollment and invitation")
        membership_parts = membership_row.split("|")
        enrollment_parts = enrollment.split("|")
        invite_parts = invite_row.split("|")
        if membership_parts[1] != "ACTIVE":
            raise AssertionError("PostgreSQL student Membership is not ACTIVE")
        if enrollment_parts[1:4] != ["ACTIVE", "STUDENT", fixture["school"]] or enrollment_parts[4] != fixture["class_main"]:
            raise AssertionError("The created ACTIVE STUDENT enrollment is not attached to the invitation school and class")
        if invite_parts[1:3] != ["1", "1"]:
            raise AssertionError("TeacherInvitation usedCount did not advance exactly once after binding")
        invitation_id = invite_parts[0]
        audit_count = sql_scalar(
            f'''SELECT count(*) FROM "AuditLog" WHERE "actorUserId"={q(student_session['user']['id'])}
                 AND "schoolId"={q(fixture['school'])} AND action='STUDENT_BOUND_TEACHER_INVITATION'
                 AND "resourceType"='TeacherInvitation' AND "resourceId"={q(invitation_id)}
                 AND "afterSummary"->>'classId'={q(fixture['class_main'])};'''
        )
        if audit_count != "1":
            raise AssertionError("PostgreSQL audit log does not contain exactly one student invitation bind record")
        audit_log_id = sql_scalar(
            f'''SELECT id FROM "AuditLog" WHERE "actorUserId"={q(student_session['user']['id'])}
                 AND "schoolId"={q(fixture['school'])} AND action='STUDENT_BOUND_TEACHER_INVITATION'
                 AND "resourceType"='TeacherInvitation' AND "resourceId"={q(invitation_id)}
                 AND "afterSummary"->>'classId'={q(fixture['class_main'])} ORDER BY "createdAt" DESC LIMIT 1;'''
        )
        if not audit_log_id:
            raise AssertionError("PostgreSQL bind audit log did not return its record ID")

        duplicate_bind = student_page.request.post(
            f"{BASE}/api/v1/student/teacher-invitations/bind",
            headers=headers(student_session),
            data={"code": pasted_code},
        )
        expect_status(duplicate_bind, 201, "repeat bind of the student's active class")
        duplicate_body = payload(duplicate_bind)
        if duplicate_body.get("alreadyBound") is not True:
            raise AssertionError("Repeated binding did not return alreadyBound=true")
        used_after_duplicate = sql_scalar(f'''SELECT "usedCount"::text FROM "TeacherInvitation" WHERE id={q(invitation_id)};''')
        enrollment_count = sql_scalar(
            f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])}
                 AND "userId"={q(student_session['user']['id'])} AND role='STUDENT' AND status='ACTIVE';'''
        )
        if used_after_duplicate != "1" or enrollment_count != "1":
            raise AssertionError("Duplicate binding added a second enrollment or consumed another invitation use")
        evidence["postgres"] = {
            "schoolId": fixture["school"],
            "classId": fixture["class_main"],
            "studentUserId": student_session["user"]["id"],
            "membershipId": membership_parts[0],
            "studentMembershipStatus": membership_parts[1],
            "enrollmentId": enrollment_parts[0],
            "enrollmentRole": enrollment_parts[2],
            "enrollmentStatus": enrollment_parts[1],
            "enrollmentSchoolId": enrollment_parts[3],
            "enrollmentClassId": enrollment_parts[4],
            "teacherInvitationId": invitation_id,
            "auditLogId": audit_log_id,
            "auditLogAction": "STUDENT_BOUND_TEACHER_INVITATION",
            "usedCountAfterFirstBind": invite_parts[1],
            "maxUses": invite_parts[2],
            "expiresAt": invite_parts[3],
            "usedCountAfterDuplicateBind": used_after_duplicate,
            "activeEnrollmentCountAfterDuplicate": enrollment_count,
            "bindAuditLogCount": audit_count,
        }
        evidence["apiStatuses"].append({"case": "student-bind", "status": 201})
        evidence["apiStatuses"].append({"case": "student-duplicate-bind", "status": duplicate_bind.status, "alreadyBound": True})

        # Seed only failure-state fixtures into the isolated T023 database and
        # verify the existing service rejects each with its real conflict code.
        negative_codes = add_inactive_invitation_fixtures(fixture)
        student_b_session = student_page.request.post(
            f"{BASE}/api/v1/auth/login",
            data={"identifier": fixture["logins"]["student_b"], "password": PASSWORD},
        )
        expect_status(student_b_session, 200, "Student B test login")
        student_b_auth = payload(student_b_session)
        for key, expected in (("expired", 409), ("revoked", 409), ("exhausted", 409)):
            response = student_page.request.post(
                f"{BASE}/api/v1/student/teacher-invitations/bind",
                headers=headers(student_b_auth),
                data={"code": negative_codes[key]},
            )
            expect_status(response, expected, f"student bind against {key} invitation")
            evidence["apiStatuses"].append({"case": f"student-bind-{key}", "status": response.status})
        # The bound student has no open assignment, delivery or published
        # course in the fixture, so Today must show the live empty state.
        open_assignments = sql_scalar(
            f'''SELECT count(*) FROM "AssignmentTarget" t JOIN "Assignment" a ON a.id=t."assignmentId"
                  WHERE t."schoolId"={q(fixture['school'])} AND t."classId"={q(fixture['class_main'])} AND a.status='OPEN';'''
        )
        open_deliveries = sql_scalar(
            f'''SELECT count(*) FROM "PracticeDelivery" WHERE "schoolId"={q(fixture['school'])} AND "classId"={q(fixture['class_main'])} AND status='OPEN';'''
        )
        student_page.goto(f"{BASE}/student/today/", wait_until="domcontentloaded")
        expect(student_page.locator("#todayApp h1")).to_contain_text("今天的学习", timeout=25_000)
        expect(student_page.locator(".today-primary")).to_contain_text("新的学习安排会在有真实任务后出现在这里。", timeout=20_000)
        expect(student_page.locator(".today-course-empty")).to_contain_text("当前没有可学课程", timeout=20_000)
        if student_page.locator(".today-cta").count() or open_assignments != "0" or open_deliveries != "0":
            raise AssertionError("Student Today exposed a task despite the test class having no open assignment, delivery or course")
        evidence["studentToday"] = {"state": student_page.locator("#todayApp").get_attribute("data-state"), "openAssignments": open_assignments, "openPracticeDeliveries": open_deliveries, "courseState": "empty"}
        evidence["browserActions"].append("Student A opened Today; PostgreSQL had no open assignment or delivery and the page showed the real empty state")

        # Re-authenticate Teacher C in the same browser and refresh the class
        # roster, then open the newly bound student's detail.
        teacher_page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
        teacher_session = login_via_browser(teacher_page, fixture["logins"]["teacher_c"], r".*/teacher/?$")
        teacher_page.locator(f'#classList a[href="{main_href}"]').click()
        teacher_page.wait_for_url(re.compile(rf".*/teacher/classes/{re.escape(fixture['class_main'])}\?schoolId=.*"), timeout=30_000)
        expect(teacher_page.locator("#rosterTable")).to_contain_text(fixture["names"]["student_a"], timeout=25_000)
        new_student_link = teacher_page.locator(f'.student-detail-link[href*="{enrollment_parts[0]}"]')
        expect(new_student_link).to_be_visible(timeout=10_000)
        new_student_link.click()
        teacher_page.wait_for_url(re.compile(rf".*/teacher/students/{re.escape(enrollment_parts[0])}\?.*"), timeout=30_000)
        expect(teacher_page.locator("body")).to_contain_text(fixture["names"]["student_a"], timeout=25_000)
        evidence["browserActions"].append("Teacher C re-logged in, refreshed the class roster, saw Student A and opened the student's detail")

        # Inspect all four server status values. Codes for inactive rows must
        # be masked, while exact server counts/dates remain visible.
        teacher_page.goto(f"{BASE}{main_href}", wait_until="domcontentloaded")
        expect(teacher_page.locator(".class-title h1")).to_contain_text("TEST_FIXTURE_ONLY T023 丙教师主班", timeout=25_000)
        teacher_page.get_by_role("button", name="查看邀请").click()
        expect(teacher_page.locator("#invitationItems .invitation-record")).to_have_count(4, timeout=20_000)
        status_counts = {
            status: teacher_page.locator(f'.invitation-state-tag[data-status="{status}"]').count()
            for status in ("ACTIVE", "EXPIRED", "REVOKED", "EXHAUSTED")
        }
        if status_counts != {"ACTIVE": 0, "EXPIRED": 1, "REVOKED": 1, "EXHAUSTED": 2}:
            raise AssertionError(f"Server-derived invitation status counts differ from PostgreSQL fixtures: {status_counts}")
        if teacher_page.locator(".invitation-record.is-usable").count() != 0:
            raise AssertionError("A non-ACTIVE server invitation was rendered as a usable code")
        if teacher_page.locator(".invitation-hidden-code").count() != 4:
            raise AssertionError("Expired, revoked and exhausted codes were not masked")
        expect(teacher_page.locator(f'.invitation-record[data-invitation-id="{invitation_id}"] .invitation-usage')).to_contain_text("1 / 1 次")
        expect(teacher_page.locator(".invitation-expiry").first).not_to_contain_text("服务器未返回")
        states_top_path = EVIDENCE_DIR / "class-invitation-inactive-states-top.png"
        teacher_page.screenshot(path=str(states_top_path))
        teacher_page.locator("#studentInvitationDialog").evaluate("element => { element.scrollTop = element.scrollHeight; }")
        states_bottom_path = EVIDENCE_DIR / "class-invitation-inactive-states-bottom.png"
        teacher_page.screenshot(path=str(states_bottom_path))
        evidence["statusRendering"] = {"counts": status_counts, "inactiveCodeMasked": True, "otherClassCodeHidden": True, "screenshots": [states_top_path.name, states_bottom_path.name]}

        # The coworker invitation panel must remain a separate business and
        # must not copy the old static page value when its API is unavailable.
        ai_page = teacher_context.new_page()
        ai_page.on("response", record_response)
        ai_page.goto(f"{BASE}/teacher/ai-tools/", wait_until="domcontentloaded")
        ai_path = f"**/api/v1/schools/{fixture['school']}/teacher-tools/invite-code"
        ai_page.route(ai_path, lambda route: route.abort("failed"))
        coworker_button = ai_page.locator('[data-action="copy-code"]')
        expect(coworker_button).to_be_enabled(timeout=20_000)
        coworker_button.click()
        expect(ai_page.locator("#inviteCodeStatus")).to_contain_text("请检查网络后重试", timeout=15_000)
        if ai_page.locator("#inviteCode").input_value() or "已复制" in ai_page.locator("#toast").inner_text():
            raise AssertionError("AI tools copied a stale/static coworker code or reported false success")
        evidence["coworkerInvitation"] = {"label": "teacher-tools coworker invitation", "classBindingCodeUsed": False, "apiFailureFallback": "no code shown and no success"}

        report_path = EVIDENCE_DIR / "browser-database-evidence.json"
        report_path.write_text(json.dumps({**evidence, "browserApiEvents": api_events}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        browser.close()
