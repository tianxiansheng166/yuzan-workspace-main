"""Real Chromium/API/PostgreSQL proof for the T021 student invitation journey."""

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import Page, expect, sync_playwright


BASE = os.environ["YZ_T021_BASE_URL"]
API = os.environ["YZ_T021_API_BASE_URL"]
DATABASE_URL = os.environ["YZ_T021_DATABASE_URL"]
DATABASE_NAME = os.environ["YZ_T021_DATABASE_NAME"]
DATABASE_USER = os.environ["YZ_T021_DATABASE_USER"]
DATABASE_PORT = int(os.environ["YZ_T021_POSTGRES_PORT"])
PSQL = os.environ["YZ_T021_PSQL"]
PG_LIBRARY = os.environ["YZ_T021_PG_LIBRARY"]
PASSWORD = "T021-Only-Test!2026"
EVIDENCE = Path(os.environ["YZ_T021_EVIDENCE_DIR"])
PROFILE_PATH = "/student/profile/"


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == DATABASE_PORT
    assert parsed.username == DATABASE_USER
    assert unquote(parsed.path.lstrip("/")) == DATABASE_NAME
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": unquote(parsed.password or ""),
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
        stderr = result.stderr.replace(env["PGPASSWORD"], "<redacted>")
        raise RuntimeError(stderr)
    return result.stdout.strip() if capture else ""


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def payload(response):
    body = response.json()
    return body.get("data", body)


def verify_database_identity() -> str:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();", capture=True)
    assert identity.startswith(f"{DATABASE_NAME}|{DATABASE_USER}|PostgreSQL 17."), identity.split("|", 2)[:2]
    return identity.split("|", 2)[2].split(",", 1)[0]


def register_user(request, label: str, role: str) -> dict:
    identifier = f"t021-{label.lower()}-{uuid.uuid4().hex}@test.invalid"
    response = request.post(
        f"{API}/api/v1/auth/register",
        data={"identifier": identifier, "password": PASSWORD, "role": role},
    )
    assert response.ok, f"registration failed for fictional {label}: HTTP {response.status}"
    session = payload(response)
    assert session.get("accessToken") and session.get("user", {}).get("id")
    session["identifier"] = identifier
    return session


def bearer(session: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['accessToken']}"}


def select_school(request, session: dict, school_id: str) -> dict:
    response = request.post(
        f"{API}/api/v1/auth/select-school",
        headers=bearer(session),
        data={"schoolId": school_id},
    )
    assert response.ok, f"school selection failed: HTTP {response.status}"
    selected = payload(response)
    assert selected.get("activeSchoolId") == school_id
    return selected


def create_invitation(request, teacher: dict, school_id: str, class_id: str, *, max_uses: int = 20) -> dict:
    response = request.post(
        f"{API}/api/v1/schools/{school_id}/teacher-invitations",
        headers=bearer(teacher),
        data={"classId": class_id, "maxUses": max_uses, "expiresInDays": 30},
    )
    assert response.ok, f"authorized teacher invitation creation failed: HTTP {response.status}"
    result = payload(response)
    assert result.get("code") and result.get("class", {}).get("id") == class_id
    return result


