"""Isolated real API/DB/browser proof for the student bilingual contract.

Every translated string is TEST_FIXTURE_ONLY. It is synthetic UI-gate data,
not Tibetan teaching content or evidence of expert review.
"""
import json
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T005_BASE_URL", "")
SCHOOL = "11111111-1111-4111-8111-111111111111"
OTHER_SCHOOL = "99999999-9999-4999-8999-999999999999"
PASSWORD = "YuzanTest!2026"
pytestmark = pytest.mark.skipif(not BASE, reason="requires YZ_T005 isolated runtime")


def sql(statement):
    container = os.environ["YZ_T005_DB_CONTAINER"]
    assert container.startswith("yz-rd-t005-")
    assert urlparse(BASE).hostname == "127.0.0.1"
    project = subprocess.check_output(
        ["docker", "inspect", container, "--format", '{{index .Config.Labels "com.docker.compose.project"}}'], text=True
    ).strip()
    assert project.startswith("yz-rd-t005-")
    return subprocess.check_output(
        ["docker", "exec", "-i", container, "psql", "-U", os.environ["YZ_T005_DB_USER"],
         "-d", os.environ["YZ_T005_DB_NAME"], "-At", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True,
    ).strip()


def body(response):
    assert response.ok, f"{response.status}: {response.text()}"
    value = response.json()
    return value.get("data", value)


class FictionalSession(dict):
    def __repr__(self):
        return "<fictional isolated session>"


def login(request, identifier):
    return FictionalSession(body(request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )))


def ui_login(page, identifier):
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null")


