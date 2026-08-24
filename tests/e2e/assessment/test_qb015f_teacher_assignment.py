"""QB-015F Chromium closure for teacher-assigned deterministic remediation.

The fixture reads the published Level 1 delivery from the isolated database,
creates only two temporary students and completed formal snapshots, then drives
the real teacher diagnostics page and the existing student Runner. It never
copies question-bank content into the test and refuses a shared runtime when
QB_RELEASE_* values are supplied by the release runner.
"""

import base64
import io
import json
import os
import struct
import subprocess
import time
import uuid
import wave

from playwright.sync_api import sync_playwright


BASE = os.environ.get("QB_RELEASE_BASE_URL", "http://127.0.0.1:4175")
DB_CONTAINER = os.environ.get("QB_RELEASE_DB_CONTAINER", "p0-integration-postgres-1")
DB_USER = os.environ.get("QB_RELEASE_DB_USER", "yuzan")
DB_NAME = os.environ.get("QB_RELEASE_DB_NAME", "yuzan_dev")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
TEACHER_ID = "33333333-3333-4333-8333-333333333333"
CANONICAL_CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
PASSWORD = "YuzanTest!2026"
DOMAIN_NAMES = {"LISTEN": "听", "SPEAK": "说", "READ": "读", "WRITE": "写"}
FAMILY_NAMES = {
    "LISTEN_IMAGE_CHOICE": "听音选图", "DICTATION": "听写句子",
    "READ_ALOUD": "朗读句子", "PICTURE_SPEAKING": "看图说话",
    "WORD_RECOGNITION": "单词认读", "SENTENCE_COMPREHENSION": "句子理解",
    "PICTURE_WORD": "看图写词", "SENTENCE_COMPLETION": "句子补全",
}
FAMILY_ORDER = list(FAMILY_NAMES)


def sql(statement, *, capture=False):
    result = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"],
        input=statement,
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def quote(value):
    return str(value).replace("'", "''")


def round_score(value):
    return round(value + 1e-9, 2)


def score_bucket(earned, maximum):
    percentage = round_score(earned / maximum * 100)
    return {
        "earnedPoints": round_score(earned),
        "maxPoints": round_score(maximum),
        "percentage": percentage,
        "proficiency": "STRONG" if percentage >= 85 else "DEVELOPING" if percentage >= 70 else "PRIORITY",
    }


def diagnosis_for(items, scores):
    domains, families = {}, {}
    for item, earned in zip(items, scores):
        domain = domains.setdefault(item["domain"], {"earned": 0, "max": 0, "count": 0, "level": item["level"]})
        family = families.setdefault(item["family"], {"earned": 0, "max": 0, "count": 0, "domain": item["domain"], "level": item["level"]})
        for bucket in (domain, family):
            bucket["earned"] += earned
            bucket["max"] += item["maxScore"]
            bucket["count"] += 1
    domain_rows = []
    for key in ["LISTEN", "SPEAK", "READ", "WRITE"]:
        bucket = domains[key]
        domain_rows.append({**score_bucket(bucket["earned"], bucket["max"]), "domain": key, "displayName": DOMAIN_NAMES[key], "itemCount": bucket["count"], "lostPoints": round_score(bucket["max"] - bucket["earned"])})
    family_rows = []
    for key in FAMILY_ORDER:
        bucket = families[key]
        family_rows.append({**score_bucket(bucket["earned"], bucket["max"]), "family": key, "displayName": FAMILY_NAMES[key], "domain": bucket["domain"], "domainDisplayName": DOMAIN_NAMES[bucket["domain"]], "levels": [bucket["level"]], "itemCount": bucket["count"], "lostPoints": round_score(bucket["max"] - bucket["earned"])})
    priorities = sorted([row for row in family_rows if row["proficiency"] == "PRIORITY"], key=lambda row: (row["percentage"], -row["lostPoints"], FAMILY_ORDER.index(row["family"])))[:3]
    strengths = sorted([row for row in family_rows if row["proficiency"] == "STRONG"], key=lambda row: (-row["percentage"], -row["earnedPoints"], FAMILY_ORDER.index(row["family"])))[:2]
    retry = []
    for item, earned in zip(items, scores):
        if earned < item["maxScore"]:
            retry.append({"assessmentItemId": item["assessmentItemId"], "questionVersionId": item["questionVersionId"], "family": item["family"], "displayName": FAMILY_NAMES[item["family"]], "domain": item["domain"], "domainDisplayName": DOMAIN_NAMES[item["domain"]], "earned": round_score(earned), "max": round_score(item["maxScore"])})
    return {
        "version": "qb-diagnosis-v1",
        "overall": score_bucket(sum(scores), sum(item["maxScore"] for item in items)),
        "domains": domain_rows,
        "families": family_rows,
        "strengths": strengths,
        "priorities": priorities,
        "retryCandidates": retry,
        "nextSteps": [{"family": row["family"], "displayName": row["displayName"], "domain": row["domain"], "domainDisplayName": row["domainDisplayName"], "levels": row["levels"], "guidance": "QB-015F controlled fixture"} for row in priorities],
    }


