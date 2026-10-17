"""Opt-in isolated real API/DB proof; positive navigation never stubs responses.

Run only against the task-owned runtime (see the versioned plan's evidence).
Fictional identities are isolated DB fixtures; every tested Assignment uses teacher UI/API transitions.
Course content/publication uses teacher APIs. DRAFT→SCHEDULED→OPEN is exercised without SQL Assignment writes.
Only failure/latency tests intercept requests. No speech process is needed.
"""
import json
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T003_BASE_URL", "")
SCHOOL = "11111111-1111-4111-8111-111111111111"
PASSWORD = "YuzanTest!2026"
pytestmark = pytest.mark.skipif(not BASE, reason="requires YZ_T003 isolated runtime")


def sql(statement):
    container = os.environ["YZ_T003_DB_CONTAINER"]
    assert container.startswith("yz-rd-t003-")
    assert urlparse(BASE).hostname == "127.0.0.1"
    project = subprocess.check_output(
        ["docker", "inspect", container, "--format", '{{index .Config.Labels "com.docker.compose.project"}}'], text=True
    ).strip()
    assert project.startswith("yz-rd-t003-")
    return subprocess.check_output(
        ["docker", "exec", "-i", container, "psql", "-U", os.environ["YZ_T003_DB_USER"],
         "-d", os.environ["YZ_T003_DB_NAME"], "-At", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True,
    ).strip()


def body(response):
    assert response.ok, f"{response.status}: {response.text()}"
    value = response.json()
    return value.get("data", value)


class AuthorizedSession(dict):
    def __repr__(self):
        return "<authorized fictional session>"


def login(request, identifier):
    return AuthorizedSession(body(request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})))


def authenticate(page, session):
    page.goto(f"{BASE}/login/")
    page.evaluate("""session => {
      localStorage.setItem('yuzan-access-token', session.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
      localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
    }""", session)


