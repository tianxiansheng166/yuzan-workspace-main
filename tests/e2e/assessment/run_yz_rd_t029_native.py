#!/usr/bin/env python3
"""Fresh, task-owned native T029 PostgreSQL/API/Web/Chromium invitation runtime."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import secrets
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t029"
SHARED_TOOLCHAIN_ROOT = ROOT.parent / "yuzan-workspace-main" / "runtime-local" / "native-web"
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t029"
E2E_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t029_onboarding_revocation.py"
DATABASE_NAME = "yuzan_t029_native"
DATABASE_USER = "yz_t029"
BUCKET = "yz-t029-native"
PORTS = {
    "API_PORT": "4129",
    "PORT": "4329",
    "POSTGRES_PORT": "55829",
    "REDIS_PORT": "6469",
    "MINIO_API_PORT": "59429",
    "MINIO_CONSOLE_PORT": "59430",
}


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t029", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure_task("T014", shared_runtime_root=SHARED_TOOLCHAIN_ROOT)
    module.TASK_ID = "T029"
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
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_config(runtime) -> None:
    if runtime.CONFIG_FILE.is_file():
        os.chmod(runtime.CONFIG_FILE, 0o600)
        existing = parse_config(runtime.CONFIG_FILE)
        expected = {
            **PORTS,
            "POSTGRES_DB": DATABASE_NAME,
            "POSTGRES_USER": DATABASE_USER,
            "S3_BUCKET": BUCKET,
        }
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T029 runtime config does not match its dedicated database, bucket and ports")
        runtime.load_config()
        return

    database_password = secrets.token_urlsafe(36)
    redis_password = secrets.token_urlsafe(36)
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
        "REDIS_PASSWORD": redis_password,
        "SESSION_SECRET": secrets.token_urlsafe(56),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}",
        "PORT": PORTS["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET,
        "S3_ACCESS_KEY": "yz_t029_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t029_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t029:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    runtime.RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(runtime.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T029 native test runtime. Do not commit.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    runtime.load_config()


def verify_native_toolchain(runtime) -> None:
    pnpm = runtime.command_path("pnpm")
    if not pnpm:
        raise RuntimeError("The repository-pinned pnpm 10.13.1 executable is unavailable")
    version = runtime.command_version(pnpm, ["--version"])
    if version != "10.13.1":
        raise RuntimeError(f"Expected pnpm 10.13.1, found {version}")
    node_version = subprocess.run([str(runtime.node_binary()), "--version"], check=True, capture_output=True, text=True).stdout.strip()
    if not node_version.startswith("v24."):
        raise RuntimeError(f"Expected Node 24, found {node_version}")
    print(f"Toolchain: Node {node_version}; pnpm {version}; PostgreSQL 17; Redis 7; MinIO")


def verify_database(runtime, config: dict[str, str], env: dict[str, str]) -> bool:
    query = "SELECT current_database() || '|' || current_user || '|' || version() || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;"
    result = runtime.run_output([str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-c", query], env=runtime.db_env(config), timeout=15)
    if result.returncode != 0:
        raise RuntimeError("Cannot verify the fresh T029 PostgreSQL database")
    values = result.stdout.strip().split("|", 3)
    if len(values) != 4 or values[0] != DATABASE_NAME or values[1] != DATABASE_USER or not values[2].startswith("PostgreSQL 17."):
        raise RuntimeError("T029 PostgreSQL identity/version does not match its dedicated database and user")
    if values[3] == "0":
        print(f"Database: {values[0]} / {values[1]} / PostgreSQL 17 / initially empty")
        return True
    migration_probe = runtime.run_output(
        [
            str(runtime.PG_BIN / "psql"), "-X", "-A", "-t", "-F", "|", "-c",
            'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text, '
            'count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM "_prisma_migrations";',
        ],
        env=runtime.db_env(config),
        timeout=15,
    )
    if migration_probe.returncode != 0:
        raise RuntimeError("T029 database has tables but no valid Prisma migration ledger; preserving it")
    applied, incomplete = migration_probe.stdout.strip().split("|", 1)
    expected = sum(path.is_dir() for path in (ROOT / "infra" / "database" / "prisma" / "migrations").iterdir())
    if int(applied) != expected or incomplete != "0":
        raise RuntimeError("T029 database migration ledger is incomplete; preserving it without rerunning migrations")
    print(f"Database: retaining task-owned schema with {applied} completed migrations")
    return False


def prepare_bucket(runtime, env: dict[str, str], config: dict[str, str]) -> None:
    script = r'''
const path = require("node:path");
const { createRequire } = require("node:module");
const requireFromApi = createRequire(path.resolve(process.cwd(), "backend/api/package.json"));
const { CreateBucketCommand, HeadBucketCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true, credentials: {accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY}});
(async () => { try { await client.send(new HeadBucketCommand({Bucket: process.env.S3_BUCKET})); } catch { await client.send(new CreateBucketCommand({Bucket: process.env.S3_BUCKET})); } finally { client.destroy(); } })().catch(error => { process.stderr.write(`${error.name || "MINIO_BUCKET_FAILED"}\n`); process.exitCode = 1; });
'''
    node = runtime.node_binary()
    result = runtime.run_output([str(node), "-e", script], env=env, cwd=ROOT, timeout=45)
    if result.returncode != 0:
        raise RuntimeError("T029-owned MinIO bucket creation failed: " + runtime.safe_text(result.stderr[-1200:], config))
    print(f"MinIO bucket: {config['S3_BUCKET']} ready")


def run_e2e(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str, int]:
    python = runtime.TEST_PYTHON
    if not python.is_file() or not E2E_FILE.is_file():
        raise RuntimeError("The native Playwright environment or T029 E2E file is unavailable")
    test_env = dict(env)
    test_env.update({
        "YZ_T029_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T029_API_BASE_URL": config["API_BASE_URL"],
        "YZ_T029_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T029_DATABASE_NAME": DATABASE_NAME,
        "YZ_T029_DATABASE_USER": DATABASE_USER,
        "YZ_T029_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T029_PSQL": str(runtime.PG_BIN / "psql"),
        "YZ_T029_PG_LIBRARY": str(runtime.PG_LIBRARY),
        "YZ_T029_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T029_EVIDENCE_DIR": str(EVIDENCE_DIR),
        "YZ_T029_CHROMIUM": str(runtime.CHROME),
        "POSTGRES_USER": config["POSTGRES_USER"],
        "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_DB": config["POSTGRES_DB"],
        "POSTGRES_PORT": config["POSTGRES_PORT"],
        "PATH": f"{runtime.PG_BIN}{os.pathsep}{runtime.TASK_BIN}{os.pathsep}{test_env.get('PATH', '')}",
    })
    process = subprocess.Popen(
        [str(python), "-m", "pytest", "-q", "-s", str(E2E_FILE)],
        cwd=ROOT,
        env=test_env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    runtime.record_for_pid("test", process.pid, str(E2E_FILE), pgid=process.pid)
    try:
        output, _ = process.communicate()
    finally:
        record = runtime.read_record("test")
        if record and int(record.get("pid", -1)) == process.pid:
            runtime.service_file("test").unlink(missing_ok=True)
    safe_output = runtime.safe_text(output, config)
    safe_output = re.sub(r"TC-[A-Z0-9]{5}-[A-Z0-9]{5}", "TC-•••••-•••••", safe_output)
    safe_output = re.sub(r"(['\"]accessToken['\"]\s*:\s*['\"])[^'\"]+(['\"])", r"\1<redacted>\2", safe_output)
    safe_output = re.sub(r"Bearer\s+[A-Za-z0-9._~-]+", "Bearer <redacted>", safe_output)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "chromium-e2e.log").write_text(safe_output, encoding="utf-8")
    return process.returncode or 0, safe_output, process.pid


def write_runtime_evidence(
    runtime,
    config: dict[str, str],
    *,
    service_pids: dict[str, int],
    test_pid: int | None,
    test_exit_code: int | None,
    bucket_ready: bool,
    stop_status: int,
    status: int,
) -> None:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    ports = {}
    for name, key in (
        ("postgres", "POSTGRES_PORT"),
        ("api", "API_PORT"),
        ("web", "PORT"),
        ("redis", "REDIS_PORT"),
        ("minio-api", "MINIO_API_PORT"),
        ("minio-console", "MINIO_CONSOLE_PORT"),
    ):
        port = int(config[key])
        ports[name] = {"port": port, "stopped": not bool(runtime.port_listener_pids(port))}
    stopped = stop_status == 0 and status == 0 and all(item["stopped"] for item in ports.values())
    evidence = {
        "task": "YZ-RD-T029",
        "database": config["POSTGRES_DB"],
        "databaseUser": config["POSTGRES_USER"],
        "bucket": BUCKET,
        "minioBucketReady": bucket_ready,
        "servicePidsBeforeStop": service_pids,
        "chromiumPytestPid": test_pid,
        "chromiumPytestExited": True if test_pid else None,
        "chromiumPytestExitCode": test_exit_code,
        "nativeE2E": "PASS" if test_exit_code == 0 else "FAIL" if test_exit_code is not None else "NOT_RUN",
        "portsAfterStop": ports,
        "stopPass": stopped,
        "worker": "NOT_STARTED",
        "dockerComposeP1Sim": "NOT_USED",
        "databaseAndMinioData": "RETAINED",
        "l4HistoricalVolumeIncident": "OPEN_NOT_INSPECTED",
    }
    (EVIDENCE_DIR / "native-runtime-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    runtime = load_runtime_module()
    created: list[str] = []
    result_code = 1
    test_pid: int | None = None
    test_exit_code: int | None = None
    bucket_ready = False
    try:
        write_config(runtime)
        config = runtime.load_config()
        runtime.ensure_dirs()
        verify_native_toolchain(runtime)
        env = runtime.runtime_env(config)
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        runtime.start_postgres(config, env, created)
        fresh_database = verify_database(runtime, config, env)
        runtime.start_redis(config, env, created)
        runtime.start_minio(config, env, created)
        prepare_bucket(runtime, env, config)
        bucket_ready = True
        pnpm = runtime.command_path("pnpm")
        if pnpm is None:
            raise RuntimeError("pnpm 10.13.1 wrapper is not available")
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        if fresh_database:
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)
            seed_env = dict(env)
            seed_env["P0_BOOTSTRAP_ONLY"] = "true"
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "seed"], env=seed_env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "build"], env=env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)
        runtime.start_web_api(config, env, created)
        ready = runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5)
        if ready != 200:
            raise RuntimeError(f"T029 API readiness failed with HTTP {ready}")
        print("Runtime: fresh T029 PostgreSQL/API/Web/Redis/MinIO services ready; Worker remains stopped")
        result_code, output, test_pid = run_e2e(runtime, config, env)
        test_exit_code = result_code
        print(output)
        print(f"T029 Chromium + NestJS API + PostgreSQL E2E: {'PASS' if result_code == 0 else 'FAIL'}")
    except Exception as error:
        print(f"T029 native runtime: FAIL — {runtime.safe_text(str(error), runtime.load_config(required=False))}")
        result_code = 1
    finally:
        service_pids = {}
        for name in ("postgres", "api", "web", "redis", "minio"):
            record = runtime.read_record(name)
            if record:
                service_pids[name] = int(record.get("pid", -1))
        stop_status = runtime.stop_all()
        if stop_status != 0:
            time.sleep(1)
            stop_status = runtime.stop_all()
        status = runtime.status()
        if stop_status != 0 or status != 0:
            result_code = 1
        config = runtime.load_config(required=False)
        if config:
            for key in ("POSTGRES_PORT", "API_PORT", "PORT", "REDIS_PORT", "MINIO_API_PORT", "MINIO_CONSOLE_PORT"):
                port = int(config[key])
                if runtime.port_listener_pids(port):
                    print(f"T029 cleanup: owned port {key}={port} still has a listener")
                    result_code = 1
            write_runtime_evidence(
                runtime,
                config,
                service_pids=service_pids,
                test_pid=test_pid,
                test_exit_code=test_exit_code,
                bucket_ready=bucket_ready,
                stop_status=stop_status,
                status=status,
            )
        print("T029 cleanup: only T029-owned services stopped; database, bucket and evidence retained.")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