def add_school_and_classes(school_a: str, teacher_id: str) -> dict[str, str]:
    school_b = str(uuid.uuid4())
    term_a = str(uuid.uuid4())
    term_b = str(uuid.uuid4())
    class_a1 = str(uuid.uuid4())
    class_b1 = str(uuid.uuid4())
    class_b2 = str(uuid.uuid4())
    class_b3 = str(uuid.uuid4())
    school_code = f"T021-{uuid.uuid4().hex[:20]}"
    term_suffix = uuid.uuid4().hex[:8]
    now = "NOW()"
    sql(
        f"""UPDATE "School" SET "name"='TEST_FIXTURE_ONLY T021 学校甲', "updatedAt"={now} WHERE "id"={q(school_a)};
            INSERT INTO "Term" ("id", "schoolId", "name", "startsAt", "endsAt", "isActive", "createdAt")
              VALUES ({q(term_a)}, {q(school_a)}, 'TEST_FIXTURE_ONLY T021 学期甲 {term_suffix}', {now} - INTERVAL '1 day', {now} + INTERVAL '1 year', true, {now});
            INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt")
              VALUES ({q(class_a1)}, {q(school_a)}, {q(term_a)}, 'TEST_FIXTURE_ONLY T021 甲班', '七年级', {now}, {now});
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
              VALUES ({q(str(uuid.uuid4()))}, {q(school_a)}, {q(class_a1)}, {q(teacher_id)}, 'TEACHER', 'ACTIVE', {now});
            INSERT INTO "School" ("id", "code", "name", "createdAt", "updatedAt")
              VALUES ({q(school_b)}, {q(school_code)}, 'TEST_FIXTURE_ONLY T021 学校乙', {now}, {now});
            INSERT INTO "Term" ("id", "schoolId", "name", "startsAt", "endsAt", "isActive", "createdAt")
              VALUES ({q(term_b)}, {q(school_b)}, 'TEST_FIXTURE_ONLY T021 学期乙', {now} - INTERVAL '1 day', {now} + INTERVAL '1 year', true, {now});
            INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt") VALUES
              ({q(class_b1)}, {q(school_b)}, {q(term_b)}, 'TEST_FIXTURE_ONLY T021 乙班', '八年级', {now}, {now}),
              ({q(class_b2)}, {q(school_b)}, {q(term_b)}, 'TEST_FIXTURE_ONLY T021 丙班', '八年级', {now}, {now}),
              ({q(class_b3)}, {q(school_b)}, {q(term_b)}, 'TEST_FIXTURE_ONLY T021 丁班', '九年级', {now}, {now});
            INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ({q(str(uuid.uuid4()))}, {q(school_b)}, {q(teacher_id)}, 'TEACHER', 'ACTIVE', {now});
            INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt") VALUES
              ({q(str(uuid.uuid4()))}, {q(school_b)}, {q(class_b1)}, {q(teacher_id)}, 'TEACHER', 'ACTIVE', {now}),
              ({q(str(uuid.uuid4()))}, {q(school_b)}, {q(class_b2)}, {q(teacher_id)}, 'TEACHER', 'ACTIVE', {now}),
              ({q(str(uuid.uuid4()))}, {q(school_b)}, {q(class_b3)}, {q(teacher_id)}, 'TEACHER', 'ACTIVE', {now});"""
    )
    return {
        "schoolA": school_a,
        "schoolB": school_b,
        "classA1": class_a1,
        "classB1": class_b1,
        "classB2": class_b2,
        "classB3": class_b3,
    }


