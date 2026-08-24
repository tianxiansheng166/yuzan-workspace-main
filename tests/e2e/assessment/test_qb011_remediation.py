"""QB-011 browser proof for the diagnosis-to-remediation loop.

It creates only an isolated formal-session fixture against the local development
database, drives the real report button and unified Runner in Chromium, and
removes both fixture sessions afterwards. It never calls a speech provider.
"""

import json
import os
import subprocess
import uuid

from playwright.sync_api import sync_playwright


BASE = os.environ.get("QB_RELEASE_BASE_URL", "http://127.0.0.1:4175")
DB_CONTAINER = os.environ.get("QB_RELEASE_DB_CONTAINER", "p0-integration-postgres-1")
DB_USER = os.environ.get("QB_RELEASE_DB_USER", "yuzan")
DB_NAME = os.environ.get("QB_RELEASE_DB_NAME", "yuzan_dev")
SCHOOL_ID = "11111111-1111-4111-8111-111111111111"
STUDENT_ID = "22222222-2222-4222-8222-222222222222"
CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
PASSWORD = "YuzanTest!2026"


def sql(statement, *, capture=False):
    result = subprocess.run(
        [
            "docker", "exec", "-i", DB_CONTAINER, "psql",
            "-U", DB_USER, "-d", DB_NAME, "-At", "-F", "\t",
            "-v", "ON_ERROR_STOP=1",
        ],
        input=statement,
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def authenticate(page):
    response = page.request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": PASSWORD},
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


def create_formal_fixture():
    source_id = str(uuid.uuid4())
    existing_membership_id = sql(
        f'''SELECT "id" FROM "Membership" WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}' LIMIT 1;''',
        capture=True,
    ) or None
    temporary_membership_id = None
    if not existing_membership_id:
        temporary_membership_id = str(uuid.uuid4())
        sql(
            f'''INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt")
                VALUES ('{temporary_membership_id}', '{SCHOOL_ID}', '{STUDENT_ID}', 'STUDENT', 'ACTIVE', NOW());'''
        )
    enrollment_id = sql(
        f'''SELECT "id" FROM "Enrollment"
            WHERE "schoolId" = '{SCHOOL_ID}' AND "userId" = '{STUDENT_ID}'
              AND "classId" = '{CLASS_ID}' AND "role" = 'STUDENT' AND "status" = 'ACTIVE'
            LIMIT 1;''',
        capture=True,
    )
    assert enrollment_id
    delivery = sql(
        f'''SELECT pd."id", pd."practiceVersionId", pv."definitionId"
            FROM "PracticeDelivery" pd
            JOIN "PracticeVersion" pv ON pv."id" = pd."practiceVersionId"
            JOIN "PracticeDefinition" d ON d."id" = pv."definitionId"
            JOIN "PracticeSection" s ON s."versionId" = pv."id"
            JOIN "PracticeItemRef" r ON r."sectionId" = s."id"
            JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
            JOIN "QuestionBankItem" i ON i."id" = v."itemId"
            WHERE pd."schoolId" = '{SCHOOL_ID}' AND pd."classId" = '{CLASS_ID}'
              AND pd."status" = 'OPEN' AND d."title" = '国家通用语言文字能力｜水平一级综合测评'
            GROUP BY pd."id", pd."practiceVersionId", pv."definitionId"
            HAVING COUNT(*) = 20
            LIMIT 1;''',
        capture=True,
    ).split("\t")
    assert len(delivery) == 3
    delivery_id, practice_version_id, practice_definition_id = delivery
    sql(
        f'''INSERT INTO "AssessmentSession"
              ("id", "schoolId", "enrollmentId", "classId", "initiatorUserId", "type", "purpose", "status", "completedAt", "practiceDefinitionId", "practiceVersionId", "deliveryId", "createdAt", "updatedAt")
            VALUES ('{source_id}', '{SCHOOL_ID}', '{enrollment_id}', '{CLASS_ID}', '{STUDENT_ID}', 'MIXED', 'STANDARD', 'COMPLETED', NOW(), '{practice_definition_id}', '{practice_version_id}', '{delivery_id}', NOW(), NOW());
            INSERT INTO "AssessmentItem"
              ("id", "sessionId", "questionVersionId", "prompt", "itemConfig", "itemType", "sectionTitle", "sectionOrder", "sortOrder", "maxScore", "scoredScore", "createdAt", "updatedAt")
            SELECT gen_random_uuid(), '{source_id}', source."questionVersionId", source."deliverySpec", source."deliverySpec", source."itemType", source."title", source."sectionOrder", source."sortOrder", source."maxScore", CASE WHEN source."sortOrder" <= 4 THEN 0 ELSE source."maxScore" END, NOW(), NOW()
              FROM (
                SELECT r."questionVersionId", v."deliverySpec", r."itemType", s."title", s."sortOrder" AS "sectionOrder",
                       ROW_NUMBER() OVER (ORDER BY s."sortOrder", r."sortOrder") AS "sortOrder",
                       (v."scoringSpec"->>'maxScore')::double precision AS "maxScore"
                  FROM "PracticeSection" s
                  JOIN "PracticeItemRef" r ON r."sectionId" = s."id"
                  JOIN "QuestionBankItemVersion" v ON v."id" = r."questionVersionId"
                 WHERE s."versionId" = '{practice_version_id}'
              ) source;'''
    )
    rows = sql(
        f'''SELECT ai."id", ai."questionVersionId", i."questionType", i."domain", ai."scoredScore", ai."maxScore"
              FROM "AssessmentItem" ai
              JOIN "QuestionBankItemVersion" v ON v."id" = ai."questionVersionId"
              JOIN "QuestionBankItem" i ON i."id" = v."itemId"
             WHERE ai."sessionId" = '{source_id}' AND ai."scoredScore" < ai."maxScore"
             ORDER BY ai."sortOrder";''',
        capture=True,
    ).splitlines()
    candidates = []
    for row in rows:
        item_id, version_id, family, domain, earned, maximum = row.split("\t")
        candidates.append({
            "assessmentItemId": item_id,
            "questionVersionId": version_id,
            "family": family,
            "displayName": family,
            "domain": domain,
            "domainDisplayName": domain,
            "earned": float(earned),
            "max": float(maximum),
        })
    assert len(candidates) == 4
    diagnosis = {
        "version": "qb-diagnosis-v1",
        "overall": {"earnedPoints": 0, "maxPoints": 100, "percentage": 0, "proficiency": "PRIORITY"},
        "domains": [], "families": [], "strengths": [], "priorities": [],
        "retryCandidates": candidates, "nextSteps": [],
    }
    report_id = str(uuid.uuid4())
    summary = json.dumps({"diagnosis": diagnosis}, ensure_ascii=False).replace("'", "''")
    sql(
        f'''INSERT INTO "AssessmentReport" ("id", "sessionId", "schoolId", "overallScore", "dataCompleteness", "summary", "createdAt", "updatedAt")
            VALUES ('{report_id}', '{source_id}', '{SCHOOL_ID}', 0, 100, '{summary}'::jsonb, NOW(), NOW());'''
    )
    return source_id, temporary_membership_id


def test_qb011_diagnosis_to_subset_runner_and_result():
    source_id, temporary_membership_id = create_formal_fixture()
    remediation_id = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            page = browser.new_page()
            try:
                authenticate(page)
                page.goto(f"{BASE}/student/practices/attempts/{source_id}/report/")
                page.locator("[data-start-remediation]").wait_for(timeout=20_000)
                page.locator("[data-start-remediation]").click()
                page.wait_for_url("**/student/practices/attempts/*/runner/**", timeout=20_000)
                remediation_id = page.url.split("/attempts/")[1].split("/")[0]
                assert remediation_id != source_id
                page.locator(".question-shell").wait_for(timeout=20_000)
                assert "1 / 4" in page.locator(".runner-progress").inner_text()
                assert page.locator(".runner-map button").count() == 4
                page.reload()
                page.locator(".question-shell").wait_for(timeout=20_000)
                assert "1 / 4" in page.locator(".runner-progress").inner_text()
                assert page.locator(".runner-map button").count() == 4

                sql(
                    f'''UPDATE "AssessmentItem" SET "scoredScore" = 1 WHERE "sessionId" = '{remediation_id}';
                        UPDATE "AssessmentSession" SET "status" = 'COMPLETED', "completedAt" = NOW() WHERE "id" = '{remediation_id}';'''
                )
                page.goto(f"{BASE}/student/practices/attempts/{remediation_id}/report/")
                page.get_by_text("本次巩固").first.wait_for(timeout=20_000)
                body = page.locator("body").inner_text()
                assert "本次重练的完成情况" in body
                assert "正式测评总分" in body
                assert "不展示标准答案或评分规则" in body
                assert page.locator("[data-repeat-remediation]").count() == 1
                result_response = page.request.get(
                    f"{BASE}/api/v1/schools/{SCHOOL_ID}/assessments/sessions/{remediation_id}/remediation-result"
                )
                assert result_response.ok, result_response.text()
                result = result_response.json().get("data", result_response.json())
                assert result["items"] and {"prompt", "answer", "deliverySpec", "scoringSpec"}.isdisjoint(
                    result["items"][0]
                )
            finally:
                browser.close()
    finally:
        if remediation_id:
            sql(f'''DELETE FROM "AssessmentSession" WHERE "id" = '{remediation_id}';''')
        sql(f'''DELETE FROM "AssessmentSession" WHERE "id" = '{source_id}';''')
        if temporary_membership_id:
            sql(f'''DELETE FROM "Membership" WHERE "id" = '{temporary_membership_id}';''')
