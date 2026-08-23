"""QB-007 browser proof: student submission, teacher review, and report completion.

This test creates one fresh fictional-student attempt, drives the student runner
with a real browser, reviews all six Level 1 teacher-owned items through the
teacher UI, verifies the generated report, and removes only that fresh attempt.
"""

import base64
import io
import struct
import subprocess
import time
import wave

import pytest
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"
PASSWORD = "YuzanTest!2026"
LEVEL_LABELS = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六"}


def wav_base64():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(struct.pack("<h", 0) * 16000)
    return base64.b64encode(buffer.getvalue()).decode()


TEST_WAV_BASE64 = wav_base64()


def run_sql(statement):
    subprocess.run(
        [
            "docker",
            "exec",
            "p0-integration-postgres-1",
            "psql",
            "-U",
            "yuzan",
            "-d",
            "yuzan_dev",
            "-v",
            "ON_ERROR_STOP=1",
            "-q",
            "-c",
            statement,
        ],
        check=True,
        text=True,
    )


def published_references(level):
    level_label = LEVEL_LABELS[level]
    result = subprocess.run(
        [
            "docker",
            "exec",
            "p0-integration-postgres-1",
            "psql",
            "-U",
            "yuzan",
            "-d",
            "yuzan_dev",
            "-At",
            "-F",
            "\t",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            f"""SELECT i."stableKey", v."scoringSpec"->>'strategy',
                      v."scoringSpec"->>'referenceAnswer'
               FROM "QuestionBankItemVersion" v
               JOIN "QuestionBankItem" i ON i."id" = v."itemId"
              WHERE v."status" = 'PUBLISHED'
                AND i."level" = '水平{level_label}级'
             ORDER BY i."stableKey", v."version" DESC;""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    references = {}
    for line in result.stdout.splitlines():
        stable_key, strategy, reference = line.split("\t", 2)
        references.setdefault(stable_key, (strategy, reference))
    return references


def active_practice_items(level):
    level_label = LEVEL_LABELS[level]
    result = subprocess.run(
        [
            "docker",
            "exec",
            "p0-integration-postgres-1",
            "psql",
            "-U",
            "yuzan",
            "-d",
            "yuzan_dev",
            "-At",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            f"""SELECT i."stableKey"
                   FROM "PracticeDelivery" pd
                   JOIN "PracticeVersion" pv ON pv."id" = pd."practiceVersionId"
                   JOIN "PracticeDefinition" d ON d."id" = pv."definitionId"
                   JOIN "PracticeSection" s ON s."versionId" = pv."id"
                   JOIN "PracticeItemRef" r ON r."sectionId" = s."id"
                   JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
                   JOIN "QuestionBankItem" i ON i."id" = v."itemId"
                  WHERE pd."schoolId" = '11111111-1111-4111-8111-111111111111'
                    AND pd."classId" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
                    AND pd."mode" = 'SELF_PRACTICE'
                    AND pd."status" = 'OPEN'
                    AND d."title" = '国家通用语言文字能力｜水平{level_label}级综合测评'
               ORDER BY s."sortOrder", r."sortOrder";""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    stable_keys = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    assert len(stable_keys) == 20
    assert len(set(stable_keys)) == 20
    return stable_keys


def authenticate(page, identifier):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """payload => {
          localStorage.setItem('yuzan-access-token', payload.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
          localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
        }""",
        payload,
    )


def create_attempt(page, practice_title):
    return page.evaluate(
        """async title => {
          const schoolId = localStorage.getItem('yuzan-active-school-id');
          const headers = { Authorization: `Bearer ${localStorage.getItem('yuzan-access-token')}`, 'Content-Type': 'application/json' };
          const catalogResponse = await fetch(`/api/v1/schools/${schoolId}/practices`, { headers });
          const catalogPayload = await catalogResponse.json();
          const catalog = catalogPayload.data || catalogPayload;
          const practice = catalog.items.find(item => item.title === title);
          if (!practice) throw new Error('Canonical question-bank practice is not visible in the student catalog');
          const attemptResponse = await fetch(`/api/v1/schools/${schoolId}/practices/${practice.id}/attempts`, {
            method: 'POST', headers, body: '{}',
          });
          const attemptPayload = await attemptResponse.json();
          if (!attemptResponse.ok) throw new Error(JSON.stringify(attemptPayload));
          return attemptPayload.data || attemptPayload;
        }""",
        practice_title,
    )


def goto_item(page, index):
    page.locator(f'[data-go="{index}"]').click()
    page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)


def select_choice(page, key):
    try:
        expected = page.locator(f'[data-choice="{key}"]')
        if expected.count() != 1:
            raise AssertionError(f"reference option {key} is not present exactly once")
        expected.click(timeout=10_000)
        page.locator(f'[data-choice="{key}"].selected').wait_for(timeout=10_000)
    except Exception as error:
        raise AssertionError(
            f"选项 {key} 不存在：{page.locator('.runner-progress').inner_text()} "
            f"{page.locator('[data-choice]').all_inner_texts()}"
        ) from error


