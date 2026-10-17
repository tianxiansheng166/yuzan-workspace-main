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
from pathlib import Path
import hashlib
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("YZ_T004_BASE_URL", "")
SCHOOL = "11111111-1111-4111-8111-111111111111"
PASSWORD = "YuzanTest!2026"
pytestmark = pytest.mark.skipif(not BASE, reason="requires YZ_T004 isolated runtime")


def sql(statement):
    container = os.environ["YZ_T004_DB_CONTAINER"]
    assert container.startswith("yz-rd-t004-")
    assert urlparse(BASE).hostname == "127.0.0.1"
    project = subprocess.check_output(
        ["docker", "inspect", container, "--format", '{{index .Config.Labels "com.docker.compose.project"}}'], text=True
    ).strip()
    assert project.startswith("yz-rd-t004-")
    return subprocess.check_output(
        ["docker", "exec", "-i", container, "psql", "-U", os.environ["YZ_T004_DB_USER"],
         "-d", os.environ["YZ_T004_DB_NAME"], "-At", "-v", "ON_ERROR_STOP=1"],
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
      SELECT '{class_id}',"schoolId","termId",'T004 class {suffix}','七年级',now(),now()
      FROM "Class" WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{student}','t004-{suffix}','T004 fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE "loginIdentifier"='student.test';
      INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
      SELECT '{other}','t004-other-{suffix}','T004 other fictional student',"passwordHash",'ACTIVE',now(),now()
      FROM "User" WHERE id='{student}';
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
      ('{uuid.uuid4()}','{SCHOOL}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{other}','STUDENT','ACTIVE',now());
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
      ('{enrollment}','{SCHOOL}','{class_id}','{student}','STUDENT','ACTIVE',now()),
      ('{uuid.uuid4()}','{SCHOOL}','{class_id}','33333333-3333-4333-8333-333333333333','TEACHER','ACTIVE',now());''')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        context = browser.new_context(viewport={"width": 390, "height": 844})
        session = login(context.request, f"t004-{suffix}")
        page = context.new_page()
        page.context.grant_permissions(["microphone"])
        authenticate(page, session)
        yield page, session, enrollment, login(page.request, f"t004-other-{suffix}")
        browser.close()


def ui_login(page, identifier):
    page.goto(f"{BASE}/login/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator('#loginAccount').fill(identifier)
    page.locator('#loginPassword').fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_function("localStorage.getItem('yuzan-access-token') !== null")


def create_path(page, enrollment):
    teacher = login(page.request, "teacher.test")
    headers = {"Authorization": f"Bearer {teacher['accessToken']}"}
    prefix = f"{BASE}/api/v1/schools/{SCHOOL}"
    objective = {"originalText": "移动端朗读与阅读", "locale": "zh-CN", "translationSource": "NONE", "reviewStatus": "REVIEWED"}
    course = body(page.request.post(f"{prefix}/course-versions", headers=headers, data={"title": f"T004 手机真实学习 {uuid.uuid4().hex[:8]}", "objectives": [objective]}))
    detail = body(page.request.get(f"{prefix}/course-versions/{course['id']}", headers=headers))
    # Authored, synthetic MP4/PDF assets; no protected original input is read.
    video = Path('/tmp/yz-rd-t004-runtime/fixture.mp4')
    if not video.exists():
        subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=green:s=320x180:d=2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(video)], check=True)
    pdf_page = page.context.new_page()
    pdf_page.set_content('<h1>T004 fictional reading material</h1><p>Read and speak clearly.</p>')
    pdf_data = pdf_page.pdf()
    pdf_page.close()
    resources = []
    for name, kind, mime, data in [('fixture.mp4','VIDEO','video/mp4',video.read_bytes()),('fixture.pdf','DOCUMENT','application/pdf',pdf_data)]:
        initialized = body(page.request.post(f'{prefix}/resources/presign-upload', headers=headers, data={'fileName':name,'kind':kind,'contentType':mime,'byteSize':len(data)}))
        assert page.request.put(initialized['uploadUrl'], data=data, headers={'Content-Type':mime}).ok
        body(page.request.put(f"{prefix}/resources/{initialized['resourceId']}/confirm-upload", headers=headers, data={'objectKey':initialized['objectKey'],'checksumSha256':hashlib.sha256(data).hexdigest()}))
        sql(f'''UPDATE "Resource" SET "rightsStatus"='APPROVED',"rightsNote"='Task authored synthetic fixture' WHERE id='{initialized['resourceId']}';''')
        resources.append({'id':initialized['resourceId'],'kind':kind,'objectKey':initialized['objectKey'],'mediaType':mime,'byteSize':len(data),'rightsStatus':'APPROVED','rightsNote':'Task authored synthetic test fixture'})
    activity = str(uuid.uuid4())
    text_activity = str(uuid.uuid4())
    body(page.request.patch(f"{prefix}/course-versions/{course['id']}", headers=headers, data={
      "expectedUpdatedAt": detail["updatedAt"], "units": [{"id": str(uuid.uuid4()), "title": "真实学习", "sortOrder": 0,
      "lessons": [{"id": str(uuid.uuid4()), "title": "阅读与朗读", "sortOrder": 0,
      "activities": [{"id": text_activity, "title": "阅读正文", "type": "TEXT", "sortOrder": 0, "required": True, "resources": resources, "instruction": objective, "teacherNotes": objective, "studentNotes": objective, "content": {"text": "这是服务器提供的移动端真实学习正文。"}}, {"id": activity, "title": "阅读与统一练习", "type": "TEXT", "sortOrder": 1, "required": True,
      "resources": [], "instruction": objective, "teacherNotes": objective, "studentNotes": objective, "content": {"text": "这是服务器提供的移动端真实学习正文。"}}]}]}]}))
    # Existing published practice is fixture content, NOT an Assignment/Attempt/Recording state shortcut.
    definition = sql("SELECT id FROM \"PracticeDefinition\" WHERE title='停顿与节奏专项训练';")
    sql(f'''INSERT INTO "CourseActivityPractice" (id,"schoolId","activityId","practiceDefinitionId",required,"createdAt") VALUES ('{uuid.uuid4()}','{SCHOOL}','{activity}','{definition}',true,now());''')
    body(page.request.post(f"{prefix}/course-versions/{course['id']}/publish", headers=headers, data={}))
    class_id = sql(f'''SELECT "classId" FROM "Enrollment" WHERE id='{enrollment}';''')
    sql(f'''INSERT INTO "PracticeDelivery" (id,"practiceVersionId","schoolId","classId",mode,"reRecordPolicy","mobilePolicy",status,"createdAt","updatedAt") SELECT '{uuid.uuid4()}',v.id,'{SCHOOL}','{class_id}','SELF_PRACTICE','{{}}','{{"allowed":true}}','OPEN',now(),now() FROM "PracticeVersion" v WHERE v."definitionId"='{definition}' AND v.status='PUBLISHED';''')
    now = datetime.now(timezone.utc)
    draft = body(page.request.post(f"{prefix}/assignments", headers=headers, data={"courseVersionId": course['id'], "title": course['title'], "startsAt": (now-timedelta(minutes=2)).isoformat(), "dueAt": (now+timedelta(days=1)).isoformat(), "targets": [{"targetType": "CLASS", "classId": class_id}]}))
    assert draft['status'] == 'DRAFT'
    scheduled = body(page.request.post(f"{prefix}/assignments/{draft['id']}/schedule", headers=headers, data={"expectedRevision": draft['revision']}))
    assert scheduled['status'] == 'SCHEDULED'
    opened = body(page.request.post(f"{prefix}/assignments/{draft['id']}/open", headers=headers, data={"expectedRevision": scheduled['revision']}))
    assert opened['status'] == 'OPEN'
    return opened['id'], course['title'], activity, definition


def fit(page, label):
    page.screenshot(path=f"/tmp/yz-rd-t004-runtime/{label}-{page.viewport_size['width']}.png", full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])")


@pytest.mark.parametrize('size', [(390,844),(430,932),(1440,1000)])
def test_mobile_course_recording_resume(runtime, size):
    page, session, enrollment, other = runtime
    page.set_viewport_size({"width": size[0], "height": size[1]})
    assignment, title, activity, definition = create_path(page, enrollment)
    identifier = sql(f'''SELECT "loginIdentifier" FROM "User" WHERE id='{session['user']['id']}';''')
    ui_login(page, identifier)
    page.goto(f"{BASE}/student/today/")
    expect(page.locator('[data-primary-action]')).to_be_visible()
    fit(page, 'today')
    page.locator('[data-primary-action]').click()
    page.wait_for_url(f"**/student/courses/course-detail/?id={assignment}")
    expect(page.locator('#cpHeroTitle')).to_have_text(title)
    expect(page.get_by_text('这是服务器提供的移动端真实学习正文。')).to_be_visible()
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    page.locator('video').evaluate('(v)=>v.play()')
    page.wait_for_function("document.querySelector('video').currentTime > 0")
    expect(page.locator('.cp-materials-frame')).to_be_attached()
    material = page.locator('.cp-materials-open').get_attribute('href')
    assert page.request.get(material).body().startswith(b'%PDF')
    fit(page, 'course')
    page.get_by_role('button', name='确认阅读', exact=True).click()
    page.locator('#cpNextBtn').click()
    with page.expect_response(lambda r: '/attempts' in r.url and r.request.method == 'POST') as created:
        page.locator('#cpPracticeGoBtn').click()
    assert created.value.status in (200, 201)
    page.wait_for_url('**/student/practices/attempts/*/prepare/')
    page.locator('[data-start-session]').click()
    page.wait_for_url('**/runner/')
    expect(page.locator('.question-shell')).to_be_visible()
    fit(page, 'runner')
    page.locator('[data-go="1"]').click()
    expect(page.get_by_text('春风又绿江南岸，明月何时照我还。', exact=True)).to_be_visible()
    attempt = page.url.split('/attempts/')[1].split('/')[0]
    if size[0] == 390:
        # Negative capability/permission injection only; no positive API responses are mocked.
        page.evaluate("window.nativeRecorder = window.MediaRecorder; window.MediaRecorder = undefined")
        page.locator('[data-start-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('不支持录音')
        page.evaluate("() => { window.MediaRecorder = window.nativeRecorder; window.__yuzanRunnerGetUserMedia = () => Promise.reject(new DOMException('Denied','NotAllowedError')); }")
        page.locator('[data-start-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('权限被拒绝')
        page.evaluate("delete window.__yuzanRunnerGetUserMedia")
    if size[0] == 430:
        # Native Chromium MP4 recording, with capability preference constrained
        # to exercise Safari's MP4 branch. This is NOT iOS Safari evidence.
        page.evaluate("() => { window.nativeTypeSupport = MediaRecorder.isTypeSupported.bind(MediaRecorder); MediaRecorder.isTypeSupported = t => t.startsWith('audio/mp4') && window.nativeTypeSupport(t); }")
    page.locator('[data-start-recording]').click()
    page.locator('[data-stop-recording]').wait_for()
    page.wait_for_timeout(2200)
    page.locator('[data-stop-recording]').evaluate('(button)=>{button.click();button.click();}')
    expect(page.locator('[data-upload-recording]')).to_be_visible()
    page.locator('.runner-speech audio').evaluate('(audio)=>audio.play()')
    page.wait_for_function("document.querySelector('.runner-speech audio').currentTime > 0")
    audio_facts = page.evaluate("""async () => {
      const blob = await fetch(document.querySelector('.runner-speech audio').src).then(r=>r.blob());
      const data = await blob.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
      return {bytes:blob.size,mime:blob.type,sha256:digest};
    }""")
    assert audio_facts['bytes'] > 100
    assert audio_facts['mime'].startswith('audio/mp4' if size[0] == 430 else 'audio/webm')
    if size[0] == 390:
        page.route('**/recordings/*/full?*', lambda route: route.abort('internetdisconnected'))
        page.locator('[data-upload-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('上传尚未确认')
        assert page.locator('.runner-speech.saved').count() == 0
        page.unroute('**/recordings/*/full?*')
        page.context.set_offline(True)
        page.locator('[data-upload-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('上传尚未确认')
        page.context.set_offline(False)
        # Expired/invalid signed-link HTTP failure injection exercises the UI;
        # a real expired MinIO signature is checked by the isolated SDK probe
        # recorded in the delivery evidence.
        page.route('**/recordings/*/full?*', lambda route: route.fulfill(status=403, body='<Error><Code>AccessDenied</Code></Error>', headers={'Access-Control-Allow-Origin':BASE}))
        page.locator('[data-upload-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('403')
        page.unroute('**/recordings/*/full?*')
        page.once('dialog', lambda dialog: dialog.accept())
        page.reload()
        expect(page.locator('[data-upload-recording]')).to_be_visible()
        expect(page.locator('.runner-speech')).to_contain_text('本机草稿已保留')
    if size[0] == 430:
        page.route('**/reading/*/recording', lambda route: route.abort('internetdisconnected'))
        page.locator('[data-upload-recording]').click()
        expect(page.locator('[data-save-state]')).to_contain_text('上传尚未确认')
        page.unroute('**/reading/*/recording')
        page.once('dialog', lambda dialog: dialog.accept())
        page.reload()
        expect(page.locator('[data-upload-recording]')).to_be_visible()
    fit(page, 'recording')
    page.locator('[data-upload-recording]').evaluate('(button)=>{button.click();button.click();}')
    expect(page.get_by_text('已成功绑定到本题。')).to_be_visible()
    attempt = page.url.split('/attempts/')[1].split('/')[0]
    prefix = f'{BASE}/api/v1/schools/{SCHOOL}'
    headers = {'Authorization':f"Bearer {session['accessToken']}"}
    foreign = {'Authorization':f"Bearer {other['accessToken']}"}
    items = body(page.request.get(f'{prefix}/practices/attempts/{attempt}/items', headers=headers))
    entries = items if isinstance(items,list) else items['items']
    recording = entries[1]['recordingId']
    status = body(page.request.get(f'{prefix}/recordings/{recording}', headers=headers))
    evidence = body(page.request.get(f'{prefix}/recordings/{recording}/evidence', headers=headers))
    downloaded = page.request.get(evidence['downloadUrl'])
    assert downloaded.ok
    Path(f'/tmp/yz-rd-t004-runtime/recording-{size[0]}.bin').write_bytes(downloaded.body())
    assert downloaded.headers['content-type'] == status['mimeType']
    assert hashlib.sha256(downloaded.body()).hexdigest() == audio_facts['sha256']
    assert status['mimeType'].split(';')[0] == audio_facts['mime'].split(';')[0]
    assert status['status'] in ('COMPLETE','PROCESSING','READY')
    assert page.request.get(f'{prefix}/recordings/{recording}', headers=foreign).status in (403,404)
    assert page.request.get(f'{prefix}/practices/attempts/{attempt}', headers=foreign).status in (403,404)
    assert page.request.get(f'{prefix}/student/courses/{assignment}', headers=foreign).status in (403,404)
    db = json.loads(sql(f'''SELECT json_build_object('recordingId',r.id,'status',r.status,'mime',r."mimeType",'objectKey',r."objectKey",'itemId',i.id,'speechJobs',(SELECT count(*) FROM "SpeechJob" j WHERE j."recordingId"=r.id),'submissionId',s."courseSubmissionId",'activityId',s."courseActivityId",'practiceDefinitionId',s."practiceDefinitionId") FROM "Recording" r JOIN "AssessmentItem" i ON i."recordingId"=r.id JOIN "AssessmentSession" s ON s.id=i."sessionId" WHERE r.id='{recording}';'''))
    assert db['activityId'] == activity and db['practiceDefinitionId'] == definition and db['speechJobs'] == 1
    assert sql(f'''SELECT count(*) FROM "Recording" WHERE "enrollmentId"='{enrollment}';''') == '1'
    # Reread the successful server record across reload and course return.
    page.reload()
    page.locator('[data-go="1"]').click()
    expect(page.get_by_text('已成功绑定到本题。')).to_be_visible()
    page.get_by_role('link', name='返回课程', exact=True).click()
    page.wait_for_url(f'**/student/courses/course-detail/?id={assignment}*')
    page.reload()
    expect(page.locator('#cpHeroTitle')).to_have_text(title)
    page.locator('#cpNextBtn').click() if page.evaluate('CoursePlayerState.getState().currentActivityId') != activity else None
    page.locator('#cpPracticeGoBtn').click()
    page.wait_for_url(f'**/student/practices/attempts/{attempt}/prepare/')
    assert sql(f'''SELECT count(*) FROM "AssessmentSession" WHERE "courseSubmissionId"='{db['submissionId']}' AND "courseActivityId"='{activity}';''') == '1'
    if size[0] == 390:
        page.locator('[data-start-session]').click()
        page.wait_for_url('**/runner/')
        page.locator('[data-go="0"]').click()
        page.locator('[data-choice]').first.click()
        expect(page.locator('[data-save-state]')).to_have_text('已保存')
        page.locator('[data-go="2"]').click()
        page.locator('[data-start-recording]').click()
        page.locator('[data-stop-recording]').wait_for()
        page.wait_for_timeout(2100)
        page.locator('[data-stop-recording]').click()
        page.locator('[data-rerecord]').click()
        page.locator('[data-start-recording]').click()
        page.locator('[data-stop-recording]').wait_for()
        page.wait_for_timeout(2100)
        page.locator('[data-stop-recording]').click()
        page.locator('[data-upload-recording]').click()
        expect(page.get_by_text('已成功绑定到本题。')).to_be_visible()
        page.locator('[data-go="3"]').click()
        page.locator('[data-text]').fill('下次朗读时我会注意停顿和语速。')
        expect(page.locator('[data-save-state]')).to_have_text('已保存')
        page.locator('[data-submit]').click()
        page.wait_for_url(f'**/student/courses/course-detail/?id={assignment}*practiceAttemptId={attempt}')
        page.reload()
        expect(page.locator('#cpHeroTitle')).to_have_text(title)
        assert sql(f'''SELECT count(*) FROM "ActivityProgress" WHERE "enrollmentId"='{enrollment}' AND completed=true;''') == '2'
    print(json.dumps({"apiDb":db,"minio":audio_facts,"viewport": size, "assignmentId": assignment, "activityId": activity, "practiceDefinitionId": definition, "attemptId": attempt, "mic": "SIMULATED_MIC"}))


def test_empty_network_error_retry_and_missing_course(runtime):
    page, session, enrollment, other = runtime
    page.goto(f'{BASE}/student/today/')
    expect(page.locator('#todayApp')).to_have_attribute('data-state','empty')
    expect(page.locator('[data-course-state]')).to_have_attribute('data-course-state','empty')
    fit(page,'empty')
    create_path(page,enrollment)
    page.route('**/student/today',lambda route: route.abort('internetdisconnected'))
    page.reload()
    expect(page.locator('#todayApp')).to_have_attribute('data-state','error')
    fit(page,'today-error')
    page.unroute('**/student/today')
    page.locator('[data-today-retry]').click()
    expect(page.locator('[data-primary-action]')).to_be_visible()
    page.goto(f'{BASE}/student/courses/course-detail/?id={uuid.uuid4()}')
    expect(page.locator('#cpError')).to_be_visible()
    fit(page,'missing-course')
