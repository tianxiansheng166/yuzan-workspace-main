#!/usr/bin/env python3
"""Run T065 against a fresh, task-owned native PostgreSQL/Redis/MinIO stack."""

from __future__ import annotations

import importlib.util
import json
import os
import secrets
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t065"
SHARED_TOOLCHAIN_ROOT = ROOT.parents[1] / "yuzan-workspace-main" / "runtime-local" / "native-web"
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t065" / "native-e2e"
FIXTURE_FILE = RUNTIME_DIR / "evidence" / "fixture-manifest.json"
FIXTURE_PREP = ROOT / "tests" / "e2e" / "assessment" / "prepare_yz_rd_t065_fixture.mjs"
E2E_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t065_reviewable_practice_fixture.py"
DATABASE_NAME = "yuzan_t065_native"
DATABASE_USER = "yz_t065"
PORTS = {
    "API_PORT": "4265",
    "PORT": "4465",
    "POSTGRES_PORT": "55765",
    "REDIS_PORT": "6565",
    "MINIO_API_PORT": "59765",
    "MINIO_CONSOLE_PORT": "59766",
}


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t065", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    # Reuse only the installed native toolchain and Playwright environment.
    # All data, configuration, services, and PID records stay under T065.
    module.configure_task("T045", shared_runtime_root=SHARED_TOOLCHAIN_ROOT)
    module.TASK_ID = "T065"
    module.RUNTIME = RUNTIME_DIR
    module.CONFIG_FILE = RUNTIME_DIR / ".env.local"
    module.STATE = RUNTIME_DIR / "state"
    module.LOGS = RUNTIME_DIR / "logs"
    module.PGDATA = RUNTIME_DIR / "postgres-data"
    module.REDIS_DATA = RUNTIME_DIR / "redis-data"
    module.MINIO_DATA = RUNTIME_DIR / "minio-data-native"
    module.EVIDENCE = RUNTIME_DIR / "evidence"
    module.TASK_BIN = RUNTIME_DIR / "bin"
    module.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    default_wait_for_http = module.wait_for_http

    def wait_for_http_with_cold_start_budget(name, url, *, expected=200, timeout=45):
        if name in {"API live", "Teacher Web"}:
            timeout = max(timeout, 180)
        return default_wait_for_http(name, url, expected=expected, timeout=timeout)

    module.wait_for_http = wait_for_http_with_cold_start_budget
    return module


def write_config(runtime) -> dict[str, str]:
    if runtime.CONFIG_FILE.is_file():
        os.chmod(runtime.CONFIG_FILE, 0o600)
        config = runtime.load_config()
        expected = {**PORTS, "POSTGRES_DB": DATABASE_NAME, "POSTGRES_USER": DATABASE_USER, "S3_BUCKET": "yz-t065-native"}
        if any(config.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T065 configuration does not match its private database, bucket, or port allocation")
        return config

    database_password = secrets.token_hex(32)
    redis_password = secrets.token_hex(32)
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
        "REDIS_PASSWORD": redis_password,
        "SESSION_SECRET": secrets.token_hex(48),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['PORT']}",
        "PORT": PORTS["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": "yz-t065-native",
        "S3_ACCESS_KEY": "yz_t065_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t065_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t065:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": secrets.token_urlsafe(24),
    }
    runtime.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(runtime.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only YZ-RD-T065 isolated fixture runtime.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    return runtime.load_config()


def run_e2e(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str]:
    python = runtime.TEST_PYTHON
    if not python.is_file() or not E2E_FILE.is_file():
        raise RuntimeError("The pinned Playwright environment or T065 E2E file is unavailable")
    test_env = dict(env)
    test_env.update({
        "YZ_T065_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T065_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T065_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T065_FIXTURE_MANIFEST": str(FIXTURE_FILE),
        "YZ_T065_EVIDENCE_DIR": str(EVIDENCE_DIR),
        "YZ_T065_PSQL": str(runtime.PG_BIN / "psql"),
        "CHROMIUM": "/usr/bin/google-chrome",
    })
    temp_dir = Path("/tmp/yz-rd-t065/chromium")
    if temp_dir.is_symlink() or (temp_dir.exists() and (not temp_dir.is_dir() or temp_dir.stat().st_uid != os.getuid())):
        raise RuntimeError("T065 private Chromium temp path is not an owned directory")
    temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp_dir.chmod(0o700)
    test_env["TMPDIR"] = str(temp_dir)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    log_path = EVIDENCE_DIR / "native-e2e.log"
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            [str(python), "-m", "pytest", "-q", "-s", str(E2E_FILE)],
            cwd=ROOT,
            env=test_env,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        runtime.record_for_pid("test", process.pid, str(E2E_FILE), pgid=process.pid)
        try:
            result = process.wait()
        except BaseException:
            if process.poll() is None:
                os.killpg(process.pid, 15)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, 9)
                    process.wait()
            raise
        finally:
            record = runtime.read_record("test")
            if record and int(record.get("pid", -1)) == process.pid:
                runtime.service_file("test").unlink(missing_ok=True)
    safe_log = runtime.safe_text(log_path.read_text(encoding="utf-8"), config)
    log_path.write_text(safe_log, encoding="utf-8")
    return result, safe_log


