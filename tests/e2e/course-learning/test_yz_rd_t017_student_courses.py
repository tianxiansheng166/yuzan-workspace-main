"""Native Chromium + API + PostgreSQL acceptance for YZ-RD-T017."""

from __future__ import annotations

import io
import json
import os
import re
import shutil
import socket
import subprocess
import tarfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright


BASE = os.environ["YZ_T017_BASE_URL"].rstrip("/")
API_BASE = os.environ["YZ_T017_API_BASE_URL"].rstrip("/")
DATABASE_URL = os.environ["YZ_T017_DATABASE_URL"]
PASSWORD = os.environ["YZ_T017_PASSWORD"]
EVIDENCE = Path(os.environ["YZ_T017_EVIDENCE_DIR"])
REPO = Path(__file__).resolve().parents[3]
BASE_SHA = "4d971c9683664c09e533069ec001b00d0dc239af"
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
STUDENT_A_ID = "22222222-2222-4222-8222-222222222222"
STUDENT_A_ENROLLMENT_ID = "f1111111-1111-4111-8111-111111111111"
STUDENT_A_CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
TEACHER_ID = "33333333-3333-4333-8333-333333333333"
TERM_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
PG_BIN = Path(os.environ["YZ_T017_PG_BIN"])
PG_PORT = str(urlparse(DATABASE_URL).port)
PG_USER = os.environ["POSTGRES_USER"]
PG_DATABASE = os.environ["POSTGRES_DB"]