@pytest.fixture
def runtime(tmp_path):
    suffix = uuid.uuid4().hex
    student_id, non_target_id, class_id, enrollment_id = [str(uuid.uuid4()) for _ in range(4)]
    sql(f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
      SELECT '{class_id}',"schoolId","termId",'T005 class {suffix}','五年级',now(),now()
      FROM "Class" WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{student_id}','t005-{suffix}','T005 fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE "loginIdentifier"='student.test';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{non_target_id}','t005-other-{suffix}','T005 fictional non-target student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE "loginIdentifier"='student.test';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
      ('{uuid.uuid4()}','{SCHOOL}','{student_id}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{non_target_id}','STUDENT','ACTIVE',now());
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
      ('{enrollment_id}','{SCHOOL}','{class_id}','{student_id}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{class_id}','33333333-3333-4333-8333-333333333333','TEACHER','ACTIVE',now());''')
    screenshot_dir = Path("/tmp/yz-rd-t005-runtime")
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        context = browser.new_context(viewport={"width": 390, "height": 844})
        # Device-check entry uses a browser-simulated microphone. This is not
        # physical-device, permission-dialog, or recording evidence.
        context.grant_permissions(["microphone"])
        page = context.new_page()
        yield page, context, suffix, student_id, non_target_id, class_id, enrollment_id
        browser.close()


def confirmed_fixture(original):
    return {
        "originalText": f"TEST_FIXTURE_ONLY {original}",
        "translation": "TEST_FIXTURE_ONLY <img src=x onerror=window.__t005Xss=1>",
        "locale": "zh-CN",
        "translationLocale": "bo-CN",
        "translationSource": "EXPERT",
        "reviewStatus": "EXPERT_CONFIRMED",
    }


def ordinary_fixture(original):
    return {
        "originalText": f"TEST_FIXTURE_ONLY {original}",
        "locale": "zh-CN",
        "translationSource": "NONE",
        "reviewStatus": "REVIEWED",
    }


def publish_negative_translation_cases(request, headers):
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    cases = [
        ("pending", "AUTO", "PENDING"),
        ("auto-confirmed", "AUTO", "EXPERT_CONFIRMED"),
    ]
    for label, source, status in cases:
        draft = body(request.post(f"{prefix}/course-versions", headers=headers, data={
            "title": f"T005 TEST_FIXTURE_ONLY {label} {uuid.uuid4().hex[:8]}",
            "objectives": [{
                "originalText": "TEST_FIXTURE_ONLY 普通话原文",
                "translation": "TEST_FIXTURE_ONLY synthetic helper",
                "locale": "zh-CN",
                "translationLocale": "bo-CN",
                "translationSource": source,
                "reviewStatus": status,
            }],
        }))
        response = request.post(f"{prefix}/course-versions/{draft['id']}/publish", headers=headers, data={})
        assert response.status == 400, response.text()
        current = body(request.get(f"{prefix}/course-versions/{draft['id']}", headers=headers))
        assert current["status"] == "DRAFT"


def create_real_course_path(page, suffix, class_id, enrollment_id):
    teacher = login(page.request, "teacher.test")
    headers = {"Authorization": f"Bearer {teacher['accessToken']}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    approved_objective = confirmed_fixture("学习目标普通话原文")
    unreviewed_objective = {
        "originalText": "TEST_FIXTURE_ONLY AUTO 原文",
        "translation": "TEST_FIXTURE_ONLY AUTO 文本",
        "locale": "zh-CN",
        "translationLocale": "bo-CN",
        "translationSource": "AUTO",
        "reviewStatus": "REVIEWED",
    }
    empty_objective = {
        "originalText": "TEST_FIXTURE_ONLY 空译文原文",
        "translation": " ",
        "locale": "zh-CN",
        "translationLocale": "bo-CN",
        "translationSource": "EXPERT",
        "reviewStatus": "EXPERT_CONFIRMED",
    }
    mandarin_only_objective = {
        "originalText": "TEST_FIXTURE_ONLY 无译文普通话原文",
        "locale": "zh-CN",
        "translationSource": "NONE",
        "reviewStatus": "REVIEWED",
    }
    draft = body(page.request.post(f"{prefix}/course-versions", headers=headers, data={
        "title": f"T005 TEST_FIXTURE_ONLY bilingual course {suffix[:8]}",
        "objectives": [approved_objective, unreviewed_objective, empty_objective, mandarin_only_objective],
    }))
    detail = body(page.request.get(f"{prefix}/course-versions/{draft['id']}", headers=headers))
    reading_id, runner_id = str(uuid.uuid4()), str(uuid.uuid4())
    student_note = confirmed_fixture("本节学生学习提示")
    body(page.request.patch(f"{prefix}/course-versions/{draft['id']}", headers=headers, data={
        "expectedUpdatedAt": detail["updatedAt"],
        "units": [{
            "id": str(uuid.uuid4()), "title": "TEST_FIXTURE_ONLY 学习单元", "sortOrder": 0,
            "lessons": [{
                "id": str(uuid.uuid4()), "title": "TEST_FIXTURE_ONLY 学习课次", "sortOrder": 0,
                "activities": [
                    {
                        "id": reading_id, "type": "TEXT", "title": "TEST_FIXTURE_ONLY 中文阅读", "sortOrder": 0, "required": True,
                        "instruction": confirmed_fixture("阅读任务普通话说明"),
                        "teacherNotes": ordinary_fixture("PRIVATE_TEACHER_NOTES"),
                        "studentNotes": student_note,
                        "completionRule": {"privateScoringRule": "TEST_FIXTURE_ONLY_PRIVATE_RULE"},
                        "content": {"text": "TEST_FIXTURE_ONLY 普通话阅读正文", "correctAnswer": "TEST_FIXTURE_ONLY_PRIVATE_ANSWER", "referenceAnswer": "TEST_FIXTURE_ONLY_PRIVATE_REFERENCE", "scoringSpec": {"maxScore": 100}},
                        "resources": [],
                    },
                    {
                        "id": runner_id, "type": "TEXT", "title": "TEST_FIXTURE_ONLY 朗读练习", "sortOrder": 1, "required": True,
                        "instruction": confirmed_fixture("朗读练习普通话说明"),
                        "teacherNotes": ordinary_fixture("PRIVATE_TEACHER_NOTES"),
                        "studentNotes": student_note,
                        "completionRule": {"privateScoringRule": "TEST_FIXTURE_ONLY_PRIVATE_RULE"},
                        "content": {"text": "TEST_FIXTURE_ONLY 朗读任务正文", "answerKey": "TEST_FIXTURE_ONLY_PRIVATE_ANSWER"},
                        "resources": [],
                    },
                ],
            }],
        }],
    }))

    # This association is isolated fixture setup because no teacher API currently
    # creates CourseActivityPractice. Course, publication, Assignment, schedule,
    # open, student progress and Runner attempt remain real API operations.
    definition = sql("SELECT id FROM \"PracticeDefinition\" WHERE title='停顿与节奏专项训练';")
    sql(f'''INSERT INTO "CourseActivityPractice" (id,"schoolId","activityId","practiceDefinitionId",required,"createdAt")
      VALUES ('{uuid.uuid4()}','{SCHOOL}','{runner_id}','{definition}',true,now());
      INSERT INTO "PracticeDelivery" (id,"practiceVersionId","schoolId","classId",mode,"reRecordPolicy","mobilePolicy",status,"createdAt","updatedAt")
      SELECT '{uuid.uuid4()}',v.id,'{SCHOOL}','{class_id}','SELF_PRACTICE','{{}}','{{"allowed":true}}','OPEN',now(),now()
      FROM "PracticeVersion" v WHERE v."definitionId"='{definition}' AND v.status='PUBLISHED';''')
    assert definition
    assert sql(f'''SELECT count(*) FROM "PracticeDelivery" WHERE "schoolId"='{SCHOOL}' AND "classId"='{class_id}' AND "practiceVersionId" IN (SELECT id FROM "PracticeVersion" WHERE "definitionId"='{definition}' AND status='PUBLISHED') AND status='OPEN';''') == "1"
    body(page.request.post(f"{prefix}/course-versions/{draft['id']}/publish", headers=headers, data={}))

    now = datetime.now(timezone.utc)
    draft_assignment = body(page.request.post(f"{prefix}/assignments", headers=headers, data={
        "courseVersionId": draft["id"], "title": draft["title"],
        "startsAt": (now - timedelta(minutes=2)).isoformat(),
        "dueAt": (now + timedelta(days=1)).isoformat(),
        "targets": [{"targetType": "CLASS", "classId": class_id}],
    }))
    scheduled = body(page.request.post(f"{prefix}/assignments/{draft_assignment['id']}/schedule", headers=headers, data={"expectedRevision": draft_assignment["revision"]}))
    opened = body(page.request.post(f"{prefix}/assignments/{draft_assignment['id']}/open", headers=headers, data={"expectedRevision": scheduled["revision"]}))
    assert opened["status"] == "OPEN"
    return opened["id"], draft["title"], reading_id, runner_id, headers


@pytest.mark.parametrize("size", [(390, 844), (430, 932), (1440, 1000)])
def test_real_course_bilingual_gate_runner_return_and_scope(runtime, size):
    page, context, suffix, student_id, non_target_id, class_id, enrollment_id = runtime
    page.set_viewport_size({"width": size[0], "height": size[1]})
    assignment_id, title, reading_id, runner_id, teacher_headers = create_real_course_path(page, suffix, class_id, enrollment_id)
    publish_negative_translation_cases(page.request, teacher_headers)

    identifier = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id='{student_id}';''')
    ui_login(page, identifier)
    student_token = page.evaluate("localStorage.getItem('yuzan-access-token')")
    student_headers = {"Authorization": f"Bearer {student_token}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    detail_response = page.request.get(f"{prefix}/student/courses/{assignment_id}", headers=student_headers)
    data = body(detail_response)
    serialized = json.dumps(data, ensure_ascii=False)
    for forbidden in ["PRIVATE_TEACHER_NOTES", "PRIVATE_RULE", "PRIVATE_ANSWER", "PRIVATE_REFERENCE", "correctAnswer", "referenceAnswer", "answerKey", "scoringSpec", "completionRule"]:
        assert forbidden not in serialized
    assert data["courseVersion"]["objectives"][0]["translationLocale"] == "bo-CN"
    assert "translation" not in data["courseVersion"]["objectives"][1]
    assert "translation" not in data["courseVersion"]["objectives"][2]
    assert data["courseVersion"]["objectives"][3]["originalText"] == "TEST_FIXTURE_ONLY 无译文普通话原文"
    assert "translation" not in data["courseVersion"]["objectives"][3]
    first_activity = data["units"][0]["lessons"][0]["activities"][0]
    assert first_activity["studentNotes"]["originalText"] == "TEST_FIXTURE_ONLY 本节学生学习提示"
    assert first_activity["studentNotes"]["translationLocale"] == "bo-CN"

    # Real fresh student session, real API course page, and no positive response interception.
    page.goto(f"{BASE}/student/today/")
    expect(page.locator("[data-primary-action]")).to_be_visible()
    page.locator("[data-primary-action]").click()
    page.wait_for_url(f"**/student/courses/course-detail/?id={assignment_id}")
    expect(page.locator("#cpHeroTitle")).to_have_text(title)
    expect(page.get_by_text("TEST_FIXTURE_ONLY 学习目标普通话原文", exact=True)).to_be_visible()
    expect(page.get_by_text("TEST_FIXTURE_ONLY 阅读任务普通话说明", exact=True)).to_be_visible()
    expect(page.locator("#cpSectionStudentNotes")).to_be_visible()
    expect(page.get_by_text("TEST_FIXTURE_ONLY 本节学生学习提示", exact=True)).to_be_visible()
    assert page.locator("#cpObjectivesList .cp-bilingual-toggle").count() == 1
    assert page.locator("#exerciseSection .cp-bilingual-toggle").count() == 1
    assert page.locator("#cpSectionStudentNotes .cp-bilingual-toggle").count() == 1

    objective_toggle = page.locator("#cpObjectivesList .cp-bilingual-toggle").first
    translation_id = objective_toggle.get_attribute("aria-controls")
    translation_panel = page.locator(f"#{translation_id}")
    expect(translation_panel).to_be_hidden()
    objective_toggle.click()
    expect(objective_toggle).to_have_text("收起藏语辅助说明")
    expect(translation_panel).to_be_visible()
    expect(translation_panel).to_contain_text("TEST_FIXTURE_ONLY <img src=x onerror=window.__t005Xss=1>")
    assert translation_panel.locator("img").count() == 0
    assert page.evaluate("window.__t005Xss === true") is False
    objective_toggle.click()
    expect(translation_panel).to_be_hidden()
    assert page.locator("#cpObjectivesList li").filter(has_text="无译文普通话原文").locator(".cp-bilingual-toggle").count() == 0

    instruction_toggle = page.locator("#exerciseSection .cp-bilingual-toggle").first
    instruction_translation = page.locator(f"#{instruction_toggle.get_attribute('aria-controls')}")
    instruction_toggle.click()
    expect(instruction_translation).to_be_visible()
    instruction_toggle.click()
    expect(instruction_translation).to_be_hidden()

    notes_toggle = page.locator("#cpSectionStudentNotes .cp-bilingual-toggle").first
    notes_translation = page.locator(f"#{notes_toggle.get_attribute('aria-controls')}")
    notes_toggle.click()
    expect(notes_translation).to_be_visible()
    notes_toggle.click()
    expect(notes_translation).to_be_hidden()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

    # Complete the first reading activity through the real course API, then move to Runner.
    page.locator("#exerciseSection .cp-exercise-submit").first.click()
    expect(page.locator("#exerciseSection")).to_contain_text("已确认")
    page.locator(f'.cp-dir-item[data-activity-id="{runner_id}"]').click()
    expect(page.get_by_text("TEST_FIXTURE_ONLY 朗读练习普通话说明", exact=True)).to_be_visible()
    practice_toggle = page.locator("#cpPracticeDesc .cp-bilingual-toggle").first
    practice_translation = page.locator(f"#{practice_toggle.get_attribute('aria-controls')}")
    practice_toggle.click()
    expect(practice_translation).to_be_visible()
    expect(page.locator("#cpPracticeGoBtn")).to_be_visible()
    page.locator("#cpPracticeGoBtn").click()
    page.wait_for_url("**/student/practices/attempts/*/prepare/")
    page.locator("[data-start-session]").click()
    page.wait_for_url("**/runner/")
    expect(page.locator(".question-shell")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.get_by_role("link", name="返回课程", exact=True).click()
    page.wait_for_url(f"**/student/courses/course-detail/?id={assignment_id}*")
    page.reload()
    expect(page.locator("#cpHeroTitle")).to_have_text(title)
    expect(page.get_by_text("TEST_FIXTURE_ONLY 朗读练习普通话说明", exact=True)).to_be_visible()
    expect(page.locator("#cpDirectory")).to_contain_text("已学习")

    refreshed = body(page.request.get(f"{prefix}/student/courses/{assignment_id}", headers=student_headers))
    assert reading_id in refreshed["studentProgress"]["completedActivityIds"]
    assert refreshed["units"][0]["lessons"][0]["activities"][1]["id"] == runner_id
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    out = Path(f"/tmp/yz-rd-t005-runtime/course-{size[0]}.png")
    page.screenshot(path=str(out), full_page=True)

    other_identifier = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id='{non_target_id}';''')
    other = login(page.request, other_identifier)
    other_headers = {"Authorization": f"Bearer {other['accessToken']}"}
    assert page.request.get(f"{prefix}/student/courses/{assignment_id}", headers=other_headers).status in (403, 404)
    assert page.request.get(f"{BASE}/api/v1/schools/{OTHER_SCHOOL}/student/courses/{assignment_id}", headers=student_headers).status == 403
    print(json.dumps({"viewport": size, "assignmentId": assignment_id, "readingActivityId": reading_id, "runnerActivityId": runner_id, "evidence": "REAL_API_DB_BROWSER_TEST_FIXTURES_ONLY"}))
