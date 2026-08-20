"""Real-browser regression for a temporary Question Bank Runner practice."""
import subprocess
from uuid import uuid4
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4175"
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"


def sql(statement):
    subprocess.run([
        "docker", "exec", "p0-integration-postgres-1", "psql", "-U", "yuzan", "-d", "yuzan_dev",
        "-v", "ON_ERROR_STOP=1", "-q", "-c", statement,
    ], check=True, text=True)


def create_fixture():
    definition_id, version_id, section_id, delivery_id = [str(uuid4()) for _ in range(4)]
    title = f"QB Runner temporary {definition_id}"
    sql(f'''INSERT INTO "PracticeDefinition" ("id","schoolId","visibility","title","summary","difficulty","estimatedMinutes","status","createdAt","updatedAt") VALUES ('{definition_id}','{SCHOOL_ID}','SCHOOL','{title}','Temporary QBank runner fixture','基础',3,'PUBLISHED',NOW(),NOW());
INSERT INTO "PracticeVersion" ("id","definitionId","version","status","contentHash","publishedAt","createdAt") VALUES ('{version_id}','{definition_id}',1,'PUBLISHED','{definition_id}',NOW(),NOW());
INSERT INTO "PracticeSection" ("id","versionId","title","sortOrder","estimatedMinutes") VALUES ('{section_id}','{version_id}','QB Runner',1,3);
INSERT INTO "PracticeItemRef" ("id","sectionId","questionVersionId","itemType","sortOrder","config") VALUES ('{uuid4()}','{section_id}','75000000-0000-4000-8000-000000000001','CHOICE',1,'{{}}'::jsonb),('{uuid4()}','{section_id}','75000000-0000-4000-8000-000000000002','SHORT_ANSWER',2,'{{}}'::jsonb),('{uuid4()}','{section_id}','75000000-0000-4000-8000-000000000003','SPEECH',3,'{{}}'::jsonb);
INSERT INTO "PracticeDelivery" ("id","practiceVersionId","schoolId","classId","mode","reRecordPolicy","mobilePolicy","status","createdAt","updatedAt") VALUES ('{delivery_id}','{version_id}','{SCHOOL_ID}','{CLASS_ID}','SELF_PRACTICE','{{}}'::jsonb,'{{}}'::jsonb,'OPEN',NOW(),NOW());''')
    return definition_id, title


def cleanup_fixture(definition_id):
    sql(f'''DELETE FROM "AssessmentSession" WHERE "practiceDefinitionId" = '{definition_id}';
DELETE FROM "PracticeDelivery" WHERE "practiceVersionId" IN (SELECT "id" FROM "PracticeVersion" WHERE "definitionId" = '{definition_id}');
DELETE FROM "PracticeDefinition" WHERE "id" = '{definition_id}';''')


def authenticate(page):
    response = page.request.post(f"{BASE}/api/v1/auth/login", data={"identifier": "student.test", "password": "YuzanTest!2026"})
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate("""payload => {
      localStorage.setItem('yuzan-access-token', payload.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)


def create_attempt(page, title):
    return page.evaluate("""async title => {
      const schoolId = localStorage.getItem('yuzan-active-school-id');
      const headers = { Authorization: `Bearer ${localStorage.getItem('yuzan-access-token')}`, 'Content-Type': 'application/json' };
      const catalog = await (await fetch(`/api/v1/schools/${schoolId}/practices`, {headers})).json();
      const practice = (catalog.data || catalog).items.find(item => item.title === title);
      const answer = await (await fetch(`/api/v1/schools/${schoolId}/practices/${practice.id}/attempts`, {method: 'POST', headers, body: '{}'})).json();
      return (answer.data || answer).attemptId;
    }""", title)


definition_id = None
try:
  definition_id, title = create_fixture()
  with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
    context = browser.new_context()
    context.add_init_script("""() => {
      class FakeRecorder { static isTypeSupported() { return true; } constructor() { this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable?.({data:new Blob(['audio'], {type:'audio/webm'})}); this.onstop?.(); } }
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
      window.__yuzanRunnerGetUserMedia = async () => ({ getTracks: () => [] });
    }""")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    authenticate(page)
    attempt_id = create_attempt(page, title)
    url = f"{BASE}/student/practices/attempts/{attempt_id}/runner/"
    page.goto(url)
    page.locator(".question-shell").wait_for(timeout=10_000)
    page.locator("[data-choice]").nth(1).click()
    page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)
    page.reload()
    page.locator(".runner-option.selected").wait_for(timeout=10_000)
    page.locator('[data-go="1"]').click()
    page.locator("[data-text]").fill("Runner 自动保存验证")
    page.wait_for_timeout(1000)
    page.reload()
    page.locator('[data-go="1"]').click()
    assert page.locator("[data-text]").input_value() == "Runner 自动保存验证"
    page.locator('[data-go="2"]').click()
    page.evaluate("""() => {
      class FakeRecorder { static isTypeSupported() { return true; } constructor() { this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable?.({data:new Blob(['audio'], {type:'audio/webm'})}); this.onstop?.(); } }
      window.MediaRecorder = FakeRecorder;
      window.__yuzanRunnerGetUserMedia = async () => ({ getTracks: () => [] });
    }""")
    page.locator("[data-start-recording]").click()
    page.locator("[data-countdown]").wait_for(timeout=5_000)
    page.locator("[data-stop-recording]").wait_for(timeout=6_000)
    page.locator("[data-stop-recording]").click()
    page.locator("[data-upload-recording]").wait_for(timeout=5_000)
    assert errors == [], errors
    browser.close()
finally:
  if definition_id:
    cleanup_fixture(definition_id)
