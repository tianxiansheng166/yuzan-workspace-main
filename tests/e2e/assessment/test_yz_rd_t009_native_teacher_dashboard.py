"""Teacher dashboard proof against an isolated native PostgreSQL/API/browser runtime.

All added people and classes are fictional TEST_FIXTURE_ONLY records. Browser
positive paths use real login and the real API; the database is used only to
prepare isolated identities and records for those API requests.
"""

import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse

import pytest
from playwright.sync_api import expect, sync_playwright


BASE = os.environ.get("YZ_T009_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T009_DATABASE_URL", "")
SCHOOL_A = "11111111-1111-4111-8111-111111111111"
TEACHER_A_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
CLASS_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
ASSIGNMENT_A = "f8888888-8888-4888-8888-888888888888"
SUBMISSION_A = "fa222222-2222-4222-8222-222222222222"
PASSWORD = "YuzanTest!2026"
pytestmark = pytest.mark.skipif(not BASE, reason="requires the isolated YZ-RD-T009 runtime")


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"]
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t009_native"
    assert parsed.password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": parsed.password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    args = ["psql", "-X", "-v", "ON_ERROR_STOP=1"]
    if capture:
        args.extend(["-A", "-t"])
    result = subprocess.run(args, input=statement, text=True, capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def q(value):
    return str(value).replace("'", "''")


def install_fixture_identities():
    suffix = uuid.uuid4().hex[:10]
    teacher_b = str(uuid.uuid4())
    teacher_c = str(uuid.uuid4())
    teacher_empty = str(uuid.uuid4())
    student_b = str(uuid.uuid4())
    student_c = str(uuid.uuid4())
    class_b = str(uuid.uuid4())
    class_c = str(uuid.uuid4())
    term_b = str(uuid.uuid4())
    school_b = str(uuid.uuid4())
    now = "NOW()"
    sql(f'''UPDATE "School" SET name='TEST_FIXTURE_ONLY 学校甲', "updatedAt"={now} WHERE id='{SCHOOL_A}';
      UPDATE "User" SET "displayName"='TEST_FIXTURE_ONLY 教师甲', "updatedAt"={now} WHERE id='{TEACHER_A_ID}';
      UPDATE "User" SET "displayName"='TEST_FIXTURE_ONLY 学生甲', "updatedAt"={now} WHERE id='{STUDENT_A_ID}';
      UPDATE "Class" SET name='TEST_FIXTURE_ONLY 班级甲', grade='七年级' WHERE id='{CLASS_A}';
      UPDATE "CourseVersion" SET title='TEST_FIXTURE_ONLY 课程甲' WHERE id='f4444444-4444-4444-8444-444444444444';
      UPDATE "Assignment" SET title='TEST_FIXTURE_ONLY 任务甲' WHERE id='{ASSIGNMENT_A}';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
        SELECT '{teacher_b}','teacher.t006.b.{suffix}','TEST_FIXTURE_ONLY 教师乙',"passwordHash",'ACTIVE',{now},{now} FROM "User" WHERE id='{TEACHER_A_ID}'
        ON CONFLICT ("loginIdentifier") DO NOTHING;
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
        SELECT '{student_b}','student.t006.b.{suffix}','TEST_FIXTURE_ONLY 学生乙',"passwordHash",'ACTIVE',{now},{now} FROM "User" WHERE id='{STUDENT_A_ID}'
        ON CONFLICT ("loginIdentifier") DO NOTHING;
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
        SELECT '{teacher_empty}','teacher.t006.empty.{suffix}','TEST_FIXTURE_ONLY 无班级教师',"passwordHash",'ACTIVE',{now},{now} FROM "User" WHERE id='{TEACHER_A_ID}';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
        ('{uuid.uuid4()}','{SCHOOL_A}','{teacher_b}','TEACHER','ACTIVE',{now}),
        ('{uuid.uuid4()}','{SCHOOL_A}','{student_b}','STUDENT','ACTIVE',{now}),
        ('{uuid.uuid4()}','{SCHOOL_A}','{teacher_empty}','TEACHER','ACTIVE',{now});
      INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
        VALUES ('{term_b}','{SCHOOL_A}','TEST_FIXTURE_ONLY 学期乙 {suffix}','2026-01-01','2027-01-01',true,{now});
      INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
        VALUES ('{class_b}','{SCHOOL_A}','{term_b}','TEST_FIXTURE_ONLY 班级乙','五年级',{now},{now});
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
        ('{uuid.uuid4()}','{SCHOOL_A}','{class_b}','{teacher_b}','TEACHER','ACTIVE',{now}),
        ('{uuid.uuid4()}','{SCHOOL_A}','{class_b}','{student_b}','STUDENT','ACTIVE',{now});
      INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
        VALUES ('{school_b}','YZ-T006-{suffix}','TEST_FIXTURE_ONLY 学校丙','TEST',{now},{now});
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
        SELECT '{teacher_c}','teacher.t006.c.{suffix}','TEST_FIXTURE_ONLY 教师丙',"passwordHash",'ACTIVE',{now},{now} FROM "User" WHERE id='{TEACHER_A_ID}';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
        SELECT '{student_c}','student.t006.c.{suffix}','TEST_FIXTURE_ONLY 学生丙',"passwordHash",'ACTIVE',{now},{now} FROM "User" WHERE id='{STUDENT_A_ID}';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
        ('{uuid.uuid4()}','{school_b}','{teacher_c}','TEACHER','ACTIVE',{now}),
        ('{uuid.uuid4()}','{school_b}','{student_c}','STUDENT','ACTIVE',{now});
      INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
        VALUES ('{uuid.uuid4()}','{school_b}','TEST_FIXTURE_ONLY 学期丙 {suffix}','2026-01-01','2027-01-01',true,{now});
      INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
        VALUES ('{class_c}','{school_b}',(SELECT id FROM "Term" WHERE "schoolId"='{school_b}'),'TEST_FIXTURE_ONLY 班级丙','六年级',{now},{now});
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
        ('{uuid.uuid4()}','{school_b}','{class_c}','{teacher_c}','TEACHER','ACTIVE',{now}),
        ('{uuid.uuid4()}','{school_b}','{class_c}','{student_c}','STUDENT','ACTIVE',{now});''')
    return {
        "teacher_b": f"teacher.t006.b.{suffix}",
        "teacher_c": f"teacher.t006.c.{suffix}",
        "teacher_empty": f"teacher.t006.empty.{suffix}",
        "school_b": school_b,
        "class_b": class_b,
        "class_c": class_c,
        "student_b": student_b,
        "student_c": student_c,
    }


def body(response):
    value = response.json()
    return value.get("data", value)


def api_login(request, identifier):
    response = request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, f"{response.status}: {response.text()}"
    return body(response)


def api_get(request, school_id, path, token):
    return request.get(
        f"{BASE}/api/v1/schools/{school_id}/{path}",
        headers={"Authorization": f"Bearer {token}"},
    )


def workflow(dashboard, item_id):
    return next(item for item in dashboard["workflow"] if item["id"] == item_id)


def sql_scalar(statement):
    return int(sql(statement, capture=True))


def test_dashboard_api_is_personalized_and_scoped():
    fixture = install_fixture_identities()
    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        try:
            unauthenticated = request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_A}/teacher/dashboard"
            )
            assert unauthenticated.status == 401, unauthenticated.text()
            teacher_a = api_login(request, "teacher.test")
            teacher_b = api_login(request, fixture["teacher_b"])
            teacher_c = api_login(request, fixture["teacher_c"])
            teacher_empty = api_login(request, fixture["teacher_empty"])
            student_a = api_login(request, "student.test")

            dashboard_a_response = api_get(request, SCHOOL_A, "teacher/dashboard", teacher_a["accessToken"])
            assert dashboard_a_response.status == 200, dashboard_a_response.text()
            dashboard_a = body(dashboard_a_response)
            expected_course_count = sql_scalar(
                f'''SELECT count(*) FROM "CourseVersion" cv JOIN "Course" c ON c."id"=cv."courseId"
                    WHERE cv."schoolId"='{SCHOOL_A}' AND cv."status" IN ('DRAFT','CHANGES_REQUESTED')
                    AND c."authorUserId"='{TEACHER_A_ID}';'''
            )
            expected_task_count = sql_scalar(
                f'''SELECT count(*) FROM "Assignment" a WHERE a."schoolId"='{SCHOOL_A}' AND a."status"='OPEN'
                    AND a."deletedAt" IS NULL AND EXISTS (SELECT 1 FROM "AssignmentTarget" t
                    WHERE t."assignmentId"=a."id" AND (t."classId"='{CLASS_A}' OR t."enrollmentId"='f1111111-1111-4111-8111-111111111111'));'''
            )
            expected_review_count = sql_scalar(
                f'''SELECT count(*) FROM "Submission" s JOIN "Enrollment" e ON e."id"=s."enrollmentId"
                    WHERE s."schoolId"='{SCHOOL_A}' AND s."deletedAt" IS NULL AND s."status"='NEEDS_REVIEW'
                    AND e."schoolId"='{SCHOOL_A}' AND e."classId"='{CLASS_A}' AND e."role"='STUDENT' AND e."status"='ACTIVE';'''
            )
            assert dashboard_a["greeting"]["name"] == "TEST_FIXTURE_ONLY 教师甲"
            assert dashboard_a["greeting"]["schoolName"] == "TEST_FIXTURE_ONLY 学校甲"
            assert workflow(dashboard_a, "course")["count"] == expected_course_count
            assert workflow(dashboard_a, "task")["count"] == expected_task_count
            assert workflow(dashboard_a, "review")["count"] == expected_review_count
            assert workflow(dashboard_a, "student")["count"] == 1
            assert any(item["id"] == ASSIGNMENT_A and item["total"] == 1 for item in dashboard_a["tasks"])
            assert dashboard_a["reviews"][0]["submissionId"] == SUBMISSION_A
            assignment_stats = body(api_get(request, SCHOOL_A, f"assignments/{ASSIGNMENT_A}/stats", teacher_a["accessToken"]))
            assert assignment_stats == {
                "assignmentId": ASSIGNMENT_A,
                "totalStudents": 1,
                "submittedCount": 1,
                "notSubmittedCount": 0,
                "reviewedCount": 0,
                "needsReviewCount": 1,
                "submissionRate": 100,
            }

            classes_a = body(api_get(request, SCHOOL_A, "classes/teachers/me?limit=100", teacher_a["accessToken"]))
            classes_b = body(api_get(request, SCHOOL_A, "classes/teachers/me?limit=100", teacher_b["accessToken"]))
            classes_c = body(api_get(request, fixture["school_b"], "classes/teachers/me?limit=100", teacher_c["accessToken"]))
            assert [item["id"] for item in classes_a] == [CLASS_A]
            assert len(classes_b) == 1 and classes_b[0]["id"] == fixture["class_b"]
            assert len(classes_c) == 1 and classes_c[0]["id"] == fixture["class_c"]

            dashboard_b = body(api_get(request, SCHOOL_A, "teacher/dashboard", teacher_b["accessToken"]))
            dashboard_c = body(api_get(request, fixture["school_b"], "teacher/dashboard", teacher_c["accessToken"]))
            assert dashboard_b["greeting"]["name"] == "TEST_FIXTURE_ONLY 教师乙"
            assert workflow(dashboard_b, "task")["count"] == 0
            assert dashboard_b["tasks"] == [] and dashboard_b["reviews"] == []
            assert dashboard_c["greeting"]["schoolName"] == "TEST_FIXTURE_ONLY 学校丙"
            assert workflow(dashboard_c, "student")["count"] == 1

            empty_dashboard = body(api_get(request, SCHOOL_A, "teacher/dashboard", teacher_empty["accessToken"]))
            assert workflow(empty_dashboard, "student")["count"] == 0
            assert workflow(empty_dashboard, "task")["count"] == 0
            assert empty_dashboard["tasks"] == [] and empty_dashboard["reviews"] == []
            empty_classes = body(api_get(request, SCHOOL_A, "classes/teachers/me?limit=100", teacher_empty["accessToken"]))
            assert empty_classes == []

            assert api_get(request, fixture["school_b"], "teacher/dashboard", teacher_a["accessToken"]).status == 403
            assert api_get(request, SCHOOL_A, "teacher/dashboard", student_a["accessToken"]).status == 403
            foreign_class_response = api_get(
                request,
                SCHOOL_A,
                f"classes/{fixture['class_b']}/student-summaries",
                teacher_a["accessToken"],
            )
            assert foreign_class_response.status == 404, foreign_class_response.text()
            foreign_assignment_stats = api_get(
                request,
                SCHOOL_A,
                f"assignments/{ASSIGNMENT_A}/stats",
                teacher_b["accessToken"],
            )
            assert foreign_assignment_stats.status == 403, foreign_assignment_stats.text()

            for path, location in [
                ("/teacher/students/demo", "/teacher/classes"),
                ("/teacher/classes/detail", "/teacher/classes"),
                ("/teacher/classes/detail/index.html", "/teacher/classes"),
                ("/teacher/students/demo/index.html", "/teacher/classes"),
                ("/teacher/reviews/submission-1", "/teacher/reviews/"),
                ("/teacher/reviews/submission-1/index.html", "/teacher/reviews/"),
                ("/teacher/review", "/teacher/reviews/"),
                ("/teacher.html", "/teacher"),
            ]:
                response = request.get(f"{BASE}{path}", max_redirects=0)
                assert response.status == 308, f"{path}: {response.status}"
                assert response.headers.get("location") == location
        finally:
            request.dispose()


