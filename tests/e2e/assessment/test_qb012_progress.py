"""QB-012 browser proof for student learning progress.

The fixture creates two completed Level 1 formal attempts, one four-item
remediation round, and one Level 2 baseline. Chromium reads the real student
Progress API and page; no speech provider is started or called.
"""

import itertools
import json
import subprocess
import uuid

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4175"
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
STUDENT_ID = "22222222-2222-4222-8222-222222222222"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
PASSWORD = "YuzanTest!2026"

DOMAIN_NAMES = {"LISTEN": "听", "SPEAK": "说", "READ": "读", "WRITE": "写"}
FAMILY_NAMES = {
    "LISTEN_IMAGE_CHOICE": "听音选图", "DICTATION": "听写句子",
    "READ_ALOUD": "朗读句子", "PICTURE_SPEAKING": "看图说话",
    "WORD_RECOGNITION": "单词认读", "SENTENCE_COMPREHENSION": "句子理解",
    "PICTURE_WORD": "看图写词", "SENTENCE_COMPLETION": "句子补全",
}


def sql(statement, *, capture=False):
    result = subprocess.run(
        ["docker", "exec", "-i", "p0-integration-postgres-1", "psql", "-U", "yuzan", "-d", "yuzan_dev", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"],
        input=statement,
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def quote(value):
    return str(value).replace("'", "''")


def authenticate(page):
    response = page.request.post(f"{BASE}/api/v1/auth/login", data={"identifier": "student.test", "password": PASSWORD})
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


def ensure_student_membership():
    existing = sql(
        f'''SELECT "id" FROM "Membership" WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}'
              AND "role" = 'STUDENT' AND "status" = 'ACTIVE' LIMIT 1;''',
        capture=True,
    )
    if existing:
        return None
    membership_id = str(uuid.uuid4())
    sql(
        f'''INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
              VALUES ('{membership_id}', '{SCHOOL_ID}', '{STUDENT_ID}', 'STUDENT', 'ACTIVE', NOW());'''
    )
    return membership_id


def load_delivery(level):
    delivery = sql(
        f'''SELECT pd."id", pd."practiceVersionId", pv."definitionId"
            FROM "PracticeDelivery" pd
            JOIN "PracticeVersion" pv ON pv."id" = pd."practiceVersionId"
            JOIN "PracticeDefinition" d ON d."id" = pv."definitionId"
           WHERE pd."schoolId" = '{SCHOOL_ID}' AND pd."classId" = '{CLASS_ID}'
             AND pd."status" = 'OPEN' AND d."difficulty" = '{level}'
           LIMIT 1;''',
        capture=True,
    ).split("\t")
    assert len(delivery) == 3
    delivery_id, practice_version_id, practice_definition_id = delivery
    rows = sql(
        f'''SELECT r."questionVersionId", r."itemType", s."title", s."sortOrder", r."sortOrder",
                     (v."scoringSpec"->>'maxScore')::double precision, i."domain", i."questionType", i."level"
              FROM "PracticeSection" s
              JOIN "PracticeItemRef" r ON r."sectionId" = s."id"
              JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
              JOIN "QuestionBankItem" i ON i."id" = v."itemId"
             WHERE s."versionId" = '{practice_version_id}'
             ORDER BY s."sortOrder", r."sortOrder";''',
        capture=True,
    ).splitlines()
    snapshot = []
    for line in rows:
        version_id, item_type, section_title, section_order, sort_order, max_score, domain, family, item_level = line.split("\t")
        snapshot.append({
            "questionVersionId": version_id, "itemType": item_type, "sectionTitle": section_title,
            "sectionOrder": int(section_order), "sortOrder": int(sort_order), "maxScore": float(max_score),
            "domain": domain, "family": family, "level": item_level,
        })
    assert len(snapshot) == 20 and sum(item["maxScore"] for item in snapshot) == 100
    return {"id": delivery_id, "versionId": practice_version_id, "definitionId": practice_definition_id, "items": snapshot}


def scores_for_loss(items, total_loss, candidate_count=0):
    if candidate_count:
        selected = next((combo for combo in itertools.combinations(range(len(items)), candidate_count)
                         if sum(items[index]["maxScore"] for index in combo) >= total_loss), None)
        assert selected is not None
        losses = {index: 1.0 for index in selected}
        remaining = total_loss - candidate_count
        for index in selected:
            addition = min(items[index]["maxScore"] - 1, remaining)
            losses[index] += addition
            remaining -= addition
        assert remaining == 0
        return [item["maxScore"] - losses.get(index, 0) for index, item in enumerate(items)]
    remaining = total_loss
    scores = []
    for item in items:
        loss = min(item["maxScore"], remaining)
        scores.append(item["maxScore"] - loss)
        remaining -= loss
    assert remaining == 0
    return scores


def diagnosis_for(items, scores):
    domains, families = {}, {}
    for item, earned in zip(items, scores):
        domain = domains.setdefault(item["domain"], {"earned": 0, "max": 0, "count": 0})
        family = families.setdefault(item["family"], {"earned": 0, "max": 0, "count": 0, "domain": item["domain"], "level": item["level"]})
        for bucket in (domain, family):
            bucket["earned"] += earned
            bucket["max"] += item["maxScore"]
            bucket["count"] += 1

    def score(bucket):
        percent = round(bucket["earned"] / bucket["max"] * 100, 2)
        return {"earnedPoints": round(bucket["earned"], 2), "maxPoints": round(bucket["max"], 2), "percentage": percent,
                "proficiency": "STRONG" if percent >= 85 else "DEVELOPING" if percent >= 70 else "PRIORITY"}

    return {
        "version": "qb-diagnosis-v1",
        "overall": score({"earned": sum(scores), "max": sum(item["maxScore"] for item in items)}),
        "domains": [{**score(bucket), "domain": key, "displayName": DOMAIN_NAMES[key], "itemCount": bucket["count"], "lostPoints": round(bucket["max"] - bucket["earned"], 2)} for key, bucket in domains.items()],
        "families": [{**score(bucket), "family": key, "displayName": FAMILY_NAMES[key], "domain": bucket["domain"], "domainDisplayName": DOMAIN_NAMES[bucket["domain"]], "levels": [bucket["level"]], "itemCount": bucket["count"], "lostPoints": round(bucket["max"] - bucket["earned"], 2)} for key, bucket in families.items()],
        "strengths": [], "priorities": [], "retryCandidates": [], "nextSteps": [],
    }


def create_formal_fixture(delivery, total_loss, completed_at, candidate_count=0):
    enrollment_id = sql(
        f'''SELECT "id" FROM "Enrollment" WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}'
              AND "classId" = '{CLASS_ID}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE' LIMIT 1;''',
        capture=True,
    )
    assert enrollment_id
    session_id = str(uuid.uuid4())
    scores = scores_for_loss(delivery["items"], total_loss, candidate_count)
    diagnosis = diagnosis_for(delivery["items"], scores)
    assert diagnosis["overall"]["earnedPoints"] == 100 - total_loss
    sql(
        f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "completedAt", "practiceDefinitionId", "practiceVersionId", "deliveryId", "createdAt", "updatedAt")
              VALUES ('{session_id}', '{SCHOOL_ID}', '{enrollment_id}', '{CLASS_ID}', '{STUDENT_ID}', 'MIXED', 'STANDARD', 'COMPLETED', '{completed_at}', '{delivery["definitionId"]}', '{delivery["versionId"]}', '{delivery["id"]}', '{completed_at}', '{completed_at}');'''
    )
    values = []
    for execution_order, (item, earned) in enumerate(zip(delivery["items"], scores), start=1):
        values.append(
            f"('{uuid.uuid4()}', '{session_id}', '{item['questionVersionId']}', '{{}}'::jsonb, '{{}}'::jsonb, '{quote(item['itemType'])}', '{quote(item['sectionTitle'])}', {item['sectionOrder']}, {execution_order}, {item['maxScore']}, {earned}, '{completed_at}', '{completed_at}')"
        )
    sql('''INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemConfig", "itemType", "sectionTitle", "sectionOrder", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt") VALUES ''' + ",".join(values) + ";")
    report_id = str(uuid.uuid4())
    summary = quote(json.dumps({"diagnosis": diagnosis}, ensure_ascii=False))
    sql(
        f'''INSERT INTO "AssessmentReport" ("id", "sessionId", "schoolId", "overallScore", "dataCompleteness", "summary", "createdAt", "updatedAt")
              VALUES ('{report_id}', '{session_id}', '{SCHOOL_ID}', {diagnosis["overall"]["earnedPoints"]}, 100, '{summary}'::jsonb, '{completed_at}', '{completed_at}');'''
    )
    candidates = [(item, score) for item, score in zip(delivery["items"], scores) if score < item["maxScore"]]
    return {"id": session_id, "candidates": candidates}


def create_remediation_fixture(source, delivery):
    session_id = str(uuid.uuid4())
    enrollment_id = sql(f'''SELECT "id" FROM "Enrollment" WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}' AND "classId" = '{CLASS_ID}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE' LIMIT 1;''', capture=True)
    created_at = "2026-08-05T10:00:00.000Z"
    sql(
        f'''INSERT INTO "AssessmentSession" ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "retestOfSessionId", "practiceDefinitionId", "practiceVersionId", "deliveryId", "completedAt", "createdAt", "updatedAt")
              VALUES ('{session_id}', '{SCHOOL_ID}', '{enrollment_id}', '{CLASS_ID}', '{STUDENT_ID}', 'MIXED', 'REMEDIATION', 'COMPLETED', '{source["id"]}', '{delivery["definitionId"]}', '{delivery["versionId"]}', '{delivery["id"]}', '{created_at}', '{created_at}', '{created_at}');'''
    )
    values = []
    for index, (item, source_score) in enumerate(source["candidates"]):
        remediation_score = item["maxScore"] if index < 3 else source_score
        values.append(f"('{uuid.uuid4()}', '{session_id}', '{item['questionVersionId']}', '{{}}'::jsonb, 'CHOICE', {index + 1}, {item['maxScore']}, {remediation_score}, '{created_at}', '{created_at}')")
    sql('''INSERT INTO "AssessmentItem" ("id", "sessionId", "questionVersionId", "prompt", "itemType", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt") VALUES ''' + ",".join(values) + ";")
    return session_id