def quote(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str) -> str:
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
    password = unquote(parsed.password or "")
    env = {
        **os.environ,
        "PGHOST": "127.0.0.1",
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username or "",
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        [str(PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", statement],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise AssertionError(result.stderr.replace(password, "<redacted>"))
    return result.stdout.strip()


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement).splitlines() if line]


def verify_database_identity() -> None:
    identity = sql("SELECT current_database() || '|' || current_user || '|' || version();")
    assert identity.startswith(f"{PG_DATABASE}|{PG_USER}|PostgreSQL 17."), identity.split("|", 2)[:2]


def create_fixtures() -> dict[str, object]:
    verify_database_identity()
    sql(
        '''BEGIN;
        DELETE FROM "CourseFavorite" WHERE "courseVersionId" IN (
          SELECT cv.id FROM "CourseVersion" cv JOIN "Course" c ON c.id=cv."courseId" WHERE c."stableKey" LIKE 't017-%');
        DELETE FROM "AssignmentTarget" t USING "Assignment" a
          WHERE t."assignmentId"=a.id AND a."courseVersionId" IN (
            SELECT cv.id FROM "CourseVersion" cv JOIN "Course" c ON c.id=cv."courseId" WHERE c."stableKey" LIKE 't017-%');
        DELETE FROM "Submission" WHERE "assignmentId" IN (
          SELECT a.id FROM "Assignment" a JOIN "CourseVersion" cv ON cv.id=a."courseVersionId"
          JOIN "Course" c ON c.id=cv."courseId" WHERE c."stableKey" LIKE 't017-%');
        DELETE FROM "Assignment" WHERE "courseVersionId" IN (
          SELECT cv.id FROM "CourseVersion" cv JOIN "Course" c ON c.id=cv."courseId" WHERE c."stableKey" LIKE 't017-%');
        DELETE FROM "CourseVersion" cv USING "Course" c WHERE cv."courseId"=c.id AND c."stableKey" LIKE 't017-%';
        DELETE FROM "Course" WHERE "stableKey" LIKE 't017-%';
        DELETE FROM "Enrollment" WHERE "userId" IN (SELECT id FROM "User" WHERE "loginIdentifier" LIKE 'student.t017.b.%');
        DELETE FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE "loginIdentifier" LIKE 'student.t017.b.%');
        DELETE FROM "Class" WHERE name LIKE 'TEST_FIXTURE_ONLY T017 B 独立班级 %';
        DELETE FROM "User" WHERE "loginIdentifier" LIKE 'student.t017.b.%';
        COMMIT;'''
    )
    suffix = uuid.uuid4().hex[:10]
    student_b = {
        "id": str(uuid.uuid4()),
        "membership": str(uuid.uuid4()),
        "class": str(uuid.uuid4()),
        "enrollment": str(uuid.uuid4()),
        "login": f"student.t017.b.{suffix}@test.invalid",
    }
    sql(
        f'''BEGIN;
        INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
          SELECT {quote(student_b['id'])},{quote(student_b['login'])},'TEST_FIXTURE_ONLY T017 学生B',"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={quote(STUDENT_A_ID)};
        INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt")
          VALUES ({quote(student_b['membership'])},{quote(SCHOOL_ID)},{quote(student_b['id'])},'STUDENT','ACTIVE',NOW());
        INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
          VALUES ({quote(student_b['class'])},{quote(SCHOOL_ID)},{quote(TERM_ID)},{quote('TEST_FIXTURE_ONLY T017 B 独立班级 ' + suffix)},'七年级',NOW(),NOW());
        INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt")
          VALUES ({quote(student_b['enrollment'])},{quote(SCHOOL_ID)},{quote(student_b['class'])},{quote(student_b['id'])},'STUDENT','ACTIVE',NOW());
        COMMIT;'''
    )

    courses: list[dict[str, str]] = []
    for index in range(24):
        course_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())
        assignment_id = str(uuid.uuid4())
        courses.append({"course": course_id, "version": version_id, "assignment": assignment_id})
        title = "T017 快速结果课程" if index == 0 else f"T017 专项课程 {index + 1:02d}"
        category = "发音基础" if index % 2 == 0 else "古诗文"
        difficulty = ("入门", "基础", "进阶")[index % 3]
        task_group = "表达交流" if index % 2 == 0 else "语言积累"
        culture = "高原文化" if index % 3 == 0 else "民俗文化"
        cover = f"/assets/student-course-{(index % 4) + 1}.jpg"
        published_at = f"NOW() - INTERVAL '{index + 1} minutes'"
        sql(
            f'''BEGIN;
            INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
              VALUES ({quote(course_id)},{quote(SCHOOL_ID)},{quote(TEACHER_ID)},{quote('t017-' + suffix + '-' + str(index))},{quote(title)},NOW(),NOW());
            INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,description,"gradeBand",locale,objectives,"capabilityTheme",difficulty,"estimatedMinutes","coverAsset","taskGroups","culturalElements","publishedAt","createdAt","updatedAt")
              VALUES ({quote(version_id)},{quote(SCHOOL_ID)},{quote(course_id)},1,'PUBLISHED',{quote(title)},{quote('T017 隔离验收课程，用于真实筛选、分页和学习进度核对。')},'七年级','zh-CN','["理解课程关键概念"]'::jsonb,{quote(category)},{quote(difficulty)},18,{quote(cover)},{quote(json.dumps([task_group], ensure_ascii=False))}::jsonb,{quote(json.dumps([culture], ensure_ascii=False))}::jsonb,{published_at},NOW(),NOW());
            INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt","openedAt",source,"createdAt","updatedAt")
              VALUES ({quote(assignment_id)},{quote(SCHOOL_ID)},{quote(version_id)},{quote(TEACHER_ID)},{quote(title)},'OPEN',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',NOW(),'SELF_STUDY',NOW(),NOW());
            INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","enrollmentId","createdAt")
              VALUES ({quote(str(uuid.uuid4()))},{quote(SCHOOL_ID)},{quote(assignment_id)},'STUDENT',{quote(STUDENT_A_ENROLLMENT_ID)},NOW());
            COMMIT;'''
        )

        if index == 0:
            unit_id = str(uuid.uuid4())
            lesson_id = str(uuid.uuid4())
            completed_activity_id = str(uuid.uuid4())
            next_activity_id = str(uuid.uuid4())
            sql(
                f'''BEGIN;
                INSERT INTO "Unit" (id,"courseVersionId",title,"sortOrder")
                  VALUES ({quote(unit_id)},{quote(version_id)},'T017 课程学习路径',1);
                INSERT INTO "Lesson" (id,"unitId",title,"sortOrder")
                  VALUES ({quote(lesson_id)},{quote(unit_id)},'T017 复述与表达',1);
                INSERT INTO "LearningActivity" (id,"lessonId",type,title,instruction,content,"sortOrder",required,"completionRule")
                  VALUES ({quote(completed_activity_id)},{quote(lesson_id)},'TEXT','T017 第一步：阅读材料','{{"text":"阅读课程材料。"}}'::jsonb,'{{"paragraphs":["观察山谷中的植物变化，并记录关键线索。"]}}'::jsonb,1,true,'{{"type":"ACKNOWLEDGED"}}'::jsonb);
                INSERT INTO "LearningActivity" (id,"lessonId",type,title,instruction,content,"sortOrder",required,"completionRule")
                  VALUES ({quote(next_activity_id)},{quote(lesson_id)},'TEXT','T017 下一项活动：复述并说明','{{"text":"根据材料完成复述。"}}'::jsonb,'{{"paragraphs":["请根据观察到的线索，用自己的话说明植物适应环境的方式。"]}}'::jsonb,2,true,'{{"type":"ACKNOWLEDGED"}}'::jsonb);
                INSERT INTO "ActivityProgress" (id,"schoolId","activityId","enrollmentId",position,completed,revision,"updatedAt")
                  VALUES ({quote(str(uuid.uuid4()))},{quote(SCHOOL_ID)},{quote(completed_activity_id)},{quote(STUDENT_A_ENROLLMENT_ID)},1,true,1,NOW());
                COMMIT;'''
            )
            for attempt in range(1, 4):
                sql(
                    f'''INSERT INTO "Submission" (id,"schoolId","assignmentId","enrollmentId","attemptNo",status,"idempotencyKey",revision,"createdAt","updatedAt")
                        VALUES ({quote(str(uuid.uuid4()))},{quote(SCHOOL_ID)},{quote(assignment_id)},{quote(STUDENT_A_ENROLLMENT_ID)},{attempt},'IN_PROGRESS',{quote('t017-popularity-' + suffix + '-' + str(attempt))},1,NOW(),NOW());'''
                )
            courses[0]["next_activity"] = next_activity_id
            courses[0]["completed_activity"] = completed_activity_id

    return {"student_b": student_b, "courses": courses, "popular_assignment": courses[0]["assignment"]}


def payload(body: object) -> object:
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


def attach_network_log(page, log: dict[str, list[dict[str, object]]]) -> None:
    def on_request(request) -> None:
        path = urlparse(request.url).path
        if "/student/courses" in path or path.endswith("/auth/login"):
            log["requests"].append({"method": request.method, "url": request.url})

    def on_response(response) -> None:
        path = urlparse(response.url).path
        if "/student/courses" not in path and not path.endswith("/auth/login"):
            return
        entry: dict[str, object] = {"method": response.request.method, "url": response.url, "status": response.status}
        try:
            body = payload(response.json())
            if isinstance(body, dict):
                entry["responseFields"] = sorted(body.keys())
                entry["data"] = {
                    "categories": body.get("categories"),
                    "gradeBands": body.get("gradeBands"),
                    "difficulties": body.get("difficulties"),
                    "assignmentIds": [course.get("assignmentId") for course in body.get("courses", []) if isinstance(course, dict)],
                    "catalogItemFields": sorted(body["courses"][0].keys()) if body.get("courses") and isinstance(body["courses"][0], dict) else [],
                    "catalogItems": [
                        {
                            "assignmentId": course.get("assignmentId"),
                            "progressPercent": course.get("progressPercent"),
                            "status": course.get("status"),
                            "isFavorite": course.get("isFavorite"),
                            "nextActivity": course.get("nextActivity"),
                        }
                        for course in body.get("courses", []) if isinstance(course, dict)
                    ],
                    "total": body.get("total"),
                    "hasMore": body.get("hasMore"),
                    "nextCursor": body.get("nextCursor"),
                    "favorited": body.get("favorited"),
                }
        except Exception:
            pass
        log["responses"].append(entry)

    page.on("request", on_request)
    page.on("response", on_response)


