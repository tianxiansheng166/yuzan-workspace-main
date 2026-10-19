#!/usr/bin/env python3
"""Task-owned native PostgreSQL/API/Web/Redis/MinIO/Chromium runner for T026."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t026"
SHARED_RUNTIME_ROOT = ROOT.parent / "yuzan-workspace-main" / "runtime-local" / "native-web"
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t026"
E2E_FILE = ROOT / "tests/e2e/assessment/test_yz_rd_t026_onboarding.py"
DATABASE_NAME = "yuzan_t026_native"
DATABASE_USER = "yz_t026"
BUCKET = "yz-t026-native"
PORTS = {
    "API_PORT": "4126",
    "PORT": "4326",
    "POSTGRES_PORT": "55686",
    "REDIS_PORT": "6486",
    "MINIO_API_PORT": "59326",
    "MINIO_CONSOLE_PORT": "59327",
}


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t026", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing native runtime helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Reuse the accepted T019 lifecycle and its migration safeguards while all
    # process state, database data and bucket contents remain T026-owned.
    module.configure_task("T019", shared_runtime_root=SHARED_RUNTIME_ROOT)
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
    runtime.RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(runtime.RUNTIME, 0o700)
    if path.is_file():
        os.chmod(path, 0o600)
        existing = parse_config(path)
        expected = {
            **PORTS,
            "POSTGRES_DB": DATABASE_NAME,
            "POSTGRES_USER": DATABASE_USER,
            "S3_BUCKET": BUCKET,
        }
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T026 runtime config has a different database, bucket or port allocation; preserving it")
        runtime.load_config()
        return
    if runtime.PGDATA.exists() and any(runtime.PGDATA.iterdir()):
        raise RuntimeError("T026 PostgreSQL data exists without its matching config; preserving it")

    import secrets

    database_password = secrets.token_urlsafe(36)
    s3_secret = secrets.token_urlsafe(36)
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
        "REDIS_PASSWORD": secrets.token_urlsafe(36),
        "SESSION_SECRET": secrets.token_urlsafe(56),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}",
        "PORT": PORTS["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET,
        "S3_ACCESS_KEY": "yz_t026_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t026_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t026:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        # The accepted native database seed's fictional template accounts use
        # this local-only password; T021 registers its own separate test users.
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T026 native runtime secrets; do not commit.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path, 0o600)
    runtime.load_config()


def verify_native_toolchain(runtime) -> None:
    pnpm = runtime.command_path("pnpm")
    if not pnpm or runtime.command_version(pnpm, ["--version"]) != "10.13.1":
        raise RuntimeError("T026 requires repository-pinned pnpm 10.13.1")
    node = runtime.node_binary()
    if not node or not runtime.command_version(node, ["--version"]).startswith("v24."):
        raise RuntimeError("T026 requires Node 24")
    if not runtime.TEST_PYTHON.is_file():
        raise RuntimeError("Shared native Playwright test environment is unavailable")
    python_check = runtime.run_output(
        [str(runtime.TEST_PYTHON), "-c", "import playwright, pytest; print('Playwright and pytest available')"],
        timeout=10,
    )
    if python_check.returncode != 0:
        raise RuntimeError("Shared native Playwright environment failed its import check")
    print(
        f"Toolchain: Node {runtime.command_version(node, ['--version'])}; pnpm 10.13.1; "
        f"PostgreSQL 17; Redis 7; MinIO; Chromium {runtime.command_version(runtime.CHROME, ['--version'])}"
    )


def make_test_env(runtime, config: dict[str, str]) -> dict[str, str]:
    env = runtime.runtime_env(config)
    env.update(
        {
            "YZ_T026_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T026_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T026_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T026_DATABASE_NAME": DATABASE_NAME,
            "YZ_T026_DATABASE_USER": DATABASE_USER,
            "YZ_T026_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T026_PSQL": str(runtime.PG_BIN / "psql"),
            "YZ_T026_PG_LIBRARY": str(runtime.PG_LIBRARY),
            "YZ_T026_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T026_EVIDENCE_DIR": str(EVIDENCE_DIR),
            "YZ_T026_CHROMIUM": str(runtime.CHROME),
        }
    )
    env["PYTHONPATH"] = os.pathsep.join([str(ROOT / "tests/e2e/assessment"), env.get("PYTHONPATH", "")]).rstrip(os.pathsep)
    return env


def run_e2e(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str, int]:
    log_path = EVIDENCE_DIR / "browser-logs" / "native-onboarding-playwright.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    process = subprocess.Popen(
        [str(runtime.TEST_PYTHON), "-m", "pytest", "-q", "-s", str(E2E_FILE)],
        cwd=ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    runtime.record_for_pid("test", process.pid, str(E2E_FILE), pgid=process.pid)
    try:
        output, _ = process.communicate(timeout=600)
    except subprocess.TimeoutExpired:
        runtime.stop_service("test", config)
        output, _ = process.communicate(timeout=15)
        output += "\nT026 native E2E timed out after 600 seconds and its recorded test process was stopped.\n"
        process.returncode = 124
    finally:
        record = runtime.read_record("test")
        if record and int(record.get("pid", -1)) == process.pid:
            runtime.service_file("test").unlink(missing_ok=True)
    safe_output = runtime.safe_text(output, config)
    safe_output = re.sub(r"TC-[A-Z0-9]{5}-[A-Z0-9]{5}", "TC-•••••-•••••", safe_output)
    safe_output = re.sub(r"Bearer\s+[A-Za-z0-9._~-]+", "Bearer <redacted>", safe_output)
    log_path.write_text(safe_output, encoding="utf-8")
    return process.returncode or 0, safe_output, process.pid


def q(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def write_sql_evidence(runtime, config: dict[str, str]) -> None:
    t023_path = EVIDENCE_DIR / "t023-browser-flow" / "browser-database-evidence.json"
    t021_path = EVIDENCE_DIR / "t021-profile-isolation" / "e2e-summary.json"
    t023 = json.loads(t023_path.read_text(encoding="utf-8"))
    t021 = json.loads(t021_path.read_text(encoding="utf-8"))
    linked = t023["postgres"]
    invite_ids = sorted(t021["teacherInvitationUsage"].keys())
    if not invite_ids:
        raise RuntimeError("T026 T021 browser evidence lacks real server invitation IDs")

    statements = [
        ("T026 database identity", "SELECT current_database(),current_user,version();"),
        (
            "T023 linked browser invitation → membership/enrollment/audit/use count",
            f'''SELECT i.id AS invitation_id,i."schoolId",i."classId",i."teacherUserId",i."maxUses",i."usedCount",i."expiresAt",
                       m.id AS membership_id,m.status::text,e.id AS enrollment_id,e.role::text,e.status::text,
                       a.id AS audit_log_id,a.action
                  FROM "TeacherInvitation" i
                  JOIN "Membership" m ON m."schoolId"=i."schoolId" AND m."userId"={q(linked['studentUserId'])} AND m.role='STUDENT'
                  JOIN "Enrollment" e ON e."schoolId"=i."schoolId" AND e."classId"=i."classId" AND e."userId"=m."userId" AND e.role='STUDENT'
                  JOIN "AuditLog" a ON a."resourceId"=i.id::text AND a."actorUserId"=m."userId" AND a.action='STUDENT_BOUND_TEACHER_INVITATION'
                 WHERE i.id={q(linked['teacherInvitationId'])};''',
        ),
        (
            "T021 student A school/class memberships and enrollment counts",
            f'''SELECT m."schoolId",m."userId",m.status::text,
                       count(e.id) FILTER (WHERE e.status='ACTIVE') AS active_class_enrollments
                  FROM "Membership" m LEFT JOIN "Enrollment" e ON e."schoolId"=m."schoolId" AND e."userId"=m."userId" AND e.role='STUDENT'
                 WHERE m."userId"={q(t021['studentAId'])} AND m.role='STUDENT'
                 GROUP BY m."schoolId",m."userId",m.status ORDER BY m."schoolId";''',
        ),
        (
            "T021 student A bound invitation IDs, classes and audit records",
            f'''SELECT i.id AS invitation_id,i."schoolId",i."classId",i."usedCount",e.id AS enrollment_id,e.status::text,a.id AS audit_log_id,a.action
                  FROM "TeacherInvitation" i
                  JOIN "Enrollment" e ON e."schoolId"=i."schoolId" AND e."classId"=i."classId" AND e."userId"={q(t021['studentAId'])} AND e.role='STUDENT'
                  LEFT JOIN "AuditLog" a ON a."resourceId"=i.id::text AND a."actorUserId"={q(t021['studentAId'])} AND a.action='STUDENT_BOUND_TEACHER_INVITATION'
                 WHERE i.id IN ({','.join(q(value) for value in invite_ids)}) ORDER BY i."schoolId",i."classId";''',
        ),
    ]
    output: list[str] = []
    for label, statement in statements:
        result = runtime.run_output(
            [str(runtime.PG_BIN / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-c", statement],
            env=runtime.db_env(config),
            timeout=20,
        )
        if result.returncode:
            raise RuntimeError(f"T026 SQL evidence failed for {label}: {runtime.safe_text(result.stderr[-1200:], config)}")
        output.append(f"## {label}\n{statement}\n{result.stdout.strip() or '(no rows)'}")
    path = EVIDENCE_DIR / "sql" / "real-onboarding-records.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n\n".join(output) + "\n", encoding="utf-8")


def reap_stopped_owned_children(runtime) -> None:
    """Reap only child PIDs recorded by this T026 runtime after TERM exits."""
    for name in ("web", "api", "minio", "redis"):
        record = runtime.read_record(name)
        if not record:
            continue
        try:
            pid = int(record["pid"])
            waited, _ = os.waitpid(pid, os.WNOHANG)
        except (ChildProcessError, KeyError, TypeError, ValueError, OSError):
            continue
        if waited == pid:
            print(f"T026 cleanup: reaped owned {name} child PID {pid}.", flush=True)


def main() -> int:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(RUNTIME_DIR, 0o700)
    runtime = load_runtime_module()
    runtime.ensure_dirs()
    write_config(runtime)
    config = runtime.load_config()
    if runtime.PGDATA.exists() and any(runtime.PGDATA.iterdir()) and not (runtime.PGDATA / "PG_VERSION").is_file():
        raise RuntimeError("T026 PostgreSQL data directory is nonempty without PG_VERSION; preserving it")
    verify_native_toolchain(runtime)
    for port in (int(value) for value in PORTS.values()):
        runtime.check_port_available(port)

    result_code = 1
    test_pid: int | None = None
    service_pids: dict[str, int] = {}
    try:
        print(f"T026 native runtime start: {datetime.now(timezone.utc).isoformat()}")
        print(f"Database identity: {DATABASE_NAME} / {DATABASE_USER}")
        print(f"MinIO bucket: {BUCKET}")
        print(f"Ports: {json.dumps(PORTS, sort_keys=True)}")
        print("Runtime mode: native Node 24 / pnpm 10.13.1 / PostgreSQL 17 / Redis 7 / MinIO; worker stopped; no Docker/Compose/P1-SIM.")
        if runtime.start("assessment") != 0:
            raise RuntimeError("T026-owned native PostgreSQL/API/Web/Redis/MinIO runtime did not start cleanly")
        if runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5) != 200:
            raise RuntimeError("T026 API readiness did not include PostgreSQL, Redis and MinIO")
        result_code, output, test_pid = run_e2e(runtime, config, make_test_env(runtime, config))
        print(output)
        print(f"T026 native Chromium/API/PostgreSQL E2E: {'PASS' if result_code == 0 else 'FAIL'}")
        if result_code == 0:
            write_sql_evidence(runtime, config)
    except Exception as error:
        print(f"T026 native runtime failed: {runtime.safe_text(str(error), config)}", file=sys.stderr, flush=True)
        result_code = 1
    finally:
        for name in ("postgres", "api", "web", "redis", "minio"):
            record = runtime.read_record(name)
            if record:
                service_pids[name] = int(record.get("pid", -1))
        stop_status = runtime.stop_all()
        if stop_status != 0:
            reap_stopped_owned_children(runtime)
            time.sleep(1)
            stop_status = runtime.stop_all()
        status = runtime.status()
        config = runtime.load_config(required=False)
        ports_after_stop = {}
        if config:
            for key in ("POSTGRES_PORT", "API_PORT", "PORT", "REDIS_PORT", "MINIO_API_PORT", "MINIO_CONSOLE_PORT"):
                port = int(config[key])
                listeners = sorted(runtime.port_listener_pids(port))
                ports_after_stop[key] = {"port": port, "listenerPids": listeners, "stopped": not listeners}
            if any(not entry["stopped"] for entry in ports_after_stop.values()):
                result_code = 1
        if stop_status != 0 or status != 0:
            result_code = 1
        summary = {
            "taskId": "YZ-RD-T026",
            "database": DATABASE_NAME,
            "databaseUser": DATABASE_USER,
            "bucket": BUCKET,
            "portsAfterStop": ports_after_stop,
            "servicePidsBeforeStop": service_pids,
            "nativeE2EPid": test_pid,
            "nativeE2EPidExited": bool(test_pid),
            "processStopPass": stop_status == 0 and status == 0 and all(entry["stopped"] for entry in ports_after_stop.values()),
            "worker": "NOT_STARTED",
            "dockerComposeP1Sim": "NOT_USED",
            "l4HistoricalVolumeIncident": "OPEN_NOT_INSPECTED",
            "databaseAndMinioData": "RETAINED",
            "testExitCode": result_code,
        }
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        (EVIDENCE_DIR / "native-runtime-summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print("T026 cleanup: only recorded T026-owned services were stopped; database and MinIO data retained.")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