def set_browser_session(page: Page, session: dict) -> None:
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId || '');
        }""",
        session,
    )
    page.goto(f"{BASE}{PROFILE_PATH}")


def invitation_usage(invitation_id: str) -> int:
    return int(sql(f'SELECT "usedCount" FROM "TeacherInvitation" WHERE "id"={q(invitation_id)};', capture=True))


def test_student_profile_real_invitation_binding_and_identity_isolation():
    postgres_version = verify_database_identity()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshot_dir = EVIDENCE / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    browser_evidence: dict[str, object] = {"postgres": postgres_version}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("YZ_T021_CHROMIUM", "/usr/bin/google-chrome"))
        context = browser.new_context(viewport={"width": 1280, "height": 1000}, reduced_motion="reduce")
        page = context.new_page()
        request = page.request

        teacher = register_user(request, "TeacherA", "TEACHER")
        student_a = register_user(request, "StudentA", "STUDENT")
        student_b = register_user(request, "StudentB", "STUDENT")
        school_a = teacher["activeSchoolId"]
        assert student_a["activeSchoolId"] == school_a == student_b["activeSchoolId"]
        fixture = add_school_and_classes(school_a, teacher["user"]["id"])
        fixture.update({"teacherId": teacher["user"]["id"], "studentAId": student_a["user"]["id"], "studentBId": student_b["user"]["id"]})
        sql(
            f"""UPDATE "User" SET "displayName"='TEST_FIXTURE_ONLY T021 教师A', "updatedAt"=NOW() WHERE "id"={q(fixture['teacherId'])};
                UPDATE "User" SET "displayName"='TEST_FIXTURE_ONLY T021 学生A', "updatedAt"=NOW() WHERE "id"={q(fixture['studentAId'])};
                UPDATE "User" SET "displayName"='TEST_FIXTURE_ONLY T021 学生B', "updatedAt"=NOW() WHERE "id"={q(fixture['studentBId'])};"""
        )

        invite_a1 = create_invitation(request, teacher, fixture["schoolA"], fixture["classA1"])
        teacher_b = select_school(request, teacher, fixture["schoolB"])
        teacher_b["user"] = teacher.get("user")
        invite_b1 = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB1"])
        invite_b2 = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB2"])
        invite_b3 = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB3"])

        # Create real invitations through the teacher API, then make them unusable
        # using only this isolated PostgreSQL test database.
        invite_expired = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB3"])
        invite_revoked = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB3"])
        invite_exhausted = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB3"], max_uses=1)
        invite_teacher_inactive = create_invitation(request, teacher_b, fixture["schoolB"], fixture["classB3"])
        sql(
            f"""UPDATE "TeacherInvitation" SET "expiresAt"=timezone('UTC', NOW() - INTERVAL '1 minute') WHERE "id"={q(invite_expired['id'])};
                UPDATE "TeacherInvitation" SET "revokedAt"=NOW() WHERE "id"={q(invite_revoked['id'])};
                UPDATE "TeacherInvitation" SET "usedCount"="maxUses" WHERE "id"={q(invite_exhausted['id'])};"""
        )

        # API status negatives are server responses, not browser mocks.
        anonymous = playwright.request.new_context()
        anonymous_response = anonymous.post(
            f"{API}/api/v1/student/teacher-invitations/bind", data={"code": "TC-UNAUTHENTICATED"}
        )
        assert anonymous_response.status == 401
        anonymous.dispose()
        assert request.post(
            f"{API}/api/v1/student/teacher-invitations/bind",
            headers=bearer(teacher_b),
            data={"code": invite_b1["code"]},
        ).status == 403
        headers_b = bearer(student_b)
        assert request.post(
            f"{API}/api/v1/student/teacher-invitations/bind", headers=headers_b, data={"code": "TC-DOES-NOT-EXIST"}
        ).status == 404
        assert sql(
            f'''SELECT count(*) FROM "Enrollment" WHERE "userId"={q(fixture["studentBId"])} AND "role"='STUDENT' AND "status"='ACTIVE';''',
            capture=True,
        ) == "0"
        rejected_invites = []
        for kind, invitation in (("expired", invite_expired), ("revoked", invite_revoked), ("exhausted", invite_exhausted)):
            response = request.post(
                f"{API}/api/v1/student/teacher-invitations/bind", headers=headers_b, data={"code": invitation["code"]}
            )
            state = sql(
                f'''SELECT ("expiresAt" <= NOW())::text || '|' || ("revokedAt" IS NOT NULL)::text || '|' || ("usedCount" >= "maxUses")::text FROM "TeacherInvitation" WHERE "id"={q(invitation["id"])};''',
                capture=True,
            )
            assert response.status == 409, f"expected 409 for invitation state {state}; got {response.status}"
            used_after_rejection = invitation_usage(invitation["id"])
            assert used_after_rejection == (1 if kind == "exhausted" else 0)
            rejected_invites.append({"kind": kind, "invitationId": invitation["id"], "status": response.status, "usedCountAfterRejection": used_after_rejection})
        sql(f'UPDATE "Enrollment" SET "status"=\'SUSPENDED\' WHERE "userId"={q(fixture["teacherId"])} AND "classId"={q(fixture["classB3"])} AND "role"=\'TEACHER\';')
        inactive_teacher_response = request.post(
            f"{API}/api/v1/student/teacher-invitations/bind",
            headers=headers_b,
            data={"code": invite_teacher_inactive["code"]},
        )
        assert inactive_teacher_response.status == 409
        assert invitation_usage(invite_teacher_inactive["id"]) == 0
        sql(f'UPDATE "Enrollment" SET "status"=\'ACTIVE\' WHERE "userId"={q(fixture["teacherId"])} AND "classId"={q(fixture["classB3"])} AND "role"=\'TEACHER\';')
        assert sql(
            f'''SELECT count(*) FROM "Enrollment" WHERE "userId"={q(fixture["studentBId"])} AND "role"='STUDENT' AND "status"='ACTIVE';''',
            capture=True,
        ) == "0"

        assert request.get(
            f"{API}/api/v1/schools/{fixture['schoolB']}/student/profile", headers=bearer(student_b)
        ).status == 403
        assert request.get(
            f"{API}/api/v1/schools/{fixture['schoolB']}/classes", headers=bearer(student_b)
        ).status == 403
        assert request.post(
            f"{API}/api/v1/auth/select-school", headers=bearer(student_b), data={"schoolId": fixture["schoolB"]}
        ).status == 403

        bind_requests: list[str] = []
        browser_errors: list[str] = []
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        page.on("request", lambda req: bind_requests.append(req.url) if req.method == "POST" and req.url.endswith("/student/teacher-invitations/bind") else None)
        set_browser_session(page, student_a)
        if page.locator("#profileName").inner_text() != "TEST_FIXTURE_ONLY T021 学生A":
            raise AssertionError(
                "initial profile read failed: "
                f"name={page.locator('#profileName').inner_text()!r}; "
                f"meta={page.locator('#profileMeta').inner_text()!r}; "
                f"message={page.locator('#bindMessage').inner_text()!r}; "
                f"description={page.locator('#connectionDescription').inner_text()!r}; "
                f"browserErrors={browser_errors!r}"
            )
        expect(page.locator("#statCompleted")).to_have_text("—")
        expect(page.locator("#statsNote")).to_contain_text("暂无统计")
        expect(page.get_by_label("教师邀请码")).to_be_visible()
        assert page.locator("#bindMessage").get_attribute("role") == "status"

        page.get_by_label("教师邀请码").fill("TC-DOES-NOT-EXIST")
        page.get_by_label("教师邀请码").press("Enter")
        expect(page.locator("#bindMessage")).to_contain_text("教师邀请码无效")
        expect(page.get_by_label("教师邀请码")).to_have_value("TC-DOES-NOT-EXIST")
        assert page.locator("#classList .class-tag").count() == 0

        # First class: the browser posts the real invitation, the service writes
        # membership/enrollment/audit rows, and the retry is idempotent.
        bind_count_before_double_click = len(bind_requests)
        page.get_by_label("教师邀请码").fill(invite_a1["code"])
        page.get_by_role("button", name="绑定教师班级").dblclick()
        expect(page.locator("#bindMessage")).to_contain_text("已加入该班级")
        assert len(bind_requests) - bind_count_before_double_click == 1
        assert invitation_usage(invite_a1["id"]) == 1
        repeated = request.post(
            f"{API}/api/v1/student/teacher-invitations/bind",
            headers=bearer(student_a),
            data={"code": invite_a1["code"]},
        )
        assert repeated.ok and payload(repeated).get("alreadyBound") is True
        assert invitation_usage(invite_a1["id"]) == 1

        # The browser sends a valid cross-school bind. Its school-selection
        # response is interrupted once after the real transaction commits.
        switch_failures = {"remaining": 1}

        def fail_first_school_switch(route):
            if route.request.method == "POST" and route.request.url.endswith("/auth/select-school") and switch_failures["remaining"]:
                switch_failures["remaining"] -= 1
                route.fulfill(status=503, content_type="application/json", body=json.dumps({"statusCode": 503, "message": "temporary T021 switch interruption"}))
            else:
                route.continue_()

        page.route("**/api/v1/auth/select-school", fail_first_school_switch)
        page.get_by_label("教师邀请码").fill(invite_b1["code"])
        page.get_by_label("教师邀请码").press("Enter")
        expect(page.locator("#connectionStatus")).to_have_text("绑定状态待核实")
        expect(page.locator("#bindMessage")).to_contain_text("绑定状态待核实")
        assert page.locator("#teacherCode").get_attribute("readonly") is not None
        assert page.locator(f'#classList [data-class-id="{fixture["classA1"]}"]').count() == 0
        assert invitation_usage(invite_b1["id"]) == 1
        assert sql(
            f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(fixture["schoolB"])} AND "classId"={q(fixture["classB1"])} AND "userId"={q(fixture["studentAId"])} AND "role"='STUDENT' AND "status"='ACTIVE';''',
            capture=True,
        ) == "1"
        assert sql(
            f'''SELECT count(*) FROM "Membership" WHERE "schoolId"={q(fixture["schoolB"])} AND "userId"={q(fixture["studentAId"])} AND "role"='STUDENT' AND "status"='ACTIVE';''',
            capture=True,
        ) == "1"
        page.unroute("**/api/v1/auth/select-school")
        page.locator("#bindTeacherBtn").click()
        expect(page.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生A")
        expect(page.locator("#profileMeta")).to_contain_text("TEST_FIXTURE_ONLY T021 学校乙")
        expect(page.locator("#bindMessage")).to_contain_text("本人学校和班级学籍已重新核实")
        assert page.locator(f'#classList [data-class-id="{fixture["classB1"]}"]').count() == 1
        assert invitation_usage(invite_b1["id"]) == 1

        # The same student joins a second legal class in the selected school.
        # The real bind commits, but the browser loses the response. A safe
        # retry must resolve as alreadyBound without consuming another use.
        bind_response_lost = {"remaining": 1}

        def drop_first_bind_response(route):
            if route.request.method == "POST" and route.request.url.endswith("/student/teacher-invitations/bind") and bind_response_lost["remaining"]:
                bind_response_lost["remaining"] -= 1
                route.fetch()
                route.abort()
            else:
                route.continue_()

        page.route("**/api/v1/student/teacher-invitations/bind", drop_first_bind_response)
        page.get_by_label("教师邀请码").fill(invite_b2["code"])
        page.get_by_label("教师邀请码").press("Enter")
        expect(page.locator("#connectionStatus")).to_have_text("绑定状态待核实")
        expect(page.locator("#bindMessage")).to_contain_text("安全重试")
        assert invitation_usage(invite_b2["id"]) == 1
        page.locator("#bindTeacherBtn").click()
        expect(page.locator("#bindMessage")).to_contain_text("本人学校和班级学籍已重新核实")
        page.unroute("**/api/v1/student/teacher-invitations/bind")
        assert page.locator(f'#classList [data-class-id="{fixture["classB1"]}"]').count() == 1
        assert page.locator(f'#classList [data-class-id="{fixture["classB2"]}"]').count() == 1
        expect(page.locator("#profileMeta")).to_contain_text("2 个有效班级")
        assert invitation_usage(invite_b1["id"]) == invitation_usage(invite_b2["id"]) == 1

        # A fresh profile page can switch between both real school memberships.
        expect(page.locator("#schoolPicker")).to_be_visible()
        page.locator("#schoolSelect").select_option(fixture["schoolA"])
        expect(page.locator("#profileMeta")).to_contain_text("TEST_FIXTURE_ONLY T021 学校甲")
        assert page.locator(f'#classList [data-class-id="{fixture["classA1"]}"]').count() == 1
        assert page.locator(f'#classList [data-class-id="{fixture["classB1"]}"]').count() == 0
        page.locator("#schoolSelect").select_option(fixture["schoolB"])
        expect(page.locator("#profileMeta")).to_contain_text("TEST_FIXTURE_ONLY T021 学校乙")
        expect(page.locator("#profileMeta")).to_contain_text("2 个有效班级")

        # Missing statistics stay missing; this response is fetched from the
        # real API and only the two optional fields are omitted at the browser
        # boundary to exercise the server-contract-missing state.
        def omit_optional_stats(route):
            live = route.fetch()
            body = live.json()
            target = body.get("data", body).get("profile")
            if isinstance(target, dict):
                target.pop("completedActivities", None)
                target.pop("totalActivities", None)
            route.fulfill(status=live.status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

        page.route("**/api/v1/schools/*/student/profile", omit_optional_stats)
        page.reload()
        expect(page.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生A")
        expect(page.locator("#statCompleted")).to_have_text("—")
        expect(page.locator("#statTotal")).to_have_text("—")
        expect(page.locator("#statsNote")).to_contain_text("服务器没有提供")
        page.unroute("**/api/v1/schools/*/student/profile")
        page.reload()
        expect(page.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生A")
        expect(page.locator("#statCompleted")).to_have_text("0")
        expect(page.locator("#statTotal")).to_have_text("0")
        expect(page.locator("#statsNote")).to_contain_text("尚无学习活动进度记录；服务器明确返回 0")
        assert sql(
            f'''SELECT count(*) FROM "ActivityProgress" WHERE "enrollmentId" IN (SELECT "id" FROM "Enrollment" WHERE "userId"={q(fixture["studentAId"])} AND "schoolId"={q(fixture["schoolB"])} AND "status"='ACTIVE');''',
            capture=True,
        ) == "0"

        # Capture the requested viewport breakpoints and reduced-motion state.
        browser_evidence["viewports"] = []
        for width, height in ((390, 844), (768, 1024), (1280, 960), (1440, 1000)):
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(60)
            dimensions = page.evaluate(
                """() => {
                  const page = document.querySelector('.profile-page');
                  const stats = document.querySelector('.stats-panel');
                  const classes = document.querySelector('.journey-panel');
                  const end = Math.max(stats.getBoundingClientRect().bottom, classes.getBoundingClientRect().bottom) + window.scrollY;
                  return {
                    viewport: document.documentElement.clientWidth,
                    document: document.documentElement.scrollWidth,
                    body: document.body.scrollWidth,
                    documentHeight: document.documentElement.scrollHeight,
                    contentEnd: Math.ceil(end),
                    profileHeight: Math.ceil(page.getBoundingClientRect().height)
                  };
                }"""
            )
            assert max(dimensions["document"], dimensions["body"]) <= dimensions["viewport"] + 1, dimensions
            assert dimensions["documentHeight"] >= dimensions["contentEnd"], dimensions
            screenshot = screenshot_dir / f"profile-{width}.png"
            page.screenshot(path=str(screenshot), full_page=True)
            browser_evidence["viewports"].append({"width": width, "height": height, "screenshot": screenshot.name, **dimensions})
        transition = page.locator(".pathway-progress").evaluate("element => getComputedStyle(element).transitionDuration")
        assert transition in {"1e-05s", "0.00001s", "0.01ms"}, transition
        browser_evidence["reducedMotionTransition"] = transition

        # Verify that the real Today page is reachable through the profile CTA.
        today_responses: list[int] = []
        page.on(
            "response",
            lambda response: today_responses.append(response.status)
            if "/student/today" in response.url and response.request.method == "GET"
            else None,
        )
        page.get_by_role("link", name="进入今日学习").click()
        expect(page).to_have_url(f"{BASE}/student/today/")
        assert any(status == 200 for status in today_responses), today_responses

        # Re-login through the real API, explicitly select school B, and confirm
        # both enrollments survive a new server session.
        active_token = page.evaluate("() => localStorage.getItem('yuzan-access-token')")
        logout_response = request.post(f"{API}/api/v1/auth/logout", headers={"Authorization": f"Bearer {active_token}"})
        assert logout_response.status in (200, 204)
        login_response = request.post(f"{API}/api/v1/auth/login", data={"identifier": student_a["identifier"], "password": PASSWORD})
        assert login_response.ok
        relogged = payload(login_response)
        relogged["identifier"] = student_a["identifier"]
        relogged_b = select_school(request, relogged, fixture["schoolB"])
        relogged_b["identifier"] = student_a["identifier"]
        set_browser_session(page, relogged_b)
        expect(page.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生A")
        expect(page.locator("#profileMeta")).to_contain_text("2 个有效班级")
        assert page.locator(f'#classList [data-class-id="{fixture["classB1"]}"]').count() == 1
        assert page.locator(f'#classList [data-class-id="{fixture["classB2"]}"]').count() == 1

        # Student B's login must replace A's visible profile immediately and
        # the API must deny access to A's school and classes.
        login_b_response = request.post(
            f"{API}/api/v1/auth/login", data={"identifier": student_b["identifier"], "password": PASSWORD}
        )
        assert login_b_response.ok
        logged_b = payload(login_b_response)
        logged_b["identifier"] = student_b["identifier"]
        b_tab = context.new_page()
        b_tab.goto(f"{BASE}/login/")
        b_tab.evaluate(
            """session => {
              localStorage.setItem('yuzan-access-token', session.accessToken);
              localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
              localStorage.setItem('yuzan-active-school-id', session.activeSchoolId || '');
            }""",
            logged_b,
        )
        b_tab.goto(f"{BASE}{PROFILE_PATH}")
        expect(b_tab.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生B")
        expect(page.locator("#profileName")).to_have_text("TEST_FIXTURE_ONLY T021 学生B")
        expect(page.locator(".sn-user strong")).to_have_text("TEST_FIXTURE_ONLY T021 学生B")
        assert "TEST_FIXTURE_ONLY T021 学生A" not in page.locator(".student-topbar").inner_text()
        expect(page.locator("#statCompleted")).to_have_text("—")
        expect(page.locator("#statTotal")).to_have_text("—")
        expect(page.locator("#classList")).to_contain_text("没有本人有效班级学籍")
        assert page.locator(f'#classList [data-class-id="{fixture["classA1"]}"]').count() == 0
        assert page.locator(f'#classList [data-class-id="{fixture["classB1"]}"]').count() == 0
        assert page.locator(f'#classList [data-class-id="{fixture["classB2"]}"]').count() == 0
        assert request.get(
            f"{API}/api/v1/schools/{fixture['schoolB']}/student/profile", headers=bearer(logged_b)
        ).status == 403

        # Verify persisted memberships/enrollments/use counters and audit rows.
        membership_rows = sql_rows(
            f'''SELECT "schoolId", "status" FROM "Membership" WHERE "userId"={q(fixture["studentAId"])} AND "role"='STUDENT' ORDER BY "schoolId";'''
        )
        enrollment_rows = sql_rows(
            f'''SELECT "schoolId", "classId", "status" FROM "Enrollment" WHERE "userId"={q(fixture["studentAId"])} AND "role"='STUDENT' ORDER BY "schoolId", "classId";'''
        )
        audit_rows = sql_rows(
            f'''SELECT "resourceId", "afterSummary"->>'classId', "afterSummary"->>'teacherUserId' FROM "AuditLog" WHERE "actorUserId"={q(fixture["studentAId"])} AND "action"='STUDENT_BOUND_TEACHER_INVITATION' ORDER BY "createdAt";'''
        )
        assert len(membership_rows) == 2
        assert {row[0] for row in enrollment_rows} == {fixture["schoolA"], fixture["schoolB"]}
        assert {row[1] for row in enrollment_rows} == {fixture["classA1"], fixture["classB1"], fixture["classB2"]}
        assert len(audit_rows) == 3
        assert invitation_usage(invite_a1["id"]) == invitation_usage(invite_b1["id"]) == invitation_usage(invite_b2["id"]) == 1

        browser_evidence.update(
            {
                "teacherId": fixture["teacherId"],
                "studentAId": fixture["studentAId"],
                "studentBId": fixture["studentBId"],
                "schoolA": fixture["schoolA"],
                "schoolB": fixture["schoolB"],
                "classIds": [fixture["classA1"], fixture["classB1"], fixture["classB2"]],
                "membershipRows": membership_rows,
                "enrollmentRows": enrollment_rows,
                "auditRows": audit_rows,
                "teacherInvitationUsage": {
                    invite_a1["id"]: invitation_usage(invite_a1["id"]),
                    invite_b1["id"]: invitation_usage(invite_b1["id"]),
                    invite_b2["id"]: invitation_usage(invite_b2["id"]),
                },
                "bindPostCount": len(bind_requests),
                "apiStatusNegatives": {"401": True, "403": True, "404": True, "409": True},
                "rejectedInviteCases": rejected_invites,
                "inactiveTeacherInvitation": {"status": inactive_teacher_response.status, "usedCount": invitation_usage(invite_teacher_inactive["id"])},
            }
        )
        (EVIDENCE / "e2e-summary.json").write_text(json.dumps(browser_evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        b_tab.close()
        context.close()
        browser.close()
