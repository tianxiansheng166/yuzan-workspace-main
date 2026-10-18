#!/usr/bin/env python3
"""Fresh, task-owned native runtime and cross-role regression for YZ-RD-T024."""

from __future__ import annotations

import importlib.util
import json
import os
import secrets
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t024"
SHARED_RUNTIME_ROOT = ROOT.parent / "yuzan-workspace-main" / "runtime-local" / "native-web"
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t024"
DATABASE_NAME = "yuzan_t024_native"
DATABASE_USER = "yz_t024"
BUCKET = "yz-t024-native"
PORTS = {
    "API_PORT": "4134",
    "PORT": "4334",
    "POSTGRES_PORT": "55674",
    "REDIS_PORT": "6474",
    "MINIO_API_PORT": "59274",
    "MINIO_CONSOLE_PORT": "59275",
}
E2E_FILES = [
    ROOT / "tests/e2e/assessment/test_yz_rd_t020_teacher_home.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t014_teacher_class_remediation.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t012_student_practice.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t018_teacher_review_queue.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t011_web_review_feedback.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t013_student_today_growth.py",
    ROOT / "tests/e2e/assessment/test_yz_rd_t016_student_navigation.py",
    ROOT / "tests/e2e/course-learning/test_yz_rd_t017_student_courses.py",
]