def ui_login(page, identifier):
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null", timeout=15_000)
    token = page.evaluate("localStorage.getItem('yuzan-access-token')")
    assert token and not token.startswith("demo-token-")
    page.wait_for_url("**/teacher/", timeout=15_000)


def test_teacher_browser_home_actions_empty_states_and_recovery():
    fixture = install_fixture_identities()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        console_errors = []
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        try:
            ui_login(page, "teacher.test")
            expect(page.locator("#teacherGreeting")).to_have_text("你好，TEST_FIXTURE_ONLY 教师甲老师")
            expect(page.locator("#schoolName")).to_have_text("TEST_FIXTURE_ONLY 学校甲")
            expect(page.locator("#workflowSection")).to_be_visible()
            expect(page.locator("#dashboardSync")).to_contain_text("1 个本人授权班级")
            expect(page.locator("#taskList")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")
            expect(page.locator("#reviewList")).to_contain_text("TEST_FIXTURE_ONLY 学生甲")
            expect(page.locator("#classList")).to_contain_text("TEST_FIXTURE_ONLY 班级甲")
            expect(page.locator("#studentState")).to_contain_text("TEST_FIXTURE_ONLY 学生甲")
            home_text = page.locator("body").inner_text()
            for stale in ["扎西卓玛", "林芝市第一中学", "五年级二班", "春天的足迹"]:
                assert stale not in home_text
            evidence_dir = Path(os.environ.get("YZ_T009_EVIDENCE_DIR", "runtime-local/native-web/evidence"))
            evidence_dir.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(evidence_dir / "teacher-home-1440.png"), full_page=True)

            task_link = page.locator("#taskList a").first
            task_href = task_link.get_attribute("href")
            assert f"assignmentId={ASSIGNMENT_A}" in task_href
            task_link.click()
            expect(page).to_have_url(f"{BASE}/teacher/assignments/?assignmentId={ASSIGNMENT_A}")
            expect(page.locator(".row.expanded")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")
            expect(page.locator(".row[data-id='f8888888-8888-4888-8888-888888888888']")).to_contain_text("1 / 1 人已提交")
            page.goto(f"{BASE}/teacher")
            expect(page.locator("#taskList a").first).to_be_visible()

            review_link = page.locator("#reviewList a").first
            review_link.click()
            expect(page).to_have_url(f"{BASE}/teacher/submissions/{SUBMISSION_A}")
            expect(page.locator("#assignmentTitle")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")
            expect(page.locator("#submitStatus")).to_contain_text("待复核")

            page.goto(f"{BASE}/teacher")
            page.locator("#classList a").first.click()
            expect(page).to_have_url(f"{BASE}/teacher/classes/{CLASS_A}")
            expect(page.locator(".class-title h1")).to_contain_text("TEST_FIXTURE_ONLY 班级甲")
            class_text = page.locator("body").inner_text()
            for stale in ["五年级二班", "林芝市第一中学", "42 人", "82.6 分"]:
                assert stale not in class_text
            expect(page.locator("#pendingList")).to_contain_text("有缺交任务")

            page.goto(f"{BASE}/teacher/classes")
            expect(page.locator("#mapView .class-card")).to_have_count(1)
            expect(page.locator("#mapView")).to_contain_text("TEST_FIXTURE_ONLY 班级甲")
            expect(page.locator(".unavailable-card")).to_contain_text("暂未接入真实日程和待办数据")
            class_list_text = page.locator("body").inner_text()
            for stale in ["扎西卓玛", "林芝市第一中学", "学生 48 人", "共 6 个班级", "2025 年 5 月", "待批改任务", "18 ›"]:
                assert stale not in class_list_text
            page.set_viewport_size({"width": 390, "height": 844})
            page.reload()
            expect(page.locator("#mapView .class-card")).to_have_count(1)
            assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
            page.set_viewport_size({"width": 1440, "height": 1000})

            page.goto(f"{BASE}/teacher")
            student_link = page.locator("#studentState a").first
            assert f"/teacher/classes/{CLASS_A}?studentId=f1111111-1111-4111-8111-111111111111#students" == student_link.get_attribute("href")
            student_link.click()
            expect(page).to_have_url(f"{BASE}/teacher/classes/{CLASS_A}?studentId=f1111111-1111-4111-8111-111111111111#students")
            expect(page.locator(".selected-student")).to_contain_text("TEST_FIXTURE_ONLY 学生甲")

            page.goto(f"{BASE}/teacher")
            page.reload()
            expect(page.locator("#taskList")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")
            expect(page.locator("#classList")).to_contain_text("TEST_FIXTURE_ONLY 班级甲")

            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{BASE}/teacher")
            expect(page.locator("#taskList")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")
            assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
            page.screenshot(path=str(evidence_dir / "teacher-home-390.png"), full_page=True)

            page.goto(f"{BASE}/login/")
            ui_login(page, fixture["teacher_empty"])
            expect(page.locator("#taskList")).to_contain_text("当前没有进行中的教学任务")
            expect(page.locator("#reviewList")).to_contain_text("当前没有待复核提交")
            expect(page.locator("#classList")).to_contain_text("当前账号暂无已授权班级")

            page.goto(f"{BASE}/login/")
            ui_login(page, "teacher.test")
            failed = {"once": False}

            def abort_once(route):
                if not failed["once"] and route.request.url.endswith("/teacher/dashboard"):
                    failed["once"] = True
                    route.abort()
                else:
                    route.continue_()

            page.route("**/api/v1/schools/*/teacher/dashboard", abort_once)
            page.goto(f"{BASE}/teacher")
            expect(page.locator("#dashboardState")).to_contain_text("网络或服务暂时不可用")
            page.unroute("**/api/v1/schools/*/teacher/dashboard", abort_once)
            page.locator("[data-retry-dashboard]").click()
            expect(page.locator("#taskList")).to_contain_text("TEST_FIXTURE_ONLY 任务甲")

            school_b = fixture["school_b"]
            page.evaluate("schoolId => localStorage.setItem('yuzan-active-school-id', schoolId)", school_b)
            page.goto(f"{BASE}/teacher")
            expect(page.locator("#dashboardState")).to_contain_text("无权读取所选学校")
            assert not console_errors, "browser page errors: " + " | ".join(console_errors)
        finally:
            browser.close()
