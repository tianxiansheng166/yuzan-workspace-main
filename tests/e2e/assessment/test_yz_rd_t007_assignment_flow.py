"""Teacher assignment list/detail proof against an isolated API, database and browser."""

import os
import subprocess
from urllib.parse import urlparse

import pytest
from playwright.sync_api import expect, sync_playwright


BASE = os.environ.get("YZ_T007_BASE_URL", "")
SCHOOL_ID = os.environ.get("YZ_T007_SCHOOL_ID", "")
ASSIGNMENT_ID = os.environ.get("YZ_T007_ASSIGNMENT_ID", "")
SUBMISSION_ID = os.environ.get("YZ_T007_SUBMISSION_ID", "")
CLASS_ID = os.environ.get("YZ_T007_CLASS_ID", "")
CLASS_LABEL = os.environ.get("YZ_T007_CLASS_LABEL", "")
TASK_TITLE = os.environ.get("YZ_T007_TASK_TITLE", "")
STUDENT_NAME = os.environ.get("YZ_T007_STUDENT_NAME", "")
TEACHER_A = os.environ.get("YZ_T007_TEACHER_A", "")
TEACHER_B = os.environ.get("YZ_T007_TEACHER_B", "")
TEACHER_EMPTY = os.environ.get("YZ_T007_TEACHER_EMPTY", "")
STUDENT_OTHER = os.environ.get("YZ_T007_STUDENT_OTHER", "")
PASSWORD = os.environ.get("YZ_T007_PASSWORD", "")
DB_CONTAINER = os.environ.get("YZ_T007_DB_CONTAINER", "")
DB_USER = os.environ.get("YZ_T007_DB_USER", "")
DB_NAME = os.environ.get("YZ_T007_DB_NAME", "")
pytestmark = pytest.mark.skipif(
    not all([BASE, SCHOOL_ID, ASSIGNMENT_ID, SUBMISSION_ID, CLASS_ID, CLASS_LABEL,
             TASK_TITLE, STUDENT_NAME, TEACHER_A, TEACHER_B, TEACHER_EMPTY,
             STUDENT_OTHER, PASSWORD, DB_CONTAINER, DB_USER, DB_NAME,
             os.environ.get("YZ_T007_ASSIGNMENT_STATUS"),
             os.environ.get("YZ_T007_DUE_FROM"), os.environ.get("YZ_T007_DUE_TO")]),
    reason="requires the isolated YZ-RD-T007 API/PostgreSQL/Chromium fixture",
)


def sql(statement):
    assert DB_CONTAINER.startswith("yz-rd-t007-")
    assert urlparse(BASE).hostname in {"127.0.0.1", "localhost"}
    project = subprocess.check_output(
        ["docker", "inspect", DB_CONTAINER, "--format", '{{index .Config.Labels "com.docker.compose.project"}}'],
        text=True,
    ).strip()
    assert project.startswith("yz-rd-t007-")
    assert "p0-integration" not in project
    result = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME,
         "-v", "ON_ERROR_STOP=1", "-At", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def body(response):
    value = response.json()
    return value.get("data", value)


def login(request, identifier):
    response = request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, f"login failed: {response.status} {response.text()}"
    return body(response)["accessToken"]