def parse_config(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_config(runtime) -> None:
    path = runtime.CONFIG_FILE
    if path.is_file():
        os.chmod(path, 0o600)
        existing = runtime.load_config()
        if any(existing.get(key) != value for key, value in PORTS.items()):
            raise RuntimeError("Existing T024 config does not match its dedicated port allocation")
        if existing.get("POSTGRES_DB") != DATABASE_NAME or existing.get("POSTGRES_USER") != DATABASE_USER:
            raise RuntimeError("Existing T024 config has a different database identity; preserving it")
        if existing.get("S3_BUCKET") != BUCKET:
            raise RuntimeError("Existing T024 config has a different bucket; preserving it")
        return
    if runtime.PGDATA.exists() and any(runtime.PGDATA.iterdir()):
        raise RuntimeError("T024 PostgreSQL data exists without its config; preserving it")

    database_password = secrets.token_hex(32)
    s3_secret = secrets.token_hex(32)
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1",
        "API_PORT": PORTS["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{PORTS['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DATABASE_USER}:{database_password}@127.0.0.1:{PORTS['POSTGRES_PORT']}/{DATABASE_NAME}?schema=public",
        "POSTGRES_USER": DATABASE_USER,
        "POSTGRES_PASSWORD": database_password,
        "POSTGRES_DB": DATABASE_NAME,
        "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": PORTS["REDIS_PORT"],
        "REDIS_PASSWORD": secrets.token_hex(32),
        "SESSION_SECRET": secrets.token_hex(48),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}",
        "PORT": PORTS["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET,
        "S3_ACCESS_KEY": "yz_t024_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t024_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t024:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T024 native test runtime.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path, 0o600)


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t024", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load existing native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Reuse the accepted T019 lifecycle/import gates while redirecting all state
    # to the dedicated T024 runtime. The helper refuses unknown tasks by design.
    module.configure_task("T019", shared_runtime_root=SHARED_RUNTIME_ROOT)
    module.TASK_ID = "T019"
    module.RUNTIME = RUNTIME_DIR
    module.CONFIG_FILE = RUNTIME_DIR / ".env.local"
    module.STATE = RUNTIME_DIR / "state"
    module.LOGS = RUNTIME_DIR / "logs"
    module.PGDATA = RUNTIME_DIR / "postgres-data"
    module.REDIS_DATA = RUNTIME_DIR / "redis-data"
    module.MINIO_DATA = RUNTIME_DIR / "minio-data"
    module.EVIDENCE = RUNTIME_DIR / "evidence"
    module.TASK_BIN = RUNTIME_DIR / "bin"
    module.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    return module


def make_test_env(runtime, config: dict[str, str]) -> dict[str, str]:
    env = runtime.runtime_env(config)
    env.update({
        "DATABASE_URL": config["DATABASE_URL"],
        "POSTGRES_USER": config["POSTGRES_USER"],
        "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_DB": config["POSTGRES_DB"],
        "POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_NATIVE_TASK_ID": "T019",
    })
    package = str(ROOT / "backend/api/package.json")
    shared = {
        "BASE_URL": config["WEB_ORIGIN"],
        "DATABASE_URL": config["DATABASE_URL"],
        "PASSWORD": config["E2E_TEST_PASSWORD"],
        "EVIDENCE_DIR": str(EVIDENCE_DIR),
        "DATABASE_NAME": DATABASE_NAME,
        "DATABASE_USER": DATABASE_USER,
        "S3_BUCKET": BUCKET,
        "S3_ENDPOINT": config["S3_ENDPOINT"],
        "S3_REGION": config["S3_REGION"],
        "S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "MINIO_API_PORT": config["MINIO_API_PORT"],
        "API_PACKAGE": package,
    }
    for prefix in ("T020", "T018", "T011"):
        for suffix, value in shared.items():
            if suffix == "EVIDENCE_DIR":
                value = str(EVIDENCE_DIR / prefix.lower())
            env[f"YZ_{prefix}_{suffix}"] = value
    env.update({
        "YZ_T012_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T012_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T012_TEST_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T012_S3_BUCKET": BUCKET,
        "YZ_T012_EVIDENCE_DIR": str(EVIDENCE_DIR / "t012"),
        "YZ_T012_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T012_POSTGRES_USER": DATABASE_USER,
        "YZ_T012_POSTGRES_DB": DATABASE_NAME,
        "YZ_T012_PSQL": str(runtime.PG_BIN / "psql"),
        "YZ_T012_API_PACKAGE": package,
        "YZ_T013_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T013_API_BASE_URL": config["API_BASE_URL"],
        "YZ_T013_TEST_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T013_DATABASE_NAME": DATABASE_NAME,
        "YZ_T013_DATABASE_USER": DATABASE_USER,
        "YZ_T013_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T013_PSQL": str(runtime.PG_BIN / "psql"),
        "YZ_T013_PG_LIBRARY": str(runtime.PG_LIBRARY),
        "YZ_T013_EVIDENCE_DIR": str(EVIDENCE_DIR / "t013"),
        "YZ_T013_CHROMIUM": str(runtime.CHROME),
        "YZ_T014_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T014_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T014_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T014_EVIDENCE_DIR": str(EVIDENCE_DIR / "t014"),
        "YZ_T014_API_PACKAGE": package,
        "YZ_T014_S3_BUCKET": BUCKET,
        "YZ_T014_S3_ENDPOINT": config["S3_ENDPOINT"],
        "YZ_T014_S3_REGION": config["S3_REGION"],
        "YZ_T014_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "YZ_T014_S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "YZ_T014_MINIO_API_PORT": config["MINIO_API_PORT"],
        "YZ_T016_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T016_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T016_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T016_PSQL": str(runtime.PG_BIN / "psql"),
        "YZ_T016_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T016_POSTGRES_USER": DATABASE_USER,
        "YZ_T016_POSTGRES_DB": DATABASE_NAME,
        "YZ_T016_SCREENSHOT_DIR": str(EVIDENCE_DIR / "screenshots" / "t016"),
        "YZ_T016_CHROME": str(runtime.CHROME),
        "YZ_T017_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T017_API_BASE_URL": config["API_BASE_URL"],
        "YZ_T017_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T017_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T017_EVIDENCE_DIR": str(EVIDENCE_DIR / "t017"),
        "YZ_T017_PG_BIN": str(runtime.PG_BIN),
        "YZ_T017_RUNTIME_ROOT": str(RUNTIME_DIR),
        "YZ_E2E_TASK_ID": "T024",
        "YZ_E2E_BRANCH": "feat/yz-rd-t024-teacher-student-rolling-web",
        "YZ_T020_DATABASE_NAME": DATABASE_NAME,
        "YZ_T020_DATABASE_USER": DATABASE_USER,
        "YZ_T018_DATABASE_NAME": DATABASE_NAME,
        "YZ_T018_DATABASE_USER": DATABASE_USER,
    })
    env["PYTHONPATH"] = os.pathsep.join([
        str(ROOT / "tests/e2e/assessment"),
        str(ROOT / "tests/e2e/course-learning"),
        env.get("PYTHONPATH", ""),
    ]).rstrip(os.pathsep)
    for name in ("t012", "t013", "t014", "t017"):
        (EVIDENCE_DIR / name).mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "screenshots" / "t016").mkdir(parents=True, exist_ok=True)
    return env


def run_cross_role_tests(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str]:
    python = runtime.TEST_PYTHON
    if not python.is_file():
        raise RuntimeError("Shared native test venv with Playwright is unavailable")
    missing = [str(path) for path in E2E_FILES if not path.is_file()]
    if missing:
        raise RuntimeError("Missing accepted E2E suite(s): " + ", ".join(missing))
    log_path = EVIDENCE_DIR / "browser-logs" / "cross-role-native-playwright.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    command = [str(python), "-m", "pytest", "-q", "-s", *(str(path) for path in E2E_FILES)]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True,
    )
    runtime.record_for_pid("test", process.pid, "T024 cross-role Chromium regression", pgid=process.pid)
    chunks: list[str] = []
    try:
        assert process.stdout is not None
        with log_path.open("w", encoding="utf-8") as log:
            for line in process.stdout:
                chunks.append(line)
                log.write(line)
                log.flush()
                print(line, end="", flush=True)
        return_code = process.wait()
    finally:
        record = runtime.read_record("test")
        if record and int(record.get("pid", -1)) == process.pid:
            runtime.service_file("test").unlink(missing_ok=True)
    output = runtime.safe_text("".join(chunks), config)
    if output:
        log_path.write_text(output, encoding="utf-8")
    return return_code, output