def load_delivery():
    delivery = sql(
        f'''SELECT pd."id", pd."practiceVersionId", pv."definitionId"
              FROM "PracticeDelivery" pd
              JOIN "PracticeVersion" pv ON pv."id" = pd."practiceVersionId"
              JOIN "PracticeDefinition" d ON d."id" = pv."definitionId"
             WHERE pd."schoolId" = '{SCHOOL_ID}' AND pd."classId" = '{CANONICAL_CLASS_ID}'
               AND pd."status" = 'OPEN' AND d."title" = '国家通用语言文字能力｜水平一级综合测评';''', capture=True,
    ).split("\t")
    assert len(delivery) == 3
    rows = sql(
        f'''SELECT r."questionVersionId", r."itemType", s."title", s."sortOrder", r."sortOrder",
                    (v."scoringSpec"->>'maxScore')::double precision, i."domain", i."questionType", i."level"
               FROM "PracticeSection" s
               JOIN "PracticeItemRef" r ON r."sectionId" = s."id"
               JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
               JOIN "QuestionBankItem" i ON i."id" = v."itemId"
              WHERE s."versionId" = '{delivery[1]}'
              ORDER BY s."sortOrder", r."sortOrder";''', capture=True,
    ).splitlines()
    items = []
    for line in rows:
        version, item_type, title, section_order, sort_order, maximum, domain, family, level = line.split("\t")
        items.append({"questionVersionId": version, "itemType": item_type, "sectionTitle": title, "sectionOrder": int(section_order), "sortOrder": int(sort_order), "maxScore": float(maximum), "domain": domain, "family": family, "level": level})
    assert len(items) == 20 and sum(item["maxScore"] for item in items) == 100
    return {"id": delivery[0], "versionId": delivery[1], "definitionId": delivery[2], "items": items}


def ensure_student_two():
    user_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    enrollment_id = str(uuid.uuid4())
    sql(f'''INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "status", "createdAt", "updatedAt")
             SELECT '{user_id}', 'qb015f-browser-{user_id}@test.invalid', 'QB-015F Student 2', "passwordHash", 'ACTIVE', NOW(), NOW()
               FROM "User" WHERE "id" = '{"22222222-2222-4222-8222-222222222222"}';
             INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
             VALUES ('{membership_id}', '{SCHOOL_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());
             INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
             VALUES ('{enrollment_id}', '{SCHOOL_ID}', '{CANONICAL_CLASS_ID}', '{user_id}', 'STUDENT', 'ACTIVE', NOW());''')
    return user_id, enrollment_id