def login_in_browser(page, base_url: str, identifier: str, password: str, log: dict[str, list[dict[str, object]]]) -> None:
    attach_network_log(page, log)
    page.goto(f"{base_url}/login/", wait_until="domcontentloaded")
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(password)
    page.locator('#loginPanel button[type="submit"]').click()
    page.wait_for_url(re.compile(r"/student/today/?(?:\?.*)?$"), timeout=35_000)
    assert any(entry["status"] == 200 and urlparse(str(entry["url"])).path.endswith("/auth/login") for entry in log["responses"])


def wait_catalog(page, *, require_busy_attribute: bool = True) -> None:
    expect(page.locator("#catalogContent")).to_be_visible(timeout=20_000)
    expect(page.locator("#catalogLoading")).to_be_hidden(timeout=20_000)
    if require_busy_attribute:
        expect(page.locator("#courseGrid")).to_have_attribute("aria-busy", "false", timeout=20_000)


def wait_for_catalog_filter(page, key: str, value: str, action) -> None:
    def matches(response) -> bool:
        path = urlparse(response.url).path.rstrip("/")
        query = parse_qs(urlparse(response.url).query)
        return path.endswith("/student/courses") and "/api/v1/schools/" in path and query.get(key) == [value]

    with page.expect_response(matches, timeout=20_000) as response_info:
        action()
    assert response_info.value.status == 200
    wait_catalog(page)


def catalog_responses(log: dict[str, list[dict[str, object]]]) -> list[dict[str, object]]:
    return [
        entry for entry in log["responses"]
        if urlparse(str(entry["url"])).path.rstrip("/").endswith("/student/courses")
    ]


def last_catalog_response(log: dict[str, list[dict[str, object]]]) -> dict[str, object]:
    matches = catalog_responses(log)
    assert matches, "Chromium did not request the student course catalog"
    return matches[-1]


def api_login(request, identifier: str) -> dict[str, object]:
    response = request.post(f"{API_BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.status == 200, response.text()
    result = payload(response.json())
    assert isinstance(result, dict) and result.get("accessToken")
    return result


def direct_favorite(method: str, url: str, access_token: str) -> tuple[int, dict[str, object]]:
    request = Request(url, headers={"Authorization": f"Bearer {access_token}"}, method=method)
    with urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))
        return response.status, payload(body)


def concurrent_favorite_requests(method: str, url: str, access_token: str, count: int = 4) -> list[tuple[int, dict[str, object]]]:
    with ThreadPoolExecutor(max_workers=count) as pool:
        return list(pool.map(lambda _: direct_favorite(method, url, access_token), range(count)))


def authorized_courses_sql() -> list[str]:
    rows = sql_rows(
        f'''SELECT a.id
              FROM "Assignment" a
              JOIN "CourseVersion" cv ON cv.id=a."courseVersionId" AND cv."schoolId"=a."schoolId"
              WHERE a."schoolId"={quote(SCHOOL_ID)} AND a.status='OPEN' AND a."deletedAt" IS NULL
                AND cv.status='PUBLISHED' AND cv."publishedAt" IS NOT NULL AND cv."retiredAt" IS NULL
                AND EXISTS (SELECT 1 FROM "AssignmentTarget" t WHERE t."schoolId"=a."schoolId" AND t."assignmentId"=a.id
                  AND (t."enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} OR t."classId"={quote(STUDENT_A_CLASS_ID)}))
              ORDER BY cv."publishedAt" DESC,a.id DESC;'''
    )
    return [row[0] for row in rows]