def retire_t014_stub_reports(runtime, config: dict[str, str]) -> None:
    """Remove only T024's obsolete, explicitly synthetic T014 score fixtures."""
    query = (
        'SELECT r.id,s.id,p.title,r."overallScore"::text,s.status::text '
        'FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId" '
        'JOIN "PracticeDefinition" p ON p.id=s."practiceDefinitionId" '
        "WHERE p.title='TEST_FIXTURE_ONLY T014 正式测评' ORDER BY r.id;"
    )
    before = subprocess.run(
        [str(runtime.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", query],
        env=runtime.db_env(config), capture_output=True, text=True, check=False,
    )
    if before.returncode != 0:
        raise RuntimeError("Unable to inspect task-owned T014 test-only report fixtures")
    cleanup_sql = '''BEGIN;
      DELETE FROM "AssessmentReport" r USING "AssessmentSession" s, "PracticeDefinition" p
       WHERE r."sessionId"=s.id AND s."practiceDefinitionId"=p.id
         AND p.title='TEST_FIXTURE_ONLY T014 正式测评';
      UPDATE "AssessmentSession" s SET status='PROCESSING',"completedAt"=NULL,"updatedAt"=NOW()
        FROM "PracticeDefinition" p
       WHERE s."practiceDefinitionId"=p.id AND p.title='TEST_FIXTURE_ONLY T014 正式测评'
         AND s.status='COMPLETED';
      COMMIT;'''
    cleanup = subprocess.run(
        [str(runtime.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", cleanup_sql],
        env=runtime.db_env(config), capture_output=True, text=True, check=False,
    )
    after = subprocess.run(
        [str(runtime.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", query],
        env=runtime.db_env(config), capture_output=True, text=True, check=False,
    )
    evidence = (
        "Scope: exact TEST_FIXTURE_ONLY T014 PracticeDefinition title in the T024 database.\n"
        "Reason: earlier accepted T014 browser fixture inserted score 83 directly; the T024 run now verifies an unreported PROCESSING session and server-generated reports only.\n"
        "Before rows (report ID | session ID | title | score | status):\n"
        + before.stdout + before.stderr
        + "Cleanup output:\n" + cleanup.stdout + cleanup.stderr
        + "After rows (must be empty):\n" + after.stdout + after.stderr
    )
    evidence_path = EVIDENCE_DIR / "sql" / "t014-synthetic-report-retirement.txt"
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.write_text(evidence, encoding="utf-8")
    if cleanup.returncode != 0 or after.returncode != 0 or after.stdout.strip():
        raise RuntimeError("T024 could not retire only its obsolete synthetic T014 report rows")


def write_dynamic_sql_evidence(runtime, config: dict[str, str]) -> None:
    base = EVIDENCE_DIR
    t020 = json.loads((base / "t020" / "proof.json").read_text(encoding="utf-8"))
    t014 = json.loads((base / "t014" / "proof.json").read_text(encoding="utf-8"))
    t012 = json.loads((base / "t012" / "e2e-summary.json").read_text(encoding="utf-8"))
    t018 = json.loads((base / "t018" / "proof.json").read_text(encoding="utf-8"))
    t011 = json.loads((base / "t011" / "proof.json").read_text(encoding="utf-8"))

    def quoted_id(value: str) -> str:
        try:
            return "'" + str(uuid.UUID(value)) + "'"
        except (ValueError, TypeError, AttributeError) as error:
            raise RuntimeError(f"Invalid dynamic ID in T024 evidence: {value!r}") from error

    statements: list[str] = []

    def query(label: str, statement: str) -> None:
        result = subprocess.run(
            [str(runtime.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", statement],
            env=runtime.db_env(config), capture_output=True, text=True, check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"T024 dynamic SQL evidence failed for {label}: {result.stderr.strip()}")
        statements.append(f"## {label}\n{statement}\n{result.stdout.strip() or '(no rows)'}")

    query("T024 database identity", "SELECT current_database(),current_user,version();")

    t020_assignment = quoted_id(t020["ids"]["assignment_a"])
    t020_submission = quoted_id(t020["ids"]["submission_a"])
    t020_item = quoted_id(t020["reviewedItemId"])
    t020_queue_item_ids = t020["queueBeforeReview"]["studentItemIds"]
    if len(t020_queue_item_ids) != t020["queueBeforeReview"]["assessmentReviewItemTotal"]:
        raise RuntimeError("T020 API queue count and dynamic item ID list disagree")
    t020_queue_items = ",".join(quoted_id(value) for value in t020_queue_item_ids)
    query("T020 teacher-home Assignment", f'''SELECT id,status::text,"courseVersionId" FROM "Assignment" WHERE id={t020_assignment};''')
    query("T020 Submission remains separate", f'''SELECT id,"assignmentId","enrollmentId",status::text FROM "Submission" WHERE id={t020_submission};''')
    query("T020 reviewed Assessment Item", f'''SELECT i.id,i."sessionId",i."scoredScore"::text,i."reviewerUserId",i.status::text,(SELECT count(*) FROM "AssessmentReport" r WHERE r."sessionId"=i."sessionId") FROM "AssessmentItem" i WHERE i.id={t020_item};''')
    query("T020 six queue item rows and saved state", f'''SELECT id,"sessionId","scoredScore"::text,"reviewerUserId",status::text FROM "AssessmentItem" WHERE id IN ({t020_queue_items}) ORDER BY id;''')
    query("T020 queue item SQL count after one score", f'''SELECT count(*) FILTER (WHERE status::text='PENDING'),count(*) FILTER (WHERE status::text='REVIEWED') FROM "AssessmentItem" WHERE id IN ({t020_queue_items});''')

    t014_assignment = quoted_id(t014["assignmentId"])
    t014_targets = ",".join(quoted_id(value) for value in t014["targets"])
    t014_non_target = quoted_id(t014["nonTarget"])
    t014_submissions = ",".join(quoted_id(value) for value in t014["courseSubmissions"].values())
    t014_activity = quoted_id(t014["completedActivityId"])
    t014_recording = quoted_id(t014["s3RecordingId"])
    query("T014 targeted OPEN Assignment", f'''SELECT a.id,a.status::text,at."targetType"::text,at."classId",at."enrollmentId" FROM "Assignment" a JOIN "AssignmentTarget" at ON at."assignmentId"=a.id WHERE a.id={t014_assignment} ORDER BY at."enrollmentId";''')
    query("T014 selected A/B and excluded C", f'''SELECT count(*) FILTER (WHERE "enrollmentId" IN ({t014_targets})),count(*) FILTER (WHERE "enrollmentId"={t014_non_target}) FROM "AssignmentTarget" WHERE "assignmentId"={t014_assignment};''')
    query("T014 A/B course Submissions", f'''SELECT id,"assignmentId","enrollmentId",status::text FROM "Submission" WHERE id IN ({t014_submissions}) ORDER BY id;''')
    query("T014 completed activity progress", f'''SELECT "activityId","enrollmentId",completed,position,revision FROM "ActivityProgress" WHERE "activityId"={t014_activity} ORDER BY "enrollmentId";''')
    query("T014 recording row", f'''SELECT id,"enrollmentId",status::text,"mimeType","objectKey" FROM "Recording" WHERE id={t014_recording};''')

    t012_attempt = quoted_id(t012["attemptId"])
    query("T012 twenty-item attempt remains PROCESSING without a report", f'''SELECT s.id,s.status::text,(SELECT count(*) FROM "AssessmentItem" i WHERE i."sessionId"=s.id),(SELECT count(*) FROM "AssessmentItem" i WHERE i."sessionId"=s.id AND i."recordingId" IS NOT NULL),(SELECT count(*) FROM "AssessmentItem" i WHERE i."sessionId"=s.id AND i."recordingId" IS NOT NULL AND i."scoredScore" IS NOT NULL),(SELECT count(*) FROM "SpeechJob" j JOIN "AssessmentItem" i ON i.id=j."assessmentItemId" WHERE i."sessionId"=s.id),(SELECT count(*) FROM "AssessmentReport" r WHERE r."sessionId"=s.id) FROM "AssessmentSession" s WHERE s.id={t012_attempt};''')

    for label, data in (("T018", t018), ("T011", t011)):
        attempt = quoted_id(data["attemptId"])
        report = quoted_id(data["reportId"])
        item_ids = data["reviewItemIds"]
        item_list = ",".join(quoted_id(value) for value in item_ids)
        query(f"{label} server-generated formal report and reviewed session", f'''SELECT s.id,s.status::text,r.id,r."overallScore"::text,(SELECT count(*) FROM "AssessmentItem" i WHERE i."sessionId"=s.id),(SELECT count(*) FROM "AssessmentItem" i WHERE i."sessionId"=s.id AND i."scoredScore" IS NOT NULL) FROM "AssessmentSession" s JOIN "AssessmentReport" r ON r."sessionId"=s.id WHERE s.id={attempt} AND r.id={report};''')
        query(f"{label} six required manual review rows", f'''SELECT id,"scoredScore"::text,"reviewerUserId","reviewerComment",revision,status::text FROM "AssessmentItem" WHERE id IN ({item_list}) ORDER BY id;''')
        recordings = data.get("recordingsInMinIO", data.get("recordings", []))
        recording_ids = [entry["recordingId"] for entry in recordings if entry.get("recordingId")]
        if recording_ids:
            recording_list = ",".join(quoted_id(value) for value in recording_ids)
            query(f"{label} MinIO recording row links", f'''SELECT id,"enrollmentId",status::text,"mimeType","objectKey" FROM "Recording" WHERE id IN ({recording_list}) ORDER BY id;''')

    query("T024 contains no T014 synthetic scored report", '''SELECT count(*) FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId" JOIN "PracticeDefinition" p ON p.id=s."practiceDefinitionId" WHERE p.title='TEST_FIXTURE_ONLY T014 正式测评';''')
    path = base / "sql" / "dynamic-flow-id-parity.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n\n".join(statements) + "\n", encoding="utf-8")


def reap_stopped_owned_children(runtime) -> None:
    """Reap only the API/Web/Redis/MinIO children recorded by this runtime."""
    for name in ("web", "api", "minio", "redis"):
        record = runtime.read_record(name)
        if not record:
            continue
        try:
            pid = int(record["pid"])
            result = os.waitpid(pid, os.WNOHANG)
        except (ChildProcessError, KeyError, TypeError, ValueError, OSError):
            continue
        if result[0] == pid:
            print(f"T024 cleanup: reaped owned {name} child PID {pid}.", flush=True)


def main() -> int:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(RUNTIME_DIR, 0o700)
    module = load_runtime_module()
    module.ensure_dirs()
    write_config(module)
    config = module.load_config()
    if module.PGDATA.exists() and any(module.PGDATA.iterdir()) and not (module.PGDATA / "PG_VERSION").is_file():
        raise RuntimeError("T024 PostgreSQL directory is nonempty without PG_VERSION; preserving it")
    for port in (int(value) for value in PORTS.values()):
        module.check_port_available(port)

    runner_log = EVIDENCE_DIR / "test-results" / "native-runner.log"
    runner_log.parent.mkdir(parents=True, exist_ok=True)
    result_code = 1
    runtime_stopped = False
    try:
        with runner_log.open("w", encoding="utf-8") as log:
            def record(message: str) -> None:
                log.write(message + "\n")
                log.flush()
                print(message, flush=True)

            node = module.node_binary()
            pnpm = module.command_path("pnpm")
            record(f"T024 native runtime start: {datetime.now(timezone.utc).isoformat()}")
            record(f"Node: {module.command_version(node, ['--version']) if node else 'NOT_FOUND'}")
            record(f"pnpm: {module.command_version(pnpm, ['--version']) if pnpm else 'NOT_FOUND'}")
            record(f"PostgreSQL: {module.command_version(module.PG_BIN / 'postgres', ['--version'])}")
            record(f"Redis: {module.command_version(module.REDIS_DIR / 'redis-server', ['--version'])}")
            record(f"Chrome: {module.command_version(module.CHROME, ['--version'])}")
            record(f"Database identity: {DATABASE_NAME} / {DATABASE_USER}")
            record(f"Bucket: {BUCKET}")
            record(f"Ports: {json.dumps(PORTS, sort_keys=True)}")
            record("Runtime mode: native; Docker/Compose/P1-SIM not used; worker remains disabled.")
            start_result = module.start("assessment")
            if start_result != 0:
                raise RuntimeError("Native T024 services did not start cleanly")
            source_dir = Path("/home/tian/code/yuzan-workspace-main/习题课程资源")
            record(f"Question bank source: {source_dir} (read-only import input)")
            if module.import_question_bank(source_dir) != 0:
                raise RuntimeError("T024 read-only Question Bank import failed")
            retire_t014_stub_reports(module, config)
            test_env = make_test_env(module, config)
            result_code, output = run_cross_role_tests(module, config, test_env)
            record(f"Cross-role Chromium/API/PostgreSQL/MinIO regression exit: {result_code}")
            record("Cross-role suite output is in browser-logs/cross-role-native-playwright.log")
            if result_code == 0:
                write_dynamic_sql_evidence(module, config)
            sql_result = subprocess.run(
                [str(module.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c",
                 "SELECT current_database(), current_user, version(), "
                 '(SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), '
                 "(SELECT count(*) FROM information_schema.tables WHERE table_schema='public');"],
                env=module.db_env(config),
                capture_output=True,
                text=True,
                check=False,
            )
            sql_path = EVIDENCE_DIR / "sql" / "native-runtime-final.txt"
            sql_path.parent.mkdir(parents=True, exist_ok=True)
            sql_path.write_text(sql_result.stdout + sql_result.stderr, encoding="utf-8")
            if sql_result.returncode != 0:
                raise RuntimeError("T024 final SQL evidence query failed")
    except Exception as error:
        print(f"T024 native runtime failed: {module.safe_text(str(error), config)}", file=sys.stderr, flush=True)
        result_code = 1
    finally:
        module.stop_all()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            reap_stopped_owned_children(module)
            live_owned = [
                name for name in ("api", "web", "redis", "minio")
                if (record := module.read_record(name)) and module.process_start_ticks(int(record.get("pid", -1))) is not None
            ]
            if not live_owned:
                break
            time.sleep(0.25)
        module.stop_all()
        status_result = module.status()
        if status_result != 0:
            result_code = 1
        remaining = {
            name: module.port_listener_pids(int(value))
            for name, value in PORTS.items()
        }
        if any(remaining.values()):
            print(f"T024 port ownership after stop: {json.dumps(remaining, sort_keys=True)}", flush=True)
            result_code = 1
        runtime_stopped = status_result == 0 and not any(remaining.values())
    sql_path = EVIDENCE_DIR / "sql" / "native-runtime-final.txt"
    db_summary = sql_path.read_text(encoding="utf-8").strip() if sql_path.is_file() else "NOT_RUN"
    summary = {
        "task": "YZ-RD-T024",
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "database": DATABASE_NAME,
        "databaseRole": DATABASE_USER,
        "bucket": BUCKET,
        "ports": PORTS,
        "runtimeStopped": runtime_stopped,
        "workerStarted": False,
        "testExitCode": result_code,
        "postgresSummary": db_summary,
        "browserLog": str(EVIDENCE_DIR / "browser-logs" / "cross-role-native-playwright.log"),
        "dockerUsed": False,
    }
    (EVIDENCE_DIR / "native-runtime-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