def api_get(request, token, path):
    return request.get(
        f"{BASE}/api/v1/schools/{SCHOOL_ID}/{path}",
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


def test_teacher_assignment_filters_roster_authorization_and_dynamic_routes():
    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        schedule_requests = []
        page.on("request", lambda req: schedule_requests.append(req.url) if "/assignments/" in req.url and req.url.endswith("/schedule") else None)
        try:
            teacher_a = login(request, TEACHER_A)
            teacher_b = login(request, TEACHER_B)
            teacher_empty = login(request, TEACHER_EMPTY)
            student_other = login(request, STUDENT_OTHER)

            stats = body(api_get(request, teacher_a, f"assignments/{ASSIGNMENT_ID}/stats"))
            db_total, db_submitted, db_review = map(int, sql(f'''WITH target_enrollments AS (
              SELECT DISTINCT e.id FROM "AssignmentTarget" t JOIN "Enrollment" e
                ON e."schoolId"=t."schoolId" AND (e."classId"=t."classId" OR e.id=t."enrollmentId")
              WHERE t."schoolId"='{SCHOOL_ID}' AND t."assignmentId"='{ASSIGNMENT_ID}'
                AND e.role='STUDENT' AND e.status='ACTIVE'
                AND ((t."targetType"='CLASS' AND e."classId"=t."classId') OR
                     (t."targetType"='STUDENT' AND e.id=t."enrollmentId'))
            ), latest_submissions AS (
              SELECT DISTINCT ON (s."enrollmentId") s."enrollmentId", s.status
              FROM "Submission" s JOIN target_enrollments e ON e.id=s."enrollmentId"
              WHERE s."schoolId"='{SCHOOL_ID}' AND s."assignmentId"='{ASSIGNMENT_ID}' AND s."deletedAt" IS NULL
              ORDER BY s."enrollmentId", s."attemptNo" DESC
            )
            SELECT (SELECT count(*) FROM target_enrollments),
              count(*) FILTER (WHERE status IN ('SUBMITTED','PROCESSING','NEEDS_REVIEW','REVIEWED','RETURNED','ACCEPTED')),
              count(*) FILTER (WHERE status='NEEDS_REVIEW') FROM latest_submissions;''').split("|"))
            assert stats["totalStudents"] == db_total
            assert stats["submittedCount"] == db_submitted
            assert stats["needsReviewCount"] == db_review

            # Teacher B is in the same school but has no target-class authorization.
            assert api_get(request, teacher_b, f"assignments/{ASSIGNMENT_ID}").status in {403, 404}
            assert api_get(request, teacher_b, f"assignments/{ASSIGNMENT_ID}/submissions").status in {403, 404}
            # A different-class student cannot read the real submission.
            student_response = request.get(
                f"{BASE}/api/v1/schools/{SCHOOL_ID}/submissions/{SUBMISSION_ID}",
                headers={"Authorization": f"Bearer {student_other}"},
            )
            assert student_response.status in {403, 404}

            # The old design pages explicitly route to the canonical business page.
            legacy = request.get(f"{BASE}/teacher/assessments/detail/?assignmentId={ASSIGNMENT_ID}", max_redirects=0)
            assert legacy.status == 308
            assert legacy.headers["location"] == f"/teacher/assignments/?assignmentId={ASSIGNMENT_ID}"

            ui_login(page, TEACHER_A)
            page.goto(f"{BASE}/teacher/assignments/?assignmentId={ASSIGNMENT_ID}")
            assignment_row = page.locator(f".row[data-id='{ASSIGNMENT_ID}']")
            expect(assignment_row).to_contain_text(TASK_TITLE)
            expect(assignment_row).to_contain_text(f"{stats['submittedCount']} / {stats['totalStudents']} 人已提交")
            expect(page.locator(".row.expanded")).to_contain_text(TASK_TITLE)
            expect(page.locator(".assignment-roster")).to_contain_text(STUDENT_NAME)
            expect(page.locator(".assignment-roster")).to_contain_text(CLASS_LABEL)
            expect(page.locator(".assignment-roster")).to_contain_text("待复核")
            queue = body(api_get(request, teacher_a, "assessment-reviews"))
            linked_review = next((item for item in queue.get("items", [])
                                  if item.get("assignmentId") == ASSIGNMENT_ID
                                  and item.get("submissionId") == SUBMISSION_ID), None)
            if linked_review:
                review_link = page.locator(f".assignment-roster a[href='/teacher/reviews/{linked_review['itemId']}']")
                expect(review_link).to_be_visible()
                review_link.click()
                expect(page).to_have_url(f"{BASE}/teacher/reviews/{linked_review['itemId']}")
                page.goto(f"{BASE}/teacher/assignments/?assignmentId={ASSIGNMENT_ID}")
            submission_link = page.locator(f".assignment-roster a[href='/teacher/submissions/{SUBMISSION_ID}']")
            expect(submission_link).to_be_visible()
            submission_link.click()
            expect(page).to_have_url(f"{BASE}/teacher/submissions/{SUBMISSION_ID}")
            expect(page.locator("#submitStatus")).to_contain_text("待复核")

            page.goto(f"{BASE}/teacher/assignments/?assignmentId={ASSIGNMENT_ID}")
            page.locator("#assignmentSearch").fill(TASK_TITLE)
            page.wait_for_timeout(400)
            expect(page.locator(f".row[data-id='{ASSIGNMENT_ID}']")).to_be_visible()
            page.locator("#assignmentClassFilter").select_option(CLASS_ID)
            page.locator("#assignmentStatusFilter").select_option(os.environ["YZ_T007_ASSIGNMENT_STATUS"])
            page.locator("#assignmentDueFrom").fill(os.environ["YZ_T007_DUE_FROM"])
            page.locator("#assignmentDueTo").fill(os.environ["YZ_T007_DUE_TO"])
            page.wait_for_timeout(300)
            expect(page.locator(f".row[data-id='{ASSIGNMENT_ID}']")).to_be_visible()
            page.set_viewport_size({"width": 1280, "height": 900})
            assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")

            # Empty and recoverable error states are derived from live API results.
            ui_login(page, TEACHER_EMPTY)
            page.goto(f"{BASE}/teacher/assignments/")
            expect(page.locator(".empty-row")).to_contain_text("暂无教学任务")
            ui_login(page, TEACHER_A)
            failed = {"once": False}

            def abort_assignment_list(route):
                if not failed["once"] and "/assignments?" in route.request.url:
                    failed["once"] = True
                    route.abort()
                else:
                    route.continue_()

            page.route("**/api/v1/schools/*/assignments*", abort_assignment_list)
            page.goto(f"{BASE}/teacher/assignments/")
            expect(page.locator(".empty-row")).to_contain_text("重新加载")
            page.unroute("**/api/v1/schools/*/assignments*", abort_assignment_list)
            page.locator("#reloadAssignments").click()
            expect(page.locator(".row[data-id]").first).to_be_visible()

            # Real DRAFT → SCHEDULED → OPEN controls ignore a rapid duplicate click.
            page.goto(f"{BASE}/teacher/assignments/")
            expect(page.locator(".row[data-id]").first).to_be_visible()
            page.locator(".new").click()
            page.locator('#taskForm input[name="title"]').fill("TEST_FIXTURE_ONLY T007 双击状态转换")
            page.locator('#taskForm select[name="classId"]').select_option(CLASS_ID)
            page.locator(".save").click()
            task_row = page.locator(".row[data-id]").filter(has_text="TEST_FIXTURE_ONLY T007 双击状态转换")
            expect(task_row).to_be_visible()
            created_assignment_id = task_row.get_attribute("data-id")
            task_row.click()
            schedule_button = page.locator('[data-transition="schedule"]')
            schedule_button.evaluate("button => { button.click(); button.click(); }")
            expect(page.locator(f".row[data-id='{created_assignment_id}']")).to_contain_text("已排期")
            assert len([url for url in schedule_requests if f"/assignments/{created_assignment_id}/schedule" in url]) == 1
            created_task_row = page.locator(f".row[data-id='{created_assignment_id}']")
            created_task_row.click()
            page.locator('[data-transition="open"]').click()
            expect(page.locator(f".row[data-id='{created_assignment_id}']")).to_contain_text("已发布")
        finally:
            context.close()
            browser.close()
            request.dispose()
