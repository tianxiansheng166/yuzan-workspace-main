"""Native Chromium/API/PostgreSQL acceptance for the T032 teacher CSV export."""

from __future__ import annotations

import csv
import importlib.util
import io
import json
import os
import re
import secrets
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse
from zoneinfo import ZoneInfo

try:
    import pytest
    from playwright.sync_api import expect, sync_playwright
except ModuleNotFoundError:
    # The native runner itself can use the host Python; pytest/Playwright are
    # imported by the task's pinned test venv when this file is collected.
    pytest = None
    expect = None
    sync_playwright = None


ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ.get("YZ_T032_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T032_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T032_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T032_EVIDENCE_DIR", ROOT / "evidence" / "yz-rd-t032"))
TEACHER_TEMPLATE_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T032 native API/PostgreSQL/Chromium runtime",
) if pytest else None


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def pg_env() -> dict[str, str]:
    parsed = urlparse(DATABASE_URL)
    return {
        **os.environ,
        "PGHOST": parsed.hostname or "",
        "PGPORT": str(parsed.port or ""),
        "PGUSER": parsed.username or "",
        "PGPASSWORD": unquote(parsed.password or ""),
        "PGDATABASE": parsed.path.lstrip("/"),
    }


def sql(statement: str) -> str:
    parsed = urlparse(DATABASE_URL)
    assert urlparse(BASE).hostname == "127.0.0.1"
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"] == "yz_t032"
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"] == "yuzan_t032_native"
    password = unquote(parsed.password or "")
    assert password and password == os.environ["POSTGRES_PASSWORD"]
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t"],
        input=statement,
        text=True,
        capture_output=True,
        env=pg_env(),
        check=False,
    )
    if result.returncode:
        raise RuntimeError("T032 PostgreSQL verification query failed: " + result.stderr.replace(password, "<redacted>")[-1200:])
    return result.stdout.strip()


def sql_json(statement: str):
    value = sql(statement)
    return json.loads(value) if value else None


def verify_runtime_identity() -> dict[str, str]:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();")
    name, user, version = identity.split("|", 2)
    if (name, user) != ("yuzan_t032_native", "yz_t032") or not version.startswith("PostgreSQL 17."):
        raise AssertionError("Chromium E2E is not connected to the task-owned PostgreSQL 17 database/user")
    return {"name": name, "user": user, "version": "PostgreSQL 17"}


