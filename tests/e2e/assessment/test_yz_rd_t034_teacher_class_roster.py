"""T034 real Chromium, NestJS API and PostgreSQL 17 roster acceptance."""

from __future__ import annotations

import csv
import io
import json
import os
import re
import secrets
import subprocess
import sys
import time
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import pytest
    from playwright.sync_api import expect, sync_playwright
except ModuleNotFoundError:
    pytest = None
    expect = None
    sync_playwright = None


ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ.get("YZ_T034_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T034_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T034_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T034_EVIDENCE_DIR", ROOT / "evidence" / "yz-rd-t034"))
EXPECTED_DATABASE_NAME = os.environ.get("YZ_T034_EXPECTED_DATABASE_NAME", "yuzan_t034_native")
EXPECTED_DATABASE_USER = os.environ.get("YZ_T034_EXPECTED_DATABASE_USER", "yz_t034")
TEACHER_TEMPLATE_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T034 native API/PostgreSQL/Chromium runtime",
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
    if urlparse(BASE).hostname != "127.0.0.1" or parsed.scheme != "postgresql" or parsed.hostname != "127.0.0.1":
        raise AssertionError("T034 test refuses a non-local or non-PostgreSQL target")
    if parsed.port != int(os.environ["POSTGRES_PORT"]):
        raise AssertionError("T034 database URL does not match the isolated PostgreSQL port")
    if parsed.username != EXPECTED_DATABASE_USER or parsed.path.lstrip("/") != EXPECTED_DATABASE_NAME:
        raise AssertionError("T034 database name/user does not match the task-owned database")
    if unquote(parsed.password or "") != os.environ["POSTGRES_PASSWORD"]:
        raise AssertionError("T034 database URL password differs from its private runtime config")
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t"],
        input=statement,
        text=True,
        capture_output=True,
        env=pg_env(),
        check=False,
    )
    if result.returncode:
        password = unquote(parsed.password or "")
        detail = result.stderr.replace(password, "<redacted>")[-1200:]
        raise RuntimeError("T034 PostgreSQL verification query failed: " + detail)
    return result.stdout.strip()


def sql_json(statement: str):
    value = sql(statement)
    return json.loads(value) if value else None


def verify_runtime_identity() -> dict[str, str]:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();")
    name, user, version = identity.split("|", 2)
    if (name, user) != (EXPECTED_DATABASE_NAME, EXPECTED_DATABASE_USER) or not version.startswith("PostgreSQL 17."):
        raise AssertionError("T034 E2E is not attached to its task-owned PostgreSQL 17 database/user")
    return {"name": name, "user": user, "version": "PostgreSQL 17"}


