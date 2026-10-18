"""Native Chromium/API/PostgreSQL/MinIO acceptance for YZ-RD-T014.

All accounts, schools, classes, submissions, assessments, and media created here
are fictional TEST_FIXTURE_ONLY data in the isolated T014 native database.
"""

import base64
import io
import json
import os
import subprocess
import uuid
import wave
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest
from playwright.sync_api import expect, sync_playwright


BASE = os.environ.get("YZ_T014_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T014_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T014_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T014_EVIDENCE_DIR", "/tmp/yz-rd-t014-evidence"))
API_PACKAGE = os.environ.get("YZ_T014_API_PACKAGE", "")
SCHOOL_A = ""
TEACHER_SEED_ID = "33333333-3333-4333-8333-333333333333"
STUDENT_SEED_ID = "22222222-2222-4222-8222-222222222222"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL,
    reason="requires the isolated YZ-RD-T014 native API/PostgreSQL/MinIO fixture",
)


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement, *, capture=False):
    assert urlparse(BASE).hostname == "127.0.0.1"
    parsed = urlparse(DATABASE_URL)
    assert parsed.scheme == "postgresql"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == int(os.environ["POSTGRES_PORT"])
    assert parsed.username == os.environ["POSTGRES_USER"]
    assert parsed.path.lstrip("/") == os.environ["POSTGRES_DB"]
    password = unquote(parsed.password or "")
    assert password
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": parsed.username,
        "PGPASSWORD": password,
        "PGDATABASE": parsed.path.lstrip("/"),
    }
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>"))
    output = result.stdout.strip()
    return output if capture else ""


def sql_scalar(statement):
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def sql_rows(statement):
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def verify_database_identity():
    identity = sql_scalar("SELECT current_database() || '|' || current_user || '|' || version();")
    expected_database = os.environ["POSTGRES_DB"]
    expected_user = os.environ["POSTGRES_USER"]
    assert identity.startswith(f"{expected_database}|{expected_user}|PostgreSQL 17."), identity.split("|", 2)[:2]


def payload(response):
    value = response.json()
    return value.get("data", value) if isinstance(value, dict) else value


def api_login(request, identifier):
    response = request.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, f"login {identifier} failed: {response.status} {response.text()}"
    return payload(response)


def auth_headers(session):
    return {"Authorization": f"Bearer {session['accessToken']}"}


def authenticate(page, session):
    page.goto(f"{BASE}/login/")
    page.evaluate(
        """session => {
          localStorage.setItem('yuzan-access-token', session.accessToken);
          localStorage.setItem('yuzan-current-user', JSON.stringify(session.user));
          localStorage.setItem('yuzan-active-school-id', session.activeSchoolId);
        }""",
        session,
    )


def wav_bytes():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as recording:
        recording.setnchannels(1)
        recording.setsampwidth(2)
        recording.setframerate(16000)
        recording.writeframes(b"\x00\x00" * 3200)
    return buffer.getvalue()


