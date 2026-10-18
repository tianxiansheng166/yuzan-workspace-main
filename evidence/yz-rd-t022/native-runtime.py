#!/usr/bin/env python3
"""Own and audit the T022 native PostgreSQL/Redis/MinIO/API/Web runtime."""

from __future__ import annotations

import importlib.util
import os
import secrets
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHARED_TOOLS = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
RUNTIME = ROOT / "runtime-local" / "native-web-t022"
DATABASE = "yuzan_t022_native"
DB_USER = "yz_t022"
PORTS = {"API_PORT": "4092", "PORT": "4292", "POSTGRES_PORT": "55654", "REDIS_PORT": "6452", "MINIO_API_PORT": "59000", "MINIO_CONSOLE_PORT": "59001"}


def load_manager():
    source = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_manager", source)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the existing native runtime manager")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure_task("t015", SHARED_TOOLS)
    module.TASK_ID = "T022"
    module.RUNTIME = RUNTIME
    module.CONFIG_FILE = RUNTIME / ".env.local"
    module.STATE = RUNTIME / "state"
    module.LOGS = RUNTIME / "logs"
    module.PGDATA = RUNTIME / "postgres-data"
    module.REDIS_DATA = RUNTIME / "redis-data"
    module.MINIO_DATA = RUNTIME / "minio-data"
    module.EVIDENCE = RUNTIME / "evidence"
    module.TASK_BIN = RUNTIME / "bin"
    module.expected_database_identity = lambda: (DATABASE, DB_USER)
    module.prepare_database_and_api = prepare_database_and_api
    return module


def write_config(manager):
    manager.RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    if manager.CONFIG_FILE.exists():
        if manager.CONFIG_FILE.stat().st_mode & 0o777 != 0o600:
            raise RuntimeError("T022 runtime configuration permissions must remain 0600")
        return
    pg_password = secrets.token_urlsafe(32)
    redis_password = secrets.token_urlsafe(32)
    s3_secret = secrets.token_urlsafe(32)
    port = PORTS
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1",
        "API_PORT": port["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{port['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DB_USER}:{pg_password}@127.0.0.1:{port['POSTGRES_PORT']}/{DATABASE}?schema=public",
        "POSTGRES_USER": DB_USER,
        "POSTGRES_PASSWORD": pg_password,
        "POSTGRES_DB": DATABASE,
        "POSTGRES_PORT": port["POSTGRES_PORT"],
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": port["REDIS_PORT"],
        "REDIS_PASSWORD": redis_password,
        "SESSION_SECRET": secrets.token_urlsafe(48),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{port['PORT']}",
        "PORT": port["PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{port['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": "yz-t022-native",
        "S3_ACCESS_KEY": f"{DB_USER}_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": f"{DB_USER}_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": port["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": port["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t022:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    descriptor = os.open(manager.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T022 configuration; values are never written to task evidence.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(manager.CONFIG_FILE, 0o600)


def prepare_database_and_api(config, env, created):
    manager = load_manager()
    manager.start_postgres(config, env, created)
    pnpm = manager.command_path("pnpm")
    if not pnpm:
        raise manager.RuntimeErrorMessage("Missing pinned pnpm")
    probe = manager.run_output(
        [
            str(manager.PG_BIN / "psql"), "-X", "-A", "-t", "-F", "|", "-c",
            "SELECT current_database(), current_user, "
            "(to_regclass('public._prisma_migrations') IS NOT NULL)::text, "
            "(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;",
        ],
        env=manager.db_env(config),
        timeout=15,
    )
    if probe.returncode != 0:
        raise manager.RuntimeErrorMessage("Could not verify the isolated T022 migration state")
    fields = probe.stdout.strip().split("|")
    if len(fields) != 4 or fields[:2] != [DATABASE, DB_USER]:
        raise manager.RuntimeErrorMessage("T022 database identity mismatch; refusing migrations")
    migration_dir = ROOT / "infra" / "database" / "prisma" / "migrations"
    expected = sum(path.is_dir() for path in migration_dir.iterdir())
    if fields[2] == "true" and int(fields[3]) > 0:
        applied = manager.run_output(
            [str(manager.PG_BIN / "psql"), "-X", "-A", "-t", "-F", "|", "-c",
             'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text, '
             'count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM "_prisma_migrations";'],
            env=manager.db_env(config), timeout=15,
        )
        if applied.returncode != 0 or applied.stdout.strip() != f"{expected}|0":
            raise manager.RuntimeErrorMessage("T022 migration history is incomplete; refusing to rerun migrations")
        print(f"T022 PostgreSQL: retained existing database with {expected} completed migrations")
    else:
        if int(fields[3]) != 0:
            raise manager.RuntimeErrorMessage("T022 database is non-empty without migration history")
        print("T022 PostgreSQL: confirmed empty task database; applying existing migrations and bootstrap seed")
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=300)
        seed_env = dict(env)
        seed_env["P0_BOOTSTRAP_ONLY"] = "true"
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "seed"], env=seed_env, config=config, timeout=600)
    manager.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"doctor", "start", "status", "stop"}:
        print("Usage: native-runtime.py doctor|start|status|stop", file=sys.stderr)
        return 2
    manager = load_manager()
    if sys.argv[1] == "start":
        write_config(manager)
    try:
        if sys.argv[1] == "doctor":
            return manager.doctor("assessment")
        if sys.argv[1] == "start":
            return manager.start("assessment")
        if sys.argv[1] == "status":
            return manager.status()
        return manager.stop_all()
    except (manager.RuntimeErrorMessage, OSError) as error:
        config = manager.load_config(required=False)
        print("T022 runtime error: " + manager.safe_text(str(error), config), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