def api_and_schema_sources_match_base(runtime) -> bool:
    head = runtime.run_output(["git", "rev-parse", "HEAD"], cwd=ROOT, timeout=10)
    if head.returncode != 0 or head.stdout.strip() != "d3d2623747eda173aeea71d8bdb2cf52630e98c0":
        return False
    diff = runtime.run_output(
        ["git", "diff", "--quiet", "HEAD", "--", "backend/api/src", "infra/database/prisma/schema.prisma"],
        cwd=ROOT,
        timeout=10,
    )
    return diff.returncode == 0


def migrations_are_current(runtime, config: dict[str, str]) -> bool:
    psql = runtime.PG_BIN / "psql"
    query = "SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text, count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM \"_prisma_migrations\";"
    result = runtime.run_output([str(psql), "-X", "-A", "-t", "-F", "|", "-c", query], env=runtime.db_env(config), timeout=15)
    if result.returncode != 0:
        return False
    values = result.stdout.strip().split("|", 1)
    migration_dir = ROOT / "infra" / "database" / "prisma" / "migrations"
    expected_count = sum(path.is_dir() for path in migration_dir.iterdir())
    return len(values) == 2 and values[0] == str(expected_count) and values[1] == "0"


def main() -> int:
    runtime = load_runtime_module()
    created: list[str] = []
    result_code = 1
    try:
        runtime.ensure_dirs()
        config = write_config(runtime)
        env = runtime.runtime_env(config)
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        if any(runtime.PGDATA.iterdir()) or any(runtime.REDIS_DATA.iterdir()) or any(runtime.MINIO_DATA.iterdir()):
            if not (runtime.PGDATA / "PG_VERSION").is_file():
                raise RuntimeError("T065 runtime data directory is nonempty without a PostgreSQL identity; preserving it")
            # Reuse is permitted only for an already initialized T065-owned local database.
            probe = runtime.run_output(
                [str(runtime.PG_BIN / "pg_ctl"), "--pgdata", str(runtime.PGDATA), "status"], env=env, timeout=10
            )
            if probe.returncode == 0:
                raise RuntimeError("T065 PostgreSQL is already running; use its exact recorded runtime state")

        socket_dir = runtime.STATE / "socket"
        socket_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(socket_dir, 0o700)
        runtime.start_postgres(config, env, created)
        runtime.start_redis(config, env, created)
        node = runtime.node_binary()
        if not node:
            raise RuntimeError("Node.js is unavailable")

        pnpm = runtime.command_path("pnpm")
        if pnpm is None:
            raise RuntimeError("pnpm is unavailable")
        if not (ROOT / "node_modules").is_dir():
            runtime.run_checked([str(pnpm), "install", "--frozen-lockfile"], env=env, config=config, timeout=900)
        artifacts_ready = (
            api_and_schema_sources_match_base(runtime)
            and (ROOT / "infra/database/generated/client/client.ts").is_file()
            and (ROOT / "infra/database/generated/client/models.ts").is_file()
            and (ROOT / "infra/database/dist/src/index.js").is_file()
            and (ROOT / "backend/api/dist/main.js").is_file()
            and (ROOT / "backend/api/dist/modules/identity/adapters/scrypt-password-verifier.js").is_file()
        )
        if artifacts_ready:
            print("Using task-local generated client/API build: application and Prisma schema match the supplied BASE.")
        else:
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "build"], env=env, config=config, timeout=600)
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=900)
        if migrations_are_current(runtime, config):
            print("T065 PostgreSQL migrations already match this checkout.")
        else:
            runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)

        prepare_env = dict(env, YZ_T065_FIXTURE_MANIFEST=str(FIXTURE_FILE))
        runtime.run_checked([str(node), str(FIXTURE_PREP)], env=prepare_env, config=config, timeout=120)
        runtime.start_web_api(config, env, created)
        ready = runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5)
        if ready == 503:
            print("T065 readiness=503; expected because local MinIO is unavailable. The TEST_FIXTURE_ONLY written review flow does not call object storage.")
        elif ready != 200:
            raise RuntimeError(f"T065 API readiness did not pass (HTTP {ready})")
        env["YZ_T065_API_READY_STATUS"] = str(ready)
        print("T065 native runtime ready: PostgreSQL 17, Redis, NestJS API and Web; MinIO and Worker not running; SPEECH_PROVIDER=disabled.")
        result_code, _output = run_e2e(runtime, config, env)
        print(f"T065 native Chrome/API/PostgreSQL E2E: {'PASS' if result_code == 0 else 'FAIL'}")
    except Exception as error:
        config = runtime.load_config(required=False)
        print("T065 native runtime: FAIL — " + runtime.safe_text(str(error), config or None))
        result_code = 1
    finally:
        runtime.stop_all()
        for name in ("web", "api", "redis"):
            record = runtime.read_record(name)
            if not record:
                continue
            try:
                pid = int(record["pid"])
                waited = os.waitpid(pid, os.WNOHANG)
            except (ChildProcessError, KeyError, TypeError, ValueError, OSError):
                continue
            if waited[0] == pid:
                print(f"T065 cleanup: reaped exited task-owned {name} PID {pid}.")
        runtime.stop_all()
        status = runtime.status()
        if status != 0:
            result_code = 1
        config = runtime.load_config(required=False)
        if config:
            for port_name in ("POSTGRES_PORT", "API_PORT", "PORT", "REDIS_PORT", "MINIO_API_PORT", "MINIO_CONSOLE_PORT"):
                port = int(config[port_name])
                if runtime.port_listener_pids(port):
                    print(f"T065 cleanup: owned port {port_name}={port} still has a listener")
                    result_code = 1
        print("T065 cleanup: task-owned services stopped; isolated fixture database and evidence retained.")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