def put_minio_object(object_key, audio_bytes):
    script = r'''const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.env.YZ_T014_API_PACKAGE);
const { PutObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.YZ_T014_S3_ENDPOINT,
  region: process.env.YZ_T014_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YZ_T014_S3_ACCESS_KEY,
    secretAccessKey: process.env.YZ_T014_S3_SECRET_KEY,
  },
});
(async () => {
  try {
    await client.send(new PutObjectCommand({
      Bucket: process.env.YZ_T014_S3_BUCKET,
      Key: process.env.YZ_T014_OBJECT_KEY,
      Body: Buffer.from(process.env.YZ_T014_AUDIO_BASE64, "base64"),
      ContentType: "audio/wav",
    }));
    process.stdout.write("PUT_OK");
  } finally {
    client.destroy();
  }
})().catch(error => {
  process.stderr.write(`${error.name || "S3_PUT_FAILED"}\n`);
  process.exitCode = 1;
});'''
    env = {
        **os.environ,
        "YZ_T014_OBJECT_KEY": object_key,
        "YZ_T014_AUDIO_BASE64": base64.b64encode(audio_bytes).decode("ascii"),
    }
    result = subprocess.run(
        ["node", "-e", script],
        cwd=Path(__file__).resolve().parents[3],
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode:
        message = result.stderr
        for secret in (env.get("YZ_T014_S3_SECRET_KEY", ""), env.get("POSTGRES_PASSWORD", "")):
            if secret:
                message = message.replace(secret, "<redacted>")
        raise RuntimeError(f"MinIO PutObject failed: {message.strip()}")
    assert result.stdout == "PUT_OK"


def create_fixture_accounts_and_records():
    verify_database_identity()
    suffix = uuid.uuid4().hex[:10]
    ids = {
        "school_a": str(uuid.uuid4()),
        "school_b": str(uuid.uuid4()),
        "teacher_a": str(uuid.uuid4()),
        "teacher_b": str(uuid.uuid4()),
        "teacher_x": str(uuid.uuid4()),
        "student_a": str(uuid.uuid4()),
        "student_b": str(uuid.uuid4()),
        "student_c": str(uuid.uuid4()),
        "student_d": str(uuid.uuid4()),
        "student_x": str(uuid.uuid4()),
        "student_inactive": str(uuid.uuid4()),
        "term_a": str(uuid.uuid4()),
        "term_b": str(uuid.uuid4()),
        "term_x": str(uuid.uuid4()),
        "class_a": str(uuid.uuid4()),
        "class_no_course": str(uuid.uuid4()),
        "class_b": str(uuid.uuid4()),
        "class_x": str(uuid.uuid4()),
        "enrollment_teacher_a": str(uuid.uuid4()),
        "enrollment_teacher_a_no_course": str(uuid.uuid4()),
        "enrollment_teacher_b": str(uuid.uuid4()),
        "enrollment_teacher_x": str(uuid.uuid4()),
        "enrollment_a": str(uuid.uuid4()),
        "enrollment_b": str(uuid.uuid4()),
        "enrollment_c": str(uuid.uuid4()),
        "enrollment_d": str(uuid.uuid4()),
        "enrollment_x": str(uuid.uuid4()),
        "enrollment_inactive": str(uuid.uuid4()),
        "course": str(uuid.uuid4()),
        "course_version": str(uuid.uuid4()),
        "unit": str(uuid.uuid4()),
        "lesson": str(uuid.uuid4()),
        "activity_a": str(uuid.uuid4()),
        "activity_b": str(uuid.uuid4()),
        "baseline_assignment": str(uuid.uuid4()),
        "submission_a": str(uuid.uuid4()),
        "submission_b": str(uuid.uuid4()),
        "feedback_a": str(uuid.uuid4()),
        "recording_a": str(uuid.uuid4()),
        "assessment_session": str(uuid.uuid4()),
        "assessment_report": str(uuid.uuid4()),
        "practice_definition": str(uuid.uuid4()),
        "draft_course": str(uuid.uuid4()),
        "draft_course_version": str(uuid.uuid4()),
        "foreign_course": str(uuid.uuid4()),
        "foreign_course_version": str(uuid.uuid4()),
    }
    ids.update({
        "login_teacher_a": f"teacher.t014.a.{suffix}@test.invalid",
        "login_teacher_b": f"teacher.t014.b.{suffix}@test.invalid",
        "login_teacher_x": f"teacher.t014.x.{suffix}@test.invalid",
        "login_student_a": f"student.t014.a.{suffix}@test.invalid",
        "login_student_b": f"student.t014.b.{suffix}@test.invalid",
        "login_student_c": f"student.t014.c.{suffix}@test.invalid",
        "login_student_d": f"student.t014.d.{suffix}@test.invalid",
        "login_student_x": f"student.t014.x.{suffix}@test.invalid",
        "login_student_inactive": f"student.t014.inactive.{suffix}@test.invalid",
        "name_teacher_a": f"TEST_FIXTURE_ONLY T014 教师甲 {suffix}",
        "name_teacher_b": f"TEST_FIXTURE_ONLY T014 教师乙 {suffix}",
        "name_teacher_x": f"TEST_FIXTURE_ONLY T014 跨校教师 {suffix}",
        "name_student_a": f"TEST_FIXTURE_ONLY T014 学生甲 {suffix}",
        "name_student_b": f"TEST_FIXTURE_ONLY T014 学生乙 {suffix}",
        "name_student_c": f"TEST_FIXTURE_ONLY T014 学生丙 {suffix}",
        "name_student_d": f"TEST_FIXTURE_ONLY T014 跨班学生 {suffix}",
        "name_student_x": f"TEST_FIXTURE_ONLY T014 跨校学生 {suffix}",
        "name_student_inactive": f"TEST_FIXTURE_ONLY T014 停用学籍 {suffix}",
        "class_name_a": f"TEST_FIXTURE_ONLY T014 授权班级甲 {suffix}",
        "class_name_no_course": f"TEST_FIXTURE_ONLY T014 无课程班级 {suffix}",
        "class_name_b": f"TEST_FIXTURE_ONLY T014 其他班级乙 {suffix}",
        "class_name_x": f"TEST_FIXTURE_ONLY T014 外校班级 {suffix}",
        "course_title": f"TEST_FIXTURE_ONLY T014 真实课程 {suffix}",
        "baseline_title": f"TEST_FIXTURE_ONLY T014 班级提交 {suffix}",
        "school_code_a": f"YZ-T014-A-{suffix}",
        "school_code_b": f"YZ-T014-B-{suffix}",
    })

    users = [
        ("teacher_a", "login_teacher_a", "name_teacher_a", TEACHER_SEED_ID),
        ("teacher_b", "login_teacher_b", "name_teacher_b", TEACHER_SEED_ID),
        ("teacher_x", "login_teacher_x", "name_teacher_x", TEACHER_SEED_ID),
        ("student_a", "login_student_a", "name_student_a", STUDENT_SEED_ID),
        ("student_b", "login_student_b", "name_student_b", STUDENT_SEED_ID),
        ("student_c", "login_student_c", "name_student_c", STUDENT_SEED_ID),
        ("student_d", "login_student_d", "name_student_d", STUDENT_SEED_ID),
        ("student_x", "login_student_x", "name_student_x", STUDENT_SEED_ID),
        ("student_inactive", "login_student_inactive", "name_student_inactive", STUDENT_SEED_ID),
    ]
    user_inserts = []
    for id_key, login_key, name_key, password_source in users:
        user_inserts.append(
            f'''INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt")
            SELECT {q(ids[id_key])},{q(ids[login_key])},{q(ids[name_key])},"passwordHash",'ACTIVE',NOW(),NOW()
            FROM "User" WHERE id={q(password_source)};'''
        )

    sql(f'''BEGIN;
      INSERT INTO "School" (id,code,name,"regionCode","createdAt","updatedAt") VALUES
        ({q(ids['school_a'])},{q(ids['school_code_a'])},'TEST_FIXTURE_ONLY T014 学校甲','T014',NOW(),NOW()),
        ({q(ids['school_b'])},{q(ids['school_code_b'])},'TEST_FIXTURE_ONLY T014 学校乙','T014',NOW(),NOW());
      {''.join(user_inserts)}
      INSERT INTO "Term" (id,"schoolId",name,"startsAt","endsAt","isActive","createdAt") VALUES
        ({q(ids['term_a'])},{q(ids['school_a'])},{q('TEST_FIXTURE_ONLY T014 学期甲 '+suffix)},'2026-01-01','2036-12-31',true,NOW()),
        ({q(ids['term_b'])},{q(ids['school_a'])},{q('TEST_FIXTURE_ONLY T014 学期乙 '+suffix)},'2026-01-01','2036-12-31',true,NOW()),
        ({q(ids['term_x'])},{q(ids['school_b'])},{q('TEST_FIXTURE_ONLY T014 学期丙 '+suffix)},'2026-01-01','2036-12-31',true,NOW());
      INSERT INTO "Class" (id,"schoolId","termId",name,grade,"createdAt","updatedAt") VALUES
        ({q(ids['class_a'])},{q(ids['school_a'])},{q(ids['term_a'])},{q(ids['class_name_a'])},'七年级',NOW(),NOW()),
        ({q(ids['class_no_course'])},{q(ids['school_a'])},{q(ids['term_a'])},{q(ids['class_name_no_course'])},'七年级',NOW(),NOW()),
        ({q(ids['class_b'])},{q(ids['school_a'])},{q(ids['term_b'])},{q(ids['class_name_b'])},'七年级',NOW(),NOW()),
        ({q(ids['class_x'])},{q(ids['school_b'])},{q(ids['term_x'])},{q(ids['class_name_x'])},'七年级',NOW(),NOW());
      INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['teacher_a'])},'TEACHER','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['teacher_b'])},'TEACHER','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_b'])},{q(ids['teacher_x'])},'TEACHER','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['student_a'])},'STUDENT','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['student_b'])},'STUDENT','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['student_c'])},'STUDENT','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['student_d'])},'STUDENT','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_b'])},{q(ids['student_x'])},'STUDENT','ACTIVE',NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['student_inactive'])},'STUDENT','ACTIVE',NOW());
      INSERT INTO "Enrollment" (id,"schoolId","classId","userId",role,status,"joinedAt") VALUES
        ({q(ids['enrollment_teacher_a'])},{q(ids['school_a'])},{q(ids['class_a'])},{q(ids['teacher_a'])},'TEACHER','ACTIVE',NOW()),
        ({q(ids['enrollment_teacher_a_no_course'])},{q(ids['school_a'])},{q(ids['class_no_course'])},{q(ids['teacher_a'])},'TEACHER','ACTIVE',NOW()),
        ({q(ids['enrollment_teacher_b'])},{q(ids['school_a'])},{q(ids['class_b'])},{q(ids['teacher_b'])},'TEACHER','ACTIVE',NOW()),
        ({q(ids['enrollment_teacher_x'])},{q(ids['school_b'])},{q(ids['class_x'])},{q(ids['teacher_x'])},'TEACHER','ACTIVE',NOW()),
        ({q(ids['enrollment_a'])},{q(ids['school_a'])},{q(ids['class_a'])},{q(ids['student_a'])},'STUDENT','ACTIVE',NOW()),
        ({q(ids['enrollment_b'])},{q(ids['school_a'])},{q(ids['class_a'])},{q(ids['student_b'])},'STUDENT','ACTIVE',NOW()),
        ({q(ids['enrollment_c'])},{q(ids['school_a'])},{q(ids['class_a'])},{q(ids['student_c'])},'STUDENT','ACTIVE',NOW()),
        ({q(ids['enrollment_d'])},{q(ids['school_a'])},{q(ids['class_b'])},{q(ids['student_d'])},'STUDENT','ACTIVE',NOW()),
        ({q(ids['enrollment_x'])},{q(ids['school_b'])},{q(ids['class_x'])},{q(ids['student_x'])},'STUDENT','ACTIVE',NOW()),
        ({q(ids['enrollment_inactive'])},{q(ids['school_a'])},{q(ids['class_a'])},{q(ids['student_inactive'])},'STUDENT','SUSPENDED',NOW());
      UPDATE "Class" SET name={q(ids['class_name_a'])},grade='七年级' WHERE id={q(ids['class_a'])} AND "schoolId"={q(ids['school_a'])};
      COMMIT;''')

    sql(f'''BEGIN;
      INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
        VALUES ({q(ids['course'])},{q(ids['school_a'])},{q(ids['teacher_a'])},{q('TEST_FIXTURE_ONLY_T014_'+suffix)},{q(ids['course_title'])},NOW(),NOW());
      INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"publishedAt","createdAt","updatedAt")
        VALUES ({q(ids['course_version'])},{q(ids['school_a'])},{q(ids['course'])},1,'PUBLISHED',{q(ids['course_title'])},'zh-CN','[]'::jsonb,NOW(),NOW(),NOW());
      INSERT INTO "Unit" (id,"courseVersionId",title,"sortOrder") VALUES ({q(ids['unit'])},{q(ids['course_version'])},'TEST_FIXTURE_ONLY 单元',900);
      INSERT INTO "Lesson" (id,"unitId",title,"sortOrder") VALUES ({q(ids['lesson'])},{q(ids['unit'])},'TEST_FIXTURE_ONLY 课时',900);
      INSERT INTO "LearningActivity" (id,"lessonId",type,title,"sortOrder",required,content)
        VALUES ({q(ids['activity_a'])},{q(ids['lesson'])},'TEXT','TEST_FIXTURE_ONLY 活动甲',900,true,'{{"body":"真实测试内容"}}'::jsonb),
               ({q(ids['activity_b'])},{q(ids['lesson'])},'TEXT','TEST_FIXTURE_ONLY 活动乙',901,true,'{{"body":"真实测试内容"}}'::jsonb);
      INSERT INTO "ActivityProgress" (id,"schoolId","activityId","enrollmentId",position,completed,revision,"updatedAt") VALUES
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['activity_a'])},{q(ids['enrollment_a'])},1,true,1,NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['activity_b'])},{q(ids['enrollment_a'])},0,false,1,NOW()),
        ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['activity_a'])},{q(ids['enrollment_b'])},1,true,1,NOW());
      INSERT INTO "Assignment" (id,"schoolId","courseVersionId","createdByUserId",title,status,"startsAt","dueAt",revision,"openedAt","createdAt","updatedAt")
        VALUES ({q(ids['baseline_assignment'])},{q(ids['school_a'])},{q(ids['course_version'])},{q(ids['teacher_a'])},{q(ids['baseline_title'])},'OPEN',NOW()-INTERVAL '1 day',NOW()+INTERVAL '10 days',1,NOW()-INTERVAL '1 day',NOW()-INTERVAL '1 day',NOW());
      INSERT INTO "AssignmentTarget" (id,"schoolId","assignmentId","targetType","classId","createdAt")
        VALUES ({q(str(uuid.uuid4()))},{q(ids['school_a'])},{q(ids['baseline_assignment'])},'CLASS',{q(ids['class_a'])},NOW());
      INSERT INTO "Submission" (id,"schoolId","assignmentId","enrollmentId","attemptNo",status,"idempotencyKey",revision,"submittedAt","createdAt","updatedAt") VALUES
        ({q(ids['submission_a'])},{q(ids['school_a'])},{q(ids['baseline_assignment'])},{q(ids['enrollment_a'])},1,'REVIEWED',{q('t014-baseline-a-'+suffix)},1,NOW(),NOW(),NOW()),
        ({q(ids['submission_b'])},{q(ids['school_a'])},{q(ids['baseline_assignment'])},{q(ids['enrollment_b'])},1,'NEEDS_REVIEW',{q('t014-baseline-b-'+suffix)},1,NOW(),NOW(),NOW());
      INSERT INTO "Feedback" (id,"schoolId","submissionId","authorUserId",decision,comment,score,revision,"releasedAt")
        VALUES ({q(ids['feedback_a'])},{q(ids['school_a'])},{q(ids['submission_a'])},{q(ids['teacher_a'])},'ACCEPT','TEST_FIXTURE_ONLY 已复核反馈',88,1,NOW());
      COMMIT;''')

    practice_version_id = str(uuid.uuid4())
    practice_section_id = str(uuid.uuid4())
    question_item_ids = [str(uuid.uuid4()) for _ in range(20)]
    question_version_ids = [str(uuid.uuid4()) for _ in range(20)]
    practice_item_ref_ids = [str(uuid.uuid4()) for _ in range(20)]
    question_items = ",\n".join(
        f"({q(item_id)},{q(ids['school_a'])},{q(f'TEST_FIXTURE_ONLY_T014_{suffix}_{index:02d}')},'READING',NOW(),NOW())"
        for index, item_id in enumerate(question_item_ids, start=1)
    )
    question_versions = ",\n".join(
        f"({q(version_id)},{q(item_id)},1,'{{\"prompt\":\"TEST_FIXTURE_ONLY\"}}'::jsonb,'{{\"maxScore\":1}}'::jsonb,'PUBLISHED',NOW(),NOW(),NOW())"
        for item_id, version_id in zip(question_item_ids, question_version_ids)
    )
    practice_item_refs = ",\n".join(
        f"({q(ref_id)},{q(practice_section_id)},{q(version_id)},'READING',{index},'{{}}'::jsonb)"
        for index, (ref_id, version_id) in enumerate(zip(practice_item_ref_ids, question_version_ids), start=1)
    )
    sql(f'''BEGIN;
      INSERT INTO "QuestionBankItem" (id,"schoolId","stableKey","itemType","createdAt","updatedAt") VALUES {question_items};
      INSERT INTO "QuestionBankItemVersion" (id,"itemId",version,"deliverySpec","scoringSpec",status,"publishedAt","createdAt","updatedAt") VALUES {question_versions};
      INSERT INTO "PracticeDefinition" (id,"schoolId",visibility,title,summary,difficulty,"estimatedMinutes","gradeBand","abilityCategories","cultureTags","catalogType","requiresRecording","instantFeedback",status,"createdAt","updatedAt")
        VALUES ({q(ids['practice_definition'])},{q(ids['school_a'])},'SCHOOL','TEST_FIXTURE_ONLY T014 正式测评','T014 原生浏览器测试','水平一级',5,'七年级','{{}}','{{}}','COMPREHENSIVE',false,false,'PUBLISHED',NOW(),NOW());
      INSERT INTO "PracticeVersion" (id,"definitionId",version,status,"contentHash","publishedAt","createdAt")
        VALUES ({q(practice_version_id)},{q(ids['practice_definition'])},1,'PUBLISHED',{q('sha256:t014:'+suffix)},NOW(),NOW());
      INSERT INTO "PracticeSection" (id,"versionId",title,"sortOrder","estimatedMinutes")
        VALUES ({q(practice_section_id)},{q(practice_version_id)},'TEST_FIXTURE_ONLY 正式测评题目',1,5);
      INSERT INTO "PracticeItemRef" (id,"sectionId","questionVersionId","itemType","sortOrder",config) VALUES {practice_item_refs};
      COMMIT;''')
    sql(f'''BEGIN;
      INSERT INTO "AssessmentSession" (id,"schoolId","enrollmentId","classId","initiatorUserId",type,purpose,status,"completedAt","practiceDefinitionId",revision,"createdAt","updatedAt")
        VALUES ({q(ids['assessment_session'])},{q(ids['school_a'])},{q(ids['enrollment_a'])},{q(ids['class_a'])},{q(ids['teacher_a'])},'READING','STANDARD','COMPLETED',NOW(),{q(ids['practice_definition'])},1,NOW(),NOW());
      INSERT INTO "AssessmentReport" (id,"sessionId","schoolId","overallScore","dataCompleteness","generatedAt","createdAt","updatedAt")
        VALUES ({q(ids['assessment_report'])},{q(ids['assessment_session'])},{q(ids['school_a'])},83,1,NOW(),NOW(),NOW());
      INSERT INTO "Recording" (id,"schoolId","enrollmentId","submissionId",status,"partCount","uploadedParts","durationMs","mimeType","objectKey",revision,"createdAt","updatedAt")
        VALUES ({q(ids['recording_a'])},{q(ids['school_a'])},{q(ids['enrollment_a'])},{q(ids['submission_a'])},'READY',1,ARRAY[1],200,'audio/wav',{q('recordings/'+ids['recording_a']+'/full')},1,NOW(),NOW());
      INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
        VALUES ({q(ids['draft_course'])},{q(ids['school_a'])},{q(ids['teacher_a'])},{q('TEST_FIXTURE_ONLY_T014_DRAFT_'+suffix)},'TEST_FIXTURE_ONLY T014 草稿课程',NOW(),NOW());
      INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"createdAt","updatedAt")
        VALUES ({q(ids['draft_course_version'])},{q(ids['school_a'])},{q(ids['draft_course'])},1,'DRAFT','TEST_FIXTURE_ONLY T014 草稿版本','zh-CN','[]'::jsonb,NOW(),NOW());
      INSERT INTO "Course" (id,"schoolId","authorUserId","stableKey",title,"createdAt","updatedAt")
        VALUES ({q(ids['foreign_course'])},{q(ids['school_b'])},{q(ids['teacher_x'])},{q('TEST_FIXTURE_ONLY_T014_FOREIGN_'+suffix)},'TEST_FIXTURE_ONLY T014 外校课程',NOW(),NOW());
      INSERT INTO "CourseVersion" (id,"schoolId","courseId",version,status,title,locale,objectives,"publishedAt","createdAt","updatedAt")
        VALUES ({q(ids['foreign_course_version'])},{q(ids['school_b'])},{q(ids['foreign_course'])},1,'PUBLISHED','TEST_FIXTURE_ONLY T014 外校版本','zh-CN','[]'::jsonb,NOW(),NOW(),NOW());
      COMMIT;''')
    object_key = f"recordings/{ids['recording_a']}/full"
    put_minio_object(object_key, wav_bytes())
    ids["baseline_title"] = ids["baseline_title"]
    ids["supplementary_title"] = f"TEST_FIXTURE_ONLY T014 定向补练 {suffix}"
    return ids


def assignment_path(school_id, class_id):
    return f"/api/v1/schools/{school_id}/classes/{class_id}/supplementary-practice"


def test_teacher_class_student_assignment_and_today_loop():
    ids = create_fixture_accounts_and_records()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        try:
            teacher_a = api_login(request, ids["login_teacher_a"])
            teacher_b = api_login(request, ids["login_teacher_b"])
            teacher_x = api_login(request, ids["login_teacher_x"])

            summaries_response = request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{ids['class_a']}/student-summaries",
                headers=auth_headers(teacher_a),
            )
            assert summaries_response.status == 200, summaries_response.text()
            summaries = payload(summaries_response)
            student_c_summary = next(
                item for item in summaries if item["enrollmentId"] == ids["enrollment_c"]
            )
            assert student_c_summary["courseProgress"] is None

            unauthenticated_request = playwright.request.new_context()
            no_auth = unauthenticated_request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{ids['class_a']}/dashboard"
            )
            assert no_auth.status == 401
            assert request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{ids['class_a']}/students/{ids['enrollment_a']}",
                headers=auth_headers(teacher_b),
            ).status == 403
            assert request.get(
                f"{BASE}/api/v1/schools/{ids['school_b']}/classes/{ids['class_x']}/students/{ids['enrollment_x']}",
                headers=auth_headers(teacher_a),
            ).status == 403
            assert request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{uuid.uuid4()}/dashboard",
                headers=auth_headers(teacher_a),
            ).status == 404
            assert request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{ids['class_a']}/students/{ids['enrollment_inactive']}",
                headers=auth_headers(teacher_a),
            ).status == 404
            assert request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/classes/{ids['class_a']}/students/{ids['enrollment_a']}",
                headers=auth_headers(api_login(request, ids["login_student_a"])),
            ).status == 403

            post_path = assignment_path(ids["school_a"], ids["class_a"])
            auth_a = auth_headers(teacher_a)
            due_at = "2099-12-31T12:00:00.000Z"
            no_auth_post = unauthenticated_request.post(
                f"{BASE}{post_path}",
                data={"title": "T014 未认证请求", "courseVersionId": ids["course_version"], "dueAt": due_at},
            )
            assert no_auth_post.status == 401
            unauthenticated_request.dispose()
            assert request.post(
                f"{BASE}{assignment_path(ids['school_a'], str(uuid.uuid4()))}",
                headers=auth_a,
                data={"title": "T014 不存在班级", "courseVersionId": ids["course_version"], "dueAt": due_at},
            ).status == 404
            negative_cases = [
                ({"title": "duplicate", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_a"], ids["enrollment_a"]]}, 409),
                ({"title": "cross-class", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_d"]]}, 400),
                ({"title": "cross-school", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_x"]]}, 400),
                ({"title": "inactive", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_inactive"]]}, 400),
                ({"title": "teacher-target", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_teacher_b"]]}, 400),
                ({"title": "invalid-deadline", "courseVersionId": ids["course_version"], "dueAt": "2000-01-01T00:00:00Z", "targetEnrollmentIds": [ids["enrollment_a"]]}, 400),
                ({"title": "invalid-date", "courseVersionId": ids["course_version"], "dueAt": "not-a-date", "targetEnrollmentIds": [ids["enrollment_a"]]}, 400),
                ({"title": "draft-version", "courseVersionId": ids["draft_course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_a"]]}, 409),
                ({"title": "foreign-version", "courseVersionId": ids["foreign_course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_a"]]}, 404),
            ]
            for body, expected_status in negative_cases:
                response = request.post(f"{BASE}{post_path}", headers=auth_a, data=body)
                assert response.status == expected_status, f"expected {expected_status} for {body['title']}: {response.text()}"

            teacher_b_forbidden = request.post(
                f"{BASE}{post_path}",
                headers=auth_headers(teacher_b),
                data={"title": "T014 未授权教师", "courseVersionId": ids["course_version"], "dueAt": due_at, "targetEnrollmentIds": [ids["enrollment_a"]]},
            )
            assert teacher_b_forbidden.status == 403, teacher_b_forbidden.text()
            cross_school_forbidden = request.post(
                f"{BASE}{assignment_path(ids['school_b'], ids['class_x'])}",
                headers=auth_a,
                data={"title": "T014 跨学校操作", "courseVersionId": ids["foreign_course_version"], "dueAt": due_at},
            )
            assert cross_school_forbidden.status == 403
            no_version = request.post(
                f"{BASE}{assignment_path(ids['school_a'], ids['class_no_course'])}",
                headers=auth_a,
                data={"title": "T014 缺少课程版本", "dueAt": due_at},
            )
            assert no_version.status == 409, no_version.text()

            teacher_page = browser.new_page(viewport={"width": 1440, "height": 1000})
            authenticate(teacher_page, teacher_a)
            teacher_page.goto(f"{BASE}/teacher/classes/")
            card = teacher_page.locator(f'.class-card[data-class-id="{ids["class_a"]}"]')
            expect(card).to_be_visible(timeout=20_000)
            expect(card).to_contain_text(ids["class_name_a"])
            card.locator('[data-action="enter"]').click()
            teacher_page.wait_for_url(f"**/teacher/classes/{ids['class_a']}?schoolId={ids['school_a']}")
            expect(teacher_page.locator(".class-title h1")).to_contain_text(ids["class_name_a"])
            expect(teacher_page.locator("#rosterTable")).to_contain_text(ids["name_student_a"])
            expect(teacher_page.locator("#rosterTable")).to_contain_text(ids["name_student_b"])
            expect(teacher_page.locator("#rosterTable")).to_contain_text(ids["name_student_c"])
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "t014-class-roster.png"), full_page=True)

            student_link = teacher_page.locator(".student-detail-link").filter(has_text=ids["name_student_a"])
            assert student_link.get_attribute("href").startswith(f"/teacher/students/{ids['enrollment_a']}?")
            student_link.click()
            teacher_page.wait_for_url(f"**/teacher/students/{ids['enrollment_a']}?*")
            expect(teacher_page.locator(".student-copy h1")).to_contain_text(
                ids["name_student_a"], timeout=15_000
            )
            expect(teacher_page.locator("#learningSummary")).to_contain_text("50%")
            expect(teacher_page.locator("#studentAssignments")).to_contain_text(ids["baseline_title"])
            expect(teacher_page.locator("#studentAssignments")).to_contain_text("教师反馈")
            expect(teacher_page.locator("#studentAssessments")).to_contain_text("83")
            expect(teacher_page.locator("#studentEvidence")).to_contain_text("READY")
            teacher_page.locator("[data-play-recording]").click()
            audio = teacher_page.locator("audio").first
            expect(audio).to_be_visible(timeout=15_000)
            recording_url = audio.get_attribute("src")
            assert recording_url
            assert teacher_page.request.get(recording_url).status == 200
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "t014-student-detail.png"), full_page=True)

            diagnostic_link = teacher_page.locator("#diagnosticLinks a").first
            diagnostic_href = diagnostic_link.get_attribute("href")
            assert diagnostic_href
            diagnostic_params = teacher_page.evaluate(
                """href => {
                  const url = new URL(href, location.origin);
                  return Object.fromEntries(url.searchParams.entries());
                }""",
                diagnostic_href,
            )
            assert diagnostic_params == {
                "schoolId": ids["school_a"],
                "classId": ids["class_a"],
                "enrollmentId": ids["enrollment_a"],
                "practiceDefinitionId": ids["practice_definition"],
            }
            diagnostic_link.click()
            teacher_page.wait_for_url("**/teacher/diagnostics/?*")
            expect(teacher_page.locator("#diagnostic-class")).to_have_value(ids["class_a"])
            expect(teacher_page.locator("#diagnostic-practice")).to_have_value(ids["practice_definition"])
            expect(teacher_page.locator("#diagnostic-students")).to_contain_text(ids["name_student_a"], timeout=20_000)
            expect(teacher_page.locator("#student-detail")).to_be_visible(timeout=20_000)
            expect(teacher_page.locator("#student-detail")).to_contain_text(ids["name_student_a"])
            expect(teacher_page.locator("#student-detail")).to_contain_text("暂无完整正式测评结果")
            teacher_page.go_back()
            teacher_page.wait_for_url(f"**/teacher/students/{ids['enrollment_a']}?*")

            review_link = teacher_page.locator("#studentAssignments a").first
            expect(review_link).to_contain_text("真实提交与复核")
            review_link.click()
            teacher_page.wait_for_url(f"**/teacher/submissions/{ids['submission_a']}*")
            expect(teacher_page.locator("body")).to_contain_text(ids["baseline_title"])
            teacher_page.go_back()
            teacher_page.wait_for_url(f"**/teacher/students/{ids['enrollment_a']}?*")
            teacher_page.locator("#backToClass").click()
            teacher_page.wait_for_url(f"**/teacher/classes/{ids['class_a']}?*")
            expect(teacher_page.locator(f'.roster-check[data-enrollment-id="{ids["enrollment_a"]}"]')).to_be_checked()
            expect(teacher_page.locator(f'.roster-check[data-enrollment-id="{ids["enrollment_c"]}"]')).not_to_be_checked()

            teacher_page.locator('[data-action="report"]').click()
            teacher_page.wait_for_url("**/teacher/diagnostics/?*")
            expect(teacher_page.locator("#diagnostic-class")).to_have_value(ids["class_a"])
            expect(teacher_page.locator("#diagnostic-students")).to_contain_text(ids["name_student_a"], timeout=20_000)
            teacher_page.goto(
                f"{BASE}/teacher/classes/{ids['class_a']}?schoolId={ids['school_a']}&studentId={ids['enrollment_a']}"
            )
            expect(teacher_page.locator("#rosterTable")).to_be_visible(timeout=20_000)

            teacher_page.get_by_role("button", name="查看提交").first.click()
            expect(teacher_page.locator("#drawerData")).to_contain_text(ids["name_student_a"])
            expect(teacher_page.locator("#drawerData")).to_contain_text(ids["name_student_b"])
            teacher_page.locator("#drawerClose").click()

            teacher_page.locator(f'.roster-check[data-enrollment-id="{ids["enrollment_b"]}"]').check()
            expect(teacher_page.locator(f'.roster-check[data-enrollment-id="{ids["enrollment_c"]}"]')).not_to_be_checked()
            teacher_page.locator('[data-action="assign-selected"]').click()
            expect(teacher_page.locator("#supplementaryPracticeForm")).to_be_visible()
            select = teacher_page.locator('select[name="courseVersionId"]')
            expect(select.locator(f'option[value="{ids["course_version"]}"]')).to_be_attached()
            select.select_option(ids["course_version"])
            teacher_page.locator('input[name="title"]').fill(ids["supplementary_title"])
            future_due = teacher_page.evaluate("""() => {
              const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
              d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
              return d.toISOString().slice(0, 16);
            }""")
            teacher_page.locator('input[name="dueAt"]').fill(future_due)
            assert ids["name_student_a"] in teacher_page.locator(".supplementary-target-summary").inner_text()
            assert ids["name_student_b"] in teacher_page.locator(".supplementary-target-summary").inner_text()
            assert ids["name_student_c"] not in teacher_page.locator(".supplementary-target-summary").inner_text()

            captured_requests = []
            teacher_page.on(
                "request",
                lambda request_event: captured_requests.append(request_event)
                if request_event.method == "POST" and request_event.url.endswith("/supplementary-practice")
                else None,
            )
            with teacher_page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.endswith("/supplementary-practice"),
                timeout=20_000,
            ) as response_info:
                teacher_page.locator("#drawerConfirm").click()
            create_response = response_info.value
            assert create_response.status == 201, create_response.text()
            teacher_page.wait_for_url("**/teacher/assignments/?assignmentId=*")
            assignment_id = teacher_page.evaluate("new URLSearchParams(location.search).get('assignmentId')")
            assert assignment_id
            expect(teacher_page.locator(".dynamic-detail")).to_be_visible(timeout=20_000)
            expect(teacher_page.locator("body")).to_contain_text(ids["supplementary_title"])
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text(ids["name_student_a"], timeout=20_000)
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text(ids["name_student_b"])
            expect(teacher_page.locator(".dynamic-detail")).not_to_contain_text(ids["name_student_c"])
            teacher_page.reload()
            expect(teacher_page.locator(".dynamic-detail")).to_be_visible(timeout=20_000)
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text(ids["name_student_a"], timeout=20_000)
            expect(teacher_page.locator(".dynamic-detail")).to_contain_text(ids["name_student_b"])
            teacher_page.screenshot(path=str(EVIDENCE_DIR / "t014-assignment-detail.png"), full_page=True)

            matching_request = next(
                request_event for request_event in captured_requests
                if request_event.url.endswith("/supplementary-practice")
            )
            idempotency_key = matching_request.headers.get("idempotency-key")
            assert idempotency_key
            request_body = json.loads(matching_request.post_data or "{}")
            replay = request.post(
                f"{BASE}/api/v1{matching_request.url.split('/api/v1')[-1]}",
                headers={**auth_a, "Idempotency-Key": idempotency_key},
                data=request_body,
            )
            assert replay.status == 201, replay.text()
            assert payload(replay)["id"] == assignment_id

            detail_response = request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/assignments/{assignment_id}",
                headers=auth_a,
            )
            assert detail_response.status == 200, detail_response.text()
            assignment_detail = payload(detail_response)
            assert assignment_detail["status"] == "OPEN"
            assert {target.get("enrollmentId") for target in assignment_detail["targets"]} == {
                ids["enrollment_a"], ids["enrollment_b"],
            }
            assert all(target["targetType"] == "STUDENT" for target in assignment_detail["targets"])
            assert all(target.get("classId") is None for target in assignment_detail["targets"])
            assert sql_scalar(
                f'''SELECT status FROM "Assignment" WHERE id={q(assignment_id)} AND "schoolId"={q(ids['school_a'])};'''
            ) == "OPEN"
            target_rows = sql_rows(
                f'''SELECT "targetType",coalesce("classId"::text,''),"enrollmentId"::text
                    FROM "AssignmentTarget" WHERE "assignmentId"={q(assignment_id)} ORDER BY "enrollmentId";'''
            )
            assert len(target_rows) == 2
            assert all(row[:2] == ["STUDENT", ""] for row in target_rows)
            assert {row[2] for row in target_rows} == {ids["enrollment_a"], ids["enrollment_b"]}
            assert sql_scalar(
                f'''SELECT count(*) FROM "Assignment" WHERE id={q(assignment_id)} AND title={q('【补充练习】'+ids['supplementary_title'])};'''
            ) == "1"
            assert sql_scalar(
                f'''SELECT count(*) FROM "AuditLog" WHERE "resourceId"={q(assignment_id)} AND action='SUPPLEMENTARY_PRACTICE_CREATED';'''
            ) == "1"

            student_a = api_login(request, ids["login_student_a"])
            student_b = api_login(request, ids["login_student_b"])
            student_c = api_login(request, ids["login_student_c"])
            student_d = api_login(request, ids["login_student_d"])
            student_x = api_login(request, ids["login_student_x"])

            opened_course_submissions = {}

            def open_today(identifier, session, expected, enrollment_id=None):
                page = browser.new_page(viewport={"width": 1280, "height": 900})
                authenticate(page, session)
                page.goto(f"{BASE}/student/today/")
                if expected:
                    expect(page.locator("#todayApp")).to_contain_text(ids["supplementary_title"], timeout=20_000)
                    today_task = page.locator(".today-record-row").filter(has_text=ids["supplementary_title"])
                    course_link = today_task.get_by_role("link")
                    expect(course_link).to_have_count(1)
                    expect(course_link).to_contain_text("课程")
                    course_link.click()
                    page.wait_for_url("**/student/courses/course-detail/?id=*")
                    expect(page.locator("body")).to_contain_text(ids["course_title"], timeout=20_000)
                    page.wait_for_function(
                        "assignmentId => { const state = window.CoursePlayerState?.getState?.(); return state?.assignmentId === assignmentId && state.submissionId && state.currentActivityId; }",
                        arg=assignment_id,
                        timeout=25_000,
                    )
                    course_state = page.evaluate("window.CoursePlayerState.getState()")
                    assert course_state["currentActivityId"] == ids["activity_b"]
                    assert course_state["currentActivity"]["title"] == "TEST_FIXTURE_ONLY 活动乙"
                    page.screenshot(path=str(EVIDENCE_DIR / f"t014-course-activity-{identifier}.png"), full_page=True)
                    submission_id = course_state["submissionId"]
                    assert submission_id
                    assert enrollment_id
                    submission_rows = sql_rows(
                        f'''SELECT id,status FROM "Submission"
                            WHERE "schoolId"={q(ids['school_a'])} AND "assignmentId"={q(assignment_id)}
                              AND "enrollmentId"={q(enrollment_id)} AND "deletedAt" IS NULL;'''
                    )
                    assert submission_rows == [[submission_id, "IN_PROGRESS"]]

                    activity_row = page.locator(f'#cpDirectory li[data-activity-id="{ids["activity_b"]}"]')
                    expect(activity_row).to_be_visible()
                    activity_row.click()
                    expect(activity_row).to_have_class("cp-dir-item cp-dir-current")
                    expect(page.locator("#cpExercisesList .cp-exercise-text-content")).to_contain_text("真实测试内容")
                    page.get_by_role("button", name="确认阅读").click()
                    confirmed_button = page.get_by_role("button", name="已确认")
                    expect(confirmed_button).to_be_disabled()
                    expect(confirmed_button).to_have_class("cp-exercise-feedback correct")
                    assert confirmed_button.evaluate("button => button.closest('#cpSectionExercises') !== null")
                    confirmed_button.scroll_into_view_if_needed()
                    page.screenshot(path=str(EVIDENCE_DIR / f"t014-course-activity-complete-viewport-{identifier}.png"), full_page=False)
                    page.screenshot(path=str(EVIDENCE_DIR / f"t014-course-activity-complete-{identifier}.png"), full_page=True)
                    assert sql_scalar(
                        f'''SELECT count(*) FROM "ActivityProgress"
                            WHERE "schoolId"={q(ids['school_a'])} AND "activityId"={q(ids['activity_b'])}
                              AND "enrollmentId"={q(enrollment_id)} AND completed=true;'''
                    ) == "1"

                    if identifier == "A":
                        for viewport_width, viewport_height in [(390, 844), (768, 1024), (1280, 900), (1440, 1000)]:
                            page.set_viewport_size({"width": viewport_width, "height": viewport_height})
                            page.locator("#cpSectionExercises").scroll_into_view_if_needed()
                            page.wait_for_timeout(80)
                            layout = page.evaluate("""() => {
                              const rect = selector => {
                                const element = document.querySelector(selector);
                                if (!element) return null;
                                const box = element.getBoundingClientRect();
                                return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width};
                              };
                              const feedback = document.querySelector('#cpExercisesList .cp-exercise-feedback');
                              return {
                                viewportWidth: window.innerWidth,
                                documentWidth: document.documentElement.scrollWidth,
                                player: rect('.cp-player-layout'),
                                main: rect('.cp-player-main'),
                                sidebar: rect('#cpDirectorySidebar'),
                                exerciseCard: rect('#cpSectionExercises'),
                                feedback: rect('#cpExercisesList .cp-exercise-feedback'),
                                feedbackBackground: feedback ? getComputedStyle(feedback).backgroundColor : null
                              };
                            }""")
                            assert layout["documentWidth"] <= viewport_width, layout
                            assert layout["player"]["right"] <= viewport_width + 1, layout
                            assert layout["feedback"] is not None, layout
                            assert layout["feedbackBackground"] not in (None, "rgba(0, 0, 0, 0)"), layout
                            card = layout["exerciseCard"]
                            feedback = layout["feedback"]
                            assert feedback["left"] >= card["left"] - 1 and feedback["right"] <= card["right"] + 1, layout
                            if viewport_width > 1024:
                                assert layout["main"]["right"] <= layout["sidebar"]["left"] + 1, layout
                                assert layout["sidebar"]["right"] <= viewport_width + 1, layout
                            else:
                                assert layout["sidebar"]["top"] >= layout["main"]["bottom"] - 1, layout
                            page.screenshot(
                                path=str(EVIDENCE_DIR / f"t014-course-responsive-{viewport_width}-A.png"),
                                full_page=False,
                            )
                        page.set_viewport_size({"width": 1280, "height": 900})

                    page.reload()
                    page.wait_for_function(
                        "submissionId => { const state = window.CoursePlayerState?.getState?.(); return state?.submissionId === submissionId && state.currentActivityId; }",
                        arg=submission_id,
                        timeout=25_000,
                    )
                    assert sql_scalar(
                        f'''SELECT count(*) FROM "Submission"
                            WHERE "schoolId"={q(ids['school_a'])} AND "assignmentId"={q(assignment_id)}
                              AND "enrollmentId"={q(enrollment_id)} AND "deletedAt" IS NULL;'''
                    ) == "1"
                    opened_course_submissions[identifier] = submission_id
                    page.goto(f"{BASE}/student/today/")
                    expect(page.locator("#todayApp")).to_contain_text(ids["supplementary_title"], timeout=20_000)
                    page.reload()
                    expect(page.locator("#todayApp")).to_contain_text(ids["supplementary_title"], timeout=20_000)
                else:
                    expect(page.locator("#todayApp")).not_to_contain_text(ids["supplementary_title"], timeout=20_000)
                page.screenshot(path=str(EVIDENCE_DIR / f"t014-today-{identifier}.png"), full_page=True)
                return page

            page_a = open_today("A", student_a, True, ids["enrollment_a"])
            page_b = open_today("B", student_b, True, ids["enrollment_b"])
            page_c = open_today("C", student_c, False)
            page_d = open_today("same-school-other-class", student_d, False)
            page_x = open_today("cross-school", student_x, False)

            own_course = request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/student/courses/{assignment_id}",
                headers=auth_headers(student_a),
            )
            assert own_course.status == 200, own_course.text()
            non_target_course = request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/student/courses/{assignment_id}",
                headers=auth_headers(student_c),
            )
            assert non_target_course.status == 404, non_target_course.text()
            cross_school_course = request.get(
                f"{BASE}/api/v1/schools/{ids['school_a']}/student/courses/{assignment_id}",
                headers=auth_headers(student_x),
            )
            assert cross_school_course.status in (403, 404), cross_school_course.text()

            count_before_failure = sql_scalar(
                f'''SELECT count(*) FROM "Assignment" WHERE "schoolId"={q(ids['school_a'])} AND title LIKE {q('【补充练习】'+ids['supplementary_title']+'%')};'''
            )
            teacher_page.goto(f"{BASE}/teacher/classes/{ids['class_a']}?schoolId={ids['school_a']}")
            expect(teacher_page.locator("#rosterTable")).to_be_visible(timeout=20_000)
            for checkbox in teacher_page.locator(".roster-check").all():
                if checkbox.is_checked():
                    checkbox.uncheck()
            teacher_page.locator(f'.roster-check[data-enrollment-id="{ids["enrollment_c"]}"]').check()
            teacher_page.locator('[data-action="assign-selected"]').click()
            network_title = f"TEST_FIXTURE_ONLY T014 网络失败 {uuid.uuid4().hex[:8]}"
            teacher_page.locator('input[name="title"]').fill(network_title)
            teacher_page.route("**/supplementary-practice", lambda route: route.abort())
            teacher_page.locator("#drawerConfirm").click()
            expect(teacher_page.locator("#supplementaryFormMessage")).to_contain_text("任务状态尚未确认", timeout=10_000)
            expect(teacher_page).to_have_url(f"{BASE}/teacher/classes/{ids['class_a']}?schoolId={ids['school_a']}")
            assert sql_scalar(
                f'''SELECT count(*) FROM "Assignment" WHERE "schoolId"={q(ids['school_a'])} AND title LIKE {q('%'+network_title)};'''
            ) == "0"
            teacher_page.unroute("**/supplementary-practice")

            sql(
                f'''UPDATE "Assignment" SET "dueAt"=NOW()-INTERVAL '1 day'
                    WHERE id={q(assignment_id)} AND "schoolId"={q(ids['school_a'])};'''
            )
            page_a.goto(f"{BASE}/student/today/")
            expect(page_a.locator("#todayApp")).not_to_contain_text(ids["supplementary_title"], timeout=20_000)
            assert sql_scalar(
                f'''SELECT status || '|' || ("dueAt" < NOW())::text FROM "Assignment" WHERE id={q(assignment_id)};'''
            ) == "OPEN|true"
            sql(
                f'''UPDATE "Assignment" SET "dueAt"=NOW()+INTERVAL '1 day'
                    WHERE id={q(assignment_id)} AND "schoolId"={q(ids['school_a'])};'''
            )
            page_a.goto(f"{BASE}/student/today/")
            expect(page_a.locator("#todayApp")).to_contain_text(ids["supplementary_title"], timeout=20_000)
            page_a.reload()
            expect(page_a.locator("#todayApp")).to_contain_text(ids["supplementary_title"], timeout=20_000)

            print(json.dumps({
                "schoolId": ids["school_a"],
                "classId": ids["class_a"],
                "enrollmentIds": [ids["enrollment_a"], ids["enrollment_b"], ids["enrollment_c"]],
                "assignmentId": assignment_id,
                "assignmentStatus": "OPEN",
                "targets": [ids["enrollment_a"], ids["enrollment_b"]],
                "nonTarget": ids["enrollment_c"],
                "courseSubmissions": opened_course_submissions,
                "completedActivityId": ids["activity_b"],
                "s3RecordingId": ids["recording_a"],
            }, ensure_ascii=False))
            for page in (page_a, page_b, page_c, page_d, page_x, teacher_page):
                page.close()
        finally:
            browser.close()
            request.dispose()
