"""Real browser journey for the canonical Level 1 Question Bank practice.

Requires the local API, frontend, PostgreSQL, and MinIO services. The test uses
the fictional development student, creates one real attempt, and removes only
that attempt and its mock recordings after verification.
"""

import base64
import io
import struct
import subprocess
import time
import wave

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"
PRACTICE_TITLE = "国家通用语言文字能力｜水平一级综合测评"


def test_wav_base64():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(struct.pack("<h", 0) * 16000)
    return base64.b64encode(buffer.getvalue()).decode()


TEST_WAV_BASE64 = test_wav_base64()


def sql(statement):
    subprocess.run([
        "docker", "exec", "p0-integration-postgres-1", "psql", "-U", "yuzan", "-d", "yuzan_dev",
        "-v", "ON_ERROR_STOP=1", "-q", "-c", statement,
    ], check=True, text=True)


def load_dictation_answers():
    result = subprocess.run([
        "docker", "exec", "p0-integration-postgres-1", "psql", "-U", "yuzan", "-d", "yuzan_dev",
        "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c",
        '''SELECT i."stableKey", v."scoringSpec"->>'referenceAnswer'
FROM "QuestionBankItemVersion" v
JOIN "QuestionBankItem" i ON i."id" = v."itemId"
WHERE v."status" = 'PUBLISHED'
  AND i."level" = '水平一级'
  AND i."stableKey" LIKE 'L1-%'
  AND v."scoringSpec"->>'strategy' = 'DICTATION_ALIGNMENT'
ORDER BY i."stableKey";''',
    ], check=True, capture_output=True, text=True)
    answers = [line.split("\t", 1)[1] for line in result.stdout.splitlines() if "\t" in line]
    assert len(answers) == 3
    return answers