def create_source(user_id, enrollment_id, delivery):
    session_id = str(uuid.uuid4())
    created_at = "2026-08-24T10:00:00+00:00"
    scores = [0.0 if item["family"] in {"LISTEN_IMAGE_CHOICE", "DICTATION", "READ_ALOUD"} else item["maxScore"] for item in delivery["items"]]
    values = []
    diagnosis_items = []
    for sort_order, (item, earned) in enumerate(zip(delivery["items"], scores), start=1):
        item_id = str(uuid.uuid4())
        diagnosis_items.append({**item, "assessmentItemId": item_id, "sortOrder": sort_order})
        values.append(f'''('{item_id}', '{session_id}', '{item["questionVersionId"]}', '{{}}'::jsonb, '{{}}'::jsonb, '{quote(item["itemType"])}', '{quote(item["sectionTitle"])}', {item["sectionOrder"]}, {sort_order}, {item["maxScore"]}, {earned}, '{created_at}', '{created_at}')''')
    diagnosis = diagnosis_for(diagnosis_items, scores)
    sql(f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "completedAt", "practiceDefinitionId", "practiceVersionId", "deliveryId", "createdAt", "updatedAt")
             VALUES ('{session_id}', '{SCHOOL_ID}', '{enrollment_id}', '{CANONICAL_CLASS_ID}', '{user_id}', 'MIXED', 'STANDARD', 'COMPLETED', '{created_at}', '{delivery["definitionId"]}', '{delivery["versionId"]}', '{delivery["id"]}', '{created_at}', '{created_at}');
             INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemConfig", "itemType", "sectionTitle", "sectionOrder", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt") VALUES {','.join(values)};
             INSERT INTO "AssessmentReport" ("id", "sessionId", "schoolId", "overallScore", "dataCompleteness", "summary", "createdAt", "updatedAt")
             VALUES ('{str(uuid.uuid4())}', '{session_id}', '{SCHOOL_ID}', {diagnosis["overall"]["earnedPoints"]}, 100, '{quote(json.dumps({"diagnosis": diagnosis}, ensure_ascii=False))}'::jsonb, '{created_at}', '{created_at}');''')
    return session_id


def authenticate(page, identifier):
    response = page.request.post(f"{BASE}/api/v1/auth/login", data={"identifier": identifier, "password": PASSWORD})
    assert response.ok, response.text()
    payload = response.json().get("data", response.json())
    page.goto(f"{BASE}/login/")
    page.evaluate("""payload => { localStorage.setItem('yuzan-access-token', payload.accessToken); localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user)); localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId); }""", payload)


def payload(response):
    return response.json().get("data", response.json())


def wav_base64():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(struct.pack("<h", 0) * 16000)
    return base64.b64encode(buffer.getvalue()).decode()


TEST_WAV_BASE64 = wav_base64()


def record_speech(page):
    page.locator("[data-start-recording]").click()
    page.locator("[data-stop-recording]").wait_for(timeout=10_000)
    page.locator("[data-stop-recording]").click()
    page.locator("[data-upload-recording]").wait_for(timeout=10_000)
    page.locator("[data-upload-recording]").click()
    page.locator(".runner-speech.saved").wait_for(timeout=20_000)


def test_qb015f_teacher_assigns_and_student_completes_subset():
    assert "p0-integration" not in os.environ.get("COMPOSE_PROJECT_NAME", "").lower()
    delivery = load_delivery()
    student1_id = "22222222-2222-4222-8222-222222222222"
    student1_enrollment = sql(f'''SELECT "id" FROM "Enrollment" WHERE "schoolId" = '{SCHOOL_ID}' AND "classId" = '{CANONICAL_CLASS_ID}' AND "userId" = '{student1_id}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE' LIMIT 1;''', capture=True)
    assert student1_enrollment
    student2_id, student2_enrollment = ensure_student_two()
    source_ids = [create_source(student1_id, student1_enrollment, delivery), create_source(student2_id, student2_enrollment, delivery)]
    assignment_ids = []
    speech_assignment_ids = []
    source_reports_before = [sql(f'''SELECT "overallScore", "summary"::text FROM "AssessmentReport" WHERE "sessionId" = '{source_id}';''', capture=True) for source_id in source_ids]
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            context = browser.new_context(viewport={"width": 1440, "height": 1100})
            context.add_init_script(f"""(() => {{
              const encoded = "{TEST_WAV_BASE64}";
              const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
              class FakeRecorder {{
                static isTypeSupported() {{ return true; }}
                constructor() {{ this.state = 'inactive'; this.mimeType = 'audio/wav'; }}
                start() {{ this.state = 'recording'; }}
                stop() {{ this.state = 'inactive'; this.ondataavailable?.({{ data: new Blob([bytes], {{ type: this.mimeType }}) }}); this.onstop?.(); }}
              }}
              Object.defineProperty(window, 'MediaRecorder', {{ configurable: true, value: FakeRecorder }});
              window.__yuzanRunnerGetUserMedia = async () => ({{ getTracks: () => [] }});
            }})()""")
            page = context.new_page()
            dialogs = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))

            authenticate(page, "teacher.test")
            page.goto(f"{BASE}/teacher/diagnostics/", wait_until="networkidle")
            page.locator("#diagnostic-content").wait_for(timeout=20_000)
            page.locator("#diagnostic-class").select_option(CANONICAL_CLASS_ID)
            page.locator("#diagnostic-practice").select_option(delivery["definitionId"])
            page.get_by_text("已测人数 / 总人数").wait_for(timeout=20_000)
            page.locator("#diagnostic-students").wait_for(timeout=20_000)
            checks = page.locator('[data-select-enrollment]')
            assert checks.count() >= 2
            for index in range(checks.count()):
                checks.nth(index).check()
            page.locator("#remediation-focus").select_option("LISTEN_IMAGE_CHOICE")
            page.locator("#assign-remediation").click()
            page.wait_for_timeout(500)
            assert dialogs and "已布置 2 项" in dialogs[-1]

            assignment_rows = sql(
                f'''SELECT s."id", e."userId"
                       FROM "AssessmentSession" s JOIN "Enrollment" e ON e."id" = s."enrollmentId"
                      WHERE s."schoolId" = '{SCHOOL_ID}' AND s."purpose" = 'REMEDIATION' AND s."remediationOrigin" = 'TEACHER_ASSIGNED'
                        AND s."retestOfSessionId" IN ('{source_ids[0]}', '{source_ids[1]}')
                        AND s."remediationFocus"->>'family' = 'LISTEN_IMAGE_CHOICE';''', capture=True,
            ).splitlines()
            assert len(assignment_rows) == 2
            assignment_ids = [line.split("\t")[0] for line in assignment_rows]
            student1_assignment = next(line.split("\t")[0] for line in assignment_rows if line.split("\t")[1] == student1_id)

            authenticate(page, "student.test")
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            page.locator(".assigned-remediations").wait_for(timeout=20_000)
            assigned_text = page.locator(".assigned-remediations").inner_text()
            assert "老师布置的专项巩固" in assigned_text
            assert "听音选图" in assigned_text and "3 道题" in assigned_text
            page.locator(f'a[href="/student/practices/attempts/{student1_assignment}/runner/"]').click()
            page.locator(".question-shell").wait_for(timeout=20_000)
            assert "第 1 / 3 题" in page.locator(".runner-progress").inner_text()

            refs = sql(
                f'''SELECT a."sortOrder", v."scoringSpec"->>'referenceAnswer'
                       FROM "AssessmentItem" a JOIN "QuestionBankItemVersion" v ON v."id" = a."questionVersionId"
                      WHERE a."sessionId" = '{student1_assignment}' ORDER BY a."sortOrder";''', capture=True,
            ).splitlines()
            expected = [line.split("\t")[1] for line in refs]
            assert len(expected) == 3 and all(expected)
            for index, key in enumerate(expected):
                if index:
                    page.locator(f'[data-go="{index}"]').click()
                    page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)
                option = page.locator(f'[data-choice="{key}"]')
                assert option.count() == 1, f"expected option {key} is not present"
                option.click()
                page.locator(f'[data-choice="{key}"].selected').wait_for(timeout=10_000)
                if index == 0:
                    page.reload()
                    page.locator(".question-shell").wait_for(timeout=20_000)
                    assert page.locator('[data-choice].selected').count() == 1
                    assert "第 1 / 3 题" in page.locator(".runner-progress").inner_text()
            page.locator("[data-submit]").click()
            page.wait_for_url("**/processing/**", timeout=30_000)
            page.get_by_role("heading", name="本次巩固已完成").wait_for(timeout=30_000)
            assert "不会改变正式测评结果" in page.locator("body").inner_text()
            result_response = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{student1_assignment}/remediation-result", headers={"Authorization": f"Bearer {page.evaluate('localStorage.getItem(\"yuzan-access-token\")')}"})
            assert result_response.ok, result_response.text()
            result = payload(result_response)
            assert result["itemCount"] == 3 and result["pendingItemCount"] == 0
            serialized = json.dumps(result, ensure_ascii=False)
            for forbidden in ["correctAnswer", "referenceAnswer", "acceptedAnswers", "scoringSpec", "rubric", "sourceTrace", "providerAudit", "rawResponse", "transcript", "candidatePoints"]:
                assert forbidden not in serialized

            authenticate(page, "teacher.test")
            page.goto(f"{BASE}/teacher/diagnostics/", wait_until="networkidle")
            page.locator("#diagnostic-content").wait_for(timeout=20_000)
            page.locator("#diagnostic-class").select_option(CANONICAL_CLASS_ID)
            page.locator("#diagnostic-practice").select_option(delivery["definitionId"])
            page.get_by_text("已测人数 / 总人数").wait_for(timeout=20_000)
            page.locator("#diagnostic-students").wait_for(timeout=20_000)
            row = page.locator("#diagnostic-students tr").filter(has_text="测试学生")
            assert row.count() == 1
            assert "老师布置 · COMPLETED" in row.inner_text()

            # The same real teacher UI now assigns READ_ALOUD. The student
            # records fresh audio; the worker and local scorer create review
            # evidence, but the provider candidate never becomes a formal score.
            page.locator(f'[data-select-enrollment="{student1_enrollment}"]').check()
            page.locator("#remediation-focus").select_option("READ_ALOUD")
            page.locator("#assign-remediation").click()
            page.wait_for_timeout(500)
            assert dialogs and "已布置 1 项" in dialogs[-1]
            speech_row = sql(
                f'''SELECT s."id" FROM "AssessmentSession" s
                      WHERE s."schoolId" = '{SCHOOL_ID}' AND s."purpose" = 'REMEDIATION'
                        AND s."remediationOrigin" = 'TEACHER_ASSIGNED' AND s."retestOfSessionId" = '{source_ids[0]}'
                        AND s."remediationFocus"->>'family' = 'READ_ALOUD' LIMIT 1;''', capture=True,
            )
            assert speech_row
            speech_assignment_ids = [speech_row]

            authenticate(page, "student.test")
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            read_card = page.locator(".assigned-remediations article").filter(has_text="朗读句子")
            read_card.wait_for(timeout=20_000)
            page.locator(f'a[href="/student/practices/attempts/{speech_row}/runner/"]').click()
            page.locator(".question-shell").wait_for(timeout=20_000)
            assert "第 1 / 3 题" in page.locator(".runner-progress").inner_text()
            for index in range(3):
                if index:
                    page.locator(f'[data-go="{index}"]').click()
                    page.locator(f'[data-go="{index}"].current').wait_for(timeout=10_000)
                record_speech(page)
            page.locator("[data-submit]").click()
            page.wait_for_url("**/processing/**", timeout=30_000)
            speech_items = sql(f'''SELECT "id" FROM "AssessmentItem" WHERE "sessionId" = '{speech_row}' ORDER BY "sortOrder";''', capture=True).splitlines()
            assert len(speech_items) == 3
            deadline = time.time() + 90
            while time.time() < deadline:
                ready = sql(f'''SELECT COUNT(*) FROM "SpeechJob" WHERE "assessmentItemId" IN ('{"','".join(speech_items)}') AND "status" = 'NEEDS_REVIEW';''', capture=True)
                if ready == "3":
                    break
                time.sleep(1)
            assert sql(f'''SELECT COUNT(*) FROM "SpeechJob" WHERE "assessmentItemId" IN ('{"','".join(speech_items)}') AND "status" = 'NEEDS_REVIEW';''', capture=True) == "3"
            speech_payload = payload(page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{speech_row}/items", headers={"Authorization": f"Bearer {page.evaluate('localStorage.getItem(\"yuzan-access-token\")')}"}))
            assert all((item.get("autoResult") or {}).get("strategy") == "SPEECH_READING" and item.get("scoredScore") is None for item in speech_payload)

            authenticate(page, "teacher.test")
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            page.locator(".review-list").wait_for(timeout=20_000)
            teacher_token = page.evaluate("localStorage.getItem('yuzan-access-token')")
            queue = payload(page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessment-reviews", headers={"Authorization": f"Bearer {teacher_token}"}))
            fresh_queue = [item for item in queue["items"] if item["sessionId"] == speech_row]
            assert len(fresh_queue) == 3
            for queue_item in fresh_queue:
                page.goto(f"{BASE}/teacher/reviews/{queue_item['itemId']}/")
                page.locator("[data-review-score]").wait_for(timeout=20_000)
                maximum = page.locator("[data-review-score]").get_attribute("max")
                page.locator("[data-review-score]").fill(maximum)
                page.locator("[data-review-comment]").fill("QB-015F teacher review")
                page.locator("[data-review-submit]").click()
                page.locator("[data-review-message]").get_by_text("已保存").wait_for(timeout=20_000)

            speech_state = sql(f'''SELECT j."status", j."provider", j."result"->>'strategy', i."scoredScore", i."autoResult"->>'candidatePoints'
                                    FROM "SpeechJob" j JOIN "AssessmentItem" i ON i."id" = j."assessmentItemId"
                                   WHERE i."sessionId" = '{speech_row}' ORDER BY i."sortOrder";''', capture=True).splitlines()
            assert len(speech_state) == 3
            assert all(line.split("\t")[:3] == ["NEEDS_REVIEW", "local", "SPEECH_READING"] for line in speech_state)
            assert all(float(line.split("\t")[3]) == 4 and float(line.split("\t")[4]) != 4 for line in speech_state)
            assert sql(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId" = '{speech_row}';''', capture=True) == "0"
            assert [sql(f'''SELECT "overallScore", "summary"::text FROM "AssessmentReport" WHERE "sessionId" = '{source_id}';''', capture=True) for source_id in source_ids] == source_reports_before
            assert sql(f'''SELECT COUNT(*) FROM "Recording" r JOIN "AssessmentItem" i ON i."recordingId" = r."id" WHERE i."sessionId" = '{speech_row}';''', capture=True) == "3"

            authenticate(page, "student.test")
            page.goto(f"{BASE}/student/practices/attempts/{speech_row}/report/", wait_until="networkidle")
            page.locator(".report-head").get_by_text("本次巩固").wait_for(timeout=20_000)
            print(json.dumps({"runtime": "isolated", "assignmentIds": assignment_ids, "speechAssignment": speech_row, "subsetItems": 3, "speechJobs": "3 NEEDS_REVIEW", "outcome": dialogs[-1]}, ensure_ascii=False))
            browser.close()
    finally:
        all_sessions = source_ids + assignment_ids + speech_assignment_ids
        sql(f'''DELETE FROM "Recording" WHERE "id" IN (SELECT "recordingId" FROM "AssessmentItem" WHERE "sessionId" IN ('{"','".join(all_sessions)}'));
                DELETE FROM "AssessmentSession" WHERE "id" IN ('{"','".join(all_sessions)}');
                DELETE FROM "Enrollment" WHERE "id" = '{student2_enrollment}';
                DELETE FROM "Membership" WHERE "userId" = '{student2_id}';
                DELETE FROM "User" WHERE "id" = '{student2_id}';''')