def write_partial_evidence(log: dict[str, object], status: str) -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "chromium-api-events.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        "status": status,
        "task": os.environ.get("YZ_E2E_TASK_ID", "T017"),
        "base": BASE_SHA,
        "branch": os.environ.get("YZ_E2E_BRANCH", "feat/yz-rd-t017-course-catalog-web-experience"),
        "database": PG_DATABASE,
        "databaseUser": PG_USER,
        "screenshots": sorted(path.name for path in EVIDENCE.glob("*.png")),
        "apiAndSqlEvidence": "chromium-api-events.json",
    }
    (EVIDENCE / "run-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_baseline_frontend() -> Path:
    runtime_root = Path(os.environ["YZ_T017_RUNTIME_ROOT"]).resolve()
    runtime_name = "native-web-t019" if os.environ.get("YZ_E2E_TASK_ID") == "T019" else "native-web-t017"
    expected_runtime = (REPO / "runtime-local" / runtime_name).resolve()
    assert runtime_root == expected_runtime, "baseline snapshot must stay inside the T017 runtime directory"
    baseline_root = runtime_root / "baseline-web"
    baseline_frontend = baseline_root / "frontend"
    assert baseline_frontend.is_relative_to(runtime_root)
    if baseline_frontend.exists():
        shutil.rmtree(baseline_frontend)
    baseline_root.mkdir(parents=True, exist_ok=True)
    archive = subprocess.run(
        ["git", "-C", str(REPO), "archive", BASE_SHA, "frontend"],
        check=True,
        capture_output=True,
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
        bundle.extractall(baseline_root)
    return baseline_frontend


def start_baseline_server(frontend_root: Path) -> tuple[subprocess.Popen, str]:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = {
        **os.environ,
        "PORT": str(port),
        "API_BASE_URL": API_BASE,
        "S3_ENDPOINT": os.environ["S3_ENDPOINT"],
        "S3_BUCKET": os.environ["S3_BUCKET"],
    }
    process = subprocess.Popen(
        [shutil.which("node") or "node", str(frontend_root / "server.mjs")],
        cwd=frontend_root,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base_url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise AssertionError("Baseline static server exited before becoming ready")
        try:
            with urlopen(base_url + "/student/courses/", timeout=1) as response:
                if response.status == 200:
                    return process, base_url
        except Exception:
            time.sleep(0.15)
    process.terminate()
    process.wait(timeout=5)
    raise AssertionError("Baseline static server did not become ready")


def test_real_student_course_catalog_chromium_api_postgres() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    log: dict[str, object] = {
        "task": os.environ.get("YZ_E2E_TASK_ID", "T017"),
        "base": BASE_SHA,
        "databaseIdentity": {"database": PG_DATABASE, "user": PG_USER},
        "requests": [],
        "responses": [],
        "assertions": {},
    }
    status = "FAIL"
    baseline_process: subprocess.Popen | None = None
    try:
        fixtures = create_fixtures()
        log["fixtures"] = {
            "studentB": fixtures["student_b"],
            "studentAAssignments": [course["assignment"] for course in fixtures["courses"]],
            "popularAssignment": fixtures["popular_assignment"],
            "nextActivity": fixtures["courses"][0]["next_activity"],
        }
        baseline_frontend = extract_baseline_frontend()
        baseline_process, baseline_url = start_baseline_server(baseline_frontend)
        chromium_path = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
        assert chromium_path, "Google Chrome/Chromium is required for this non-skipped E2E"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=chromium_path, args=["--no-sandbox"])

            baseline_context = browser.new_context(viewport={"width": 1440, "height": 1000})
            baseline_page = baseline_context.new_page()
            baseline_log: dict[str, list[dict[str, object]]] = {"requests": [], "responses": []}
            log["baselineBrowser"] = baseline_log
            login_in_browser(baseline_page, baseline_url, "student.test", PASSWORD, baseline_log)
            baseline_page.goto(f"{baseline_url}/student/courses/", wait_until="domcontentloaded")
            wait_catalog(baseline_page, require_busy_attribute=False)
            baseline_page.mouse.move(1438, 998)
            baseline_page.screenshot(path=str(EVIDENCE / "course-catalog-before-1440.png"), full_page=True)
            baseline_page.locator(".cc-card").first.scroll_into_view_if_needed()
            baseline_page.mouse.move(1438, 998)
            baseline_page.screenshot(path=str(EVIDENCE / "course-catalog-before-cards-1440.png"), full_page=False)
            baseline_page.evaluate("window.scrollTo(0, 0)")
            baseline_page.set_viewport_size({"width": 390, "height": 844})
            baseline_page.mouse.move(388, 842)
            baseline_page.screenshot(path=str(EVIDENCE / "course-catalog-before-390.png"), full_page=True)
            baseline_page.locator(".cc-card").first.scroll_into_view_if_needed()
            baseline_page.mouse.move(388, 842)
            baseline_page.screenshot(path=str(EVIDENCE / "course-catalog-before-cards-390.png"), full_page=False)
            log["baseline"] = {
                "commit": BASE_SHA,
                "url": f"{baseline_url}/student/courses/",
                "catalog": last_catalog_response(baseline_log).get("data"),
            }
            baseline_context.close()

            context_a = browser.new_context(viewport={"width": 1440, "height": 1000})
            page_a = context_a.new_page()
            a_log: dict[str, list[dict[str, object]]] = {"requests": [], "responses": []}
            log["studentABrowser"] = a_log
            login_in_browser(page_a, BASE, "student.test", PASSWORD, a_log)
            student_a_session = api_login(page_a.request, "student.test")
            student_a_token = str(student_a_session["accessToken"])
            course_link = page_a.get_by_role("link", name="课程中心").first
            expect(course_link).to_be_visible(timeout=10_000)
            course_link.click()
            expect(page_a).to_have_url(re.compile(r"/student/courses/?$"), timeout=15_000)
            wait_catalog(page_a)

            expected_ids = authorized_courses_sql()
            first_page = last_catalog_response(a_log)
            assert first_page["status"] == 200
            assert {
                "categories", "gradeBands", "difficulties", "statuses", "sources", "courses", "total", "hasMore", "nextCursor",
            }.issubset(first_page["responseFields"])
            assert {
                "assignmentId", "course", "title", "description", "capabilityTheme", "gradeBand", "difficulty",
                "estimatedMinutes", "coverAsset", "taskGroups", "culturalElements", "source", "status", "progressPercent",
                "isFavorite", "nextActivity", "submission", "completedAt",
            }.issubset(first_page["data"]["catalogItemFields"])
            assert isinstance(first_page["data"]["gradeBands"], list)
            assert isinstance(first_page["data"]["difficulties"], list)
            assert first_page["data"]["total"] == len(expected_ids)
            assert first_page["data"]["assignmentIds"] == expected_ids[:12]
            assert first_page["data"]["hasMore"] is True
            assert first_page["data"]["nextCursor"] == expected_ids[11]
            assert len(set(first_page["data"]["assignmentIds"])) == 12
            assert "评分最高" not in page_a.locator("#sortSelect").inner_text()
            assert page_a.locator("#sortSelect option[value='popularity']").count() == 1
            log["assertions"]["catalogCountAndFirstPageMatchSQL"] = {
                "apiTotal": first_page["data"]["total"],
                "sqlTotal": len(expected_ids),
                "firstPageIds": first_page["data"]["assignmentIds"],
            }

            wait_for_catalog_filter(page_a, "gradeBand", "七年级", lambda: page_a.locator("#gradeFilter").select_option(label="七年级"))
            assert parse_qs(urlparse(last_catalog_response(a_log)["url"]).query)["gradeBand"] == ["七年级"]
            wait_for_catalog_filter(page_a, "capabilityTheme", "发音基础", lambda: page_a.locator("#categoryFilter").select_option(label="发音基础"))
            assert parse_qs(urlparse(last_catalog_response(a_log)["url"]).query)["capabilityTheme"] == ["发音基础"]
            wait_for_catalog_filter(page_a, "difficulty", "入门", lambda: page_a.locator("#difficultyFilter").select_option(label="入门"))
            assert parse_qs(urlparse(last_catalog_response(a_log)["url"]).query)["difficulty"] == ["入门"]
            wait_for_catalog_filter(page_a, "taskGroup", "表达交流", lambda: page_a.locator("#taskGroupFilter").fill("表达交流"))
            assert parse_qs(urlparse(last_catalog_response(a_log)["url"]).query)["taskGroup"] == ["表达交流"]
            wait_for_catalog_filter(page_a, "culturalElement", "高原文化", lambda: page_a.locator("#culturalFilter").fill("高原文化"))
            assert parse_qs(urlparse(last_catalog_response(a_log)["url"]).query)["culturalElement"] == ["高原文化"]
            wait_for_catalog_filter(page_a, "search", "T017 快速结果课程", lambda: page_a.locator("#searchInput").fill("T017 快速结果课程"))
            filtered = last_catalog_response(a_log)
            filter_query = parse_qs(urlparse(filtered["url"]).query)
            assert filter_query["search"] == ["T017 快速结果课程"]
            assert filter_query["gradeBand"] == ["七年级"]
            assert filter_query["capabilityTheme"] == ["发音基础"]
            assert filter_query["difficulty"] == ["入门"]
            assert filter_query["taskGroup"] == ["表达交流"]
            assert filter_query["culturalElement"] == ["高原文化"]
            assert filtered["data"]["total"] == 1
            special_id = str(fixtures["popular_assignment"])
            assert filtered["data"]["assignmentIds"] == [special_id]
            filtered_course = filtered["data"]["catalogItems"][0]
            assert filtered_course["progressPercent"] == 50
            assert filtered_course["status"] == "IN_PROGRESS"
            assert filtered_course["nextActivity"]["title"] == "T017 下一项活动：复述并说明"
            course_version_id = str(fixtures["courses"][0]["version"])
            required_activity_counts = sql_rows(
                f'''SELECT count(a.id),count(ap."activityId") FILTER (WHERE ap.completed)
                      FROM "LearningActivity" a
                      JOIN "Lesson" l ON l.id=a."lessonId"
                      JOIN "Unit" u ON u.id=l."unitId"
                      LEFT JOIN "ActivityProgress" ap ON ap."activityId"=a.id AND ap."enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)}
                      WHERE u."courseVersionId"={quote(course_version_id)} AND a.required=true;'''
            )[0]
            assert required_activity_counts == ["2", "1"]
            card = page_a.locator(f'.cc-card[data-course-id="{special_id}"]')
            expect(card).to_be_visible()
            expect(card.locator(".cc-learning-progress")).to_have_attribute("aria-valuenow", "50")
            expect(card.locator(".cc-card-cta")).to_contain_text("继续学习")
            log["assertions"]["progressPercentMatchesPostgres"] = {
                "requiredActivities": int(required_activity_counts[0]),
                "completedActivities": int(required_activity_counts[1]),
                "apiProgressPercent": filtered_course["progressPercent"],
                "apiStatus": filtered_course["status"],
                "nextActivity": filtered_course["nextActivity"]["title"],
            }
            log["assertions"]["serverFilters"] = {key: filter_query[key][0] for key in ("gradeBand", "capabilityTheme", "difficulty", "taskGroup", "culturalElement", "search")}

            favorite = card.locator("[data-favorite]")
            favorite.click()
            expect(favorite).to_have_attribute("aria-pressed", "true", timeout=10_000)
            favorite_count = int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};'''))
            assert favorite_count == 1
            favorite_url = f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses/{special_id}/favorite"
            put_results = concurrent_favorite_requests("PUT", favorite_url, student_a_token)
            assert all(status == 200 and body == {"favorited": True} for status, body in put_results), put_results
            assert int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};''')) == 1
            page_a.reload(wait_until="domcontentloaded")
            wait_catalog(page_a)
            favorite_after_refresh = page_a.locator(f'[data-favorite="{special_id}"]')
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "true")

            favorite_after_refresh.click()
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "false", timeout=10_000)
            delete_results = concurrent_favorite_requests("DELETE", favorite_url, student_a_token)
            assert all(status == 200 and body == {"favorited": False} for status, body in delete_results), delete_results
            favorite_count = int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};'''))
            assert favorite_count == 0
            favorite_requests = [
                entry for entry in a_log["responses"]
                if urlparse(str(entry["url"])).path.endswith(f"/{special_id}/favorite")
            ]
            assert any(entry["method"] == "PUT" and entry["status"] == 200 for entry in favorite_requests)
            assert any(entry["method"] == "DELETE" and entry["status"] == 200 for entry in favorite_requests)

            post_url = f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses/{special_id}/favorite"
            post_added = page_a.request.post(post_url, headers={"Authorization": f"Bearer {student_a_token}"})
            post_removed = page_a.request.post(post_url, headers={"Authorization": f"Bearer {student_a_token}"})
            assert post_added.status == 201 and payload(post_added.json()) == {"favorited": True}
            assert post_removed.status == 201 and payload(post_removed.json()) == {"favorited": False}
            page_a.reload(wait_until="domcontentloaded")
            wait_catalog(page_a)
            favorite_after_refresh = page_a.locator(f'[data-favorite="{special_id}"]')
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "false")

            before_double = len([
                entry for entry in a_log["requests"]
                if entry["method"] == "PUT" and urlparse(str(entry["url"])).path.endswith(f"/{special_id}/favorite")
            ])
            favorite_after_refresh.evaluate("button => { button.click(); button.click(); }")
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "true", timeout=10_000)
            after_double = len([
                entry for entry in a_log["requests"]
                if entry["method"] == "PUT" and urlparse(str(entry["url"])).path.endswith(f"/{special_id}/favorite")
            ])
            assert after_double - before_double == 1

            context_a.set_offline(True)
            favorite_after_refresh.click()
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "true", timeout=10_000)
            expect(page_a.locator("#toast")).to_contain_text("网络连接失败", timeout=10_000)
            assert int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};''')) == 1
            context_a.set_offline(False)
            favorite_after_refresh.click()
            expect(favorite_after_refresh).to_have_attribute("aria-pressed", "false", timeout=10_000)
            assert int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};''')) == 0

            page_a.reload(wait_until="domcontentloaded")
            wait_catalog(page_a)
            expect(page_a.locator(f'[data-favorite="{special_id}"]')).to_have_attribute("aria-pressed", "false")
            assert int(sql(f'''SELECT count(*) FROM "CourseFavorite" WHERE "schoolId"={quote(SCHOOL_ID)} AND "enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} AND "courseVersionId"={quote(course_version_id)};''')) == 0
            log["assertions"]["favoriteLifecycle"] = {
                "persistedAfterRefresh": True,
                "concurrentPutResponses": put_results,
                "concurrentDeleteResponses": delete_results,
                "legacyPostToggle": [payload(post_added.json()), payload(post_removed.json())],
                "doubleClickPutRequests": after_double - before_double,
                "browserOfflineRetainedFavoriteAndManualRetryRemovedIt": True,
                "databaseFavoriteRows": 0,
            }

            latest = last_catalog_response(a_log)
            assert latest["data"]["assignmentIds"] == expected_ids[:12]
            page_a.locator("#loadMoreBtn").click()
            expect(page_a.locator("#resultCount")).to_contain_text(f"已加载 {len(expected_ids)} 门", timeout=10_000)
            all_loaded_ids = page_a.locator(".cc-card[data-course-id]").evaluate_all("cards => cards.map(card => card.dataset.courseId)")
            page2 = last_catalog_response(a_log)
            page2_ids = page2["data"]["assignmentIds"]
            assert len(page2_ids) == len(expected_ids) - 12
            assert page2_ids == expected_ids[12:]
            assert not (set(expected_ids[:12]) & set(page2_ids))
            assert all_loaded_ids == expected_ids
            assert len(set(all_loaded_ids)) == len(all_loaded_ids)
            assert page2["data"]["hasMore"] is False
            log["assertions"]["cursorPaginationMatchesSQL"] = {
                "total": len(expected_ids),
                "firstPage": expected_ids[:12],
                "secondPage": page2_ids,
                "duplicates": 0,
            }

            wait_for_catalog_filter(page_a, "sortBy", "popularity", lambda: page_a.locator("#sortSelect").select_option("popularity"))
            popularity = last_catalog_response(a_log)
            popularity_query = parse_qs(urlparse(popularity["url"]).query)
            assert popularity_query["sortBy"] == ["popularity"]
            popularity_sql = [row[0] for row in sql_rows(
                f'''SELECT a.id
                      FROM "Assignment" a
                      JOIN "CourseVersion" cv ON cv.id=a."courseVersionId" AND cv."schoolId"=a."schoolId"
                      LEFT JOIN "Submission" s ON s."assignmentId"=a.id
                      WHERE a."schoolId"={quote(SCHOOL_ID)} AND a.status='OPEN' AND a."deletedAt" IS NULL
                        AND cv.status='PUBLISHED' AND cv."publishedAt" IS NOT NULL AND cv."retiredAt" IS NULL
                        AND EXISTS (SELECT 1 FROM "AssignmentTarget" t WHERE t."schoolId"=a."schoolId" AND t."assignmentId"=a.id
                          AND (t."enrollmentId"={quote(STUDENT_A_ENROLLMENT_ID)} OR t."classId"={quote(STUDENT_A_CLASS_ID)}))
                      GROUP BY a.id ORDER BY count(s.id) DESC,a.id DESC;'''
            )]
            assert popularity["data"]["assignmentIds"] == popularity_sql[:12]
            assert popularity["data"]["assignmentIds"][0] == special_id
            assert int(sql(f'''SELECT count(*) FROM "Submission" WHERE "assignmentId"={quote(special_id)};''')) == 3
            log["assertions"]["popularitySortMatchesSubmissionCounts"] = {
                "sortBy": "popularity",
                "topAssignment": special_id,
                "topSubmissionCount": 3,
                "apiFirstPageMatchesSQL": True,
            }

            no_match = "T017-无匹配课程-" + uuid.uuid4().hex[:8]
            wait_for_catalog_filter(page_a, "search", no_match, lambda: page_a.locator("#searchInput").fill(no_match))
            empty_response = last_catalog_response(a_log)
            assert empty_response["status"] == 200 and empty_response["data"]["total"] == 0
            expect(page_a.locator("#emptyState")).to_be_visible()
            expect(page_a.locator("#resultCount")).to_contain_text("共 0 门")

            route_pattern = re.compile(r".*/api/v1/schools/[^/]+/student/courses(?:\?.*)?$")
            page_a.route(route_pattern, lambda route: route.abort())
            page_a.locator("#searchInput").fill("T017 网络暂时失败")
            page_a.locator("#searchInput").press("Enter")
            expect(page_a.locator("#requestError")).to_contain_text("当前需要联网加载课程", timeout=10_000)
            expect(page_a.locator("#networkNotice")).to_be_visible()
            page_a.unroute(route_pattern)
            context_a.set_offline(True)
            expect(page_a.locator("#networkMessage")).to_contain_text("当前需要联网加载课程")
            expect(page_a.locator("#networkRetry")).to_be_disabled()
            context_a.set_offline(False)
            expect(page_a.locator("#networkMessage")).to_contain_text("网络已恢复", timeout=5_000)
            expect(page_a.locator("#networkRetry")).to_be_enabled()
            wait_for_catalog_filter(page_a, "search", "T017 网络暂时失败", lambda: page_a.locator("#networkRetry").click())
            expect(page_a.locator("#networkNotice")).to_be_hidden()
            expect(page_a.locator("#emptyState")).to_be_visible()
            log["assertions"]["emptyNetworkErrorOfflineRetry"] = {
                "emptyResultTotal": 0,
                "requestFailureShown": True,
                "offlineMessage": "当前需要联网加载课程。网络恢复后可以重试。",
                "retryAfterOnline": True,
            }

            b_context = browser.new_context(viewport={"width": 1280, "height": 900})
            page_b = b_context.new_page()
            b_log: dict[str, list[dict[str, object]]] = {"requests": [], "responses": []}
            log["studentBBrowser"] = b_log
            login_in_browser(page_b, BASE, str(fixtures["student_b"]["login"]), PASSWORD, b_log)
            with page_b.expect_response(lambda response: urlparse(response.url).path.rstrip("/").endswith("/student/courses") and "/api/v1/schools/" in urlparse(response.url).path, timeout=20_000) as b_catalog_response:
                page_b.goto(f"{BASE}/student/courses/", wait_until="domcontentloaded")
            assert b_catalog_response.value.status == 200
            wait_catalog(page_b)
            expect(page_b.locator("#emptyState")).to_be_visible()
            assert last_catalog_response(b_log)["status"] == 200
            assert last_catalog_response(b_log)["data"]["total"] == 0
            b_session = api_login(page_b.request, str(fixtures["student_b"]["login"]))
            b_headers = {"Authorization": f"Bearer {b_session['accessToken']}"}
            a_detail_url = f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses/{special_id}"
            assert page_b.request.get(a_detail_url, headers=b_headers).status == 404
            assert page_b.request.post(f"{a_detail_url}/favorite", headers=b_headers).status == 404
            assert page_b.request.put(f"{a_detail_url}/favorite", headers=b_headers).status == 404
            assert page_b.request.delete(f"{a_detail_url}/favorite", headers=b_headers).status == 404
            other_school_url = f"{API_BASE}/api/v1/schools/99999999-9999-4999-8999-999999999999/student/courses/{special_id}/favorite"
            assert page_a.request.put(other_school_url, headers={"Authorization": f"Bearer {student_a_token}"}).status == 403
            assert page_a.request.delete(other_school_url, headers={"Authorization": f"Bearer {student_a_token}"}).status == 403
            invalid_id = str(uuid.uuid4())
            invalid_favorite_url = f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses/{invalid_id}/favorite"
            assert page_a.request.put(invalid_favorite_url, headers={"Authorization": f"Bearer {student_a_token}"}).status == 404
            assert page_a.request.delete(invalid_favorite_url, headers={"Authorization": f"Bearer {student_a_token}"}).status == 404
            assert sql(f'''SELECT count(*) FROM "AssignmentTarget" WHERE "assignmentId"={quote(special_id)} AND "enrollmentId"={quote(str(fixtures['student_b']['enrollment']))};''') == "0"
            log["assertions"]["studentBIsolation"] = {
                "bCatalogTotal": 0,
                "aDetailFromB": 404,
                "favoriteAFromB": 404,
                "assignmentTargetRowsForB": 0,
            }

            anonymous_api = playwright.request.new_context()
            try:
                unauthenticated = anonymous_api.get(f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses")
                assert unauthenticated.status == 401
                assert anonymous_api.put(favorite_url).status == 401
                assert anonymous_api.delete(favorite_url).status == 401
            finally:
                anonymous_api.dispose()
            teacher_session = api_login(page_b.request, "teacher.test")
            teacher_headers = {"Authorization": f"Bearer {teacher_session['accessToken']}"}
            assert page_b.request.get(f"{API_BASE}/api/v1/schools/{SCHOOL_ID}/student/courses", headers=teacher_headers).status == 403
            assert page_b.request.put(favorite_url, headers=teacher_headers).status == 403
            assert page_b.request.delete(favorite_url, headers=teacher_headers).status == 403
            log["assertions"]["authStatusChecks"] = {"unauthenticated": 401, "wrongRole": 403, "inaccessibleCourse": 404}
            b_context.close()

            race_page = context_a.new_page()
            race_log: dict[str, list[dict[str, object]]] = {"requests": [], "responses": []}
            log["raceBrowser"] = race_log
            attach_network_log(race_page, race_log)
            race_page.goto(f"{BASE}/student/courses/", wait_until="domcontentloaded")
            wait_catalog(race_page)
            race_page.evaluate(
                """() => {
                  const original = window.YuzanApi.listStudentCourses.bind(window.YuzanApi);
                  window.YuzanApi.listStudentCourses = filters => {
                    const result = original(filters);
                    if (filters.search !== '真实学习流程课程') return result;
                    return result.then(data => new Promise(resolve => setTimeout(() => resolve(data), 1200)));
                  };
                }"""
            )
            race_page.locator("#searchInput").fill("真实学习流程课程")
            race_page.wait_for_timeout(450)
            assert any(parse_qs(urlparse(str(entry["url"])).query).get("search") == ["真实学习流程课程"] for entry in race_log["requests"])
            wait_for_catalog_filter(race_page, "search", "T017 快速结果课程", lambda: race_page.locator("#searchInput").fill("T017 快速结果课程"))
            expect(race_page.locator(".cc-card-title")).to_have_text("T017 快速结果课程")
            race_page.wait_for_timeout(900)
            expect(race_page.locator(".cc-card-title")).to_have_text("T017 快速结果课程")
            assert race_page.locator(".cc-card").count() == 1
            log["assertions"]["staleRequestIgnored"] = True

            fast_link = race_page.locator(".cc-card-link").first
            assert fast_link.get_attribute("href") == f"/student/courses/course-detail/?id={special_id}"
            fast_link.focus()
            keyboard_outline = fast_link.evaluate("element => getComputedStyle(element).outlineStyle")
            fast_link.press("Enter")
            expect(race_page).to_have_url(re.compile(r"/student/courses/course-detail/\?id=" + re.escape(special_id) + r"$"), timeout=15_000)
            expect(race_page.locator("#cpMain")).to_be_visible(timeout=20_000)
            expect(race_page.locator("#cpHeroTitle")).to_have_text("T017 快速结果课程")
            activity_id = str(fixtures["courses"][0]["next_activity"])
            current_activity = race_page.locator(f'#cpDirectory li[data-activity-id="{activity_id}"]')
            expect(current_activity).to_contain_text("T017 下一项活动：复述并说明")
            expect(current_activity).to_contain_text("当前")
            current_activity.click()
            activity_state = race_page.evaluate("window.CoursePlayerState.getState()")
            assert activity_state["assignmentId"] == special_id
            assert activity_state["currentActivityId"] == activity_id
            detail_gets = [
                entry for entry in race_log["responses"]
                if entry["method"] == "GET" and urlparse(str(entry["url"])).path.endswith(f"/student/courses/{special_id}")
            ]
            assert detail_gets and detail_gets[-1]["status"] == 200
            assert any(
                entry["method"] == "POST" and urlparse(str(entry["url"])).path.endswith(f"/student/courses/{special_id}/submissions") and entry["status"] in (200, 201)
                for entry in race_log["responses"]
            )
            race_page.set_viewport_size({"width": 1280, "height": 900})
            race_page.screenshot(path=str(EVIDENCE / "course-detail-activity-1280.png"), full_page=True)
            race_page.go_back(wait_until="domcontentloaded")
            expect(race_page).to_have_url(re.compile(r"/student/courses/?$"), timeout=15_000)
            wait_catalog(race_page)
            log["assertions"]["keyboardDetailAndReturn"] = {
                "assignmentId": special_id,
                "detailApiStatus": detail_gets[-1]["status"],
                "activityId": activity_id,
                "currentActivityOpened": activity_state["currentActivityId"] == activity_id,
                "focusOutline": keyboard_outline,
                "returnedToCatalog": True,
            }

            with page_a.expect_response(lambda response: urlparse(response.url).path.rstrip("/").endswith("/student/courses") and "/api/v1/schools/" in urlparse(response.url).path, timeout=20_000) as reset_response:
                page_a.goto(f"{BASE}/student/courses/", wait_until="domcontentloaded")
            assert reset_response.value.status == 200
            wait_catalog(page_a)
            for width, height in ((390, 844), (768, 1024), (1280, 900), (1440, 1000)):
                page_a.set_viewport_size({"width": width, "height": height})
                page_a.wait_for_timeout(120)
                metrics = page_a.evaluate("""() => ({
                  viewport: innerWidth,
                  document: document.documentElement.scrollWidth,
                  firstCard: document.querySelector('.cc-card')?.getBoundingClientRect().width || 0,
                  columns: getComputedStyle(document.querySelector('#courseGrid')).gridTemplateColumns,
                  visibleCards: document.querySelectorAll('.cc-card').length,
                  pageHeight: document.documentElement.scrollHeight,
                  catalogHeight: document.querySelector('#catalogContent').scrollHeight
                })""")
                assert metrics["document"] <= width + 1, f"horizontal overflow at {width}px: {metrics}"
                assert metrics["firstCard"] > 0, f"course card missing at {width}px"
                page_a.mouse.move(width - 2, height - 2)
                page_a.screenshot(path=str(EVIDENCE / f"course-catalog-after-{width}.png"), full_page=True)
                page_a.locator(".cc-card").first.scroll_into_view_if_needed()
                page_a.mouse.move(width - 2, height - 2)
                page_a.screenshot(path=str(EVIDENCE / f"course-catalog-cards-{width}.png"), full_page=False)
                page_a.evaluate("window.scrollTo(0, 0)")
                log.setdefault("viewports", {})[str(width)] = metrics
            page_a.set_viewport_size({"width": 390, "height": 844})
            page_a.screenshot(path=str(EVIDENCE / "course-catalog-after-390-viewport.png"), full_page=False)
            page_a.set_viewport_size({"width": 1440, "height": 1000})
            page_a.screenshot(path=str(EVIDENCE / "course-catalog-after-1440.png"), full_page=True)

            log["browserRuntime"] = {"browser": browser.version, "baseUrl": BASE, "apiBaseUrl": API_BASE}
            log["assertions"]["browserLoginAndCatalogNavigation"] = True
            log["assertions"]["returnedTotalUsesServerCount"] = True
            status = "PASS"
            browser.close()
    finally:
        if baseline_process and baseline_process.poll() is None:
            baseline_process.terminate()
            try:
                baseline_process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                baseline_process.kill()
                baseline_process.wait(timeout=5)
        write_partial_evidence(log, status)
