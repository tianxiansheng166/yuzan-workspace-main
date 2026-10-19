"""Native Chromium/API/PostgreSQL acceptance for YZ-RD-T037 Today pathways.

The imported report proof uses the existing app/API flow. All added identities,
course text and pending attempts are explicitly TEST_FIXTURE_ONLY data in the
isolated T037 database; they do not represent a pilot school or real student.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

import pytest
from playwright.sync_api import expect, sync_playwright

import test_yz_rd_t008_student_history as t008
import test_yz_rd_t011_web_review_feedback as t011
import test_yz_rd_t030_student_growth as t030


BASE = os.environ.get("YZ_T037_BASE_URL", "")
API_ROOT = os.environ.get("YZ_T037_API_BASE_URL", "")
API = f"{API_ROOT.rstrip('/')}/api/v1" if API_ROOT else ""
DATABASE_URL = os.environ.get("YZ_T037_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T037_PASSWORD", "")
DATABASE = os.environ.get("YZ_T037_DATABASE_NAME", "")
DB_ROLE = os.environ.get("YZ_T037_DATABASE_USER", "")
DB_PORT = int(os.environ.get("YZ_T037_POSTGRES_PORT", "0"))
PSQL = os.environ.get("YZ_T037_PSQL", "")
PG_LIBRARY = os.environ.get("YZ_T037_PG_LIBRARY", "")
CHROME = os.environ.get("YZ_T037_CHROMIUM", "/usr/bin/google-chrome")
EVIDENCE = Path(os.environ.get("YZ_T037_EVIDENCE_DIR", "/tmp/yz-rd-t037-evidence"))
UPSTREAM_EVIDENCE = Path(os.environ.get("YZ_T030_EVIDENCE_DIR", "/tmp/yz-rd-t037-upstream"))
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

pytestmark = pytest.mark.skipif(
    not BASE or not API or not DATABASE_URL or not PASSWORD or not PSQL,
    reason="requires the isolated T037 native Chromium/API/PostgreSQL runtime",
)


def payload(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == DB_PORT and parsed.username == DB_ROLE
    assert parsed.path.lstrip("/") == DATABASE and parsed.password
    import subprocess

    password = parsed.password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": DB_ROLE,
        "PGPASSWORD": password,
        "PGDATABASE": DATABASE,
        "LD_LIBRARY_PATH": os.pathsep.join(filter(None, [PG_LIBRARY, os.environ.get("LD_LIBRARY_PATH", "")])),
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
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    return result.stdout.strip() if capture else ""


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def verify_database() -> str:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();", capture=True)
    assert identity.startswith(f"{DATABASE}|{DB_ROLE}|PostgreSQL 17."), identity.split("|", 2)[:2]
    return identity.split("|", 2)[2].splitlines()[0]


def auth_headers(session: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['accessToken']}"}


def login_api(page, identifier: str) -> dict:
    response = page.request.post(
        f"{API}/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    return payload(response)


def login_in_browser(page, identifier: str) -> dict:
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_url(re.compile(r".*/student/today/?$"), timeout=20_000)
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null", timeout=10_000)
    return page.evaluate(
        """() => ({
          accessToken: localStorage.getItem('yuzan-access-token'),
          activeSchoolId: localStorage.getItem('yuzan-active-school-id'),
          user: JSON.parse(localStorage.getItem('yuzan-current-user') || '{}')
        })"""
    )


def open_today(page, *, ready: bool = True) -> dict:
    page.goto(f"{BASE}/student/today/", wait_until="domcontentloaded")
    page.wait_for_function("window.__studentTodayData !== undefined || document.querySelector('#todayApp[data-state=error]')", timeout=40_000)
    if ready:
        page.wait_for_function("document.querySelectorAll('.today-skill-card').length === 4", timeout=30_000)
    return page.evaluate("window.__studentTodayData || null")


def assert_no_horizontal_overflow(page, width: int) -> dict[str, int]:
    dimensions = page.evaluate(
        """() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })"""
    )
    assert max(dimensions["document"], dimensions["body"]) <= dimensions["viewport"] + 1, {"width": width, **dimensions}
    return dimensions


def add_test_course_activity(assignment_id: str) -> dict[str, str]:
    row = sql_rows(
        f'''SELECT a."courseVersionId",cv.title,a.status::text
              FROM "Assignment" a JOIN "CourseVersion" cv ON cv.id=a."courseVersionId"
             WHERE a.id={q(assignment_id)} AND a."schoolId"={q(SCHOOL_ID)};'''
    )
    assert len(row) == 1 and row[0][2] == "OPEN", row
    version_id, course_title = row[0][:2]
    ids = {key: str(uuid.uuid4()) for key in ("unit", "lesson", "activity")}
    activity_title = "TEST_FIXTURE_ONLY T037 课程正文验收段落"
    sql(
        f'''BEGIN;
        INSERT INTO "Unit" (id,"courseVersionId",title,"sortOrder")
          VALUES ({q(ids['unit'])},{q(version_id)},'TEST_FIXTURE_ONLY T037 学习单元',1);
        INSERT INTO "Lesson" (id,"unitId",title,"sortOrder")
          VALUES ({q(ids['lesson'])},{q(ids['unit'])},'TEST_FIXTURE_ONLY T037 学习课时',1);
        INSERT INTO "LearningActivity" (id,"lessonId",type,title,instruction,"sortOrder",required,"completionRule",content,"studentNotes")
          VALUES ({q(ids['activity'])},{q(ids['lesson'])},'TEXT',{q(activity_title)},
                  '{{"text":"TEST_FIXTURE_ONLY：阅读这一段课程内容。"}}'::jsonb,1,true,
                  '{{"type":"ACKNOWLEDGED"}}'::jsonb,
                  '{{"paragraphs":["TEST_FIXTURE_ONLY：这里是与授权课程版本绑定的数据库正文。"]}}'::jsonb,
                  '{{"title":"课程要点","items":["此段仅用于隔离验收。"],"source":"TEACHER_AUTHORED","published":true}}'::jsonb);
        COMMIT;'''
    )
    return {"assignmentId": assignment_id, "courseVersionId": version_id, "courseTitle": course_title, **ids, "activityTitle": activity_title}


def test_01_real_app_report_states_and_authorized_reviews():
    """Reuse the existing complete API/teacher-review flow for legal 0 and pending states."""
    verify_database()
    original_verifier = t030.verify_resource_identity

    def verify_t037_runtime():
        version = verify_database()
        assert urlparse(t030.S3_ENDPOINT).hostname == "127.0.0.1"
        assert t030.S3_BUCKET == os.environ["YZ_T037_S3_BUCKET"]

    t030.verify_resource_identity = verify_t037_runtime
    try:
        t030.test_growth_feedback_remediation_recovery_and_identity_isolation()
    finally:
        t030.verify_resource_identity = original_verifier

    source = json.loads((UPSTREAM_EVIDENCE / "native-evidence.json").read_text(encoding="utf-8"))
    zero = source["zeroScoreReport"]
    assert zero["allItemScoresZero"] is True
    assert zero["reportSQL"][2] == "0"
    assert source["processingWithoutReport"]["reportCountBeforeTeacherReview"] == 0
    assert source["apiNegativeStatuses"]["sameSchoolOtherStudentReport"] in (403, 404)
    assert source["apiNegativeStatuses"]["crossSchoolReport"] in (403, 404)
    result = {
        "source": "existing T030 student Runner + teacher review flow, run on isolated T037 native services",
        "databaseVersion": verify_database(),
        "testDataBoundary": "TEST_FIXTURE_ONLY identities and authored test course; no pilot/production student data",
        "processingBeforeReview": source["processingWithoutReport"],
        "zeroScoreFormalReport": zero,
        "studentA": source["identities"]["studentA"],
        "sameSchoolStudentB": source["identities"]["studentB"],
        "crossSchoolStudentC": source["identities"]["studentC"],
        "practiceDefinitionId": source["practiceDefinitionId"],
        "courseAssignmentId": source["courseFeedbackSource"]["assignmentId"],
        "isolationStatuses": source["apiNegativeStatuses"],
    }
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "report-state-proof.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def test_02_today_showcase_clicks_isolation_retry_and_four_viewports():
    assert verify_database().startswith("PostgreSQL 17.")
    proof = json.loads((EVIDENCE / "report-state-proof.json").read_text(encoding="utf-8"))
    source = json.loads((UPSTREAM_EVIDENCE / "native-evidence.json").read_text(encoding="utf-8"))
    course = add_test_course_activity(proof["courseAssignmentId"])
    showcase = t011.create_student_fixture("T037-showcase", CLASS_ID)
    showcase_user = showcase["user"]
    showcase_login = showcase["login"]
    showcase_enrollment = showcase["enrollment"]

    report_user_id = proof["studentA"]["userId"]
    report_login = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id={q(report_user_id)};''', capture=True)
    assert report_login
    student_b_login = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id={q(proof['sameSchoolStudentB']['userId'])};''', capture=True)
    student_c_login = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id={q(proof['crossSchoolStudentC']['userId'])};''', capture=True)
    zero_session_id = proof["zeroScoreFormalReport"]["sessionId"]
    zero_report_id = proof["zeroScoreFormalReport"]["reportSQL"][0]
    practice_id = proof["practiceDefinitionId"]
    assignment_id = course["assignmentId"]

    screenshots = EVIDENCE / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    browser_errors: list[str] = []
    responsive = {}
    click_proof = {}
    isolation = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["microphone"])
        page = context.new_page()
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        try:
            # A real login form with an active school/class, then all four dynamic Today cards.
            showcase_session = login_in_browser(page, showcase_login)
            assert showcase_session["activeSchoolId"] == SCHOOL_ID
            today = open_today(page)
            assert today["version"] == "student-today-v1"
            assert page.locator(".today-skill-card").count() == 4
            assert page.locator(".today-skill-listen").count() == 1
            assert page.locator(".today-skill-speak").count() == 1
            assert page.locator(".today-skill-exam").count() == 1
            assert page.locator(".today-skill-report").count() == 1
            assert today["primaryAction"]["kind"] == "BASELINE", today["primaryAction"]

            practice_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/practices?sort=RECOMMENDED", headers=auth_headers(showcase_session))
            assert practice_response.ok, practice_response.text()
            practice_catalog = payload(practice_response)["items"]
            recording_definition = next(item for item in practice_catalog if item.get("requiresRecording") is True)
            recording_href = page.locator(".today-skill-speak .today-skill-link").get_attribute("href")
            assert recording_href == f"/student/practices/{recording_definition['id']}/", recording_href
            assert recording_definition["title"] in page.locator(".today-skill-speak").inner_text()

            baseline_id = today["primaryAction"]["target"]["practiceDefinitionId"]
            baseline = next(item for item in practice_catalog if item["id"] == baseline_id)
            exam_href = page.locator(".today-skill-exam .today-skill-link").get_attribute("href")
            assert exam_href == f"/student/practices/{baseline_id}/", exam_href
            assert baseline_id == practice_id, {"todayBaseline": baseline_id, "reportPathPractice": practice_id}

            # A dynamic real Assignment, targeted to this student's class, opens Course Detail.
            course_list_response = page.request.get(f"{API}/schools/{SCHOOL_ID}/student/courses?limit=4", headers=auth_headers(showcase_session))
            assert course_list_response.ok, course_list_response.text()
            listed_courses = payload(course_list_response)["courses"]
            authorized_course = next(item for item in listed_courses if item["assignmentId"] == assignment_id)
            course_href = page.locator(".today-skill-listen .today-skill-link").get_attribute("href")
            assert course_href == f"/student/courses/course-detail/?id={assignment_id}", course_href
            course_detail_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/student/courses/{assignment_id}",
                headers=auth_headers(showcase_session),
            )
            assert course_detail_response.ok, course_detail_response.text()
            detail = payload(course_detail_response)
            activity = detail["units"][0]["lessons"][0]["activities"][0]
            assert activity["id"] == course["activity"] and activity["title"] == course["activityTitle"]
            page.locator(".today-skill-listen .today-skill-link").click()
            page.wait_for_url(f"**/student/courses/course-detail/?id={assignment_id}", timeout=20_000)
            page.locator("#cpMain").wait_for(state="visible", timeout=30_000)
            expect(page.locator("#cpHeroTitle")).to_contain_text(course["courseTitle"])
            expect(page.locator("body")).to_contain_text(course["activityTitle"])
            page.screenshot(path=str(screenshots / "authorized-course-detail-1440.png"), full_page=True)
            click_proof["course"] = {
                "assignmentId": assignment_id,
                "courseVersionId": course["courseVersionId"],
                "status": "OPEN",
                "authorizedEnrollmentId": showcase_enrollment,
                "activityId": course["activity"],
                "browserUrl": page.url,
                "apiStatus": course_detail_response.status,
            }

            # Each listening/practice and assessment card lands on its exact authorized definition.
            open_today(page)
            recording_detail = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/{recording_definition['id']}",
                headers=auth_headers(showcase_session),
            )
            assert recording_detail.ok, recording_detail.text()
            page.locator(".today-skill-speak .today-skill-link").click()
            page.wait_for_url(f"**/student/practices/{recording_definition['id']}/", timeout=20_000)
            expect(page.locator("body")).to_contain_text(recording_definition["title"])
            page.screenshot(path=str(screenshots / "recording-practice-definition-1440.png"), full_page=True)
            click_proof["recordingPractice"] = {
                "practiceDefinitionId": recording_definition["id"],
                "title": recording_definition["title"],
                "requiresRecording": recording_definition["requiresRecording"],
                "detailApiStatus": recording_detail.status,
                "browserUrl": page.url,
            }

            open_today(page)
            assessment_detail = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices/{baseline_id}",
                headers=auth_headers(showcase_session),
            )
            assert assessment_detail.ok, assessment_detail.text()
            page.locator(".today-skill-exam .today-skill-link").click()
            page.wait_for_url(f"**/student/practices/{baseline_id}/", timeout=20_000)
            expect(page.locator("body")).to_contain_text(baseline["title"])
            page.screenshot(path=str(screenshots / "authorized-assessment-definition-1440.png"), full_page=True)
            click_proof["assessmentEntry"] = {
                "practiceDefinitionId": baseline_id,
                "title": baseline["title"],
                "baselineAction": today["primaryAction"]["kind"],
                "detailApiStatus": assessment_detail.status,
                "browserUrl": page.url,
            }

            # Capture all requested widths from the same authenticated, DB-backed Today state.
            open_today(page)
            for width, height in ((390, 844), (768, 1024), (1280, 900), (1440, 1000)):
                page.set_viewport_size({"width": width, "height": height})
                page.wait_for_timeout(100)
                responsive[str(width)] = assert_no_horizontal_overflow(page, width)
                page.screenshot(path=str(screenshots / f"today-showcase-{width}.png"), full_page=True)
            assert [int(width) for width in responsive] == [390, 768, 1280, 1440]

            # An actual legal completed STANDARD report with 0 points remains visible as 0.
            report_session = login_api(page, report_login)
            page.goto(f"{BASE}/login/")
            page.evaluate(
                """session => {
                  localStorage.setItem('yuzan-access-token', session.accessToken);
                  localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
                  localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
                }""",
                report_session,
            )
            zero_report_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{zero_session_id}/report",
                headers=auth_headers(report_session),
            )
            assert zero_report_response.ok and payload(zero_report_response)["overallScore"] == 0
            zero_sql = sql_rows(
                f'''SELECT r.id,r."overallScore"::text,s.status::text,s.purpose::text,
                           (s."completedAt" IS NOT NULL)::text
                      FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId"
                     WHERE r."sessionId"={q(zero_session_id)};'''
            )
            assert zero_sql == [[zero_report_id, "0", "COMPLETED", "STANDARD", "true"]], zero_sql
            zero_today = open_today(page)
            latest_formal = zero_today["summary"]["latestFormalAssessment"]
            assert latest_formal and latest_formal["score"] == 0, latest_formal
            report_card = page.locator(".today-skill-report")
            expect(report_card).to_contain_text("最近正式成绩 0 分")
            expect(report_card.get_by_role("link")).to_have_attribute("href", "/student/growth/")
            page.screenshot(path=str(screenshots / "today-formal-zero-score-1440.png"), full_page=True)
            report_card.get_by_role("link").click()
            page.wait_for_url("**/student/growth/", timeout=20_000)
            page.locator("#growthApp[data-state='ready']").wait_for(timeout=30_000)
            zero_row = page.locator(f'.growth-report-row a[href="/assessment/sessions/{zero_session_id}/report/"]').locator("xpath=..")
            zero_row.wait_for(timeout=20_000)
            expect(zero_row).to_contain_text("0 分")
            click_proof["formalReport"] = {
                "reportId": zero_report_id,
                "sessionId": zero_session_id,
                "overallScore": 0,
                "sql": zero_sql[0],
                "apiStatus": zero_report_response.status,
                "growthHref": f"/assessment/sessions/{zero_session_id}/report/",
            }

            # Cross-student and cross-school attempts cannot read the course, definition or report.
            same_school_other = login_api(page, student_b_login)
            cross_school = login_api(page, student_c_login)
            for identity, label in ((same_school_other, "sameSchoolOtherStudent"), (cross_school, "crossSchoolStudent")):
                course_read = page.request.get(
                    f"{API}/schools/{SCHOOL_ID}/student/courses/{assignment_id}", headers=auth_headers(identity)
                )
                practice_read = page.request.get(
                    f"{API}/schools/{SCHOOL_ID}/practices/{baseline_id}", headers=auth_headers(identity)
                )
                report_read = page.request.get(
                    f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{zero_session_id}/report", headers=auth_headers(identity)
                )
                assert course_read.status in (403, 404), (label, course_read.status)
                assert practice_read.status in (403, 404), (label, practice_read.status)
                assert report_read.status in (403, 404), (label, report_read.status)
                isolation[label] = {
                    "courseStatus": course_read.status,
                    "practiceStatus": practice_read.status,
                    "reportStatus": report_read.status,
                }

            # With no completed report, a submitted but unreviewed session has no score/report entry.
            pending_user = t011.create_student_fixture("T037-pending", CLASS_ID)
            pending_session = login_in_browser(page, pending_user["login"])
            page.set_viewport_size({"width": 1280, "height": 900})
            pending_today = open_today(page)
            assert pending_today["primaryAction"]["kind"] == "BASELINE", pending_today["primaryAction"]
            pending_baseline_id = pending_today["primaryAction"]["target"]["practiceDefinitionId"]
            page.locator(".today-skill-exam .today-skill-link").click()
            page.wait_for_url(f"**/student/practices/{pending_baseline_id}/", timeout=20_000)
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            pending_session_id = page.url.split("/attempts/")[1].split("/")[0]
            page.locator(".question-shell").wait_for(timeout=20_000)
            pending_completion = t008.complete_real_attempt(
                page, auth_headers(pending_session), pending_session_id, base_url=BASE
            )
            assert pending_completion["itemCount"] == 20 and pending_completion["recordedAudio"] > 0
            session_state = sql_rows(
                f'''SELECT status::text,purpose::text FROM "AssessmentSession" WHERE id={q(pending_session_id)};'''
            )
            report_count = sql(
                f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"={q(pending_session_id)};''', capture=True
            )
            assert session_state == [["PROCESSING", "STANDARD"]], session_state
            assert report_count == "0", report_count

            # First Today API call fails, visible retry succeeds; refresh retains database state.
            injected = {"count": 0}

            def fail_first_today(route):
                if route.request.method == "GET" and route.request.url.endswith("/student/today") and injected["count"] == 0:
                    injected["count"] += 1
                    route.abort("internetdisconnected")
                else:
                    route.continue_()

            page.route("**/student/today", fail_first_today)
            page.goto(f"{BASE}/student/today/", wait_until="domcontentloaded")
            page.locator("#todayApp[data-state='error']").wait_for(timeout=20_000)
            expect(page.get_by_role("alert")).to_contain_text("网络连接失败")
            assert injected["count"] == 1
            page.unroute("**/student/today", fail_first_today)
            page.locator("[data-today-retry]").click()
            page.wait_for_function("document.querySelectorAll('.today-skill-card').length === 4", timeout=40_000)
            pending_after_retry = page.evaluate("window.__studentTodayData")
            assert pending_after_retry["summary"]["latestFormalAssessment"] is None
            expect(page.locator(".today-skill-report")).to_contain_text("不展示待审或缺失成绩")
            expect(page.locator(".today-skill-report .today-skill-link")).to_have_attribute("href", "/student/practices/history/")
            expect(page.locator(".today-pending-section")).to_contain_text("正在处理")
            assert "0 分" not in page.locator(".today-skill-report").inner_text()
            page.screenshot(path=str(screenshots / "today-pending-no-score-1280.png"), full_page=True)
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("document.querySelectorAll('.today-skill-card').length === 4", timeout=40_000)
            refreshed = page.evaluate("window.__studentTodayData")
            assert refreshed["summary"]["latestFormalAssessment"] is None
            assert sql(f'''SELECT count(*) FROM "AssessmentReport" WHERE "sessionId"={q(pending_session_id)};''', capture=True) == "0"
            isolation["freshStudentWithPendingReview"] = {
                "enrollmentId": pending_user["enrollment"],
                "sessionId": pending_session_id,
                "sessionSQL": session_state[0],
                "formalReportCount": 0,
                "latestFormalAssessment": None,
                "networkFailureCount": injected["count"],
                "retryCardsRendered": 4,
                "refreshRetainedNoReport": True,
                "recordedAudio": pending_completion["recordedAudio"],
                "recordingSource": "Chromium fake microphone (SIMULATED_MIC)",
            }
            assert browser_errors == [], browser_errors
        finally:
            browser.close()

    result = {
        "databaseVersion": verify_database(),
        "testDataBoundary": "TEST_FIXTURE_ONLY database identities/content; accepted authored Question Bank source files were imported read-only",
        "studentId": showcase_user,
        "authorizedCourse": click_proof.get("course"),
        "recordingPractice": click_proof.get("recordingPractice"),
        "assessmentEntry": click_proof.get("assessmentEntry"),
        "formalReport": click_proof.get("formalReport"),
        "isolation": isolation,
        "responsive": responsive,
        "browserErrors": browser_errors,
        "screenshots": [str(path.relative_to(EVIDENCE)) for path in sorted(screenshots.glob("*.png"))],
    }
    (EVIDENCE / "today-showcase-proof.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