def fill_text(page, value):
    page.locator("[data-text]").fill(value)
    page.locator("[data-save-state]").get_by_text("已保存").wait_for(timeout=10_000)


def record_speech(page):
    page.locator("[data-start-recording]").click()
    try:
        page.locator("[data-stop-recording]").wait_for(timeout=8_000)
    except Exception as error:
        raise AssertionError(f"录音未进入 RECORDING：{page.locator('.question-shell').inner_text()}") from error
    page.locator("[data-stop-recording]").click()
    page.locator("[data-upload-recording]").wait_for(timeout=8_000)
    page.locator("[data-upload-recording]").click()
    page.locator(".runner-speech.saved").wait_for(timeout=20_000)


def auth_headers(page):
    token = page.evaluate("localStorage.getItem('yuzan-access-token')")
    school_id = page.evaluate("localStorage.getItem('yuzan-active-school-id')")
    return school_id, {"Authorization": f"Bearer {token}"}


def payload(response):
    return response.json().get("data", response.json())


def wait_for_submission(page, attempt_id):
    school_id, headers = auth_headers(page)
    deadline = time.time() + 90
    latest_session = None
    latest_items = None
    while time.time() < deadline:
        session_response = page.request.get(
            f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}",
            headers=headers,
        )
        assert session_response.ok, session_response.text()
        latest_session = payload(session_response)
        items_response = page.request.get(
            f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}/items",
            headers=headers,
        )
        assert items_response.ok, items_response.text()
        latest_items = payload(items_response)
        pending = [item for item in latest_items if item.get("scoredScore") is None]
        speech_pending = [
            item for item in pending
            if (item.get("autoResult") or {}).get("state") == "NEEDS_REVIEW"
        ]
        if (
            latest_session["status"] == "PROCESSING"
            and len(latest_items) == 20
            and len([item for item in latest_items if item.get("scoredScore") is not None]) == 14
            and len(speech_pending) == 4
            and len([item for item in pending if item.get("autoResult") is None]) == 2
        ):
            break
        time.sleep(1)
    assert latest_session["status"] == "PROCESSING", latest_session
    assert len(latest_items) == 20
    assert len([item for item in latest_items if item.get("scoredScore") is not None]) == 14
    return school_id, headers, latest_items


