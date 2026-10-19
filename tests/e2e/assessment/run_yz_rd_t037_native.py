#!/usr/bin/env python3
"""Task-owned native PostgreSQL/API/Web/Redis/MinIO/Chromium runner for T037."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
TASK = "T037"
RUNTIME = ROOT / "runtime-local" / "native-web-t037"
SHARED_RUNTIME = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
EVIDENCE = ROOT / "evidence" / "yz-rd-t037"
DATABASE = "yuzan_t037_native"
DB_ROLE = "yz_t037"
BUCKET = "yz-t037-native"
SOURCE_DIR = Path("/home/tian/code/yuzan-workspace-main/习题课程资源")
PORTS = {
    "POSTGRES_PORT": "55687",
    "REDIS_PORT": "6487",
    "MINIO_API_PORT": "59487",
    "MINIO_CONSOLE_PORT": "59488",
    "API_PORT": "4187",
    "WEB_PORT": "4387",
}
NODE = Path.home() / ".nvm" / "versions" / "node" / "v24.20.0" / "bin" / "node"
TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t037_today_showcase.py"
REPORT_EVIDENCE = RUNTIME / "evidence" / "upstream-report"
SERVICE_PORTS = {
    "postgres": "POSTGRES_PORT",
    "redis": "REDIS_PORT",
    "minio": "MINIO_API_PORT",
    "api": "API_PORT",
    "web": "PORT",
}
PIDS_BEFORE_STOP: dict[str, int | None] = {}


def command_version(binary: Path | None, args: list[str]) -> str:
    if not binary:
        return "MISSING"
    result = subprocess.run([str(binary), *args], capture_output=True, text=True, timeout=20, check=False)
    if result.returncode:
        return "VERSION_ERROR"
    return (result.stdout or result.stderr).strip().splitlines()[0]


def load_manager():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_rd_t037_native_runtime", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the ownership-aware native runtime manager")
    manager = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = manager
    spec.loader.exec_module(manager)

    manager.TASK_ID = TASK
    manager.BASE_RUNTIME = SHARED_RUNTIME
    manager.RUNTIME = RUNTIME
    manager.CONFIG_FILE = RUNTIME / ".env.local"
    manager.STATE = Path("/tmp/yz-rd-t037/state")
    manager.LOGS = RUNTIME / "logs"
    manager.PGDATA = RUNTIME / "postgres-data"
    manager.REDIS_DATA = RUNTIME / "redis-data"
    manager.MINIO_DATA = RUNTIME / "minio-data"
    manager.EVIDENCE = RUNTIME / "evidence"
    manager.TOOLCHAIN = SHARED_RUNTIME / "toolchain"
    manager.TASK_BIN = RUNTIME / "bin"
    manager.PG_PREFIX = manager.TOOLCHAIN / "pgdg"
    manager.PG_BIN = manager.PG_PREFIX / "usr" / "lib" / "postgresql" / "17" / "bin"
    manager.PG_LIBRARY = manager.PG_PREFIX / "usr" / "lib" / "x86_64-linux-gnu"
    manager.REDIS_DIR = manager.TOOLCHAIN / "redis-7.4.10" / "src"
    manager.MINIO_BIN = manager.TOOLCHAIN / "bin" / "minio"
    manager.TEST_PYTHON = SHARED_RUNTIME / "venv" / "bin" / "python"
    manager.node_binary = lambda: NODE
    manager.command_version = lambda binary, args, env=None: command_version(Path(binary) if binary else None, args)
    manager.expected_database_identity = lambda: (DATABASE, DB_ROLE)
    manager.create_local_config = lambda: create_config(manager)
    manager.prepare_database_and_api = lambda config, env, created: prepare_database_and_api(manager, config, env, created)
    return manager


def create_config(manager) -> None:
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    RUNTIME.chmod(0o700)
    if manager.CONFIG_FILE.exists():
        if manager.CONFIG_FILE.stat().st_mode & 0o777 != 0o600:
            raise RuntimeError("Existing T037 runtime config must have mode 0600")
        existing = manager.load_config(required=True)
        expected = {
            **{key: value for key, value in PORTS.items() if key != "WEB_PORT"},
            "PORT": PORTS["WEB_PORT"],
            "POSTGRES_DB": DATABASE,
            "POSTGRES_USER": DB_ROLE,
            "S3_BUCKET": BUCKET,
        }
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing runtime config identity differs from T037; preserving it")
        return

    password = secrets.token_urlsafe(32)
    redis_password = secrets.token_urlsafe(32)
    s3_secret = secrets.token_urlsafe(32)
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1",
        "API_PORT": PORTS["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{PORTS['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DB_ROLE}:{password}@127.0.0.1:{PORTS['POSTGRES_PORT']}/{DATABASE}?schema=public",
        "POSTGRES_USER": DB_ROLE,
        "POSTGRES_PASSWORD": password,
        "POSTGRES_DB": DATABASE,
        "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": PORTS["REDIS_PORT"],
        "REDIS_PASSWORD": redis_password,
        "SESSION_SECRET": secrets.token_urlsafe(48),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": f"http://127.0.0.1:{PORTS['WEB_PORT']}",
        "PORT": PORTS["WEB_PORT"],
        "S3_ENDPOINT": f"http://127.0.0.1:{PORTS['MINIO_API_PORT']}",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": BUCKET,
        "S3_ACCESS_KEY": f"{DB_ROLE}_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": f"{DB_ROLE}_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t037:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    descriptor = os.open(manager.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T037 runtime credentials; never copy to evidence.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    manager.CONFIG_FILE.chmod(0o600)


def prepare_database_and_api(manager, config, env, created) -> None:
    manager.start_postgres(config, env, created)
    psql = str(manager.PG_BIN / "psql")
    probe = manager.run_output(
        [psql, "-X", "-A", "-t", "-F", "|", "-c",
         "SELECT current_database(),current_user,(to_regclass('public._prisma_migrations') IS NOT NULL)::text,"
         "(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;"],
        env=manager.db_env(config), timeout=20,
    )
    if probe.returncode:
        raise RuntimeError("Cannot verify the T037 PostgreSQL identity")
    fields = probe.stdout.strip().split("|")
    if len(fields) != 4 or fields[:2] != [DATABASE, DB_ROLE]:
        raise RuntimeError("T037 database identity mismatch; refusing mutation")
    pnpm = manager.command_path("pnpm")
    if not pnpm or command_version(pnpm, ["--version"]) != "10.13.1":
        raise RuntimeError("Pinned pnpm 10.13.1 is unavailable")
    migrations = ROOT / "infra" / "database" / "prisma" / "migrations"
    expected = sum(path.is_dir() for path in migrations.iterdir())
    if fields[2] == "true" and int(fields[3]) > 0:
        applied = manager.run_output(
            [psql, "-X", "-A", "-t", "-F", "|", "-c",
             'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text,'
             'count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text FROM "_prisma_migrations";'],
            env=manager.db_env(config), timeout=20,
        )
        if applied.returncode or applied.stdout.strip() != f"{expected}|0":
            raise RuntimeError("Existing T037 database migration state is incomplete; preserving it")
        print(f"T037 PostgreSQL: retaining {expected} completed migrations")
    else:
        if int(fields[3]) != 0:
            raise RuntimeError("T037 database is non-empty without a Prisma migration ledger")
        print("T037 PostgreSQL: confirmed empty task-owned database; applying migrations and bootstrap seed")
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)
        seed_env = dict(env)
        seed_env["P0_BOOTSTRAP_ONLY"] = "true"
        manager.run_checked([str(pnpm), "--filter", "@yuzan/database", "seed"], env=seed_env, config=config, timeout=900)
    manager.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)


def ensure_bucket(manager, config, env) -> None:
    script = r'''const path = require("node:path");
const { createRequire } = require("node:module");
const api = createRequire(path.resolve(process.cwd(), "backend/api/package.json"));
const { CreateBucketCommand, HeadBucketCommand, S3Client } = api("@aws-sdk/client-s3");
const client = new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
(async()=>{try{await client.send(new HeadBucketCommand({Bucket:process.env.S3_BUCKET}));}catch{await client.send(new CreateBucketCommand({Bucket:process.env.S3_BUCKET}));}finally{client.destroy();}})().catch(error=>{process.stderr.write((error.name||"MINIO_BUCKET_FAILED")+"\n");process.exitCode=1;});'''
    result = manager.run_output([str(NODE), "-e", script], env=env, cwd=ROOT, timeout=60)
    if result.returncode:
        raise RuntimeError("Could not prepare the T037-owned MinIO bucket: " + result.stderr[-1000:])
    print(f"T037 MinIO bucket ready: {BUCKET}")


def source_snapshot() -> list[dict[str, object]]:
    required = ("题库【三改】.docx", "答案及评分细则.docx", "题库音频及图片.zip")
    missing = [name for name in required if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise RuntimeError("Read-only accepted Question Bank source is incomplete: " + ", ".join(missing))
    files = []
    for name in required:
        path = SOURCE_DIR / name
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        files.append({"path": str(path.relative_to(SOURCE_DIR)), "bytes": path.stat().st_size, "sha256": digest.hexdigest()})
    return files


def import_question_bank(manager, config, env) -> tuple[str, str]:
    before = source_snapshot()
    if not manager.minio_health(config):
        raise RuntimeError("Task-owned MinIO is unhealthy; the accepted source was not imported")
    pnpm = manager.command_path("pnpm")
    args = ["--all", "--school-id", "11111111-1111-4111-8111-111111111111", "--class-id", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "--source-dir", str(SOURCE_DIR)]
    dry_run = manager.run_checked([str(pnpm), "qb:source:apply", "--", *args], env=env, config=config, timeout=3600)
    if "DRY RUN" not in dry_run or "NO DATABASE WRITE" not in dry_run or "NO MINIO WRITE" not in dry_run:
        raise RuntimeError("Question Bank importer did not confirm the no-write preflight")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "question-bank-preflight.txt").write_text(dry_run, encoding="utf-8")
    manager.run_checked([str(pnpm), "qb:source:apply", "--", "--apply", *args], env=env, config=config, timeout=3600)
    after = source_snapshot()
    if before != after:
        raise RuntimeError("Read-only accepted Question Bank source changed during import")
    source_proof = {"sourceDir": str(SOURCE_DIR), "sourceFiles": before, "unchangedAfterImport": True, "targetDatabase": DATABASE, "targetBucket": BUCKET}
    source_path = EVIDENCE / "question-bank-source-proof.json"
    source_path.write_text(json.dumps(source_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "PASS", str(source_path)


def test_environment(manager, config) -> dict[str, str]:
    env = manager.runtime_env(config)
    api_root = config["API_BASE_URL"]
    pg_bin = str(manager.PG_BIN)
    node_bin = str(NODE.parent)
    env["PATH"] = os.pathsep.join(filter(None, [node_bin, pg_bin, env.get("PATH", "")]))
    common = {
        "YZ_NATIVE_TASK_ID": TASK,
        "YZ_T037_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T037_API_BASE_URL": api_root,
        "YZ_T037_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T037_DATABASE_NAME": DATABASE,
        "YZ_T037_DATABASE_USER": DB_ROLE,
        "YZ_T037_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T037_PSQL": str(manager.PG_BIN / "psql"),
        "YZ_T037_PG_LIBRARY": str(manager.PG_LIBRARY),
        "YZ_T037_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T037_CHROMIUM": "/usr/bin/google-chrome",
        "YZ_T037_EVIDENCE_DIR": str(EVIDENCE),
        "YZ_T037_S3_BUCKET": BUCKET,
        "YZ_T030_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T030_API_BASE_URL": api_root,
        "YZ_T030_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T030_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T030_DATABASE_NAME": DATABASE,
        "YZ_T030_DATABASE_USER": DB_ROLE,
        "YZ_T030_POSTGRES_PORT": config["POSTGRES_PORT"],
        "YZ_T030_PSQL": str(manager.PG_BIN / "psql"),
        "YZ_T030_PG_LIBRARY": str(manager.PG_LIBRARY),
        "YZ_T030_EVIDENCE_DIR": str(REPORT_EVIDENCE),
        "YZ_T030_CHROMIUM": "/usr/bin/google-chrome",
        "YZ_T030_S3_BUCKET": BUCKET,
        "YZ_T030_S3_ENDPOINT": config["S3_ENDPOINT"],
        "YZ_T030_S3_REGION": config["S3_REGION"],
        "YZ_T030_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "YZ_T030_S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "YZ_T030_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
        "YZ_T011_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T011_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T011_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T011_DATABASE_NAME": DATABASE,
        "YZ_T011_DATABASE_USER": DB_ROLE,
        "YZ_T011_EVIDENCE_DIR": str(RUNTIME / "evidence" / "t011"),
        "YZ_T011_S3_BUCKET": BUCKET,
        "YZ_T011_S3_ENDPOINT": config["S3_ENDPOINT"],
        "YZ_T011_S3_REGION": config["S3_REGION"],
        "YZ_T011_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "YZ_T011_S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "YZ_T011_MINIO_API_PORT": config["MINIO_API_PORT"],
        "YZ_T011_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
        "YZ_T010_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T010_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T010_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T010_EVIDENCE_DIR": str(RUNTIME / "evidence" / "t010"),
        "YZ_T010_S3_BUCKET": BUCKET,
        "YZ_T010_S3_ENDPOINT": config["S3_ENDPOINT"],
        "YZ_T010_S3_REGION": config["S3_REGION"],
        "YZ_T010_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "YZ_T010_S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "YZ_T010_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
        "DATABASE_URL": config["DATABASE_URL"],
        "POSTGRES_DB": DATABASE,
        "POSTGRES_USER": DB_ROLE,
        "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_PORT": config["POSTGRES_PORT"],
        "S3_BUCKET": BUCKET,
        "S3_ENDPOINT": config["S3_ENDPOINT"],
        "S3_REGION": config["S3_REGION"],
        "S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "S3_ACCESS_KEY_ID": config["S3_ACCESS_KEY_ID"],
        "S3_SECRET_ACCESS_KEY": config["S3_SECRET_ACCESS_KEY"],
    }
    env.update(common)
    return env


def redact(text: str, config: dict[str, str]) -> str:
    for key in ("DATABASE_URL", "POSTGRES_PASSWORD", "REDIS_PASSWORD", "SESSION_SECRET", "S3_SECRET_KEY", "E2E_TEST_PASSWORD"):
        value = config.get(key)
        if value:
            text = text.replace(value, "<redacted>")
    text = re.sub(r"Bearer\s+[A-Za-z0-9._~-]+", "Bearer <redacted>", text)
    text = re.sub(r"(['\"]accessToken['\"]\s*:\s*['\"])[^'\"]+(['\"])", r"\1<redacted>\2", text)
    return text


def run_e2e(manager, config) -> tuple[int, str]:
    env = test_environment(manager, config)
    temp_dir = Path("/tmp/yz-rd-t037/chromium")
    temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp_dir.chmod(0o700)
    env["TMPDIR"] = str(temp_dir)
    result = subprocess.run(
        [str(manager.TEST_PYTHON), "-m", "pytest", "-q", "-s", str(TEST_FILE)],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=5400,
        check=False,
    )
    output = redact(result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else ""), config)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "native-e2e.log").write_text(output, encoding="utf-8")
    print(output[-18000:])
    return result.returncode, output


def runtime_record(manager, config, *, start_code: int, e2e_code: int, stop_code: int, source_status: str) -> None:
    services = {}
    for name, port_key in SERVICE_PORTS.items():
        record = manager.read_record(name)
        port = int(config[port_key])
        listeners = sorted(manager.port_listener_pids(port))
        services[name] = {
            "pidBeforeStop": PIDS_BEFORE_STOP.get(name),
            "port": port,
            "listenerPidsAfterStop": listeners,
            "stopped": not listeners,
        }
    summary = {
        "task": TASK,
        "runtime": "native; Docker and Compose not used",
        "database": DATABASE,
        "databaseRole": DB_ROLE,
        "postgresVersion": command_version(manager.PG_BIN / "postgres", ["--version"]),
        "minioBucket": BUCKET,
        "node": command_version(NODE, ["--version"]),
        "pnpm": command_version(manager.command_path("pnpm"), ["--version"]),
        "chromium": command_version(Path("/usr/bin/google-chrome"), ["--version"]),
        "startExitCode": start_code,
        "questionBankImport": source_status,
        "e2eExitCode": e2e_code,
        "stopExitCode": stop_code,
        "services": services,
        "evidenceGeneratedAt": datetime.now(timezone.utc).isoformat(),
        "dataRetained": True,
        "worker": "NOT_STARTED; speech scorer disabled; fake Chromium microphone only",
    }
    (EVIDENCE / "native-runtime-evidence.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stop_owned_services(manager) -> int:
    result = manager.stop_all()
    if result == 0:
        return 0
    deadline = manager.time.monotonic() + 45
    for _ in range(23):
        unresolved = False
        for name in ("test", "worker", "web", "api", "minio", "redis", "postgres"):
            record = manager.read_record(name)
            if not record:
                continue
            try:
                pid = int(record["pid"])
                expected_start = str(record["start_ticks"])
                actual_start = manager.process_start_ticks(pid)
            except (KeyError, TypeError, ValueError):
                unresolved = True
                break
            if actual_start is not None and actual_start == expected_start:
                unresolved = True
                break
            if actual_start is not None:
                unresolved = True
                break
        if not unresolved:
            return manager.stop_all()
        if manager.time.monotonic() >= deadline:
            break
        manager.time.sleep(2)
    print("T037 task-owned shutdown remains pending; no force kill was attempted")
    return 1


def main() -> int:
    manager = load_manager()
    start_code = 1
    e2e_code = 2
    stop_code = 0
    source_status = "NOT_RUN"
    try:
        create_config(manager)
        config = manager.load_config()
        manager.ensure_dirs()
        for port in PORTS.values():
            manager.check_port_available(int(port))
        env = manager.runtime_env(config)
        created: list[str] = []
        manager.prepare_database_and_api(config, env, created)
        manager.start_redis(config, env, created)
        manager.start_minio(config, env, created)
        ensure_bucket(manager, config, env)
        source_status, _source_path = import_question_bank(manager, config, env)
        manager.start_web_api(config, env, created)
        if manager.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready") != 200:
            raise RuntimeError("API readiness did not confirm PostgreSQL, Redis and MinIO")
        for name in SERVICE_PORTS:
            record = manager.read_record(name)
            PIDS_BEFORE_STOP[name] = int(record["pid"]) if record and record.get("pid") else None
        start_code = 0
        e2e_code, _ = run_e2e(manager, config)
        return_code = e2e_code
    except (manager.RuntimeErrorMessage, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print("T037 runtime failed: " + redact(str(error), locals().get("config", {})))
        return_code = 1
    finally:
        try:
            config = manager.load_config(required=False)
            stop_code = stop_owned_services(manager) if config else 0
            if config:
                runtime_record(manager, config, start_code=start_code, e2e_code=e2e_code, stop_code=stop_code, source_status=source_status)
        except Exception as error:  # Preserve logs and avoid targeting any unowned PID.
            stop_code = 1
            print("T037 owned-runtime cleanup incomplete: " + str(error))
    print(f"T037_NATIVE_RESULT start={start_code} source={source_status} e2e={e2e_code} stop={stop_code}")
    if start_code != 0 or e2e_code != 0 or stop_code != 0:
        return 1
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