@pytest.fixture
def runtime():
    suffix = uuid.uuid4().hex
    student, other, class_id, enrollment = [str(uuid.uuid4()) for _ in range(4)]
    # Only fictional identities in an isolated DB. No state/score bypass for the
    # tested student path; course publication and student submission are real APIs.
    sql(f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt")
      SELECT '{class_id}',"schoolId","termId",'T003 class {suffix}','七年级',now(),now()
      FROM "Class" WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{student}','t003-{suffix}','T003 fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE "loginIdentifier"='student.test';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{other}','t003-other-{suffix}','T003 other fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE id='{student}';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
      ('{uuid.uuid4()}','{SCHOOL}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{other}','STUDENT','ACTIVE',now());
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
      ('{enrollment}','{SCHOOL}','{class_id}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{class_id}','33333333-3333-4333-8333-333333333333','TEACHER','ACTIVE',now());''')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 960})
        session = login(page.request, f"t003-{suffix}")
        authenticate(page, session)
        yield page, session, enrollment, login(page.request, f"t003-other-{suffix}")
        browser.close()


def create_course(page, enrollment):
    teacher = login(page.request, "teacher.test")
    headers = {"Authorization": f"Bearer {teacher['accessToken']}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    objective = {"originalText": "阅读后确认完成", "locale": "zh-CN", "translationSource": "NONE", "reviewStatus": "REVIEWED"}
    course = body(page.request.post(f"{prefix}/course-versions", headers=headers, data={
        "title": f"T003 阅读路径 {uuid.uuid4().hex[:8]}", "objectives": [objective],
    }))
    detail = body(page.request.get(f"{prefix}/course-versions/{course['id']}", headers=headers))
    activity = str(uuid.uuid4())
    body(page.request.patch(f"{prefix}/course-versions/{course['id']}", headers=headers, data={
        "expectedUpdatedAt": detail["updatedAt"], "units": [{"id": str(uuid.uuid4()), "title": "阅读单元", "sortOrder": 0,
        "lessons": [{"id": str(uuid.uuid4()), "title": "阅读课次", "sortOrder": 0,
        "activities": [{"id": activity, "title": "阅读后确认", "type": "TEXT", "sortOrder": 0,
        "required": True, "resources": [], "instruction": objective,
        "teacherNotes": objective, "studentNotes": objective,
        "content": {"text": "这是教师通过真实课程 API 发布的隔离验收阅读内容。"}}]}]}],
    }))
    body(page.request.post(f"{prefix}/course-versions/{course['id']}/publish", headers=headers, data={}))
    return course, activity


def ui_login(page, identifier):
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator('#loginAccount').fill(identifier)
    page.locator('#loginPassword').fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null")


def test_teacher_publish_student_today_persistence_and_security(runtime):
    page, session, enrollment, other = runtime
    course, activity = create_course(page, enrollment)
    class_id = sql(f'''SELECT "classId" FROM "Enrollment" WHERE id='{enrollment}';''')
    teacher = login(page.request, "teacher.test")
    headers = {"Authorization": f"Bearer {teacher['accessToken']}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    ui_login(page, "teacher.test")
    page.goto(f"{BASE}/teacher/assignments/")
    page.get_by_role('button', name='新建任务', exact=False).click()
    page.locator('[name="title"]').fill(course['title'])
    page.locator('[name="courseVersionId"]').select_option(course['id'])
    page.locator('[name="classId"]').select_option(class_id)
    now = datetime.now().astimezone()
    page.locator('[name="startsAt"]').fill((now-timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M'))
    page.locator('[name="deadline"]').fill((now+timedelta(days=1)).strftime('%Y-%m-%dT%H:%M'))
    with page.expect_response(lambda r: r.url.endswith('/assignments') and r.request.method == 'POST') as created:
        page.get_by_role('button', name='保存草稿', exact=True).click()
    draft = body(created.value)
    assignment = draft['id']
    assert draft['status'] == 'DRAFT' and draft['revision'] == 1
    assert page.request.get(f"{prefix}/assignments/{assignment}", headers={"Authorization":f"Bearer {session['accessToken']}"}).status == 404
    notification_query = f'''SELECT count(*) FROM "Notification" WHERE "actionUrl"='/student/today/?assignmentId={assignment}';'''
    assert sql(notification_query) == '0'
    invalid_open = page.request.post(f"{prefix}/assignments/{assignment}/open", headers=headers, data={"expectedRevision": 1})
    assert invalid_open.status == 409 and 'ASSIGNMENT_STATUS_INVALID' in invalid_open.text()
    assert page.request.post(f"{prefix}/assignments/{assignment}/schedule", headers=headers, data={}).status == 400
    stale_schedule = page.request.post(f"{prefix}/assignments/{assignment}/schedule", headers=headers, data={"expectedRevision": 999})
    assert stale_schedule.status == 409 and 'ASSIGNMENT_CONFLICT' in stale_schedule.text()
    with pytest.raises(HTTPError) as anonymous:
        urlopen(Request(f"{prefix}/assignments/{assignment}/schedule", data=b'{"expectedRevision":1}', headers={"Content-Type":"application/json"}))
    assert anonymous.value.code == 401
    student_headers = {"Authorization": f"Bearer {session['accessToken']}"}
    today_url = f"{prefix}/student/today"
    assert assignment not in json.dumps(body(page.request.get(today_url, headers=student_headers)))
    row = page.locator(f'.row[data-id="{assignment}"]')
    row.click()
    with page.expect_response(lambda r: r.url.endswith(f'/{assignment}/schedule')) as scheduled:
        page.get_by_role('button', name='确认排期', exact=True).click()
    scheduled_data = body(scheduled.value)
    assert scheduled_data['status'] == 'SCHEDULED' and scheduled_data['revision'] == 2
    assert sql(notification_query) == '0'
    assert assignment not in json.dumps(body(page.request.get(today_url, headers=student_headers)))
    assert page.request.post(f"{prefix}/assignments/{assignment}/open", headers=headers, data={"expectedRevision": 1}).status == 409
    assert sql(notification_query) == '0'
    page.locator(f'.row[data-id="{assignment}"]').click()
    with page.expect_response(lambda r: r.url.endswith(f'/{assignment}/open')) as opened:
        page.get_by_role('button', name='立即开放', exact=True).click()
    opened_data = body(opened.value)
    assert opened_data['status'] == 'OPEN' and opened_data['revision'] == 3
    expect(page.locator(f'.row[data-id="{assignment}"]')).to_contain_text('已发布')
    assert page.request.post(f"{prefix}/assignments/{assignment}/open", headers=headers, data={"expectedRevision": 3}).status == 409
    assert sql(notification_query) == '1'
    assert sql(f'''SELECT count(*) FROM "Notification" WHERE "actionUrl"='/student/today/?assignmentId={assignment}' AND "recipientUserId"='{session["user"]["id"]}';''') == '1'
    assert page.request.post(f"{prefix}/assignments/{assignment}/open", headers=student_headers, data={"expectedRevision": 3}).status == 403
    other_headers = {"Authorization": f"Bearer {other['accessToken']}"}
    assert page.request.get(f"{prefix}/assignments/{assignment}", headers=other_headers).status == 404
    assert page.request.get(f"{prefix}/student/courses/{assignment}", headers=other_headers).status == 404
    assert assignment not in json.dumps(body(page.request.get(today_url, headers=other_headers)))
    # A real teacher from this school has no access to this unrelated class.
    unauthorized_class = sql(f'''SELECT id FROM "Class" WHERE "schoolId"='{SCHOOL}' AND id <> '{class_id}' AND id NOT IN (SELECT "classId" FROM "Enrollment" WHERE "userId"='{teacher['user']['id']}' AND role='TEACHER') LIMIT 1;''')
    if not unauthorized_class:
        unauthorized_class = str(uuid.uuid4())
        sql(f'''INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt") SELECT '{unauthorized_class}',"schoolId","termId",'Forbidden {uuid.uuid4().hex}','七年级',now(),now() FROM "Class" WHERE id='{class_id}';''')
    payload = {"courseVersionId":course['id'], "title":"negative", "startsAt":now.isoformat(), "dueAt":(now+timedelta(days=1)).isoformat(), "targets":[{"targetType":"CLASS","classId":unauthorized_class}]}
    assert page.request.post(f"{prefix}/assignments", headers=headers, data=payload).status == 403
    forbidden_teacher, foreign_school, foreign_term, foreign_class = [str(uuid.uuid4()) for _ in range(4)]
    foreign_code = uuid.uuid4().hex
    sql(f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt") SELECT '{forbidden_teacher}','t003-teacher-{foreign_code}','Unauthorized fictional teacher',"passwordHash",'ACTIVE',now(),now() FROM "User" WHERE "loginIdentifier"='teacher.test';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES ('{uuid.uuid4()}','{SCHOOL}','{forbidden_teacher}','TEACHER','ACTIVE',now());
      INSERT INTO "School" (id,code,name,"createdAt","updatedAt") VALUES ('{foreign_school}','{foreign_code}','T003 foreign school',now(),now());
      INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","createdAt") VALUES ('{foreign_term}','{foreign_school}','T003 term',now(),now()+interval '1 year',now());
      INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt") VALUES ('{foreign_class}','{foreign_school}','{foreign_term}','Foreign class','七年级',now(),now());''')
    forbidden = login(page.request, f't003-teacher-{foreign_code}')
    forbidden_headers = {'Authorization':f"Bearer {forbidden['accessToken']}"}
    assert page.request.get(f'{prefix}/assignments/{assignment}', headers=forbidden_headers).status == 403
    assert page.request.post(f'{prefix}/assignments/{assignment}/open', headers=forbidden_headers, data={'expectedRevision':3}).status == 403
    assert assignment not in json.dumps(body(page.request.get(f'{prefix}/assignments', headers=forbidden_headers)))
    assert page.request.get(f'{BASE}/api/v1/schools/{foreign_school}/assignments/{assignment}', headers=headers).status == 403
    payload['targets'][0]['classId'] = foreign_class
    assert page.request.post(f'{prefix}/assignments', headers=headers, data=payload).status == 404
    payload['targets'][0]['classId'] = class_id
    payload['dueAt'] = (now-timedelta(days=1)).isoformat()
    assert page.request.post(f"{prefix}/assignments", headers=headers, data=payload).status == 400
    assert page.request.get(f"{BASE}/api/v1/schools/{uuid.uuid4()}/assignments/{assignment}", headers=headers).status == 403
    assert page.request.get(f"{prefix}/assignments/{uuid.uuid4()}", headers=headers).status == 404
    identifier = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id='{session["user"]["id"]}';''')
    ui_login(page, identifier)
    page.goto(f"{BASE}/student/today/")
    expect(page.locator('.today-course-item').filter(has_text=course['title']).locator('a')).to_be_visible()
    page.locator('.today-course-item').filter(has_text=course['title']).locator('a').click()
    page.wait_for_url(f"**/student/courses/course-detail/?id={assignment}")
    expect(page.locator('#cpHeroTitle')).to_have_text(course['title'])
    page.get_by_role('button', name='确认阅读', exact=True).click()
    expect(page.get_by_text('已确认', exact=True)).to_be_visible()
    submission = page.evaluate('CoursePlayerState.getState().submissionId')
    page.reload()
    expect(page.get_by_text('已确认阅读', exact=True)).to_be_visible()
    assert page.evaluate('CoursePlayerState.getState().submissionId') == submission
    assert sql(f'''SELECT status FROM "Assignment" WHERE id='{assignment}';''') == 'OPEN'
    assert sql(f'''SELECT count(*) FROM "AssignmentTarget" WHERE "assignmentId"='{assignment}' AND "classId"='{class_id}';''') == '1'
    assert sql(f'''SELECT count(*) FROM "Submission" WHERE id='{submission}' AND "assignmentId"='{assignment}' AND "enrollmentId"='{enrollment}';''') == '1'
    assert sql(f'''SELECT completed FROM "ActivityProgress" WHERE "activityId"='{activity}' AND "enrollmentId"='{enrollment}';''') == 't'
    page.screenshot(path='/tmp/yz-rd-t003-runtime/student-completed.png', full_page=True)
    print(json.dumps({"assignmentId":assignment,"courseVersionId":course['id'],"classId":class_id,"enrollmentId":enrollment,"submissionId":submission,"activityId":activity,"notificationCount":1,"revision":3}))


def test_failure_reload_conflict_and_notification_outage(runtime):
    page, session, enrollment, other = runtime
    course, _ = create_course(page, enrollment)
    teacher = login(page.request, 'teacher.test')
    headers = {'Authorization': f"Bearer {teacher['accessToken']}"}
    prefix = f'{BASE}/api/v1/schools/{SCHOOL}'
    class_id = sql(f'''SELECT "classId" FROM "Enrollment" WHERE id='{enrollment}';''')
    now = datetime.now(timezone.utc)
    draft = body(page.request.post(f'{prefix}/assignments', headers=headers, data={
        'courseVersionId': course['id'], 'title': course['title'], 'startsAt': (now-timedelta(minutes=1)).isoformat(),
        'dueAt': (now+timedelta(days=1)).isoformat(), 'targets': [{'targetType':'CLASS','classId':class_id}],
    }))
    assignment = draft['id']
    authenticate(page, teacher)
    page.goto(f'{BASE}/teacher/assignments/')
    row = page.locator(f'.row[data-id="{assignment}"]')
    expect(row).to_contain_text('已保存草稿')
    row.click()
    schedule_url = f'**/assignments/{assignment}/schedule'
    # Only this deliberate failure is intercepted; the successful path stays real.
    page.route(schedule_url, lambda route: route.abort('failed'))
    page.get_by_role('button', name='确认排期', exact=True).click()
    expect(page.locator('.transition-status')).to_contain_text('重新加载')
    expect(page.get_by_role('button', name='确认排期', exact=True)).to_be_disabled()
    assert sql(f'''SELECT status FROM "Assignment" WHERE id='{assignment}';''') == 'DRAFT'
    page.unroute(schedule_url)
    page.locator('.transition-status').get_by_role('button', name='重新加载', exact=True).click()
    row.click()
    # A second writer increments revision through the legitimate DRAFT update API.
    updated = body(page.request.post(f'{prefix}/assignments/{assignment}', headers=headers, data={
        'title': course['title'], 'expectedRevision': draft['revision'],
    }))
    page.get_by_role('button', name='确认排期', exact=True).click()
    expect(page.locator('.transition-status')).to_contain_text('重新加载')
    assert sql(f'''SELECT status FROM "Assignment" WHERE id='{assignment}';''') == 'DRAFT'
    page.locator('.transition-status').get_by_role('button', name='重新加载', exact=True).click()
    row.click()
    with page.expect_response(lambda r: r.url.endswith(f'/{assignment}/schedule')) as scheduled_response:
        page.get_by_role('button', name='确认排期', exact=True).click()
    scheduled = body(scheduled_response.value)
    assert scheduled['revision'] == updated['revision'] + 1
    # Private database only: a temporary, assignment-scoped notification failure.
    # This never creates or mutates an Assignment/Submission/progress business state.
    function = 't003_notification_' + uuid.uuid4().hex
    sql(f'''CREATE FUNCTION {function}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW."actionUrl" = '/student/today/?assignmentId={assignment}' THEN RAISE EXCEPTION 'T003 deliberate notification outage'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER {function} BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION {function}();''')
    try:
        row.click()
        with page.expect_response(lambda r: r.url.endswith(f'/{assignment}/open')) as opened_response:
            page.get_by_role('button', name='立即开放', exact=True).click()
        opened = body(opened_response.value)
        assert opened['status'] == 'OPEN'
        expect(page.locator(f'.row[data-id="{assignment}"]')).to_contain_text('已发布')
        assert sql(f'''SELECT status FROM "Assignment" WHERE id='{assignment}';''') == 'OPEN'
        assert sql(f'''SELECT count(*) FROM "Notification" WHERE "actionUrl"='/student/today/?assignmentId={assignment}';''') == '0'
        today = body(page.request.get(f'{prefix}/student/today', headers={'Authorization':f"Bearer {session['accessToken']}"}))
        assert assignment in json.dumps(today)
        assert page.request.post(f'{prefix}/assignments/{assignment}/open', headers=headers, data={'expectedRevision':opened['revision']}).status == 409
        page.screenshot(path='/tmp/yz-rd-t003-runtime/teacher-open-outage.png', full_page=True)
        print(json.dumps({'outageAssignmentId':assignment, 'status':'OPEN', 'revision':opened['revision'], 'notifications':0, 'todayVisible':True, 'conflictRecovered':True}))
    finally:
        sql(f'DROP TRIGGER {function} ON "Notification"; DROP FUNCTION {function}();')


def test_concurrent_publish_has_one_effect_and_unpublished_course_rejected(runtime):
    from concurrent.futures import ThreadPoolExecutor
    page, _, enrollment, _ = runtime
    course, _ = create_course(page, enrollment)
    teacher = login(page.request, 'teacher.test')
    headers = {'Authorization':f"Bearer {teacher['accessToken']}"}
    prefix = f'{BASE}/api/v1/schools/{SCHOOL}'
    now = datetime.now(timezone.utc)
    class_id = sql(f'''SELECT "classId" FROM "Enrollment" WHERE id='{enrollment}';''')
    payload = {'courseVersionId':course['id'], 'title':course['title'], 'startsAt':now.isoformat(),
               'dueAt':(now+timedelta(days=1)).isoformat(), 'targets':[{'targetType':'CLASS','classId':class_id}]}
    unpublished = body(page.request.post(f'{prefix}/course-versions', headers=headers, data={'title':'T003 unpublished', 'objectives':[]}))
    assert page.request.post(f'{prefix}/assignments', headers=headers, data={**payload, 'courseVersionId':unpublished['id']}).status == 404
    draft = body(page.request.post(f'{prefix}/assignments', headers=headers, data=payload))
    assignment = draft['id']
    scheduled = body(page.request.post(f'{prefix}/assignments/{assignment}/schedule', headers=headers, data={'expectedRevision':draft['revision']}))
    def publish(_):
        try:
            response = urlopen(Request(f'{prefix}/assignments/{assignment}/open', data=json.dumps({'expectedRevision':scheduled['revision']}).encode(),
                                      headers={**headers, 'Content-Type':'application/json'}))
            return response.status
        except HTTPError as error:
            return error.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(publish, range(2)))
    assert statuses == [200, 409]
    assert sql(f'''SELECT status || ':' || revision FROM "Assignment" WHERE id='{assignment}';''') == 'OPEN:3'
    assert sql(f'''SELECT count(*) FROM "Notification" WHERE "actionUrl"='/student/today/?assignmentId={assignment}';''') == '1'
    print(json.dumps({'concurrentAssignmentId':assignment,'statuses':statuses,'revision':3,'notificationCount':1,'unpublishedCourseStatus':404}))