@pytest.mark.parametrize("level", [1, 2, 3, 4, 5, 6])
def test_question_bank_student_teacher_report(level):
    attempt_id = None
    practice_title = f"国家通用语言文字能力｜水平{LEVEL_LABELS[level]}级综合测评"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context()
        context.add_init_script(
            f"""(() => {{
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
            }})()"""
        )
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        try:
            references = published_references(level)
            ordered_keys = active_practice_items(level)
            authenticate(page, "student.test")
            created = create_attempt(page, practice_title)
            attempt_id = created["attemptId"]
            page.goto(f"{BASE}/student/practices/attempts/{attempt_id}/runner/")
            page.locator(".question-shell").wait_for(timeout=15_000)

            listen_choices = [key for key in ordered_keys if "-LISTEN-LISTEN_IMAGE_CHOICE-" in key]
            assert len(listen_choices) == 3
            for stable_key in listen_choices:
                goto_item(page, ordered_keys.index(stable_key))
                page.locator(".audio-stimulus audio").wait_for(timeout=15_000)
                page.locator(".runner-option img").first.wait_for(timeout=15_000)
                assert page.locator(".runner-option img").count() >= 3
                select_choice(page, references[stable_key][1])

            dictation_keys = [key for key in ordered_keys if "-LISTEN-DICTATION-" in key]
            assert len(dictation_keys) == 3
            for stable_key in dictation_keys:
                goto_item(page, ordered_keys.index(stable_key))
                page.locator(".audio-stimulus audio").wait_for(timeout=15_000)
                fill_text(page, references[stable_key][1])

            read_aloud_keys = [key for key in ordered_keys if "-SPEAK-READ_ALOUD-" in key]
            assert len(read_aloud_keys) == 3
            for stable_key in read_aloud_keys:
                goto_item(page, ordered_keys.index(stable_key))
                assert page.locator(".text-stimulus").count() == 1
                record_speech(page)

            picture_speaking_key = next(key for key in ordered_keys if "-SPEAK-PICTURE_SPEAKING-" in key)
            goto_item(page, ordered_keys.index(picture_speaking_key))
            page.locator(".image-stimulus img").wait_for(timeout=15_000)
            record_speech(page)

            read_choices = [key for key in ordered_keys if "-READ-WORD_RECOGNITION-" in key or "-READ-SENTENCE_COMPREHENSION-" in key]
            assert len(read_choices) == 6
            for stable_key in read_choices:
                goto_item(page, ordered_keys.index(stable_key))
                select_choice(page, references[stable_key][1])

            picture_word_keys = [key for key in ordered_keys if "-WRITE-PICTURE_WORD-" in key]
            assert len(picture_word_keys) == 2
            for stable_key in picture_word_keys:
                goto_item(page, ordered_keys.index(stable_key))
                page.locator(".image-stimulus img").wait_for(timeout=15_000)
                fill_text(page, references[stable_key][1].split("/", 1)[0])

            sentence_completion_keys = [key for key in ordered_keys if "-WRITE-SENTENCE_COMPLETION-" in key]
            assert len(sentence_completion_keys) == 2
            for stable_key in sentence_completion_keys:
                goto_item(page, ordered_keys.index(stable_key))
                fill_text(page, "我会认真完成这道题")

            page.locator("[data-submit]").click()
            try:
                page.wait_for_url("**/processing**", timeout=60_000)
            except PlaywrightTimeoutError as error:
                raise AssertionError(f"提交未进入 processing：{page.url} {page.locator('body').inner_text()}") from error
            assert page_errors == [], page_errors

            school_id, student_headers, scored_items = wait_for_submission(page, attempt_id)
            strategy_items = [
                (item, (item.get("autoResult") or {}).get("strategy"))
                for item in scored_items
            ]
            open_item = next(item for item, strategy in strategy_items if strategy == "SPEECH_OPEN_RESPONSE")
            speech_items = [item for item, strategy in strategy_items if strategy == "SPEECH_READING"]
            rubric_items = [item for item, strategy in strategy_items if strategy == "RUBRIC_TEXT"]
            assert len(speech_items) == 3
            assert len(rubric_items) == 2
            assert open_item["scoredScore"] is None
            open_jobs_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/speech-jobs/by-item/{open_item['id']}",
                headers=student_headers,
            )
            assert open_jobs_response.ok, open_jobs_response.text()
            assert len(payload(open_jobs_response)) == 1
            assert payload(open_jobs_response)[0]["status"] == "NEEDS_REVIEW"
            review_item_ids = [item["id"] for item in speech_items + [open_item] + rubric_items]

            authenticate(page, "teacher.test")
            page.goto(f"{BASE}/teacher/reviews/")
            page.locator(".review-list").wait_for(timeout=20_000)
            queue_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/assessment-reviews",
                headers=auth_headers(page)[1],
            )
            assert queue_response.ok, queue_response.text()
            queue_payload = payload(queue_response)
            queue = queue_payload["items"] if isinstance(queue_payload, dict) else queue_payload
            fresh_queue = [item for item in queue if item["sessionId"] == attempt_id]
            assert {item["itemId"] for item in fresh_queue} == set(review_item_ids)
            assert len(page.locator(".review-row").all()) >= 6

            for item in fresh_queue:
                item_id = item["itemId"]
                page.goto(f"{BASE}/teacher/reviews/{item_id}")
                page.locator(".detail-wrap").wait_for(timeout=20_000)
                detail_body = page.locator("body").inner_text()
                assert "教师参考量表" in detail_body
                assert page.locator("[data-review-score]").count() == 1
                if item["strategy"] in {"SPEECH_READING", "SPEECH_OPEN_RESPONSE"}:
                    assert page.locator(".detail-audio audio").count() == 1
                    assert page.locator(".detail-audio audio").get_attribute("src")
                    assert "本地语音诊断" in detail_body
                if item["strategy"] == "SPEECH_OPEN_RESPONSE":
                    page.locator("[data-picture]").wait_for(timeout=20_000)
                    assert page.locator("[data-picture]").get_attribute("src")
                    assert "图片与表达证据" in detail_body
                    assert "教师可见转写" in detail_body
                max_score = page.locator("[data-review-score]").get_attribute("max")
                page.locator("[data-review-score]").fill(max_score)
                page.locator("[data-review-comment]").fill("QB-007 浏览器复核：依据题目量表提交正式分数")
                page.locator("[data-review-submit]").click()
                page.locator("[data-review-message]").get_by_text("已保存").wait_for(timeout=20_000)

            authenticate(page, "student.test")
            report_response = page.request.get(
                f"{BASE}/api/v1/schools/{school_id}/assessments/sessions/{attempt_id}/report",
                headers=auth_headers(page)[1],
            )
            assert report_response.ok, report_response.text()
            report = payload(report_response)
            assert report["summary"]["totalMaxPoints"] == 100
            assert report["summary"]["answeredItems"] == 20
            assert report["overallScore"] is not None
            page.goto(f"{BASE}/student/practices/attempts/{attempt_id}/report/")
            page.locator(".score-number").wait_for(timeout=20_000)
            assert str(report["overallScore"]) in page.locator(".score-number").inner_text()
            assert "已完成" in page.locator("body").inner_text()
            print(
                {
                    "attemptId": attempt_id,
                    "studentItems": 20,
                    "teacherQueueItems": len(fresh_queue),
                    "reportOverallScore": report["overallScore"],
                    "reportState": report.get("summary", {}).get("scoringState"),
                }
            )
        finally:
            browser.close()
            if attempt_id:
                run_sql(
                    f'''DELETE FROM "Recording" WHERE "idempotencyKey" LIKE 'runner-{attempt_id}-%';
DELETE FROM "AssessmentSession" WHERE "id" = '{attempt_id}';'''
                )