def seed_fixture() -> dict[str, object]:
    suffix = uuid.uuid4().hex[:10]
    ids: dict[str, object] = {}
    for key in (
        "school", "school_other", "term", "term_other", "class_main", "class_empty", "class_single",
        "class_other", "teacher_main", "teacher_other", "teacher_cross", "teacher_main_enrollment",
        "teacher_empty_enrollment", "teacher_single_enrollment", "teacher_other_enrollment",
        "teacher_cross_enrollment", "single_student", "single_enrollment", "course", "course_version",
        "unit", "lesson",
    ):
        ids[key] = str(uuid.uuid4())
    students = []
    for index in range(35):
        students.append({"id": str(uuid.uuid4()), "enrollmentId": str(uuid.uuid4()), "index": index})
    ids["students"] = students
    for index in range(100):
        ids.setdefault("activities", []).append(str(uuid.uuid4()))
    names = [f"T034学生{index + 1:02d}" for index in range(35)]
    names[0] = "T034同名学生"
    names[1] = "T034同名学生"
    names[2] = "T034བོད学生"
    names[3] = "T034零进度"
    names[4] = "T034无进度"
    names[25] = "T034目标甲"
    names[26] = "T034目标乙"
    names[27] = "T034目标丙"
    login_ids = {
        "teacher_main": f"teacher.t034.main.{suffix}@test.invalid",
        "teacher_other": f"teacher.t034.other.{suffix}@test.invalid",
        "teacher_cross": f"teacher.t034.cross.{suffix}@test.invalid",
        "single_student": f"student.t034.single.{suffix}@test.invalid",
    }
    for student in students:
        key = f"student_{student['index']:02d}"
        student["loginKey"] = key
        login_ids[key] = f"student.t034.{student['index']:02d}.{suffix}@test.invalid"
        student["displayName"] = names[student["index"]]
    ids["logins"] = login_ids
    ids["class_name"] = f"TEST_FIXTURE_ONLY T034 真实班级 {suffix}"
    ids["empty_class_name"] = f"TEST_FIXTURE_ONLY T034 空班 {suffix}"
    ids["single_class_name"] = f"TEST_FIXTURE_ONLY T034 单人班 {suffix}"
    ids["other_class_name"] = f"TEST_FIXTURE_ONLY T034 同校隔离班 {suffix}"
    sql_rows: list[str] = [
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
            VALUES ({q(ids['school'])},{q('YZ-T034-'+suffix)},{q('TEST_FIXTURE_ONLY T034 学校 '+suffix)},'TEST',NOW(),NOW());''',
        f'''INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt")
            VALUES ({q(ids['school_other'])},{q('YZ-T034-X-'+suffix)},{q('TEST_FIXTURE_ONLY T034 跨校 '+suffix)},'TEST',NOW(),NOW());''',
    ]
    user_specs = [(key, value, TEACHER_TEMPLATE_ID if key.startswith("teacher_") else STUDENT_TEMPLATE_ID)
                  for key, value in login_ids.items()]
    def user_id_for(key: str) -> str:
        if key in ids:
            return str(ids[key])
        return str(next(student["id"] for student in students if student["loginKey"] == key))

    for key, login, template in user_specs:
        display_name = {
            "teacher_main": f"TEST_FIXTURE_ONLY T034 教师甲 {suffix}",
            "teacher_other": f"TEST_FIXTURE_ONLY T034 教师乙 {suffix}",
            "teacher_cross": f"TEST_FIXTURE_ONLY T034 跨校教师 {suffix}",
            "single_student": f"TEST_FIXTURE_ONLY T034 单人学生 {suffix}",
        }.get(key)
        if key.startswith("student_"):
            student_index = int(key.rsplit("_", 1)[1])
            display_name = names[student_index]
        sql_rows.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
                SELECT {q(user_id_for(key))},
                       {q(login)},{q(display_name)} ,"passwordHash",'ACTIVE',NOW(),NOW()
                FROM "User" WHERE id={q(template)};'''
        )
    for key, role, school_key in [
        ("teacher_main", "TEACHER", "school"), ("teacher_other", "TEACHER", "school"),
        ("teacher_cross", "TEACHER", "school_other"), ("single_student", "STUDENT", "school"),
    ] + [(student["loginKey"], "STUDENT", "school") for student in students]:
        user_id = user_id_for(key)
        sql_rows.append(
            f'''INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
                VALUES ({q(str(uuid.uuid4()))},{q(ids[school_key])},{q(user_id)},{q(role)},'ACTIVE',NOW());'''
        )
    for key, school_key, name in (("term", "school", "主学期"), ("term_other", "school_other", "跨校学期")):
        sql_rows.append(
            f'''INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt")
                VALUES ({q(ids[key])},{q(ids[school_key])},{q('TEST_FIXTURE_ONLY T034 '+name+' '+suffix)},'2026-01-01','2036-12-31',true,NOW());'''
        )
    for key, school_key, term_key, label in (
        ("class_main", "school", "term", "真实班级"), ("class_empty", "school", "term", "空班"),
        ("class_single", "school", "term", "单人班"), ("class_other", "school", "term", "同校隔离班"),
        ("class_other_school", "school_other", "term_other", "跨校班级"),
    ):
        if key == "class_other_school":
            ids[key] = str(uuid.uuid4())
        sql_rows.append(
            f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
                VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[term_key])},{q('TEST_FIXTURE_ONLY T034 '+label+' '+suffix)},'七年级',NOW(),NOW());'''
        )
    for key, class_key, school_key in (
        ("teacher_main_enrollment", "class_main", "school"),
        ("teacher_empty_enrollment", "class_empty", "school"),
        ("teacher_single_enrollment", "class_single", "school"),
        ("teacher_other_enrollment", "class_other", "school"),
        ("teacher_cross_enrollment", "class_other_school", "school_other"),
    ):
        teacher_key = {"teacher_main_enrollment": "teacher_main", "teacher_empty_enrollment": "teacher_main",
                       "teacher_single_enrollment": "teacher_main", "teacher_other_enrollment": "teacher_other",
                       "teacher_cross_enrollment": "teacher_cross"}[key]
        sql_rows.append(
            f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
                VALUES ({q(ids[key])},{q(ids[school_key])},{q(ids[class_key])},{q(ids[teacher_key])},'TEACHER','ACTIVE',NOW());'''
        )
    sql_rows.append(
        f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
            VALUES ({q(ids['single_enrollment'])},{q(ids['school'])},{q(ids['class_single'])},{q(ids['single_student'])},'STUDENT','ACTIVE',NOW());'''
    )
    for student in students:
        sql_rows.append(
            f'''INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
                VALUES ({q(student['enrollmentId'])},{q(ids['school'])},{q(ids['class_main'])},{q(student['id'])},'STUDENT','ACTIVE',NOW());'''
        )
    sql_rows.extend([
        f'''INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
            VALUES ({q(ids['course'])},{q(ids['school'])},{q(ids['teacher_main'])},{q('t034-'+suffix)},{q('TEST_FIXTURE_ONLY T034 课程')},NOW(),NOW());''',
        f'''INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,"publishedAt","createdAt","updatedAt")
            VALUES ({q(ids['course_version'])},{q(ids['school'])},{q(ids['course'])},1,'PUBLISHED',{q('TEST_FIXTURE_ONLY T034 课程')},NOW(),NOW(),NOW());''',
        f'''INSERT INTO "Unit" (id,"courseVersionId",title,"sortOrder")
            VALUES ({q(ids['unit'])},{q(ids['course_version'])},{q('TEST_FIXTURE_ONLY T034 单元')},1);''',
        f'''INSERT INTO "Lesson" (id,"unitId",title,"sortOrder")
            VALUES ({q(ids['lesson'])},{q(ids['unit'])},{q('TEST_FIXTURE_ONLY T034 课时')},1);''',
    ])
    sql_rows.append(
        'INSERT INTO "LearningActivity" (id,"lessonId",type,title,"sortOrder") VALUES '
        + ",\n".join(
            f"({q(activity)},{q(ids['lesson'])},'TEXT',{q('TEST_FIXTURE_ONLY T034 活动 '+str(index + 1))},{index + 1})"
            for index, activity in enumerate(ids["activities"])
        ) + ";"
    )
    progress_rows: list[str] = []
    for student in students:
        index = int(student["index"])
        if index in (4, 33, 34):
            continue
        if index == 0:
            progress_percent = 100
        elif index == 1:
            progress_percent = 99
        elif index in (2, 3):
            progress_percent = 0
        else:
            progress_percent = 98 - (index - 4)
        if index <= 24:
            age = f"{index + 1} minutes"
        elif index <= 28:
            age = f"8 days {index - 24} hours"
        else:
            age = f"15 days {index - 28} hours"
        for activity_index, activity_id in enumerate(ids["activities"]):
            completed = "true" if activity_index < progress_percent else "false"
            progress_rows.append(
                f"({q(str(uuid.uuid4()))},{q(ids['school'])},{q(activity_id)},{q(student['enrollmentId'])},1,{completed},1,NOW()-INTERVAL {q(age)})"
            )
    sql_rows.append('INSERT INTO "ActivityProgress" (id,"schoolId","activityId","enrollmentId",position,completed,revision,"updatedAt") VALUES\n'
                    + ",\n".join(progress_rows) + ";")
    score_specs = ((0, 0), (1, None), (25, 0), (26, 84), (27, None))
    for index, score in score_specs:
        student = students[index]
        session_id = str(uuid.uuid4())
        sql_rows.append(
            f'''INSERT INTO "AssessmentSession" (id,"schoolId","enrollmentId","classId","initiatorUserId",type,purpose,status,"completedAt","createdAt","updatedAt")
                VALUES ({q(session_id)},{q(ids['school'])},{q(student['enrollmentId'])},{q(ids['class_main'])},{q(ids['teacher_main'])},'MIXED','STANDARD','COMPLETED',NOW(),NOW(),NOW());'''
        )
        if score is not None:
            sql_rows.append(
                f'''INSERT INTO "AssessmentReport" (id,"sessionId","schoolId","overallScore","dataCompleteness","generatedAt","createdAt","updatedAt")
                    VALUES ({q(str(uuid.uuid4()))},{q(session_id)},{q(ids['school'])},{score},1,NOW(),NOW(),NOW());'''
            )

    sql("BEGIN;\n" + "\n".join(sql_rows) + "\nCOMMIT;")
    count = sql(
        f'''SELECT count(*) FROM "Enrollment" WHERE "schoolId"={q(ids['school'])} AND "classId"={q(ids['class_main'])} AND role='STUDENT' AND status='ACTIVE';'''
    )
    if count != "35":
        raise AssertionError(f"T034 main class has {count} ACTIVE STUDENT enrollments, expected 35")
    ids["class_other_school_name"] = f"TEST_FIXTURE_ONLY T034 跨校班级 {suffix}"
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
        with opener.open(request, timeout=30) as response:
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
    payload = data_payload(response)
    if status != 200 or not isinstance(payload, dict) or not payload.get("accessToken"):
        raise AssertionError(f"TEST_FIXTURE_ONLY T034 login failed with HTTP {status}")
    return payload


def sql_expected_roster(class_id: str, school_id: str) -> list[dict[str, object]]:
    statement = f'''
      WITH active_roster AS (
        SELECT e.id AS enrollment_id,u."displayName" AS display_name
        FROM "Enrollment" e JOIN "User" u ON u.id=e."userId"
        WHERE e."schoolId"={q(school_id)} AND e."classId"={q(class_id)} AND e.role='STUDENT' AND e.status='ACTIVE'
      ), progress AS (
        SELECT ap."enrollmentId" AS enrollment_id,count(*)::int AS total,
          count(*) FILTER (WHERE ap.completed)::int AS completed,max(ap."updatedAt") AS last_active
        FROM "ActivityProgress" ap
        WHERE ap."schoolId"={q(school_id)} AND ap."enrollmentId" IN (SELECT enrollment_id FROM active_roster)
        GROUP BY ap."enrollmentId"
      ), assessment AS (
        SELECT DISTINCT ON (s."enrollmentId") s."enrollmentId" AS enrollment_id,s.status,
          CASE WHEN s.status='COMPLETED' AND ar."generatedAt" IS NOT NULL THEN ar."overallScore" ELSE NULL END AS formal_score
        FROM "AssessmentSession" s LEFT JOIN "AssessmentReport" ar ON ar."sessionId"=s.id
        WHERE s."schoolId"={q(school_id)} AND s."classId"={q(class_id)}
          AND s."enrollmentId" IN (SELECT enrollment_id FROM active_roster)
        ORDER BY s."enrollmentId",s."createdAt" DESC
      )
      SELECT COALESCE(json_agg(json_build_object(
        'enrollmentId',r.enrollment_id,'displayName',r.display_name,
        'courseProgress',CASE WHEN p.total>0 THEN round(p.completed*100.0/p.total)::int ELSE NULL END,
        'riskStatus',CASE WHEN p.last_active IS NULL OR p.last_active<NOW()-INTERVAL '14 days' THEN 'INACTIVE'
          WHEN p.last_active<NOW()-INTERVAL '7 days' THEN 'AT_RISK' ELSE 'OK' END,
        'lastActiveAt',p.last_active,'latestAssessmentScore',a.formal_score
      ) ORDER BY r.enrollment_id)::text,'[]')
      FROM active_roster r LEFT JOIN progress p ON p.enrollment_id=r.enrollment_id
        LEFT JOIN assessment a ON a.enrollment_id=r.enrollment_id;
    '''
    result = sql_json(statement)
    return result if isinstance(result, list) else []


def parse_csv_bytes(raw: bytes) -> tuple[list[str], list[list[str]]]:
    if not raw.startswith(b"\xef\xbb\xbf"):
        raise AssertionError("T034 CSV download is missing its UTF-8 BOM")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline="")))
    if not rows:
        raise AssertionError("T034 CSV download has no header")
    return rows[0], rows[1:]


def read_download(download) -> tuple[str, bytes]:
    path = download.path()
    if not path:
        raise AssertionError("Chromium download event did not produce a completed file")
    return download.suggested_filename, Path(path).read_bytes()


def click_and_download(page, button, confirmation_messages: list[str]) -> tuple[str, bytes]:
    page.once("dialog", lambda dialog: (confirmation_messages.append(dialog.message), dialog.accept()))
    with page.expect_download(timeout=25_000) as download_info:
        button.click()
    return read_download(download_info.value)


def compare_csv_with_sql(raw: bytes, class_name: str, expected_rows: list[dict[str, object]]) -> dict[str, object]:
    headers, rows = parse_csv_bytes(raw)
    expected_headers = [
        "姓名", "班级", "课程进度（无数据为—）", "Submission已完成数", "Submission未交数",
        "最近正式分", "风险", "最近活跃",
    ]
    if headers != expected_headers or len(rows) != len(expected_rows):
        raise AssertionError(f"T034 CSV headers/row count differ from the full SQL roster ({len(rows)} vs {len(expected_rows)})")
    expected_names = Counter(str(row["displayName"]) for row in expected_rows)
    actual_names = Counter(row[0][1:] if row[0].startswith("'") else row[0] for row in rows)
    if actual_names != expected_names:
        raise AssertionError("T034 CSV does not contain the complete authorized PostgreSQL roster name multiset")
    expected_fields = Counter(
        (
            str(row["displayName"]), class_name,
            "—" if row["courseProgress"] is None else f"{row['courseProgress']}%",
            "0", "0",
            "" if row["latestAssessmentScore"] is None else str(row["latestAssessmentScore"]),
            {"OK": "正常", "AT_RISK": "关注", "INACTIVE": "不活跃"}[str(row["riskStatus"])],
        )
        for row in expected_rows
    )
    actual_fields = Counter(
        (row[0][1:] if row[0].startswith("'") else row[0], row[1], row[2], row[3], row[4], row[5], row[6])
        for row in rows
    )
    if actual_fields != expected_fields:
        raise AssertionError("T034 CSV progress, formal score, or risk cells differ from PostgreSQL");
    if any(len(row) != len(headers) for row in rows):
        raise AssertionError("T034 CSV row shape differs from its RFC 4180 header")
    return {"headerColumns": len(headers), "csvDataRows": len(rows), "sqlActiveEnrollments": len(expected_rows), "rowParity": "PASS"}


def row_ids(page) -> list[str]:
    return page.locator("#rosterTable .roster-row:not(.header)").evaluate_all(
        "rows => rows.map(row => row.dataset.enrollmentId).filter(Boolean)"
    )


def test_t034_real_roster_filter_sort_detail_and_full_class_csv():
    if not BASE.startswith("http://127.0.0.1:"):
        raise AssertionError("T034 native E2E requires its own loopback Web runtime")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    database = verify_runtime_identity()
    fixture = seed_fixture()
    teacher_main = login_api(fixture["logins"]["teacher_main"])
    teacher_other = login_api(fixture["logins"]["teacher_other"])
    teacher_cross = login_api(fixture["logins"]["teacher_cross"])
    school_id = str(fixture["school"])
    class_id = str(fixture["class_main"])
    class_name = str(fixture["class_name"])
    roster_path = f"/schools/{school_id}/classes/{class_id}/student-summaries"
    dashboard_status, dashboard_response = api_call(f"/schools/{school_id}/classes/{class_id}/dashboard", token=str(teacher_main["accessToken"]))
    dashboard = data_payload(dashboard_response)
    if dashboard_status != 200 or dashboard.get("classId") != class_id or dashboard.get("className") != class_name:
        raise AssertionError("T034 teacher dashboard did not return its real authorized class")
    summary_status, summary_response = api_call(roster_path, token=str(teacher_main["accessToken"]))
    summaries = data_payload(summary_response)
    if summary_status != 200 or not isinstance(summaries, list) or len(summaries) != 35:
        raise AssertionError("T034 student-summaries did not return all 35 ACTIVE STUDENT enrollments")
    sql_rows = sql_expected_roster(class_id, school_id)
    if len(sql_rows) != 35:
        raise AssertionError("T034 independent PostgreSQL active Enrollment join did not return exactly 35 rows")
    sql_by_id = {str(item["enrollmentId"]): item for item in sql_rows}
    api_by_id = {str(item["enrollmentId"]): item for item in summaries}
    if set(api_by_id) != set(sql_by_id):
        raise AssertionError("T034 API and PostgreSQL active enrollment ID sets differ")
    for enrollment_id, actual in api_by_id.items():
        expected = sql_by_id[enrollment_id]
        for field in ("displayName", "courseProgress", "riskStatus", "latestAssessmentScore"):
            if actual.get(field) != expected.get(field):
                raise AssertionError(f"T034 API field {field} differs from PostgreSQL for one synthetic enrollment")
    duplicated_name_ids = [str(item["enrollmentId"]) for item in summaries if item.get("displayName") == "T034同名学生"]
    if len(duplicated_name_ids) != 2 or len(set(duplicated_name_ids)) != 2:
        raise AssertionError("T034 two same-name student records did not preserve distinct Enrollment IDs")
    at_risk_ids = {key for key, row in sql_by_id.items() if row["riskStatus"] == "AT_RISK"}
    ok_ids = {key for key, row in sql_by_id.items() if row["riskStatus"] == "OK"}
    scored_ids = {key for key, row in sql_by_id.items() if row["latestAssessmentScore"] is not None}
    no_score_ids = set(sql_by_id) - scored_ids
    if len(at_risk_ids) != 4 or len(scored_ids) != 3 or len(no_score_ids) != 32:
        raise AssertionError("T034 SQL fixture did not produce the expected verified risk and formal-score groups")
    if not any(row["latestAssessmentScore"] == 0 for row in sql_rows) or not any(row["latestAssessmentScore"] is None for row in sql_rows):
        raise AssertionError("T034 PostgreSQL fixture does not distinguish a real zero score from null")

    negatives = {
        "anonymous": api_call(roster_path)[0],
        "same_school_other_teacher": api_call(roster_path, token=str(teacher_other["accessToken"]))[0],
        "cross_school": api_call(roster_path, token=str(teacher_cross["accessToken"]))[0],
        "missing_class": api_call(f"/schools/{school_id}/classes/{uuid.uuid4()}/student-summaries", token=str(teacher_main["accessToken"]))[0],
    }
    if negatives != {"anonymous": 401, "same_school_other_teacher": 404, "cross_school": 403, "missing_class": 404}:
        raise AssertionError(f"T034 API authorization negatives differ from the frozen contract: {negatives}")

    event_log: list[dict[str, object]] = []
    browser_errors: list[str] = []
    browser_downloads: list[str] = []
    confirmation_messages: list[str] = []
    e2e: dict[str, object] = {
        "database": database,
        "schoolId": "[TEST_FIXTURE_ONLY omitted]",
        "classId": "[TEST_FIXTURE_ONLY omitted]",
        "activeStudentEnrollmentCount": len(sql_rows),
        "sameNameEnrollmentIdsDistinct": True,
        "apiSqlParity": {"studentRows": 35, "fields": ["displayName", "courseProgress", "riskStatus", "latestAssessmentScore"], "result": "PASS"},
        "sqlFilterCounts": {"AT_RISK": len(at_risk_ids), "SCORED": len(scored_ids), "NO_SCORE": len(no_score_ids)},
        "negativeApiStatuses": negatives,
        "browserApiEvents": event_log,
        "screenshots": [],
        "downloadRows": [],
        "pageErrors": browser_errors,
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000}, reduced_motion="reduce", timezone_id="Asia/Shanghai", accept_downloads=True,
        )
        page = context.new_page()
        page.on("pageerror", lambda error: browser_errors.append(type(error).__name__))
        page.on("download", lambda download: browser_downloads.append(download.suggested_filename))

        def record_response(response):
            path = urlparse(response.url).path
            if path.endswith("/student-summaries") or "/students/" in path:
                event_log.append({"pathKind": "student-summaries" if path.endswith("/student-summaries") else "student-detail", "method": response.request.method, "status": response.status})

        page.on("response", record_response)
        page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
        page.locator("#loginAccount").fill(str(fixture["logins"]["teacher_main"]))
        page.locator("#loginPassword").fill(PASSWORD)
        page.locator('#loginPanel button[type="submit"]').click()
        page.wait_for_url(re.compile(r".*/teacher/?$"), timeout=45_000)
        browser_session = page.evaluate("""() => ({token:localStorage.getItem('yuzan-access-token')||'',schoolId:localStorage.getItem('yuzan-active-school-id')||'',user:JSON.parse(localStorage.getItem('yuzan-current-user')||'null')})""")
        if not browser_session["token"] or browser_session["schoolId"] != school_id:
            raise AssertionError("T034 browser login did not select the synthetic teacher's authorized school")

        page.goto(f"{BASE}/teacher/classes/{class_id}?schoolId={school_id}#students", wait_until="domcontentloaded")
        page.get_by_role("heading", name=class_name).wait_for(timeout=25_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(35, timeout=25_000)
        expect(page.locator("#rosterCount")).to_have_text("当前显示 35 / 已加载 35 人")
        if len(row_ids(page)) != len(set(row_ids(page))):
            raise AssertionError("T034 browser roster collapsed or duplicated real enrollment rows")
        e2e["initialBrowserRosterRows"] = len(row_ids(page))

        # Real name search and the three server-derived risk groups.
        page.locator("#rosterSearch").fill("བོད")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(1)
        if row_ids(page) != [str(next(item["enrollmentId"] for item in summaries if item["displayName"].endswith("བོད学生")))]:
            raise AssertionError("T034 Unicode name search did not find the matching live API enrollment")
        page.locator("#rosterSearch").fill("")
        page.locator("#rosterRisk").select_option("AT_RISK")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(len(at_risk_ids))
        expect(page.locator("#rosterCount")).to_have_text(f"当前显示 {len(at_risk_ids)} / 已加载 35 人")
        if set(row_ids(page)) != at_risk_ids:
            raise AssertionError("T034 risk filter differs from SQL's server-derived riskStatus group")
        e2e["riskFilter"] = {"selected": "AT_RISK", "visibleRows": len(row_ids(page)), "sqlRows": len(at_risk_ids), "result": "PASS"}

        page.locator("#rosterRisk").select_option("")
        page.locator("#rosterScore").select_option("SCORED")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(len(scored_ids))
        if set(row_ids(page)) != scored_ids:
            raise AssertionError("T034 formal-score-present filter differs from PostgreSQL reports, including score zero")
        page.locator("#rosterScore").select_option("NO_SCORE")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(len(no_score_ids))
        if set(row_ids(page)) != no_score_ids:
            raise AssertionError("T034 no-formal-score filter did not keep null separate from score zero")
        e2e["scoreFilters"] = {"SCORED": len(scored_ids), "NO_SCORE": len(no_score_ids), "zeroIsScored": True, "nullIsUnscored": True, "result": "PASS"}

        page.locator("#rosterScore").select_option("")
        page.locator("#rosterSort").select_option("activity")
        activity_order = row_ids(page)
        latest_id = max(
            (str(item["enrollmentId"]) for item in summaries if item.get("lastActiveAt")),
            key=lambda key: str(api_by_id[key]["lastActiveAt"]),
        )
        null_activity_ids = {str(item["enrollmentId"]) for item in summaries if not item.get("lastActiveAt")}
        if activity_order[0] != latest_id or not null_activity_ids.issubset(set(activity_order[-len(null_activity_ids):])):
            raise AssertionError("T034 recent-activity sort does not put real latest activity first and missing activity last")
        page.locator("#rosterSort").select_option("progress")
        progress_order = row_ids(page)
        max_progress_id = max(
            (str(item["enrollmentId"]) for item in summaries if item.get("courseProgress") is not None),
            key=lambda key: int(api_by_id[key]["courseProgress"]),
        )
        null_progress_ids = {str(item["enrollmentId"]) for item in summaries if item.get("courseProgress") is None}
        if progress_order[0] != max_progress_id or not null_progress_ids.issubset(set(progress_order[-len(null_progress_ids):])):
            raise AssertionError("T034 course-progress sort does not put highest percentage first and null progress last")
        e2e["sorts"] = {"recentActivityTopMatchesApi": True, "recentActivityNullsLast": True, "courseProgressTopMatchesApi": True, "courseProgressNullsLast": True, "result": "PASS"}

        # A visible 3/35 filter must still download the full authorized class.
        page.locator("#rosterSearch").fill("目标")
        page.locator("#rosterRisk").select_option("AT_RISK")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(3)
        expect(page.locator("#rosterCount")).to_have_text("当前显示 3 / 已加载 35 人")
        button = page.locator(".roster-export-button")
        expect(button).to_have_text("导出全班名单CSV")
        expect(button).to_have_attribute("aria-describedby", "rosterExportStatus")
        filename, raw_csv = click_and_download(page, button, confirmation_messages)
        csv_result = compare_csv_with_sql(raw_csv, class_name, sql_rows)
        headers, csv_rows = parse_csv_bytes(raw_csv)
        by_name = {row[0][1:] if row[0].startswith("'") else row[0]: row for row in csv_rows}
        same_name_scores = [row[5] for row in csv_rows if (row[0][1:] if row[0].startswith("'") else row[0]) == "T034同名学生"]
        if sorted(same_name_scores) != ["", "0"]:
            raise AssertionError("T034 full CSV changed explicit score zero or null formal score")
        if len(csv_rows) != 35 or len(confirmation_messages) != 1 or "全班 35 名在读学生" not in confirmation_messages[0] or "不受当前搜索和筛选影响" not in confirmation_messages[0]:
            raise AssertionError("T034 filtered export did not clearly confirm and download the full 35-student class")
        if any(str(item["enrollmentId"]) in raw_csv.decode("utf-8-sig") for item in summaries):
            raise AssertionError("T034 CSV leaked internal Enrollment IDs")
        e2e["filteredCsv"] = {**csv_result, "visibleFilteredRows": 3, "filterCountText": "当前显示 3 / 已加载 35 人", "filenameContainsStudentName": False, "zeroScoreCell": "0", "nullScoreCell": "", "download": "PASS"}
        e2e["downloadRows"].append({"scope": "filtered three of 35", "csvDataRows": len(csv_rows), "result": "PASS"})

        # Scores are visible as 0 or — in the roster, and same-name records remain separate.
        page.locator("#rosterSearch").fill("")
        page.locator("#rosterRisk").select_option("")
        page.locator("#rosterSort").select_option("name")
        zero_id = str(fixture["students"][0]["enrollmentId"])
        null_id = str(fixture["students"][1]["enrollmentId"])
        expect(page.locator(f'.roster-row[data-enrollment-id="{zero_id}"] [data-label="最近正式分"]')).to_have_text("0")
        expect(page.locator(f'.roster-row[data-enrollment-id="{null_id}"] [data-label="最近正式分"]')).to_have_text("—")
        page.locator("#rosterSearch").fill("同名学生")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(2)
        same_name_ids = row_ids(page)
        if set(same_name_ids) != set(duplicated_name_ids):
            raise AssertionError("T034 name search did not preserve both distinct same-name enrollment rows")
        page.locator("#rosterRisk").select_option("OK")
        page.locator("#rosterSort").select_option("activity")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(2)
        selected_same_name_id = same_name_ids[-1]
        link = page.locator(f'.roster-row[data-enrollment-id="{selected_same_name_id}"] .student-detail-link')
        link.focus()
        link.press("Enter")
        page.wait_for_url(re.compile(rf".*/teacher/students/{re.escape(selected_same_name_id)}(?:\?.*)?$"), timeout=20_000)
        expect(page.locator(".student-copy h1")).to_contain_text("同名学生")
        expect(page.locator("#backToClass")).to_have_attribute("href", re.compile(rf"schoolId={re.escape(school_id)}.*studentId={re.escape(selected_same_name_id)}"))
        detail_url = page.url
        if "rosterSearch" in detail_url:
            raise AssertionError("T034 search text should not be copied into the student-detail route")
        e2e["studentDetailClick"] = {"dynamicEnrollmentIdPath": True, "sameNameRecords": 2, "clickedEnrollmentIdMatched": True, "keyboardEnter": True, "result": "PASS"}
        page.locator("#backToClass").focus()
        page.locator("#backToClass").press("Enter")
        page.wait_for_url(re.compile(rf".*/teacher/classes/{re.escape(class_id)}\?.*studentId={re.escape(selected_same_name_id)}.*#students$"), timeout=20_000)
        page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
        expect(page.locator("#rosterSearch")).to_have_value("同名学生")
        expect(page.locator("#rosterRisk")).to_have_value("OK")
        expect(page.locator("#rosterSort")).to_have_value("activity")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(2, timeout=20_000)
        expect(page.locator(f'.roster-row[data-enrollment-id="{selected_same_name_id}"]')).to_have_class(re.compile("selected-student"))
        e2e["filterStateReturn"] = {"searchRestored": True, "riskRestored": True, "sortRestored": True, "sameEnrollmentSelected": True, "invalidEnumsRemoved": True, "result": "PASS"}

        page.reload(wait_until="domcontentloaded")
        page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
        expect(page.locator("#rosterSearch")).to_have_value("同名学生")
        expect(page.locator("#rosterRisk")).to_have_value("OK")
        expect(page.locator("#rosterSort")).to_have_value("activity")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(2, timeout=20_000)
        expect(page.locator(f'.roster-row[data-enrollment-id="{selected_same_name_id}"]')).to_have_class(re.compile("selected-student"))
        e2e["filterStateReload"] = {"searchRestored": True, "riskRestored": True, "sortRestored": True, "sameEnrollmentSelected": True, "result": "PASS"}

        # Escape clears the search field; Tab traverses all filters and live regions stay polite.
        page.locator("#rosterSearch").focus()
        page.locator("#rosterSearch").press("Escape")
        expect(page.locator("#rosterSearch")).to_have_value("")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(len(ok_ids), timeout=10_000)
        page.locator("#rosterRisk").select_option("")
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(35, timeout=10_000)
        page.locator("#rosterSearch").focus()
        for next_id in ("rosterRisk", "rosterScore", "rosterSort"):
            page.keyboard.press("Tab")
            if page.evaluate("document.activeElement.id") != next_id:
                raise AssertionError(f"T034 keyboard Tab did not reach {next_id}")
        if page.locator("#rosterCount").get_attribute("aria-live") != "polite":
            raise AssertionError("T034 visible row count is not announced through a polite live region")

        # Empty and single-student authorized class edge cases use the same live API.
        page.goto(f"{BASE}/teacher/classes/{fixture['class_single']}?schoolId={school_id}#students", wait_until="domcontentloaded")
        page.get_by_role("heading", name=str(fixture["single_class_name"])).wait_for(timeout=20_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(1, timeout=20_000)
        page.goto(f"{BASE}/teacher/classes/{fixture['class_empty']}?schoolId={school_id}#students", wait_until="domcontentloaded")
        page.get_by_role("heading", name=str(fixture["empty_class_name"])).wait_for(timeout=20_000)
        expect(page.locator("#rosterCount")).to_have_text("当前显示 0 / 已加载 0 人")
        expect(page.locator("#rosterTable")).to_contain_text("暂无在读学生")
        empty_filename, empty_raw = click_and_download(page, page.locator(".roster-export-button"), confirmation_messages)
        empty_headers, empty_data_rows = parse_csv_bytes(empty_raw)
        if empty_data_rows or empty_headers != headers:
            raise AssertionError("T034 authorized empty class did not export a header-only CSV")
        e2e["emptyAndSingleClass"] = {"singleStudentRows": 1, "emptyStudentRows": 0, "emptyCsvRows": 0, "result": "PASS"}
        e2e["downloadRows"].append({"scope": "authorized empty class", "csvDataRows": 0, "result": "PASS"})

        # Four viewport proof includes roster overflow, focus, live status and reduced motion.
        page.goto(f"{BASE}/teacher/classes/{class_id}?schoolId={school_id}#students", wait_until="domcontentloaded")
        page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
        expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(35, timeout=20_000)
        viewport_results = []
        for width, height in ((390, 844), (768, 900), (1280, 900), (1440, 1000)):
            page.set_viewport_size({"width": width, "height": height})
            page.locator("#students").scroll_into_view_if_needed()
            page.wait_for_timeout(80)
            state = page.evaluate("""() => {
              const wrap = document.querySelector('.roster-table-wrap');
              const button = document.querySelector('.roster-export-button');
              const rect = button.getBoundingClientRect();
              document.querySelector('#rosterSearch').focus({focusVisible:true});
              return {
                width: innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                rosterClientWidth: wrap.clientWidth,
                rosterScrollWidth: wrap.scrollWidth,
                exportVisible: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth + 1,
                focusVisible: document.activeElement.matches(':focus-visible'),
                countLive: document.querySelector('#rosterCount').getAttribute('aria-live'),
                exportDescription: button.getAttribute('aria-describedby'),
                reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
              };
            }""")
            if state["documentWidth"] > width + 1 or state["rosterScrollWidth"] > state["rosterClientWidth"] + 1:
                raise AssertionError(f"T034 document or roster overflows horizontally at {width}px")
            if not state["exportVisible"] or not state["focusVisible"] or state["countLive"] != "polite" or not state["reducedMotion"]:
                raise AssertionError(f"T034 roster control visibility/accessibility regressed at {width}px")
            filename = f"roster-{width}.png"
            page.screenshot(path=str(EVIDENCE_DIR / filename))
            viewport_results.append({"width": width, "height": height, "documentScrollWidth": state["documentWidth"], "rosterScrollWidth": state["rosterScrollWidth"], "exportVisible": state["exportVisible"], "keyboardFocusVisible": state["focusVisible"], "ariaLive": state["countLive"], "reducedMotion": state["reducedMotion"], "screenshot": filename})
        e2e["fourViewports"] = viewport_results

        # UI failures and network loss leave no prior enrollment rows visible.
        failure_records = []
        api_route = f"**/api/v1/schools/{school_id}/classes/{class_id}/student-summaries"
        for label, status, abort in (("http-500", 500, False), ("network-abort", None, True), ("http-403", 403, False), ("http-404", 404, False)):
            failure_page = context.new_page()
            if abort:
                failure_page.route(api_route, lambda route, request: route.abort())
            else:
                def fulfill_failure(route, request, response_status=status, case_label=label):
                    route.fulfill(
                        status=response_status,
                        content_type="application/json",
                        body=json.dumps({"message": f"TEST_FIXTURE_ONLY T034 {case_label}"}),
                    )

                failure_page.route(api_route, fulfill_failure)
            failure_page.goto(f"{BASE}/teacher/classes/{class_id}?schoolId={school_id}#students", wait_until="domcontentloaded")
            failure_page.get_by_role("heading", name=class_name).wait_for(timeout=20_000)
            expect(failure_page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(0, timeout=20_000)
            expect(failure_page.locator("#rosterTable [role=alert]")).to_be_visible(timeout=20_000)
            failure_records.append({"case": label, "visibleStudentRows": 0, "oldRosterReused": False})
            failure_page.close()
        e2e["uiFailureStates"] = failure_records

        # Defer one real API response while the school identity changes; the old response must be discarded.
        page.add_init_script("""(() => {
          const original = window.fetch.bind(window);
          window.fetch = async (input, init = {}) => {
            const url = typeof input === 'string' ? input : input.url;
            if (localStorage.getItem('t034-hold-roster') === '1' && url.includes('/student-summaries')) {
              localStorage.removeItem('t034-hold-roster');
              const requestOptions = {...init};
              delete requestOptions.signal;
              const response = await original(input, requestOptions);
              return new Promise(resolve => { window.__t034ReleaseRoster = () => resolve(response); });
            }
            return original(input, init);
          };
        })();""")
        page.evaluate("localStorage.setItem('t034-hold-roster','1')")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("typeof window.__t034ReleaseRoster === 'function'", timeout=20_000)
        page.evaluate("localStorage.setItem('yuzan-active-school-id','TEST_FIXTURE_ONLY T034 switched school')")
        expect(page.locator(".class-identity-boundary")).to_be_visible(timeout=5_000)
        page.evaluate("window.__t034ReleaseRoster()")
        page.wait_for_timeout(500)
        if page.locator(".class-identity-boundary").count() != 1 or page.locator(".roster-row").count() != 0:
            raise AssertionError("T034 late response from the prior school repopulated the roster")
        e2e["schoolSwitch"] = {"oldResponseReleasedAfterSwitch": True, "rosterCleared": True, "lateRowsRendered": 0, "result": "PASS"}

        if browser_errors:
            raise AssertionError(f"T034 Chromium page errors: {browser_errors}")
        browser.close()

    if any(event.get("status") != 200 for event in event_log if event.get("pathKind") == "student-detail"):
        raise AssertionError("T034 dynamic student detail API request did not return HTTP 200")
    e2e["browserDownloadEventCount"] = len(browser_downloads)
    e2e["confirmationCount"] = len(confirmation_messages)
    e2e["sameNameSearch"] = {"matches": 2, "distinctEnrollmentIds": True, "result": "PASS"}
    e2e["filterTextStateInUrl"] = "not included; restored from sessionStorage scoped to active user, school and class"
    e2e["riskStatusUnknown"] = "API contract derives only OK/AT_RISK/INACTIVE; neutral UNKNOWN fallback is covered by T034 frontend tests"
    e2e["fixtureOnly"] = True
    (EVIDENCE_DIR / "t034-browser-database-evidence.json").write_text(json.dumps(e2e, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t034"
RUNTIME_STATE_DIR = Path("/tmp/yz-rd-t034-native-state")
SHARED_TOOLCHAIN_ROOT = Path.home() / "code" / "yuzan-workspace-main" / "runtime-local" / "native-web"
DATABASE_NAME = "yuzan_t034_native"
DATABASE_USER = "yz_t034"
BUCKET = "yz-t034-native"
PORTS = {
    "API_PORT": "4134",
    "PORT": "4334",
    "POSTGRES_PORT": "55834",
    "REDIS_PORT": "6474",
    "MINIO_API_PORT": "59274",
    "MINIO_CONSOLE_PORT": "59275",
}


def load_runtime_module():
    import importlib.util

    runtime_path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t034", runtime_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing identity-checked native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure_task("T014", shared_runtime_root=SHARED_TOOLCHAIN_ROOT)
    module.TASK_ID = "T034"
    module.RUNTIME = RUNTIME_DIR
    module.CONFIG_FILE = RUNTIME_DIR / ".env.local"
    if RUNTIME_STATE_DIR.exists() and any(RUNTIME_STATE_DIR.iterdir()):
        raise RuntimeError("T034 temporary PID/socket state is already populated; preserving it for identity inspection")
    module.STATE = RUNTIME_STATE_DIR
    module.LOGS = RUNTIME_DIR / "logs"
    module.PGDATA = RUNTIME_DIR / "postgres-data"
    module.REDIS_DATA = RUNTIME_DIR / "redis-data"
    module.MINIO_DATA = RUNTIME_DIR / "minio-data"
    module.EVIDENCE = RUNTIME_DIR / "evidence"
    module.TASK_BIN = RUNTIME_DIR / "bin"
    module.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    return module


def parse_runtime_config(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_runtime_config(runtime) -> None:
    if runtime.CONFIG_FILE.is_file():
        os.chmod(runtime.CONFIG_FILE, 0o600)
        existing = parse_runtime_config(runtime.CONFIG_FILE)
        expected = {**PORTS, "POSTGRES_DB": DATABASE_NAME, "POSTGRES_USER": DATABASE_USER, "S3_BUCKET": BUCKET}
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T034 runtime config does not match its owned database, bucket and ports")
        runtime.load_config()
        return
    for path in (runtime.STATE, runtime.PGDATA, runtime.REDIS_DATA, runtime.MINIO_DATA):
        if path.exists() and any(path.iterdir()):
            raise RuntimeError(f"T034 runtime has existing task data without its private config; preserving {path.name}")
    db_password = secrets.token_urlsafe(36)
    s3_secret = secrets.token_urlsafe(36)
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1", "API_PORT": PORTS["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{PORTS['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DATABASE_USER}:{db_password}@127.0.0.1:{PORTS['POSTGRES_PORT']}/{DATABASE_NAME}?schema=public",
        "POSTGRES_USER": DATABASE_USER, "POSTGRES_PASSWORD": db_password,
        "POSTGRES_DB": DATABASE_NAME, "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
        "REDIS_HOST": "127.0.0.1", "REDIS_PORT": PORTS["REDIS_PORT"], "REDIS_PASSWORD": secrets.token_urlsafe(36),
        "SESSION_SECRET": secrets.token_urlsafe(56),
        "WEB_HOST": "127.0.0.1", "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}", "PORT": PORTS["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}", "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET, "S3_ACCESS_KEY": "yz_t034_local", "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t034_local", "S3_SECRET_ACCESS_KEY": s3_secret, "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"], "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t034:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000", "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled", "LOG_LEVEL": "info", "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(runtime.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T034 native runtime; do not commit.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    runtime.load_config()


def verify_runtime_tools(runtime) -> None:
    pnpm = runtime.command_path("pnpm")
    node = runtime.node_binary()
    if not node:
        raise RuntimeError("T034 requires the existing Node 24 toolchain")
    tool_env = {**os.environ, "PATH": f"{node.parent}{os.pathsep}{os.environ.get('PATH', '')}"}
    if not pnpm or runtime.command_version(pnpm, ["--version"], env=tool_env) != "10.13.1":
        raise RuntimeError("T034 requires the pinned pnpm 10.13.1 toolchain")
    version = subprocess.run([str(node), "--version"], check=True, capture_output=True, text=True).stdout.strip()
    if not version.startswith("v24."):
        raise RuntimeError("T034 requires Node 24")
    if not runtime.TEST_PYTHON.is_file() or not Path("/usr/bin/google-chrome").is_file():
        raise RuntimeError("T034 pinned Playwright or Chromium toolchain is unavailable")
    print("T034 toolchain: Node 24; pnpm 10.13.1; PostgreSQL 17; Redis 7; MinIO; Chromium")


def verify_or_migrate_database(runtime, config: dict[str, str], env: dict[str, str]) -> bool:
    probe = runtime.run_output(
        [str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-c",
         "SELECT current_database() || '|' || current_user || '|' || version() || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;"],
        env=runtime.db_env(config), timeout=20,
    )
    if probe.returncode:
        raise RuntimeError("Cannot verify the isolated T034 PostgreSQL database")
    fields = probe.stdout.strip().split("|", 3)
    if len(fields) != 4 or fields[:2] != [DATABASE_NAME, DATABASE_USER] or not fields[2].startswith("PostgreSQL 17."):
        raise RuntimeError("T034 PostgreSQL identity/version differs from its owned database")
    if fields[3] == "0":
        return True
    migration_count = sum(path.is_dir() for path in (ROOT / "infra/database/prisma/migrations").iterdir())
    ledger = runtime.run_output(
        [str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-F", "|", "-c",
         'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text,count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM "_prisma_migrations";'],
        env=runtime.db_env(config), timeout=20,
    )
    if ledger.returncode or ledger.stdout.strip() != f"{migration_count}|0":
        raise RuntimeError("T034 database migrations are incomplete; preserving the current database")
    print(f"T034 PostgreSQL: retained its task-owned database with {migration_count} complete migrations")
    return False


def ensure_short_postgres_socket_path(runtime) -> None:
    conf = runtime.PGDATA / "postgresql.conf"
    if not conf.is_file():
        return
    marker = "# YZ-RD-T034 isolated native runtime"
    lines = conf.read_text(encoding="utf-8").splitlines()
    try:
        marker_index = lines.index(marker)
    except ValueError:
        return
    socket_line = f"unix_socket_directories = '{runtime.STATE / 'socket'}'"
    for index in range(marker_index + 1, len(lines)):
        if lines[index].lstrip().startswith("unix_socket_directories"):
            lines[index] = socket_line
            break
    else:
        lines.insert(marker_index + 1, socket_line)
    updated = "\n".join(lines) + "\n"
    if updated != conf.read_text(encoding="utf-8"):
        conf.write_text(updated, encoding="utf-8")


def prepare_bucket(runtime, env: dict[str, str]) -> None:
    script = r'''const path=require("node:path");const{createRequire}=require("node:module");const r=createRequire(path.resolve(process.cwd(),"backend/api/package.json"));const{CreateBucketCommand,HeadBucketCommand,S3Client}=r("@aws-sdk/client-s3");const c=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});(async()=>{try{await c.send(new HeadBucketCommand({Bucket:process.env.S3_BUCKET}))}catch{await c.send(new CreateBucketCommand({Bucket:process.env.S3_BUCKET}))}finally{c.destroy()}})().catch(e=>{process.stderr.write(`${e.name||"MINIO_BUCKET_FAILED"}\n`);process.exitCode=1});'''
    result = runtime.run_output([str(runtime.node_binary()), "-e", script], env=env, cwd=ROOT, timeout=45)
    if result.returncode:
        raise RuntimeError("T034 MinIO bucket initialization failed: " + runtime.safe_text(result.stderr[-1200:], runtime.load_config()))


def run_native_test(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, int | None]:
    python = runtime.TEST_PYTHON
    test_env = {
        **env,
        "YZ_T034_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T034_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T034_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T034_EVIDENCE_DIR": str(EVIDENCE_DIR),
        "POSTGRES_USER": config["POSTGRES_USER"], "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_DB": config["POSTGRES_DB"], "POSTGRES_PORT": config["POSTGRES_PORT"],
        "PATH": f"{runtime.PG_BIN}{os.pathsep}{runtime.TASK_BIN}{os.pathsep}{env.get('PATH', '')}",
    }
    process = subprocess.Popen(
        [str(python), "-m", "pytest", "-q", "-s", str(Path(__file__))],
        cwd=ROOT, env=test_env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, start_new_session=True,
    )
    runtime.record_for_pid("test", process.pid, str(Path(__file__)), pgid=process.pid)
    output, _ = process.communicate()
    for key in ("POSTGRES_PASSWORD", "REDIS_PASSWORD", "S3_SECRET_KEY", "E2E_TEST_PASSWORD"):
        secret = config.get(key, "")
        if secret:
            output = output.replace(secret, "<redacted>")
    print(output)
    return process.returncode or 0, process.pid


def write_native_runtime_evidence(runtime, config: dict[str, str], service_pids: dict[str, int], test_pid: int | None, status: int) -> None:
    ports = {}
    for name, key in (
        ("postgres", "POSTGRES_PORT"), ("api", "API_PORT"), ("web", "PORT"),
        ("redis", "REDIS_PORT"), ("minio-api", "MINIO_API_PORT"), ("minio-console", "MINIO_CONSOLE_PORT"),
    ):
        port = int(config[key])
        ports[name] = {"port": port, "stopped": not bool(runtime.port_listener_pids(port))}
    stopped = status == 0 and all(record["stopped"] for record in ports.values())
    record = {
        "task": "YZ-RD-T034", "database": DATABASE_NAME, "databaseUser": DATABASE_USER,
        "servicePidsBeforeStop": service_pids, "chromiumPytestPid": test_pid,
        "chromiumPytestExited": bool(test_pid), "portsAfterStop": ports,
        "stopPass": stopped, "worker": "NOT_STARTED", "dockerCompose": "NOT_USED",
        "minioBucket": BUCKET,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "native-runtime-evidence.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
        node = runtime.node_binary()
        env["PATH"] = f"{node.parent}{os.pathsep}{env.get('PATH', '')}"
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        ensure_short_postgres_socket_path(runtime)
        runtime.start_postgres(config, env, created)
        fresh_database = verify_or_migrate_database(runtime, config, env)
        runtime.start_redis(config, env, created)
        runtime.start_minio(config, env, created)
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
        prepare_bucket(runtime, env)
        runtime.start_web_api(config, env, created)
        ready = runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5)
        if ready != 200:
            raise RuntimeError(f"T034 API readiness failed with HTTP {ready}")
        result_code, test_pid = run_native_test(runtime, config, env)
    except Exception as error:
        config = runtime.load_config(required=False)
        print("T034 native runtime: FAIL — " + runtime.safe_text(str(error), config))
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
                    print(f"T034 cleanup: task port {key}={port} still has a listener")
                    result_code = 1
            write_native_runtime_evidence(runtime, config, service_pids, test_pid, stop_status if status == 0 else status)
        socket_dir = RUNTIME_STATE_DIR / "socket"
        if socket_dir.is_dir() and not any(socket_dir.iterdir()):
            socket_dir.rmdir()
        if RUNTIME_STATE_DIR.is_dir() and not any(RUNTIME_STATE_DIR.iterdir()):
            RUNTIME_STATE_DIR.rmdir()
        print("T034 cleanup: only T034-owned processes stopped; its PostgreSQL data, MinIO bucket and evidence retained; no Worker/Docker/Compose used")
    return result_code


if __name__ == "__main__":
    raise SystemExit(run_native_runtime())