def test_qb012_student_progress_page_and_safe_history():
    created_sessions = []
    temporary_membership_id = ensure_student_membership()
    try:
        level_one = load_delivery("水平一级")
        level_two = load_delivery("水平二级")
        baseline = create_formal_fixture(level_one, 16, "2026-08-01T10:00:00.000Z", candidate_count=4)
        created_sessions.append(baseline["id"])
        assert len(baseline["candidates"]) == 4
        remediation_id = create_remediation_fixture(baseline, level_one)
        created_sessions.append(remediation_id)
        follow_up = create_formal_fixture(level_one, 9, "2026-08-10T10:00:00.000Z")
        created_sessions.append(follow_up["id"])
        level_two_baseline = create_formal_fixture(level_two, 22, "2026-08-15T10:00:00.000Z")
        created_sessions.append(level_two_baseline["id"])

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            try:
                authenticate(page)
                page.goto(f"{BASE}/student/progress/")
                page.get_by_role("heading", name="学习进步").wait_for(timeout=20_000)
                body = page.locator("body").inner_text()
                assert "水平一级正式测评趋势" in body
                assert "比上次提高 7 分" in body
                assert "听说读写变化" in body
                assert "专项巩固" in body
                assert "4 道题，3 道已掌握" in body
                assert "追回" in body
                assert "水平二级正式测评趋势" in body
                assert "这是当前学习基线" in body
                assert "跨水平" in body

                progress_response = page.request.get(f"{BASE}/api/v1/schools/{SCHOOL_ID}/students/me/question-bank-progress")
                assert progress_response.ok, progress_response.text()
                progress = progress_response.json().get("data", progress_response.json())
                serialized = json.dumps(progress, ensure_ascii=False)
                for forbidden in ["correctAnswer", "referenceAnswer", "acceptedAnswers", "scoringSpec", "rubric", "providerAudit", "rawResponse", "candidatePoints"]:
                    assert forbidden not in serialized
                level_two_progress = next(level for level in progress["formalLevels"] if level["practiceDefinitionId"] == level_two["definitionId"])
                assert level_two_progress["comparisonState"] == "BASELINE_ONLY"
                assert level_two_progress["latestVsPrevious"] is None

                page.locator(f'[data-progress-formal-session="{follow_up["id"]}"]').click()
                page.wait_for_url(f"**/attempts/{follow_up['id']}/report/**", timeout=20_000)
                page.get_by_text("综合练习").first.wait_for(timeout=20_000)
                page.goto(f"{BASE}/student/progress/")
                page.locator(f'[data-progress-remediation-round="{remediation_id}"]').click()
                page.wait_for_url(f"**/attempts/{remediation_id}/report/**", timeout=20_000)
                page.get_by_text("本次巩固").first.wait_for(timeout=20_000)
            finally:
                browser.close()
    finally:
        if created_sessions:
            sql("DELETE FROM \"AssessmentSession\" WHERE \"id\" IN (" + ",".join(f"'{session_id}'" for session_id in created_sessions) + ");")
        if temporary_membership_id:
            sql(f'''DELETE FROM "Membership" WHERE "id" = '{temporary_membership_id}';''')
