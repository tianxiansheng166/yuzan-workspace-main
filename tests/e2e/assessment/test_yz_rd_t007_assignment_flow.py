"""Teacher assignment browser proof against an isolated native API and PostgreSQL."""

import os
import subprocess
import uuid
from urllib.parse import parse_qsl, unquote, urlparse

import pytest
from playwright.sync_api import expect, sync_playwright


BASE = os.environ.get("YZ_T010_BASE_URL", os.environ.get("YZ_T007_BASE_URL", ""))
DATABASE_URL = os.environ.get("YZ_T010_DATABASE_URL", os.environ.get("YZ_T007_DATABASE_URL", ""))
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
TEACHER_A_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
COURSE_VERSION_ID = "f4444444-4444-4444-8444-444444444444"
PASSWORD = os.environ.get("YZ_T010_PASSWORD", os.environ.get("YZ_T007_PASSWORD", ""))
PAGE_SIZE = 20
NATIVE_TASK_ID = os.environ.get("YZ_NATIVE_TASK_ID", "T010").upper()
EXPECTED_DATABASE = f"yuzan_{NATIVE_TASK_ID.lower()}_native"
EXPECTED_DATABASE_USER = f"yz_{NATIVE_TASK_ID.lower()}"
pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T007 native API/PostgreSQL/Chromium fixture",
)


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == EXPECTED_DATABASE_USER
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == EXPECTED_DATABASE
    assert parsed.password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": unquote(parsed.password),
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    args = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"]
    result = subprocess.run(args, input=statement, text=True, capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr.replace(unquote(parsed.password), "<redacted>"))
    output = result.stdout.strip()
    if capture:
        return output
    return output


def sql_rows(statement):
    output = sql(statement, capture=True)
    return [line.split("|") for line in output.splitlines() if line]


def sql_scalar(statement):
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def verify_database_identity():
    row = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    assert row.startswith(f"{EXPECTED_DATABASE}|{EXPECTED_DATABASE_USER}|PostgreSQL 17."), row.split("|", 2)[:2]