def seed_fixture() -> dict[str, object]:
    suffix = uuid.uuid4().hex[:10]
    keys = (
        "school", "school_other", "term", "term_b", "term_x", "class_main", "class_empty", "class_b", "class_x",
        "teacher_c", "teacher_b", "teacher_x", "student_formula", "student_tab", "student_at",
        "teacher_enrollment", "teacher_empty_enrollment", "teacher_b_enrollment", "teacher_x_enrollment",
        "enrollment_formula", "enrollment_tab", "enrollment_at", "course", "course_version", "unit", "lesson",
        "activity_one", "activity_two", "assignment_one", "assignment_two", "submission_one", "submission_two",
        "assessment_formula", "assessment_tab", "assessment_at", "report_formula", "report_at",
    )
    ids = {key: str(uuid.uuid4()) for key in keys}
    logins = {
        "teacher_c": f"teacher.t032.c.{suffix}@test.invalid",
        "teacher_b": f"teacher.t032.b.{suffix}@test.invalid",
        "teacher_x": f"teacher.t032.x.{suffix}@test.invalid",
        "student_formula": f"student.t032.formula.{suffix}@test.invalid",
        "student_tab": f"student.t032.tab.{suffix}@test.invalid",
        "student_at": f"student.t032.at.{suffix}@test.invalid",
    }
    names = {
        "student_formula": '=HYPERLINK("https://example.invalid","བོད,学生")',
        "student_tab": "\t=1+1\r\n第二行，学生",
        "student_at": "@SUM(1,1) 多语言学生",
    }
    sql_rows: list[str] = [
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
            VALUES ({q(ids['school'])},{q('YZ-T032-'+suffix)},{q('TEST_FIXTURE_ONLY T032 测试学校 '+suffix)},'TEST',NOW(),NOW());''',
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
            VALUES ({q(ids['school_other'])},{q('YZ-T032-X-'+suffix)},{q('TEST_FIXTURE_ONLY T032 跨校测试 '+suffix)},'TEST',NOW(),NOW());''',
    ]
    for key, login in logins.items():
        template = TEACHER_TEMPLATE_ID if key.startswith("teacher_") else STUDENT_TEMPLATE_ID
        sql_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
                SELECT {q(ids[key])},{q(login)},{q(names.get(key, 'TEST_FIXTURE_ONLY T032 '+key+' '+suffix))},"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(template)};'''
        )
    for key, role, school_key in (
        ("teacher_c", "TEACHER", "school"), ("teacher_b", "TEACHER", "school"), ("teacher_x", "TEACHER", "school_other"),
        ("student_formula", "STUDENT", "school"), ("student_tab", "STUDENT", "school"), ("student_at", "STUDENT", "school"),
    ):
        sql_rows.append(
            f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
                VALUES ({q(str(uuid.uuid4()))},{q(ids[school_key])},{q(ids[key])},{q(role)},'ACTIVE',NOW());'''
        )
    for key, school_key, label in (
        ("term", "school", "主班学期"), ("term_b", "school", "乙教师学期"), ("term_x", "school_other", "跨校学期"),
    ):
        sql_rows.append(
            f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
                VALUES ({q(ids[key])},{q(ids[school_key])},{q('TEST_FIXTURE_ONLY T032 '+label+' '+suffix)},'2026-01-01','2036-12-31',true,NOW());'''
        )
    for key, school_key, term_key, label in (
        ("class_main", "school", "term", "教师丙主班"), ("class_empty", "school", "term", "教师丙空班"),
        ("class_b", "school", "term_b", "教师乙班"), ("class_x", "school_other", "term_x", "跨校教师班"),
    ):
        sql_rows.append(
            f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
                VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[term_key])},{q('TEST_FIXTURE_ONLY T032 '+label+' '+suffix)},'七年级',NOW(),NOW());'''
        )
    for enrollment_key, school_key, class_key, user_key in (
        ("teacher_enrollment", "school", "class_main", "teacher_c"),
        ("teacher_empty_enrollment", "school", "class_empty", "teacher_c"),
        ("teacher_b_enrollment", "school", "class_b", "teacher_b"),
        ("teacher_x_enrollment", "school_other", "class_x", "teacher_x"),
        ("enrollment_formula", "school", "class_main", "student_formula"),
        ("enrollment_tab", "school", "class_main", "student_tab"),
        ("enrollment_at", "school", "class_main", "student_at"),
    ):
        role = "TEACHER" if enrollment_key.startswith("teacher_") else "STUDENT"
        sql_rows.append(
            f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
                VALUES ({q(ids[enrollment_key])},{q(ids[school_key])},{q(ids[class_key])},{q(ids[user_key])},{q(role)},'ACTIVE',NOW());'''
        )

    sql_rows.extend([
        f'''INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
            VALUES ({q(ids['course'])},{q(ids['school'])},{q(ids['teacher_c'])},{q('t032-'+suffix)},{q('TEST_FIXTURE_ONLY T032 班级课程')},NOW(),NOW());''',
        f'''INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,"publishedAt","createdAt","updatedAt")
            VALUES ({q(ids['course_version'])},{q(ids['school'])},{q(ids['course'])},1,'PUBLISHED',{q('TEST_FIXTURE_ONLY T032 班级课程')},NOW(),NOW(),NOW());''',
        f'''INSERT INTO "Unit" (id,"courseVersionId",title,"sortOrder") VALUES ({q(ids['unit'])},{q(ids['course_version'])},'TEST_FIXTURE_ONLY T032 单元',1);''',
        f'''INSERT INTO "Lesson" (id,"unitId",title,"sortOrder") VALUES ({q(ids['lesson'])},{q(ids['unit'])},'TEST_FIXTURE_ONLY T032 课时',1);''',
        f'''INSERT INTO "LearningActivity" (id,"lessonId",type,title,"sortOrder") VALUES
            ({q(ids['activity_one'])},{q(ids['lesson'])},'TEXT','TEST_FIXTURE_ONLY T032 活动一',1),
            ({q(ids['activity_two'])},{q(ids['lesson'])},'TEXT','TEST_FIXTURE_ONLY T032 活动二',2);''',
    ])
    for key, label in (("assignment_one", "任务一"), ("assignment_two", "任务二")):
        sql_rows.append(
            f'''INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt","createdAt","updatedAt")
                VALUES ({q(ids[key])},{q(ids['school'])},{q(ids['course_version'])},{q(ids['teacher_c'])},{q('TEST_FIXTURE_ONLY T032 '+label)},'OPEN',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',NOW(),NOW(),NOW());'''
        )
        sql_rows.append(
            f'''INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","enrollmentId","createdAt")
                VALUES ({q(str(uuid.uuid4()))},{q(ids['school'])},{q(ids[key])},'CLASS',{q(ids['class_main'])},NULL,NOW());'''
        )
    for submission_key, assignment_key, enrollment_key in (
        ("submission_one", "assignment_one", "enrollment_formula"),
        ("submission_two", "assignment_two", "enrollment_tab"),
    ):
        sql_rows.append(
            f'''INSERT INTO "Submission" (id,"schoolId","assignmentId","enrollmentId","attemptNo",status,"idempotencyKey","submittedAt","createdAt","updatedAt")
                VALUES ({q(ids[submission_key])},{q(ids['school'])},{q(ids[assignment_key])},{q(ids[enrollment_key])},1,'SUBMITTED',{q('t032-'+submission_key+'-'+suffix)},NOW(),NOW(),NOW());'''
        )
    for enrollment_key, activity_key, completed, age_days in (
        ("enrollment_formula", "activity_one", True, 0), ("enrollment_formula", "activity_two", True, 0),
        ("enrollment_tab", "activity_one", False, 10), ("enrollment_tab", "activity_two", False, 10),
    ):
        sql_rows.append(
            f'''INSERT INTO "ActivityProgress" (id,"schoolId","activityId","enrollmentId",position,completed,revision,"updatedAt")
                VALUES ({q(str(uuid.uuid4()))},{q(ids['school'])},{q(ids[activity_key])},{q(ids[enrollment_key])},1,{str(completed).lower()},1,NOW()-INTERVAL '{age_days} days');'''
        )
    for session_key, enrollment_key, status, score, report_key in (
        ("assessment_formula", "enrollment_formula", "COMPLETED", 0, "report_formula"),
        ("assessment_tab", "enrollment_tab", "COMPLETED", None, None),
        ("assessment_at", "enrollment_at", "COMPLETED", 86, "report_at"),
    ):
        sql_rows.append(
            f'''INSERT INTO "AssessmentSession" (id,"schoolId","enrollmentId","classId","initiatorUserId",type,purpose,status,"completedAt","createdAt","updatedAt")
                VALUES ({q(ids[session_key])},{q(ids['school'])},{q(ids[enrollment_key])},{q(ids['class_main'])},{q(ids['teacher_c'])},'MIXED','STANDARD',{q(status)},NOW(),NOW(),NOW());'''
        )
        if report_key:
            sql_rows.append(
                f'''INSERT INTO "AssessmentReport" (id,"sessionId","schoolId","overallScore","dataCompleteness","generatedAt","createdAt","updatedAt")
                    VALUES ({q(ids[report_key])},{q(ids[session_key])},{q(ids['school'])},{'NULL' if score is None else str(score)},1,NOW(),NOW(),NOW());'''
            )

    sql("BEGIN;\n" + "\n".join(sql_rows) + "\nCOMMIT;")
    if sql(f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(ids['school'])} AND "classId"={q(ids['class_main'])} AND role='STUDENT' AND status='ACTIVE';''') != "3":
        raise AssertionError("T032 Teacher C fixture does not have exactly three ACTIVE student enrollments")
    ids.update(logins=logins, names=names, suffix=suffix, class_name=f"TEST_FIXTURE_ONLY T032 教师丙主班 {suffix}", empty_class_name=f"TEST_FIXTURE_ONLY T032 教师丙空班 {suffix}")
    return ids


def api_call(path: str, *, token: str | None = None, method: str = "GET", body: dict[str, object] | None = None) -> tuple[int, object]:
    from urllib.error import HTTPError
    from urllib.request import ProxyHandler, Request, build_opener

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(
        f"{BASE}/api/v1{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=headers,
        method=method,
    )
    opener = build_opener(ProxyHandler({}))
    try:
        with opener.open(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        try:
            return error.code, json.loads(error.read().decode("utf-8"))
        except Exception:
            return error.code, {}


def data_payload(value):
    if isinstance(value, dict) and "data" in value:
        return value["data"]
    return value


def login_api(identifier: str) -> dict[str, object]:
    status, response = api_call("/auth/login", method="POST", body={"identifier": identifier, "password": PASSWORD})
    if status != 200:
        raise AssertionError(f"TEST_FIXTURE_ONLY T032 login failed: HTTP {status}")
    payload = data_payload(response)
    if not isinstance(payload, dict) or not payload.get("accessToken"):
        raise AssertionError("T032 fixture login did not return an access token")
    return payload


def sql_expected_roster(class_id: str, school_id: str) -> list[dict[str, object]]:
    statement = f'''
      WITH active_roster AS (
        SELECT e.id AS enrollment_id,e."schoolId" AS school_id,e."classId" AS class_id,u."displayName" AS display_name
        FROM "Enrollment" e JOIN "User" u ON u.id=e."userId"
        WHERE e."schoolId"={q(school_id)} AND e."classId"={q(class_id)} AND e.role='STUDENT' AND e.status='ACTIVE'
      ), per_student AS (
        SELECT r.*,
          p.progress_total,p.progress_completed,p.last_active,
          t.assignment_total,t.assignment_submitted,
          a.latest_status,a.formal_score,
          CASE WHEN p.last_active IS NULL OR p.last_active < NOW()-INTERVAL '14 days' THEN 'INACTIVE'
               WHEN p.last_active < NOW()-INTERVAL '7 days' THEN 'AT_RISK' ELSE 'OK' END AS risk_status
        FROM active_roster r
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS progress_total,
            count(*) FILTER (WHERE ap.completed)::int AS progress_completed,
            max(ap."updatedAt") AS last_active
          FROM "ActivityProgress" ap WHERE ap."schoolId"=r.school_id AND ap."enrollmentId"=r.enrollment_id
        ) p
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS assignment_total,
            count(*) FILTER (WHERE assigned.is_submitted)::int AS assignment_submitted
          FROM (
            SELECT aa.id, EXISTS (
              SELECT 1 FROM "Submission" s
              WHERE s."schoolId"=r.school_id AND s."assignmentId"=aa.id AND s."enrollmentId"=r.enrollment_id
                AND s."deletedAt" IS NULL AND s.status IN ('SUBMITTED','PROCESSING','NEEDS_REVIEW','REVIEWED','RETURNED','ACCEPTED')
            ) AS is_submitted
            FROM "Assignment" aa
            WHERE aa."schoolId"=r.school_id AND aa."deletedAt" IS NULL
              AND EXISTS (
                SELECT 1 FROM "AssignmentTarget" at
                WHERE at."schoolId"=r.school_id AND at."assignmentId"=aa.id
                  AND ((at."targetType"='CLASS' AND at."classId"=r.class_id)
                    OR (at."targetType"='STUDENT' AND at."enrollmentId"=r.enrollment_id))
              )
          ) assigned
        ) t
        LEFT JOIN LATERAL (
          SELECT s.status AS latest_status,
            CASE WHEN s.status='COMPLETED' AND ar."generatedAt" IS NOT NULL THEN ar."overallScore" ELSE NULL END AS formal_score
          FROM "AssessmentSession" s LEFT JOIN "AssessmentReport" ar ON ar."sessionId"=s.id
          WHERE s."schoolId"=r.school_id AND s."classId"=r.class_id AND s."enrollmentId"=r.enrollment_id
          ORDER BY s."createdAt" DESC LIMIT 1
        ) a ON true
      )
      SELECT COALESCE(json_agg(json_build_object(
        'enrollmentId',enrollment_id,'displayName',display_name,
        'courseProgress',CASE WHEN progress_total>0 THEN round(progress_completed*100.0/progress_total)::int ELSE NULL END,
        'submittedAssignmentCount',assignment_submitted,
        'missingAssignmentCount',GREATEST(0,assignment_total-assignment_submitted),
        'latestAssessmentScore',formal_score,'riskStatus',risk_status,'lastActiveAt',last_active
      ) ORDER BY enrollment_id)::text,'[]')
      FROM per_student;
    '''
    result = sql_json(statement)
    return result if isinstance(result, list) else []


def parse_csv_bytes(raw: bytes) -> tuple[list[str], list[list[str]]]:
    if not raw.startswith(b"\xef\xbb\xbf"):
        raise AssertionError("CSV download is missing the UTF-8 BOM")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline="")))
    if not rows:
        raise AssertionError("CSV download has no header")
    return rows[0], rows[1:]


def parse_database_timestamp(value: object) -> datetime:
    raw = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        parsed = None
        for pattern in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                parsed = datetime.strptime(raw, pattern)
                break
            except ValueError:
                pass
        if parsed is None:
            raise
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(ZoneInfo("Asia/Shanghai"))


def read_download(download) -> tuple[str, bytes]:
    path = download.path()
    if not path:
        raise AssertionError("Chromium download event did not provide a completed file")
    return download.suggested_filename, Path(path).read_bytes()


def click_and_download(page, locator, confirmation_messages: list[str], *, key: bool = False, duplicate: bool = False) -> tuple[str, bytes]:
    page.once("dialog", lambda dialog: (confirmation_messages.append(dialog.message), dialog.accept()))
    with page.expect_download(timeout=20_000) as download_info:
        if key:
            locator.focus()
            locator.press("Enter")
        else:
            locator.click()
            if duplicate:
                locator.evaluate("button => button.click()")
    return read_download(download_info.value)


def compare_csv_with_sql(raw: bytes, class_name: str, expected_rows: list[dict[str, object]]) -> dict[str, object]:
    headers, rows = parse_csv_bytes(raw)
    expected_headers = [
        "姓名", "班级", "课程进度（无数据为—）", "Submission已完成数", "Submission未交数",
        "最近正式分", "风险", "最近活跃",
    ]
    if headers != expected_headers:
        raise AssertionError("CSV columns do not match the T032 field contract")
    if len(rows) != len(expected_rows):
        raise AssertionError(f"CSV row count {len(rows)} does not match PostgreSQL active enrollment count {len(expected_rows)}")
    expected_by_name = {row["displayName"]: row for row in expected_rows}
    seen: set[str] = set()
    risk_labels = {"OK": "正常", "AT_RISK": "关注", "INACTIVE": "不活跃"}
    for row in rows:
        if len(row) != len(headers):
            raise AssertionError("CSV row has a different number of columns than its RFC 4180 header")
        display_name, class_value, progress, submitted, missing, score, risk, active = row
        source_name = display_name[1:] if display_name.startswith("'") else display_name
        expected = expected_by_name.get(source_name)
        if expected is None or source_name in seen:
            raise AssertionError("CSV contains a name that is missing from or duplicated in the PostgreSQL roster join")
        seen.add(source_name)
        if class_value != class_name:
            raise AssertionError("CSV class name does not match the authorized class dashboard")
        expected_progress = "—" if expected["courseProgress"] is None else f"{expected['courseProgress']}%"
        if progress != expected_progress:
            raise AssertionError("CSV course progress does not match PostgreSQL ActivityProgress rows")
        if submitted != str(expected["submittedAssignmentCount"]) or missing != str(expected["missingAssignmentCount"]):
            raise AssertionError("CSV Submission counts do not match PostgreSQL Assignment/Target/Submission joins")
        expected_score = "" if expected["latestAssessmentScore"] is None else str(expected["latestAssessmentScore"])
        if score != expected_score:
            raise AssertionError("CSV score does not preserve the latest formal AssessmentReport null/zero value")
        if risk != risk_labels[expected["riskStatus"]]:
            raise AssertionError("CSV risk value does not match the activity age derived by PostgreSQL")
        if expected["lastActiveAt"] is None:
            if active:
                raise AssertionError("CSV supplied a recent-active timestamp when PostgreSQL has none")
        else:
            # Prisma maps these DateTime columns to PostgreSQL timestamp
            # without time zone and serializes their stored UTC instant as ISO UTC.
            timestamp = parse_database_timestamp(expected["lastActiveAt"])
            csv_timestamp = datetime.strptime(active, "%Y/%m/%d %H:%M").replace(tzinfo=ZoneInfo("Asia/Shanghai"))
            if abs((csv_timestamp - timestamp).total_seconds()) >= 60:
                raise AssertionError(f"CSV local activity time differs from PostgreSQL updatedAt: {active} vs {timestamp.strftime('%Y/%m/%d %H:%M')}")
        if display_name and display_name[0] in "=+-@\t\r":
            raise AssertionError("CSV contains a formula-like value without a text marker")
    return {"headerColumns": len(headers), "studentRows": len(rows), "sqlRows": len(expected_rows), "parity": "PASS"}


def test_t032_authorized_teacher_downloads_live_csv_and_isolated_scope_negatives():
    assert BASE.startswith("http://127.0.0.1:")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    database = verify_runtime_identity()
    fixture = seed_fixture()
    teacher_session = login_api(fixture["logins"]["teacher_c"])
    teacher_b_session = login_api(fixture["logins"]["teacher_b"])
    teacher_x_session = login_api(fixture["logins"]["teacher_x"])
    school_id = str(fixture["school"])
    class_id = str(fixture["class_main"])
    class_name = str(fixture["class_name"])
    roster_path = f"/schools/{school_id}/classes/{class_id}/student-summaries"
    dashboard_status, dashboard_response = api_call(f"/schools/{school_id}/classes/{class_id}/dashboard", token=str(teacher_session["accessToken"]))
    dashboard = data_payload(dashboard_response)
    assert dashboard_status == 200 and dashboard["classId"] == class_id and dashboard["className"] == class_name
    summaries_status, summaries_response = api_call(roster_path, token=str(teacher_session["accessToken"]))
    summaries = data_payload(summaries_response)
    if summaries_status != 200 or not isinstance(summaries, list) or len(summaries) != 3:
        raise AssertionError("T032 student-summaries endpoint did not return the full active roster as an unpaginated array")
    expected_rows = sql_expected_roster(class_id, school_id)
    if len(expected_rows) != 3:
        raise AssertionError("PostgreSQL student-summaries join did not find exactly three authorized active enrollments")

    negative_statuses = {}
    negative_statuses["teacher_b_other_class"] = api_call(roster_path, token=str(teacher_b_session["accessToken"]))[0]
    negative_statuses["cross_school"] = api_call(roster_path, token=str(teacher_x_session["accessToken"]))[0]
    negative_statuses["anonymous"] = api_call(roster_path)[0]
    negative_statuses["missing_class"] = api_call(f"/schools/{school_id}/classes/{uuid.uuid4()}/student-summaries", token=str(teacher_session["accessToken"]))[0]
    negative_statuses["teacher_b_expected_by_card"] = 403
    if negative_statuses["cross_school"] != 403 or negative_statuses["anonymous"] != 401 or negative_statuses["missing_class"] != 404:
        raise AssertionError(f"T032 API negative-control statuses differ from the task card: {negative_statuses}")

    api_events: list[dict[str, object]] = []
    downloads: list[str] = []
    browser_download_events: list[str] = []
    page_errors: list[str] = []
    confirmation_messages: list[str] = []
    evidence: dict[str, object] = {
        "database": database,
        "schoolId": school_id,
        "classId": class_id,
        "className": "[TEST_FIXTURE_ONLY 班级名已脱敏]",
        "activeStudentEnrollmentCount": 3,
        "studentNames": "[三条 TEST_FIXTURE_ONLY 学生姓名已脱敏]",
        "apiStatuses": {"dashboard": dashboard_status, "studentSummaries": summaries_status, **negative_statuses},
        "studentSummariesArrayLength": len(summaries),
        "studentSummariesPagination": "raw array; controller/service define no cursor, total, or limit",
        "browserActions": [],
        "downloadEvents": downloads,
        "apiEvents": api_events,
        "responsive": [],
        "pageErrors": page_errors,
        "confirmationCount": 0,
        "sqlParity": [],
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce", timezone_id="Asia/Shanghai", accept_downloads=True)
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(type(error).__name__))
        page.on("download", lambda download: browser_download_events.append(download.suggested_filename))

        def record_response(response):
            if urlparse(response.url).path.endswith("/student-summaries"):
                event = {"method": response.request.method, "status": response.status}
                api_events.append(event)

        page.on("response", record_response)
        page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
        page.locator("#loginAccount").fill(fixture["logins"]["teacher_c"])
        page.locator("#loginPassword").fill(PASSWORD)
        page.locator('#loginPanel button[type="submit"]').click()
        page.wait_for_url(re.compile(r".*/teacher/?$"), timeout=45_000)
        browser_session = page.evaluate("""() => ({ token: localStorage.getItem('yuzan-access-token') || '', schoolId: localStorage.getItem('yuzan-active-school-id') || '', user: JSON.parse(localStorage.getItem('yuzan-current-user') || 'null') })""")
        if not browser_session["token"] or browser_session["schoolId"] != school_id:
            raise AssertionError("Teacher C browser login did not select the authorized T032 school")

        page.goto(f"{BASE}/teacher/classes/{class_id}?schoolId={school_id}", wait_until="domcontentloaded")
        page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(3, timeout=20_000)
        expect(page.locator("#rosterExportStatus")).to_have_attribute("aria-live", "polite")
        export_button = page.locator(".roster-export-button")
        expect(export_button).to_have_attribute("aria-label", "导出名单/学情CSV")

        download_name, first_raw = click_and_download(page, export_button, confirmation_messages)
        if "学生" in download_name or fixture["names"]["student_formula"] in download_name:
            raise AssertionError("Downloaded filename contains a student name")
        first_parity = compare_csv_with_sql(first_raw, class_name, expected_rows)
        evidence["sqlParity"].append(first_parity)
        downloads.append(download_name)
        evidence["browserActions"].append("Teacher C clicked the class detail roster CSV button; Chromium emitted a download event")
        evidence["confirmationCount"] = len(confirmation_messages)
        if len(confirmation_messages) != 1 or "3 名在读学生" not in confirmation_messages[0] or fixture["names"]["student_formula"] in confirmation_messages[0]:
            raise AssertionError("Personal-data confirmation did not describe the count and categories without exposing student names")

        parsed_headers, parsed_rows = parse_csv_bytes(first_raw)
        enrollment_ids = {str(item["enrollmentId"]) for item in summaries}
        if any(identifier in first_raw.decode("utf-8-sig") for identifier in enrollment_ids):
            raise AssertionError("CSV leaked an internal Enrollment ID")
        if parsed_headers[0] != "姓名" or len(parsed_rows) != 3:
            raise AssertionError("Independent Python CSV parser did not recover the expected header/row count")
        for item in parsed_rows:
            if item[0] and item[0][0] in "=+-@\t\r":
                raise AssertionError("Formula injection guard failed for a downloaded student name")
        name_to_row = {row[0][1:] if row[0].startswith("'") else row[0]: row for row in parsed_rows}
        if name_to_row[fixture["names"]["student_formula"]][5] != "0":
            raise AssertionError("Explicit formal score zero did not survive CSV export")
        if name_to_row[fixture["names"]["student_tab"]][5] != "":
            raise AssertionError("Missing formal score was converted to zero instead of an empty CSV cell")
        if name_to_row[fixture["names"]["student_at"]][2] != "—":
            raise AssertionError("Missing course progress did not use the documented em dash")

        export_responses_before_repeat = len(api_events)
        repeated_name, repeated_raw = click_and_download(page, export_button, confirmation_messages, duplicate=True)
        export_responses_after_repeat = len(api_events)
        if repeated_raw != first_raw:
            raise AssertionError("Repeated download with unchanged data did not reproduce the same CSV content")
        if export_responses_after_repeat - export_responses_before_repeat != 1:
            raise AssertionError("Rapid duplicate activation produced more than one fresh student-summaries request")
        downloads.append(repeated_name)
        evidence["browserActions"].append("Repeated download produced byte-identical CSV from the same server rows")
        evidence["sqlParity"].append(compare_csv_with_sql(repeated_raw, class_name, expected_rows))

        # A real PostgreSQL mutation must be visible in the next download.
        sql(f'''UPDATE "ActivityProgress" SET completed=true,"updatedAt"=NOW()
                WHERE "schoolId"={q(school_id)} AND "enrollmentId"={q(fixture['enrollment_tab'])}
                  AND "activityId"={q(fixture['activity_two'])};''')
        changed_expected_rows = sql_expected_roster(class_id, school_id)
        changed_name, changed_raw = click_and_download(page, export_button, confirmation_messages)
        downloads.append(changed_name)
        changed_parity = compare_csv_with_sql(changed_raw, class_name, changed_expected_rows)
        evidence["sqlParity"].append(changed_parity)
        changed_rows = parse_csv_bytes(changed_raw)[1]
        changed_by_name = {row[0][1:] if row[0].startswith("'") else row[0]: row for row in changed_rows}
        if changed_by_name[fixture["names"]["student_tab"]][2] != "50%" or changed_raw == first_raw:
            raise AssertionError("A changed PostgreSQL ActivityProgress row did not change the next fresh download")
        evidence["browserActions"].append("Changed one real ActivityProgress row; next download showed 50% rather than the prior 0%")

        # Keyboard activation exercises the same download path and the polite live region.
        keyboard_name, keyboard_raw = click_and_download(page, export_button, confirmation_messages, key=True)
        downloads.append(keyboard_name)
        if keyboard_raw != changed_raw:
            raise AssertionError("Keyboard activation exported data different from the current authorized server rows")
        evidence["browserActions"].append("Keyboard Enter activated the focused export button")

        viewport_results = []
        for width, height in ((390, 844), (768, 900), (1280, 900), (1440, 1000)):
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("window.scrollTo(0,0)")
            page.wait_for_timeout(80)
            state = page.evaluate("""() => {
              const wrap = document.querySelector('.roster-table-wrap');
              const button = document.querySelector('.roster-export-button');
              const rect = button.getBoundingClientRect();
              button.focus({focusVisible:true});
              return {
                width: innerWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                rosterClientWidth: wrap.clientWidth,
                rosterScrollWidth: wrap.scrollWidth,
                buttonRight: rect.right,
                buttonVisible: rect.width > 0 && rect.height > 0,
                focused: document.activeElement === button,
                focusVisible: button.matches(':focus-visible'),
                liveRole: document.querySelector('#rosterExportStatus').getAttribute('role'),
                liveMode: document.querySelector('#rosterExportStatus').getAttribute('aria-live'),
                reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
              };
            }""")
            if state["documentScrollWidth"] > width + 1 or state["rosterScrollWidth"] > state["rosterClientWidth"] + 1:
                raise AssertionError(f"Class detail or roster needs horizontal scrolling at {width}px")
            if not state["buttonVisible"] or state["buttonRight"] > width + 1 or not state["focused"] or not state["focusVisible"]:
                raise AssertionError(f"Export button is not visible/focusable within {width}px")
            if state["liveRole"] != "status" or state["liveMode"] != "polite" or not state["reducedMotion"]:
                raise AssertionError(f"Export status or reduced-motion accessibility regressed at {width}px")
            screenshot = EVIDENCE_DIR / f"roster-export-{width}.png"
            page.screenshot(path=str(screenshot))
            viewport_results.append({"width": width, "height": height, "documentScrollWidth": state["documentScrollWidth"], "rosterScrollWidth": state["rosterScrollWidth"], "keyboardFocusVisible": True, "ariaLive": "polite", "reducedMotion": True, "screenshot": screenshot.name})
        evidence["responsive"] = viewport_results

        # Each failure must stay download-free; a later retry must make a new GET.
        route_pattern = f"**/api/v1/schools/{school_id}/classes/{class_id}/student-summaries"
        ui_failures: list[dict[str, object]] = []

        def assert_ui_failure(label: str, *, status: int | None = None, abort: bool = False) -> None:
            before = len(browser_download_events)
            if abort:
                page.route(route_pattern, lambda route: route.abort())
            else:
                body = json.dumps({"message": f"TEST_FIXTURE_ONLY T032 {label}"})
                page.route(route_pattern, lambda route: route.fulfill(status=status or 500, content_type="application/json", body=body))
            export_button.click()
            page.wait_for_function("document.querySelector('#rosterExportStatus').textContent.startsWith('导出失败、重试')", timeout=8_000)
            page.wait_for_timeout(120)
            if len(browser_download_events) != before:
                raise AssertionError(f"{label} failure triggered a stale or unauthorized download")
            page.unroute(route_pattern)
            if status == 401:
                page.evaluate("""session => {
                  localStorage.setItem('yuzan-access-token', session.token);
                  localStorage.setItem('yuzan-active-school-id', session.schoolId);
                  localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
                }""", browser_session)
            ui_failures.append({"case": label, "status": status, "downloadEvents": 0, "retryMessage": True})

        assert_ui_failure("unauthorized", status=401)
        assert_ui_failure("forbidden", status=403)
        assert_ui_failure("missing-class", status=404)
        assert_ui_failure("server-error", status=500)
        assert_ui_failure("network-failure", abort=True)

        # Exercise the real 15-second AbortController timeout with a delayed route.
        before_timeout_downloads = len(browser_download_events)

        def delayed_timeout_response(route):
            time.sleep(16)
            try:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": summaries}))
            except Exception:
                pass

        page.route(route_pattern, delayed_timeout_response)
        export_button.click()
        page.wait_for_function("document.querySelector('#rosterExportStatus').textContent.includes('读取超时')", timeout=19_000)
        page.unroute(route_pattern)
        if len(browser_download_events) != before_timeout_downloads:
            raise AssertionError("Timed-out request triggered a download")
        ui_failures.append({"case": "request-timeout", "timeoutMs": 15000, "downloadEvents": 0, "retryMessage": True})

        retry_name, retry_raw = click_and_download(page, export_button, confirmation_messages)
        downloads.append(retry_name)
        if retry_raw != changed_raw:
            raise AssertionError("Retry after 401/403/404/500/network/timeout did not download the current server response")
        evidence["uiFailureAndRetry"] = {"failures": ui_failures, "realRetry": "PASS", "oldDataDownload": False}

        # Resolve a delayed old response after the login/school identity changes.
        before_stale_downloads = len(browser_download_events)
        page.evaluate("""payload => {
          const original = window.YuzanApi.request.bind(window.YuzanApi);
          window.__t032HoldNext = true;
          window.YuzanApi.request = (path, options) => {
            if (window.__t032HoldNext && path.endsWith('/student-summaries')) {
              window.__t032HoldNext = false;
              return new Promise(resolve => { window.__t032Release = () => resolve(payload); });
            }
            return original(path, options);
          };
        }""", summaries)
        export_button.click()
        page.wait_for_function("typeof window.__t032Release === 'function'", timeout=5_000)
        page.evaluate("""() => {
          localStorage.setItem('yuzan-access-token', 'TEST_FIXTURE_ONLY switched-account-token');
          localStorage.setItem('yuzan-active-school-id', 'TEST_FIXTURE_ONLY switched-school');
          localStorage.setItem('yuzan-current-user', JSON.stringify({id:'TEST_FIXTURE_ONLY switched-user'}));
          window.__t032Release();
        }""")
        page.wait_for_function("document.querySelector('#rosterExportStatus').textContent.includes('账号或学校已切换')", timeout=5_000)
        if len(browser_download_events) != before_stale_downloads:
            raise AssertionError("A late response from the old login/school produced a CSV download")
        evidence["staleIdentity"] = {"lateResponseDiscarded": True, "oldRosterCleared": True, "downloadEvents": 0}
        page.evaluate("""session => {
          localStorage.setItem('yuzan-access-token', session.token);
          localStorage.setItem('yuzan-active-school-id', session.schoolId);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
        }""", browser_session)
        page.goto(f"{BASE}/teacher/classes/{class_id}?schoolId={school_id}", wait_until="domcontentloaded")
        page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(3, timeout=20_000)

        # The authorized empty class is header-only and still uses the live GET.
        empty_class_id = str(fixture["class_empty"])
        page.goto(f"{BASE}/teacher/classes/{empty_class_id}?schoolId={school_id}", wait_until="domcontentloaded")
        page.get_by_role("heading", name=str(fixture["empty_class_name"])).wait_for(timeout=20_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(0, timeout=15_000)
        empty_name, empty_raw = click_and_download(page, page.locator(".roster-export-button"), confirmation_messages)
        empty_headers, empty_rows = parse_csv_bytes(empty_raw)
        if empty_rows or empty_headers != parsed_headers or "学生" in empty_name:
            raise AssertionError("Authorized empty class did not export header-only CSV")
        downloads.append(empty_name)
        evidence["emptyClass"] = {"dashboardStudentCount": 0, "csvDataRows": 0, "headerColumns": len(empty_headers), "result": "PASS"}

        if page_errors:
            raise AssertionError(f"Chromium page errors occurred: {page_errors}")
        browser.close()

    evidence["downloadEvents"] = [{"filenameContainsStudentName": False, "csvBytes": "omitted", "rows": 3} for _ in downloads[:-1]] + [{"filenameContainsStudentName": False, "csvBytes": "omitted", "rows": 0}]
    evidence["browserDownloadEventCount"] = len(downloads)
    evidence["confirmationCount"] = len(confirmation_messages)
    evidence["unpaginatedSqlParity"] = "PASS: three CSV rows match three ACTIVE STUDENT Enrollment joins"
    evidence["formulaCells"] = "all downloaded dangerous prefixes are stored as apostrophe-prefixed plain text; sample names omitted"
    evidence["testFixtureOnly"] = True

    redacted_sample = io.StringIO(newline="")
    writer = csv.writer(redacted_sample, lineterminator="\n")
    writer.writerow(parsed_headers)
    sample = parsed_rows[0]
    writer.writerow(["[脱敏学生姓名]", "[脱敏班级]", sample[2], sample[3], sample[4], sample[5], sample[6], sample[7]])
    (EVIDENCE_DIR / "csv-sample-redacted.csv").write_text(redacted_sample.getvalue(), encoding="utf-8-sig", newline="")
    (EVIDENCE_DIR / "t032-browser-database-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# Native runner lives in this task-scoped E2E file so the implementation stays
# within the task card's permitted source/test/evidence paths.
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t032"
SHARED_TOOLCHAIN_ROOT = ROOT.parent / "yuzan-workspace-main" / "runtime-local" / "native-web"
DATABASE_NAME = "yuzan_t032_native"
DATABASE_USER = "yz_t032"
BUCKET = "yz-t032-native"
PORTS = {
    "API_PORT": "4132",
    "PORT": "4332",
    "POSTGRES_PORT": "55832",
    "REDIS_PORT": "6472",
    "MINIO_API_PORT": "59272",
    "MINIO_CONSOLE_PORT": "59273",
}


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t032", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure_task("T014", shared_runtime_root=SHARED_TOOLCHAIN_ROOT)
    module.TASK_ID = "T032"
    module.RUNTIME = RUNTIME_DIR
    module.CONFIG_FILE = RUNTIME_DIR / ".env.local"
    module.STATE = RUNTIME_DIR / "state"
    module.LOGS = RUNTIME_DIR / "logs"
    module.PGDATA = RUNTIME_DIR / "postgres-data"
    module.REDIS_DATA = RUNTIME_DIR / "redis-data"
    module.MINIO_DATA = RUNTIME_DIR / "minio-data"
    module.EVIDENCE = RUNTIME_DIR / "evidence"
    module.TASK_BIN = RUNTIME_DIR / "bin"
    module.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    return module


def parse_config(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_runtime_config(runtime) -> None:
    if runtime.CONFIG_FILE.is_file():
        os.chmod(runtime.CONFIG_FILE, 0o600)
        existing = parse_config(runtime.CONFIG_FILE)
        expected = {**PORTS, "POSTGRES_DB": DATABASE_NAME, "POSTGRES_USER": DATABASE_USER, "S3_BUCKET": BUCKET}
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T032 runtime config does not match its task-owned database/bucket/ports")
        runtime.load_config()
        return
    database_password = secrets.token_urlsafe(36)
    s3_secret = secrets.token_urlsafe(36)
    values = {
        "NODE_ENV": "development", "API_HOST": "127.0.0.1", "API_PORT": PORTS["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{PORTS['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DATABASE_USER}:{database_password}@127.0.0.1:{PORTS['POSTGRES_PORT']}/{DATABASE_NAME}?schema=public",
        "POSTGRES_USER": DATABASE_USER, "POSTGRES_PASSWORD": database_password,
        "POSTGRES_DB": DATABASE_NAME, "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
        "REDIS_HOST": "127.0.0.1", "REDIS_PORT": PORTS["REDIS_PORT"], "REDIS_PASSWORD": secrets.token_urlsafe(36),
        "SESSION_SECRET": secrets.token_urlsafe(56), "WEB_HOST": "127.0.0.1", "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}",
        "PORT": PORTS["PORT"], "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}", "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET, "S3_ACCESS_KEY": "yz_t032_local", "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t032_local", "S3_SECRET_ACCESS_KEY": s3_secret, "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"], "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t032:worker:heartbeat", "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60", "SPEECH_PROVIDER": "disabled", "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(runtime.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T032 native test runtime. Do not commit.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    runtime.load_config()


def verify_runtime_tools(runtime) -> None:
    pnpm = runtime.command_path("pnpm")
    if not pnpm or runtime.command_version(pnpm, ["--version"]) != "10.13.1":
        raise RuntimeError("T032 requires the pinned pnpm 10.13.1 toolchain")
    node_version = subprocess.run([str(runtime.node_binary()), "--version"], check=True, capture_output=True, text=True).stdout.strip()
    if not node_version.startswith("v24."):
        raise RuntimeError("T032 requires Node 24")
    print(f"T032 toolchain: Node {node_version}; pnpm 10.13.1; PostgreSQL 17; Redis 7; MinIO; Chromium")


def verify_or_migrate_database(runtime, config: dict[str, str], env: dict[str, str]) -> bool:
    probe = runtime.run_output(
        [str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-c", "SELECT current_database() || '|' || current_user || '|' || version() || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;"],
        env=runtime.db_env(config), timeout=15,
    )
    if probe.returncode:
        raise RuntimeError("Cannot verify the isolated T032 PostgreSQL database")
    values = probe.stdout.strip().split("|", 3)
    if len(values) != 4 or values[:2] != [DATABASE_NAME, DATABASE_USER] or not values[2].startswith("PostgreSQL 17."):
        raise RuntimeError("T032 PostgreSQL identity/version does not match its dedicated database")
    if values[3] == "0":
        return True
    migration_count = sum(path.is_dir() for path in (ROOT / "infra/database/prisma/migrations").iterdir())
    ledger = runtime.run_output(
        [str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-F", "|", "-c", 'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text,count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM "_prisma_migrations";'],
        env=runtime.db_env(config), timeout=15,
    )
    if ledger.returncode or ledger.stdout.strip() != f"{migration_count}|0":
        raise RuntimeError("T032 database has incomplete or missing migration evidence; preserving it")
    print(f"T032 PostgreSQL: retained database with {migration_count} completed migrations; no reseed")
    return False


def prepare_bucket(runtime, env: dict[str, str]) -> None:
    script = r'''const path=require("node:path");const{createRequire}=require("node:module");const r=createRequire(path.resolve(process.cwd(),"backend/api/package.json"));const{CreateBucketCommand,HeadBucketCommand,S3Client}=r("@aws-sdk/client-s3");const c=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});(async()=>{try{await c.send(new HeadBucketCommand({Bucket:process.env.S3_BUCKET}))}catch{await c.send(new CreateBucketCommand({Bucket:process.env.S3_BUCKET}))}finally{c.destroy()}})().catch(e=>{process.stderr.write(`${e.name||"MINIO_BUCKET_FAILED"}\n`);process.exitCode=1});'''
    result = runtime.run_output([str(runtime.node_binary()), "-e", script], env=env, cwd=ROOT, timeout=45)
    if result.returncode:
        raise RuntimeError("T032-owned MinIO bucket initialization failed: " + runtime.safe_text(result.stderr[-1200:], runtime.load_config()))


def run_native_test(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, int | None]:
    python = runtime.TEST_PYTHON
    if not python.is_file() or not Path(__file__).is_file():
        raise RuntimeError("Pinned T032 pytest/Playwright environment is unavailable")
    test_env = {
        **env,
        "YZ_T032_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T032_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T032_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T032_EVIDENCE_DIR": str(EVIDENCE_DIR),
        "POSTGRES_USER": config["POSTGRES_USER"], "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_DB": config["POSTGRES_DB"], "POSTGRES_PORT": config["POSTGRES_PORT"],
        "PATH": f"{runtime.PG_BIN}{os.pathsep}{runtime.TASK_BIN}{os.pathsep}{env.get('PATH','')}",
    }
    process = subprocess.Popen(
        [str(python), "-m", "pytest", "-q", "-s", str(Path(__file__))],
        cwd=ROOT, env=test_env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, start_new_session=True,
    )
    runtime.record_for_pid("test", process.pid, str(Path(__file__)), pgid=process.pid)
    output, _ = process.communicate()
    config_secrets = {config.get("POSTGRES_PASSWORD", ""), config.get("REDIS_PASSWORD", ""), config.get("S3_SECRET_KEY", ""), config.get("E2E_TEST_PASSWORD", "")}
    for secret in config_secrets:
        if secret:
            output = output.replace(secret, "<redacted>")
    print(output)
    return process.returncode or 0, process.pid


def write_native_runtime_evidence(runtime, config: dict[str, str], service_pids: dict[str, int], test_pid: int | None, status: int) -> None:
    ports = {}
    for name, key in (("postgres", "POSTGRES_PORT"), ("api", "API_PORT"), ("web", "PORT"), ("redis", "REDIS_PORT"), ("minio-api", "MINIO_API_PORT"), ("minio-console", "MINIO_CONSOLE_PORT")):
        port = int(config[key])
        ports[name] = {"port": port, "stopped": not bool(runtime.port_listener_pids(port))}
    stopped = status == 0 and all(record["stopped"] for record in ports.values())
    evidence = {
        "task": "YZ-RD-T032", "database": DATABASE_NAME, "databaseUser": DATABASE_USER,
        "servicePidsBeforeStop": service_pids, "chromiumPytestPid": test_pid,
        "chromiumPytestExited": bool(test_pid), "portsAfterStop": ports,
        "stopPass": stopped, "worker": "NOT_STARTED", "dockerCompose": "NOT_USED",
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "native-runtime-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_native_runtime() -> int:
    runtime = load_runtime_module()
    created: list[str] = []
    result_code = 1
    test_pid = None
    try:
        write_runtime_config(runtime)
        config = runtime.load_config()
        runtime.ensure_dirs()
        verify_runtime_tools(runtime)
        env = runtime.runtime_env(config)
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        runtime.start_postgres(config, env, created)
        fresh_database = verify_or_migrate_database(runtime, config, env)
        runtime.start_redis(config, env, created)
        runtime.start_minio(config, env, created)
        prepare_bucket(runtime, env)
        pnpm = runtime.command_path("pnpm")
        if not pnpm:
            raise RuntimeError("Pinned pnpm wrapper is unavailable")
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        if fresh_database:
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)
            seed_env = {**env, "P0_BOOTSTRAP_ONLY": "true"}
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "seed"], env=seed_env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "build"], env=env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)
        runtime.start_web_api(config, env, created)
        ready = runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5)
        if ready != 200:
            raise RuntimeError(f"T032 API readiness failed with HTTP {ready}")
        result_code, test_pid = run_native_test(runtime, config, env)
    except Exception as error:
        config = runtime.load_config(required=False)
        detail = runtime.safe_text(str(error), config)
        print(f"T032 native runtime: FAIL — {detail}")
        result_code = 1
    finally:
        service_pids = {}
        for name in ("postgres", "api", "web", "redis", "minio"):
            record = runtime.read_record(name)
            if record:
                service_pids[name] = int(record.get("pid", -1))
        stop_status = runtime.stop_all()
        if stop_status != 0:
            time.sleep(1)
            stop_status = runtime.stop_all()
        status = runtime.status()
        if stop_status != 0 or status != 0:
            result_code = 1
        config = runtime.load_config(required=False)
        if config:
            for key in PORTS:
                port = int(config[key])
                if runtime.port_listener_pids(port):
                    print(f"T032 cleanup: owned port {key}={port} still has a listener")
                    result_code = 1
            write_native_runtime_evidence(runtime, config, service_pids, test_pid, stop_status if status == 0 else status)
        print("T032 cleanup: only T032-owned processes stopped; database, bucket and evidence retained; no Worker/Docker/Compose used")
    return result_code


if __name__ == "__main__":
    raise SystemExit(run_native_runtime())