def authenticate(page):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate("""payload => {
      localStorage.setItem('yuzan-access-token', payload.accessToken);
      localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)


def create_or_resume_attempt(page):
    return page.evaluate("""async title => {
      const schoolId = localStorage.getItem('yuzan-active-school-id');
      const headers = { Authorization: `Bearer ${localStorage.getItem('yuzan-access-token')}`, 'Content-Type': 'application/json' };
      const catalogResponse = await fetch(`/api/v1/schools/${schoolId}/practices`, { headers });
      const catalogPayload = await catalogResponse.json();
      const catalog = catalogPayload.data || catalogPayload;
      if (catalog.total !== 7) throw new Error(`Expected 7 visible practices, got ${catalog.total}`);
      const practice = catalog.items.find(item => item.title === title);
      if (!practice) throw new Error('Canonical Level 1 practice is not visible in the student catalog');
      const attemptResponse = await fetch(`/api/v1/schools/${schoolId}/practices/${practice.id}/attempts`, {
        method: 'POST', headers, body: '{}',
      });
      const attemptPayload = await attemptResponse.json();
      if (!attemptResponse.ok) throw new Error(JSON.stringify(attemptPayload));
      return attemptPayload.data || attemptPayload;
    }""", PRACTICE_TITLE)


def select_choice(page):
    page.locator("[data-choice]").first.click()
    page.locator(".runner-option.selected").wait_for(timeout=10_000)


def fill_text(page, value):
    page.locator("[data-text]").fill(value)
    page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)


def record_speech(page):
    page.locator("[data-start-recording]").click()
    try:
        page.locator("[data-stop-recording]").wait_for(timeout=8_000)
    except Exception as error:
        raise AssertionError(
            f"录音未进入 RECORDING：{page.locator('.question-shell').inner_text()}"
        ) from error
    page.locator("[data-stop-recording]").click()
    page.locator("[data-upload-recording]").wait_for(timeout=8_000)
    page.locator("[data-upload-recording]").click()
    try:
        page.locator(".runner-speech.saved").wait_for(timeout=15_000)
    except Exception as error:
        raise AssertionError(
            f"录音未保存：{page.locator('main').inner_text()}"
        ) from error


def goto_item(page, index):
    page.locator(f'[data-go="{index}"]').click()
    page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)


def wait_for_audio(page):
    audio = page.locator(".audio-stimulus audio")
    audio.wait_for(timeout=15_000)
    assert audio.count() == 1


def wait_for_choice_images(page):
    images = page.locator(".runner-option img")
    images.nth(3).wait_for(timeout=15_000)
    assert images.count() == 4


attempt_id = None
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context()
        context.add_init_script(f"""(() => {{
          const encoded = "{TEST_WAV_BASE64}";
          const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
          class FakeRecorder {{
            static isTypeSupported() {{ return true; }}
            constructor(_stream, _options) {{ this.state = 'inactive'; this.mimeType = 'audio/wav'; }}
            start() {{ this.state = 'recording'; }}
            stop() {{
              this.state = 'inactive';
              this.ondataavailable?.({{ data: new Blob([bytes], {{ type: this.mimeType }}) }});
              this.onstop?.();
            }}
          }}
          Object.defineProperty(window, 'MediaRecorder', {{ configurable: true, value: FakeRecorder }});
          window.__yuzanRunnerGetUserMedia = async () => ({{ getTracks: () => [] }});
        }})()""")
        page = context.new_page()
        page_errors = []
        item_payloads = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        authenticate(page)
        created = create_or_resume_attempt(page)
        attempt_id = created["attemptId"]
        dictation_answers = load_dictation_answers()
        page.on("response", lambda response: item_payloads.append(response.json()) if f"/attempts/{attempt_id}/items" in response.url and response.ok else None)
        page.goto(f"{BASE}/student/practices/attempts/{attempt_id}/runner/")
        page.locator(".question-shell").wait_for(timeout=15_000)

        # 1. 听：audio + four image choices, authored A/B/C/D order.
        wait_for_audio(page)
        wait_for_choice_images(page)
        assert page.locator(".runner-option b").all_inner_texts() == ["A", "B", "C", "D"]
        select_choice(page)
        page.reload()
        page.locator(".runner-option.selected").wait_for(timeout=15_000)

        # Complete the remaining two listen-picture choices and three dictation inputs.
        for index in [1, 2]:
            goto_item(page, index)
            wait_for_audio(page)
            wait_for_choice_images(page)
            select_choice(page)
        for index in [3, 4, 5]:
            goto_item(page, index)
            wait_for_audio(page)
            fill_text(page, dictation_answers[index - 3])

        # 2. 说：three read-aloud text prompts, then picture speaking.
        for index in [6, 7, 8]:
            goto_item(page, index)
            assert page.locator(".text-stimulus").count() == 1
            assert page.locator("[data-start-recording]").count() == 1
            record_speech(page)
        goto_item(page, 9)
        page.locator(".image-stimulus img").wait_for(timeout=15_000)
        assert page.locator("[data-start-recording]").count() == 1
        record_speech(page)

        # 3. 读：word recognition and sentence comprehension choices.
        for index in range(10, 16):
            goto_item(page, index)
            assert page.locator(".text-stimulus").count() == 1
            assert page.locator("[data-choice]").count() >= 3
            select_choice(page)

        # 4. 写：two picture-to-word items followed by sentence completion.
        for index in [16, 17]:
            goto_item(page, index)
            page.locator(".image-stimulus img").wait_for(timeout=15_000)
            fill_text(page, f"看图写词 {index}")
        for index in [18, 19]:
            goto_item(page, index)
            assert page.locator(".text-stimulus").count() == 1
            fill_text(page, f"句子补全 {index}")

        page.locator("[data-submit]").click()
        try:
            page.wait_for_url("**/processing**", timeout=60_000)
        except PlaywrightTimeoutError as error:
            raise AssertionError(
                f"提交未进入 processing：url={page.url} body={page.locator('body').inner_text()}"
            ) from error
        assert page_errors == [], page_errors
        assert item_payloads, "Runner did not request its attempt-item payload"
        serialized = str(item_payloads)
        for protected in ["scoringSpec", "correctAnswer", "acceptedAnswers", "referenceAnswer", "rubric", "deductionRules", "scoredScore", "autoResult"]:
            assert protected not in serialized

        school_id = page.evaluate("localStorage.getItem('yuzan-active-school-id')")
        token = page.evaluate("localStorage.getItem('yuzan-access-token')")
        headers = {"Authorization": f"Bearer {token}"}
        deadline = time.time() + 60
        session_payload = None
        scored_items_payload = None
        while time.time() < deadline:
            session_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}",
                headers=headers,
            )
            assert session_response.ok, session_response.text()
            session_payload = session_response.json().get("data", session_response.json())
            scored_items_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}/items",
                headers=headers,
            )
            assert scored_items_response.ok, scored_items_response.text()
            scored_items_payload = scored_items_response.json().get("data", scored_items_response.json())
            local_diagnostics = [
                item for item in scored_items_payload
                if (item.get("autoResult") or {}).get("provider") == "local"
            ]
            if session_payload["status"] == "PROCESSING" and len(local_diagnostics) == 3:
                break
            time.sleep(1)

        assert session_payload["status"] == "PROCESSING", session_payload
        assert len(scored_items_payload) == 20
        scored_items = [item for item in scored_items_payload if item.get("scoredScore") is not None]
        assert len(scored_items) == 14
        pending_items = [item for item in scored_items_payload if item.get("scoredScore") is None]
        local_diagnostics = [
            item for item in pending_items
            if (item.get("autoResult") or {}).get("provider") == "local"
        ]
        assert len(local_diagnostics) == 3
        assert all(
            item["autoResult"]["state"] == "NEEDS_REVIEW"
            and item["autoResult"]["finalizable"] is False
            and item["autoResult"]["candidatePoints"] <= item["autoResult"]["maxScore"]
            and "transcript" not in item["autoResult"]
            and "errors" not in item["autoResult"]
            for item in local_diagnostics
        )
        assert len([item for item in pending_items if (item.get("autoResult") or {}).get("state") == "NEEDS_REVIEW"]) == 5
        assert len([item for item in pending_items if item.get("autoResult") is None]) == 1
        for item in scored_items:
            assert 0 <= item["scoredScore"] <= item["maxScore"]
            assert item["autoResult"]["scorerVersion"] == "qb-deterministic-v1"

        for index in [6, 7, 8]:
            jobs_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/speech-jobs/by-item/{scored_items_payload[index]['id']}",
                headers=headers,
            )
            assert jobs_response.ok, jobs_response.text()
            jobs = jobs_response.json().get("data", jobs_response.json())
            assert len(jobs) == 1
            assert jobs[0]["status"] == "NEEDS_REVIEW"
        picture_jobs_response = page.request.get(
            f"{BASE}/api/v1/schools/{school_id}/speech-jobs/by-item/{scored_items_payload[9]['id']}",
            headers=headers,
        )
        assert picture_jobs_response.ok, picture_jobs_response.text()
        assert picture_jobs_response.json().get("data", picture_jobs_response.json()) == []

        report_response = page.request.get(
            f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}/report",
            headers=headers,
        )
        if report_response.status == 200:
            assert report_response.json().get("data") is None, report_response.text()
        else:
            assert report_response.status in (404, 409), report_response.text()
        serialized_scored = str(scored_items_payload)
        for protected in ["scoringSpec", "correctAnswer", "acceptedAnswers", "referenceAnswer", "rubric", "deductionRules"]:
            assert protected not in serialized_scored
        browser.close()
finally:
    if attempt_id:
        sql(f'''DELETE FROM "Recording" WHERE "idempotencyKey" LIKE 'runner-{attempt_id}-%';
DELETE FROM "AssessmentSession" WHERE "id" = '{attempt_id}';''')