def install_fixture():
    """Install fictional, isolated T007 users and real Assignment/Submission/review rows."""
    verify_database_identity()
    suffix = uuid.uuid4().hex[:10]
    ids = {
        "teacher_b": str(uuid.uuid4()),
        "teacher_empty": str(uuid.uuid4()),
        "teacher_c": str(uuid.uuid4()),
        "student_b": str(uuid.uuid4()),
        "student_c": str(uuid.uuid4()),
        "school_b": str(uuid.uuid4()),
        "term_a": str(uuid.uuid4()),
        "class_b": str(uuid.uuid4()),
        "term_b": str(uuid.uuid4()),
        "class_c": str(uuid.uuid4()),
        "assignment": str(uuid.uuid4()),
        "assignment_target": str(uuid.uuid4()),
        "transition_assignment": str(uuid.uuid4()),
        "transition_target": str(uuid.uuid4()),
        "submission": str(uuid.uuid4()),
        "assessment_session": str(uuid.uuid4()),
        "assessment_item": str(uuid.uuid4()),
    }
    ids["teacher_b_login"] = f"teacher.t007.b.{suffix}"
    ids["teacher_empty_login"] = f"teacher.t007.empty.{suffix}"
    ids["teacher_c_login"] = f"teacher.t007.c.{suffix}"
    ids["student_b_login"] = f"student.t007.b.{suffix}"
    ids["student_c_login"] = f"student.t007.c.{suffix}"
    ids["main_title"] = f"TEST_FIXTURE_ONLY T007 主任务 {suffix}"
    ids["transition_title"] = f"TEST_FIXTURE_ONLY T007 重复发布保护 {suffix}"
    ids["class_a_name"] = f"TEST_FIXTURE_ONLY T007 班甲 {suffix}"
    ids["class_a_label"] = f"七年级{ids['class_a_name']}"
    ids["student_a_name"] = f"TEST_FIXTURE_ONLY T007 学生甲 {suffix}"
    ids["due_date"] = "2026-11-20"
    question_version = sql_scalar(
        '''SELECT v.id FROM "QuestionBankItemVersion" v
           JOIN "QuestionBankItem" i ON i.id=v."itemId"
           WHERE i."stableKey"='QB-DEV-TEXT-SPEECH-001' AND v.version=1 AND v.status='PUBLISHED';'''
    )

    statements = [
        "BEGIN",
        f'''UPDATE "School" SET name={q(f"TEST_FIXTURE_ONLY T007 学校甲 {suffix}")}, "updatedAt"=NOW()
            WHERE id={q(SCHOOL_ID)}''',
        f'''UPDATE "User" SET "displayName"={q(f"TEST_FIXTURE_ONLY T007 教师甲 {suffix}")}, "updatedAt"=NOW()
            WHERE id={q(TEACHER_A_ID)}''',
        f'''UPDATE "User" SET "displayName"={q(ids["student_a_name"])}, "updatedAt"=NOW()
            WHERE id={q(STUDENT_A_ID)}''',
        f'''UPDATE "Class" SET name={q(ids["class_a_name"])}, grade='七年级', "updatedAt"=NOW()
            WHERE id={q(CLASS_ID)}''',
        f'''INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
            VALUES ({q("f3333333-3333-4333-8333-333333333333")},{q(SCHOOL_ID)},{q(TEACHER_A_ID)},
              'TEST_FIXTURE_ONLY_T007_COURSE','TEST_FIXTURE_ONLY T007 测试课程',NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET title='TEST_FIXTURE_ONLY T007 测试课程',"updatedAt"=NOW()''',
        f'''INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"publishedAt","createdAt","updatedAt")
            VALUES ({q(COURSE_VERSION_ID)},{q(SCHOOL_ID)},{q("f3333333-3333-4333-8333-333333333333")},1,'PUBLISHED',
              'TEST_FIXTURE_ONLY T007 测试课程版本','zh-CN','[]'::jsonb,NOW(),NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET status='PUBLISHED',title='TEST_FIXTURE_ONLY T007 测试课程版本',"updatedAt"=NOW()''',
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids["teacher_b"])},{q(ids["teacher_b_login"])},'TEST_FIXTURE_ONLY T007 教师乙',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_A_ID)}''',
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids["teacher_empty"])},{q(ids["teacher_empty_login"])},'TEST_FIXTURE_ONLY T007 空班教师',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_A_ID)}''',
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids["student_b"])},{q(ids["student_b_login"])},'TEST_FIXTURE_ONLY T007 学生乙',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_A_ID)}''',
        f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
            ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(ids["teacher_b"])},'TEACHER','ACTIVE',NOW()),
            ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(ids["teacher_empty"])},'TEACHER','ACTIVE',NOW()),
            ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(ids["student_b"])},'STUDENT','ACTIVE',NOW())''',
        f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
            VALUES ({q(ids["term_a"])},{q(SCHOOL_ID)},{q(f"TEST_FIXTURE_ONLY T007 学期甲 {suffix}")},'2026-01-01','2027-12-31',true,NOW())''',
        f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
            VALUES ({q(ids["class_b"])},{q(SCHOOL_ID)},{q(ids["term_a"])},{q(f"TEST_FIXTURE_ONLY T007 班乙 {suffix}")},'五年级',NOW(),NOW())''',
        f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
            ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(ids["class_b"])},{q(ids["teacher_b"])},'TEACHER','ACTIVE',NOW()),
            ({q(str(uuid.uuid4()))},{q(SCHOOL_ID)},{q(ids["class_b"])},{q(ids["student_b"])},'STUDENT','ACTIVE',NOW())''',
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
            VALUES ({q(ids["school_b"])},{q(f"YZ-T007-{suffix}")},{q(f"TEST_FIXTURE_ONLY T007 学校乙 {suffix}")},'TEST',NOW(),NOW())''',
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids["teacher_c"])},{q(ids["teacher_c_login"])},'TEST_FIXTURE_ONLY T007 教师丙',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(TEACHER_A_ID)}''',
        f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids["student_c"])},{q(ids["student_c_login"])},'TEST_FIXTURE_ONLY T007 学生丙',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(STUDENT_A_ID)}''',
        f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
            ({q(str(uuid.uuid4()))},{q(ids["school_b"])},{q(ids["teacher_c"])},'TEACHER','ACTIVE',NOW()),
            ({q(str(uuid.uuid4()))},{q(ids["school_b"])},{q(ids["student_c"])},'STUDENT','ACTIVE',NOW())''',
        f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
            VALUES ({q(ids["term_b"])},{q(ids["school_b"])},{q(f"TEST_FIXTURE_ONLY T007 学期乙 {suffix}")},'2026-01-01','2027-12-31',true,NOW())''',
        f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
            VALUES ({q(ids["class_c"])},{q(ids["school_b"])},{q(ids["term_b"])},{q(f"TEST_FIXTURE_ONLY T007 班丙 {suffix}")},'六年级',NOW(),NOW())''',
        f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
            ({q(str(uuid.uuid4()))},{q(ids["school_b"])},{q(ids["class_c"])},{q(ids["teacher_c"])},'TEACHER','ACTIVE',NOW()),
            ({q(str(uuid.uuid4()))},{q(ids["school_b"])},{q(ids["class_c"])},{q(ids["student_c"])},'STUDENT','ACTIVE',NOW())''',
        f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt","createdAt","updatedAt")
            VALUES ({q(ids["assignment"])},{q(SCHOOL_ID)},{q(COURSE_VERSION_ID)},{q(TEACHER_A_ID)},{q(ids["main_title"])},'OPEN',
            NOW()-INTERVAL '1 day','2026-11-20T12:00:00Z','2026-10-17T00:00:00Z',NOW(),NOW())''',
        f'''INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","enrollmentId","createdAt")
            VALUES ({q(ids["assignment_target"])},{q(SCHOOL_ID)},{q(ids["assignment"])},'STUDENT',
              'f1111111-1111-4111-8111-111111111111',NOW())''',
        f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","createdAt","updatedAt")
            VALUES ({q(ids["transition_assignment"])},{q(SCHOOL_ID)},{q(COURSE_VERSION_ID)},{q(TEACHER_A_ID)},{q(ids["transition_title"])},'DRAFT',
            NOW()-INTERVAL '1 day',NOW()+INTERVAL '7 days',NOW(),NOW())''',
        f'''INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
            VALUES ({q(ids["transition_target"])},{q(SCHOOL_ID)},{q(ids["transition_assignment"])},'CLASS',{q(CLASS_ID)},NOW())''',
        f'''INSERT INTO "Submission" (id,"schoolId","assignmentId","enrollmentId","attemptNo",status,"idempotencyKey","submittedAt","createdAt","updatedAt")
            VALUES ({q(ids["submission"])},{q(SCHOOL_ID)},{q(ids["assignment"])},'f1111111-1111-4111-8111-111111111111',1,'NEEDS_REVIEW',
            {q(f"yz-rd-t007-{suffix}")},NOW(),NOW(),NOW())''',
        f'''INSERT INTO "AssessmentSession" (id,"schoolId","enrollmentId","classId","initiatorUserId",type,status,"submittedAt","courseSubmissionId","createdAt","updatedAt")
            VALUES ({q(ids["assessment_session"])},{q(SCHOOL_ID)},'f1111111-1111-4111-8111-111111111111',{q(CLASS_ID)},
            {q(TEACHER_A_ID)},'READING','SUBMITTED',NOW(),{q(ids["submission"])},NOW(),NOW())''',
        f'''INSERT INTO "AssessmentItem" (id,"sessionId","questionVersionId",prompt,"itemType",status,"sortOrder","maxScore","createdAt","updatedAt")
            VALUES ({q(ids["assessment_item"])},{q(ids["assessment_session"])},{q(question_version)},
            '{{"text":"TEST_FIXTURE_ONLY T007 朗读复核题"}}'::jsonb,'SPEECH','PENDING',0,4,NOW(),NOW())''',
    ]
    for index in range(24):
        assignment_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())
        filler_title = f"TEST_FIXTURE_ONLY T007 分页任务 {suffix}-{index:02d}"
        statements.extend(
            [
                f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","createdAt","updatedAt")
                    VALUES ({q(assignment_id)},{q(SCHOOL_ID)},{q(COURSE_VERSION_ID)},{q(TEACHER_A_ID)},{q(filler_title)},'DRAFT',
                    NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',NOW()-INTERVAL '2 hours'-INTERVAL '{index} seconds',NOW())''',
                f'''INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
                    VALUES ({q(target_id)},{q(SCHOOL_ID)},{q(assignment_id)},'CLASS',{q(CLASS_ID)},NOW())''',
            ]
        )
        if index == 23:
            ids["filler_last"] = assignment_id
    statements.append("COMMIT")
    sql(";\n".join(statements) + ";")
    ids["school_a"] = SCHOOL_ID
    ids["class_a"] = CLASS_ID
    ids["teacher_a_login"] = "teacher.test"
    ids["teacher_a_name"] = f"TEST_FIXTURE_ONLY T007 教师甲 {suffix}"
    ids["teacher_b_name"] = "TEST_FIXTURE_ONLY T007 教师乙"
    ids["student_b_login"] = f"student.t007.b.{suffix}"
    ids["teacher_empty_login"] = f"teacher.t007.empty.{suffix}"
    return ids


def assignment_ids_from_sql(*, class_id=None, status=None, search=None, due_from=None, due_to=None, offset=0, limit=20):
    teacher_classes = f'''SELECT "classId" FROM "Enrollment"
        WHERE "schoolId"={q(SCHOOL_ID)} AND "userId"={q(TEACHER_A_ID)} AND role='TEACHER' AND status='ACTIVE'
        AND "classId" IS NOT NULL'''
    conditions = [f'a."schoolId"={q(SCHOOL_ID)}', 'a."deletedAt" IS NULL']
    conditions.append(
        f'''EXISTS (
            SELECT 1 FROM "AssignmentTarget" t
            LEFT JOIN "Enrollment" target_enrollment ON target_enrollment."schoolId"=t."schoolId" AND target_enrollment.id=t."enrollmentId"
            WHERE t."schoolId"=a."schoolId" AND t."assignmentId"=a.id
              AND (t."classId" IN ({teacher_classes}) OR target_enrollment."classId" IN ({teacher_classes}))
        )'''
    )
    if class_id:
        conditions.append(
            f'''EXISTS (SELECT 1 FROM "AssignmentTarget" t
                LEFT JOIN "Enrollment" target_enrollment ON target_enrollment."schoolId"=t."schoolId" AND target_enrollment.id=t."enrollmentId"
                WHERE t."schoolId"=a."schoolId" AND t."assignmentId"=a.id
                  AND (t."classId"={q(class_id)} OR target_enrollment."classId"={q(class_id)}))'''
        )
    if status:
        conditions.append(f'a.status={q(status)}')
    if search:
        conditions.append(f'a.title ILIKE {q("%" + search + "%")}')
    if due_from:
        conditions.append(f'a."dueAt">={q(due_from)}::timestamptz')
    if due_to:
        conditions.append(f'a."dueAt"<={q(due_to)}::timestamptz')
    return [
        row[0]
        for row in sql_rows(
            f'''SELECT a.id FROM "Assignment" a WHERE {' AND '.join(conditions)}
                ORDER BY a."createdAt" DESC,a.id DESC LIMIT {int(limit)} OFFSET {int(offset)};'''
        )
    ]


def body(response):
    value = response.json()
    return value.get("data", value)


def api_login(request, identifier):
    response = request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, f"login failed: {response.status} {response.text()}"
    return body(response)["accessToken"]


def api_get(request, token, path, *, school_id=SCHOOL_ID):
    return request.get(
        f"{BASE}/api/v1/schools/{school_id}/{path}",
        headers={"Authorization": f"Bearer {token}"},
    )


def ui_login(page, identifier):
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null", timeout=15_000)
    page.wait_for_url("**/teacher/", timeout=15_000)


def wait_for_assignment_list(page, action):
    with page.expect_response(
        lambda response: response.request.method == "GET"
        and urlparse(response.url).path.endswith("/assignments")
        and "?" in response.url,
        timeout=15_000,
    ) as response_info:
        action()
    response = response_info.value
    assert response.status == 200, f"assignment list API returned {response.status}: {response.url}"


def assert_page_matches_sql(page, expected_ids, *, page_number=0):
    start_index = page_number * PAGE_SIZE
    page_ids = expected_ids[start_index : start_index + PAGE_SIZE]
    start = start_index + 1 if page_ids else 0
    end = start_index + len(page_ids)
    expected_label = "当前页 0 条" if end == 0 else f"当前页 {start}–{end} 条"
    expect(page.locator("[data-page-label]")).to_have_text(expected_label)
    rows = page.locator(".task-table .row[data-id]")
    expect(rows).to_have_count(len(page_ids))
    actual_ids = page.locator(".task-table .row[data-id]").evaluate_all("rows => rows.map(row => row.dataset.id)")
    assert actual_ids == page_ids


def test_teacher_assignment_filters_roster_authorization_and_dynamic_routes():
    fixture = install_fixture()
    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="Asia/Shanghai")
        page = context.new_page()
        assignment_list_requests = []
        transition_requests = []
        page.on(
            "request",
            lambda req: assignment_list_requests.append(req.url)
            if req.method == "GET" and "/assignments?" in req.url
            else None,
        )
        page.on(
            "request",
            lambda req: transition_requests.append(req.url)
            if req.method == "POST" and req.url.endswith(("/schedule", "/open"))
            else None,
        )
        try:
            teacher_a = api_login(request, "teacher.test")
            teacher_b = api_login(request, fixture["teacher_b_login"])
            teacher_c = api_login(request, fixture["teacher_c_login"])
            teacher_empty = api_login(request, fixture["teacher_empty_login"])
            student_b = api_login(request, fixture["student_b_login"])

            # Counts and item links must match the real Assignment, Submission and AssessmentItem rows.
            stats = body(api_get(request, teacher_a, f"assignments/{fixture['assignment']}/stats"))
            db_total, db_submitted, db_review = map(
                int,
                sql_scalar(
                    f'''WITH target_enrollments AS (
                      SELECT DISTINCT e.id FROM "AssignmentTarget" t JOIN "Enrollment" e
                        ON e."schoolId"=t."schoolId" AND (e."classId"=t."classId" OR e.id=t."enrollmentId")
                      WHERE t."schoolId"={q(SCHOOL_ID)} AND t."assignmentId"={q(fixture['assignment'])}
                        AND e.role='STUDENT' AND e.status='ACTIVE'
                        AND ((t."targetType"='CLASS' AND e."classId"=t."classId") OR
                             (t."targetType"='STUDENT' AND e.id=t."enrollmentId"))
                    ), latest_submissions AS (
                      SELECT DISTINCT ON (s."enrollmentId") s."enrollmentId", s.status
                      FROM "Submission" s JOIN target_enrollments e ON e.id=s."enrollmentId"
                      WHERE s."schoolId"={q(SCHOOL_ID)} AND s."assignmentId"={q(fixture['assignment'])} AND s."deletedAt" IS NULL
                      ORDER BY s."enrollmentId", s."attemptNo" DESC
                    )
                    SELECT (SELECT count(*) FROM target_enrollments),
                      count(*) FILTER (WHERE status IN ('SUBMITTED','PROCESSING','NEEDS_REVIEW','REVIEWED','RETURNED','ACCEPTED')),
                      count(*) FILTER (WHERE status='NEEDS_REVIEW') FROM latest_submissions;'''
                ).split("|"),
            )
            assert (stats["totalStudents"], stats["submittedCount"], stats["needsReviewCount"]) == (
                db_total,
                db_submitted,
                db_review,
            )
            assert db_total == 1 and db_submitted == 1 and db_review == 1
            review_queue = body(api_get(request, teacher_a, "assessment-reviews"))
            linked_review = next(
                item
                for item in review_queue["items"]
                if item.get("assignmentId") == fixture["assignment"]
                and item.get("submissionId") == fixture["submission"]
            )
            assert sql_scalar(
                f'''SELECT count(*) FROM "AssessmentItem" ai JOIN "AssessmentSession" s ON s.id=ai."sessionId"
                    WHERE ai.id={q(linked_review['itemId'])} AND s."courseSubmissionId"={q(fixture['submission'])}
                    AND s.status='SUBMITTED' AND ai.status='PENDING';'''
            ) == "1"

            # Teacher B is in the same school but cannot see class A's task, roster, submission or review.
            assert api_get(request, teacher_b, f"assignments/{fixture['assignment']}").status in {403, 404}
            assert api_get(request, teacher_b, f"assignments/{fixture['assignment']}/submissions").status in {403, 404}
            assert api_get(request, teacher_b, f"assessment-reviews/{linked_review['itemId']}").status in {403, 404}
            teacher_b_list = body(api_get(request, teacher_b, "assignments?limit=100"))
            assert fixture["assignment"] not in {item["id"] for item in teacher_b_list["items"]}
            assert api_get(request, teacher_a, f"assignments/{fixture['assignment']}", school_id=fixture["school_b"]).status == 403
            assert api_get(request, teacher_a, "assignments", school_id=fixture["school_b"]).status == 403
            assert api_get(request, teacher_c, f"assignments/{fixture['assignment']}", school_id=fixture["school_b"]).status in {403, 404}
            assert api_get(request, teacher_c, f"assessment-reviews/{linked_review['itemId']}", school_id=fixture["school_b"]).status in {403, 404}
            student_submission = api_get(request, student_b, f"submissions/{fixture['submission']}")
            assert student_submission.status in {403, 404}

            # Initial teacher list uses true cursor pages. Every visible ID and page range is checked against SQL.
            ui_login(page, "teacher.test")
            page.goto(f"{BASE}/teacher/assignments/")
            all_sql_ids = assignment_ids_from_sql(limit=10_000)
            assert len(all_sql_ids) > PAGE_SIZE
            assert_page_matches_sql(page, all_sql_ids)
            expect(page.locator("[data-page-next]")).to_be_enabled()
            wait_for_assignment_list(page, lambda: page.locator("[data-page-next]").click())
            assert_page_matches_sql(page, all_sql_ids, page_number=1)
            expect(page.locator("[data-page-label]")).to_have_text(f"当前页 21–{min(len(all_sql_ids), 40)} 条")
            second_request = urlparse(assignment_list_requests[-1])
            second_query = dict(parse_qsl(second_request.query))
            assert second_query["cursor"] == all_sql_ids[PAGE_SIZE - 1]
            wait_for_assignment_list(page, lambda: page.locator("[data-page-prev]").click())
            assert_page_matches_sql(page, all_sql_ids)

            # Class filter, status filter, title filter and due-date filter each reach the API and agree with PostgreSQL.
            wait_for_assignment_list(page, lambda: page.locator("#assignmentClassFilter").select_option(CLASS_ID))
            class_ids = assignment_ids_from_sql(class_id=CLASS_ID)
            assert_page_matches_sql(page, class_ids)
            class_query = dict(parse_qsl(urlparse(assignment_list_requests[-1]).query))
            assert class_query["classId"] == CLASS_ID

            wait_for_assignment_list(page, lambda: page.locator("#assignmentStatusFilter").select_option("OPEN"))
            open_ids = assignment_ids_from_sql(class_id=CLASS_ID, status="OPEN")
            assert_page_matches_sql(page, open_ids)
            status_query = dict(parse_qsl(urlparse(assignment_list_requests[-1]).query))
            assert status_query["classId"] == CLASS_ID and status_query["status"] == "OPEN"

            wait_for_assignment_list(page, lambda: page.locator("#assignmentSearch").fill(fixture["main_title"]))
            title_ids = assignment_ids_from_sql(class_id=CLASS_ID, status="OPEN", search=fixture["main_title"])
            assert_page_matches_sql(page, title_ids)
            assert title_ids == [fixture["assignment"]]
            title_query = dict(parse_qsl(urlparse(assignment_list_requests[-1]).query))
            assert title_query["search"] == fixture["main_title"]

            wait_for_assignment_list(page, lambda: page.locator("#assignmentDueFrom").fill(fixture["due_date"]))
            wait_for_assignment_list(page, lambda: page.locator("#assignmentDueTo").fill(fixture["due_date"]))
            due_from, due_to = page.evaluate(
                """() => [
                  new Date(2026, 10, 20, 0, 0, 0, 0).toISOString(),
                  new Date(2026, 10, 20, 23, 59, 59, 999).toISOString()
                ]"""
            )
            due_ids = assignment_ids_from_sql(
                class_id=CLASS_ID,
                status="OPEN",
                search=fixture["main_title"],
                due_from=due_from,
                due_to=due_to,
            )
            assert_page_matches_sql(page, due_ids)
            assert due_ids == [fixture["assignment"]]
            due_query = dict(parse_qsl(urlparse(assignment_list_requests[-1]).query))
            assert due_query["dueAtFrom"] == due_from and due_query["dueAtTo"] == due_to

            # Real assignment detail, authorized roster, dynamic Submission and dynamic AssessmentReview.
            page.goto(f"{BASE}/teacher/assignments/?assignmentId={fixture['assignment']}")
            assignment_row = page.locator(f".row[data-id='{fixture['assignment']}']")
            expect(assignment_row).to_contain_text(fixture["main_title"])
            expect(assignment_row).to_contain_text("1 / 1 人已提交")
            expect(page.locator(".row.expanded")).to_contain_text(fixture["main_title"])
            expect(page.locator(".assignment-roster")).to_contain_text(fixture["student_a_name"])
            expect(page.locator(".assignment-roster")).to_contain_text(fixture["class_a_label"])
            expect(page.locator(".assignment-roster")).to_contain_text("待复核")
            review_link = page.locator(f".assignment-roster a[href='/teacher/reviews/{linked_review['itemId']}']")
            expect(review_link).to_be_visible()
            review_href = review_link.get_attribute("href")
            assert review_href == f"/teacher/reviews/{linked_review['itemId']}"
            review_link.click()
            expect(page).to_have_url(f"{BASE}/teacher/reviews/{linked_review['itemId']}")
            expect(page.locator(".detail-top h1")).to_contain_text(fixture["student_a_name"])
            expect(page.locator(".detail-stimulus")).to_contain_text("春风又绿江南岸")
            page.go_back()
            expect(page).to_have_url(f"{BASE}/teacher/assignments/?assignmentId={fixture['assignment']}")
            expect(page.locator(".assignment-roster")).to_contain_text(fixture["student_a_name"])

            page.goto(f"{BASE}/teacher/submissions/{fixture['submission']}")
            expect(page.locator("#studentName")).to_contain_text(fixture["student_a_name"])
            expect(page.locator("#assignmentTitle")).to_contain_text(fixture["main_title"])
            expect(page.locator("#submitStatus")).to_contain_text("待复核")
            page.go_back()
            expect(page).to_have_url(f"{BASE}/teacher/assignments/?assignmentId={fixture['assignment']}")
            expect(page.locator(".assignment-roster")).to_contain_text(fixture["student_a_name"])
            evidence = os.environ.get("YZ_T010_EVIDENCE_DIR", os.environ.get("YZ_T007_EVIDENCE_DIR"))
            evidence_dir = None
            if evidence:
                from pathlib import Path

                evidence_dir = Path(evidence)
                evidence_dir.mkdir(parents=True, exist_ok=True)
            page.reload()
            expect(page.locator(".row.expanded")).to_contain_text(fixture["main_title"])
            for width in (1280, 1440):
                page.set_viewport_size({"width": width, "height": 1000})
                page.goto(f"{BASE}/teacher/assignments/?assignmentId={fixture['assignment']}")
                expect(page.locator(".row.expanded")).to_contain_text(fixture["main_title"])
                expect(page.locator(".assignment-roster a")).to_be_visible()
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), width
                if evidence_dir:
                    page.screenshot(path=str(evidence_dir / f"assignment-detail-{width}.png"), full_page=True)
            page.set_viewport_size({"width": 1440, "height": 1000})

            # Empty teacher and one-shot API failure both render real recoverable UI states.
            ui_login(page, fixture["teacher_empty_login"])
            page.goto(f"{BASE}/teacher/assignments/")
            expect(page.locator(".empty-row")).to_contain_text("暂无教学任务")
            ui_login(page, "teacher.test")
            failed = {"once": False}

            def abort_assignment_list(route):
                if not failed["once"] and route.request.method == "GET" and route.request.url.split("?", 1)[0].endswith("/assignments"):
                    failed["once"] = True
                    route.abort()
                else:
                    route.continue_()

            page.route("**/api/v1/schools/*/assignments**", abort_assignment_list)
            page.goto(f"{BASE}/teacher/assignments/")
            expect(page.locator(".empty-row")).to_contain_text("重新加载")
            assert failed["once"]
            page.unroute("**/api/v1/schools/*/assignments**", abort_assignment_list)
            page.locator("#reloadAssignments").click()
            expect(page.locator(".row[data-id]").first).to_be_visible()

            # A real PostgreSQL DRAFT cannot be scheduled or opened twice by a rapid duplicate click.
            created_assignment_id = fixture["transition_assignment"]
            assert created_assignment_id != fixture["assignment"]
            task_row = page.locator(f".row[data-id='{created_assignment_id}']")
            expect(task_row).to_contain_text(fixture["transition_title"])
            task_row.click()
            page.locator('[data-transition="schedule"]').evaluate("button => { button.click(); button.click(); }")
            scheduled_row = page.locator(f".row[data-id='{created_assignment_id}']")
            expect(scheduled_row).to_contain_text("已排期")
            assert len([url for url in transition_requests if f"/assignments/{created_assignment_id}/schedule" in url]) == 1
            page.locator(f".row[data-id='{created_assignment_id}']").click()
            page.locator('[data-transition="open"]').evaluate("button => { button.click(); button.click(); }")
            expect(page.locator(f".row[data-id='{created_assignment_id}']")).to_contain_text("已发布")
            assert len([url for url in transition_requests if f"/assignments/{created_assignment_id}/open" in url]) == 1
            assert sql_scalar(
                f'''SELECT status || '|' || revision FROM "Assignment"
                    WHERE id={q(created_assignment_id)} AND "schoolId"={q(SCHOOL_ID)};'''
            ) == "OPEN|3"
            assert sql_scalar(
                f'''SELECT count(*) FROM "Assignment" WHERE "schoolId"={q(SCHOOL_ID)} AND title={q(fixture['transition_title'])};'''
            ) == "1"

            if evidence_dir:
                page.screenshot(path=str(evidence_dir / "assignment-published.png"), full_page=True)
            print(
                "T007 native proof: "
                f"assignment={fixture['assignment']} submission={fixture['submission']} "
                f"review={linked_review['itemId']} sql_api_stats={db_total}/{db_submitted}/{db_review} "
                f"paged={len(all_sql_ids)} published={created_assignment_id}"
            )
        finally:
            context.close()
            browser.close()
            request.dispose()
