#!/usr/bin/env python3
"""Run integrated T029-T032 Chromium flows on T033-owned native services."""

from __future__ import annotations

import importlib.util
import json
import os
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[3]
TASK = "T033"
RUNTIME = ROOT / "runtime-local" / "native-web-t033"
SHARED_TOOLCHAIN = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
EVIDENCE = ROOT / "evidence" / "yz-rd-t033"
DATABASE = "yuzan_t033_native"
DB_ROLE = "yz_t033"
BUCKET = "yz-t033-native"
PORTS = {
    "POSTGRES_PORT": "55673",
    "REDIS_PORT": "6473",
    "MINIO_API_PORT": "59473",
    "MINIO_CONSOLE_PORT": "59474",
    "API_PORT": "4173",
    "WEB_PORT": "4373",
}
SOURCE_DIR = Path("/home/tian/code/yuzan-workspace-main/习题课程资源")
NODE_DIR = Path.home() / ".nvm" / "versions" / "node" / "v24.20.0" / "bin"
NODE = NODE_DIR / "node"
CHROME_TMP = Path("/tmp/yz-rd-t033/t")
TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t033_multirole.py"
SERVICE_NAMES = ("postgres", "api", "web", "redis", "minio")
PIDS_BEFORE_STOP: dict[str, int | None] = {}


def load_manager():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_rd_t033_native_runtime", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the existing ownership-aware native runtime manager")
    manager = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = manager
    spec.loader.exec_module(manager)

    manager.TASK_ID = TASK
    manager.BASE_RUNTIME = SHARED_TOOLCHAIN
    manager.RUNTIME = RUNTIME
    manager.CONFIG_FILE = RUNTIME / ".env.local"
    manager.STATE = Path("/tmp/yz-rd-t033/state")
    manager.LOGS = RUNTIME / "logs"
    manager.PGDATA = RUNTIME / "postgres-data"
    manager.REDIS_DATA = RUNTIME / "redis-data"
    manager.MINIO_DATA = RUNTIME / "minio-data"
    manager.EVIDENCE = RUNTIME / "evidence"
    manager.TOOLCHAIN = SHARED_TOOLCHAIN / "toolchain"
    manager.TASK_BIN = RUNTIME / "bin"
    manager.PG_PREFIX = manager.TOOLCHAIN / "pgdg"
    manager.PG_BIN = manager.PG_PREFIX / "usr" / "lib" / "postgresql" / "17" / "bin"
    manager.PG_LIBRARY = manager.PG_PREFIX / "usr" / "lib" / "x86_64-linux-gnu"
    manager.REDIS_DIR = manager.TOOLCHAIN / "redis-7.4.10" / "src"
    manager.MINIO_BIN = manager.TOOLCHAIN / "bin" / "minio"
    manager.TEST_PYTHON = SHARED_TOOLCHAIN / "venv" / "bin" / "python"
    manager.node_binary = lambda: NODE
    manager.command_version = command_version
    manager.expected_database_identity = lambda: (DATABASE, DB_ROLE)
    manager.create_local_config = lambda: write_config(manager)
    manager.prepare_database_and_api = lambda config, env, created: prepare_database_and_api(
        manager, config, env, created
    )
    original_wait_for_http = manager.wait_for_http

    def wait_for_http_t033(name, url, *, expected=200, timeout=45):
        if name == "API live":
            timeout = 120
        elif name == "Teacher Web":
            timeout = 90
        original_wait_for_http(name, url, expected=expected, timeout=timeout)

    manager.wait_for_http = wait_for_http_t033
    original_start_web_api = manager.start_web_api

    def start_web_api_with_dependencies(config, env, created):
        manager.start_redis(config, env, created)
        manager.start_minio(config, env, created)
        original_start_web_api(config, env, created)

    manager.start_web_api = start_web_api_with_dependencies
    original_start_minio = manager.start_minio

    def start_minio_t033(config, env, created):
        record = manager.read_record("minio")
        if record:
            okay, _detail = manager.record_process_ok("minio", record)
            pid = int(record.get("pid", -1))
            console_owned = pid in manager.port_listener_pids(int(config["MINIO_CONSOLE_PORT"]))
            if okay and console_owned and manager.minio_health(config):
                print(f"MinIO: reused healthy T033 process (PID {pid})")
                return False
            if manager.process_start_ticks(pid) is not None:
                raise manager.RuntimeErrorMessage(
                    "T033 MinIO process is alive but failed its task identity or health check; preserving it"
                )
        return original_start_minio(config, env, created)

    manager.start_minio = start_minio_t033
    return manager


def command_version(binary, args, env=None) -> str:
    if binary is None:
        return "MISSING"
    try:
        result = subprocess.run(
            [str(binary), *args],
            env=env,
            text=True,
            capture_output=True,
            check=False,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return "VERSION_TIMEOUT"
    return (result.stdout or result.stderr).strip().splitlines()[0] if result.returncode == 0 else "VERSION_ERROR"


def config_values(manager) -> dict[str, str]:
    if manager.CONFIG_FILE.is_file():
        if manager.CONFIG_FILE.stat().st_mode & 0o777 != 0o600:
            raise RuntimeError("Existing T033 runtime config must have mode 0600")
        values = {}
        for line in manager.CONFIG_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
        expected = {
            **{key: value for key, value in PORTS.items() if key != "WEB_PORT"},
            "PORT": PORTS["WEB_PORT"],
            "POSTGRES_DB": DATABASE,
            "POSTGRES_USER": DB_ROLE,
            "S3_BUCKET": BUCKET,
        }
        mismatches = [key for key, value in expected.items() if values.get(key) != value]
        if mismatches:
            raise RuntimeError("Existing T033 runtime identity mismatch: " + ", ".join(mismatches))
        manager.load_config()
        return values

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
        "WORKER_HEARTBEAT_KEY": "yuzan:t033:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    RUNTIME.chmod(0o700)
    descriptor = os.open(manager.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only YZ-RD-T033 runtime; credentials are never copied to evidence.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(manager.CONFIG_FILE, 0o600)
    return values


def write_config(manager) -> None:
    config_values(manager)


def prepare_database_and_api(manager, config, env, created) -> None:
    socket_dir = manager.STATE / "socket"
    socket_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(socket_dir, 0o700)
    postgres_config = manager.PGDATA / "postgresql.conf"
    if postgres_config.is_file():
        lines = postgres_config.read_text(encoding="utf-8").splitlines()
        setting = f"unix_socket_directories = '{socket_dir}'"
        replaced = False
        for index, line in enumerate(lines):
            if line.lstrip().startswith("unix_socket_directories ="):
                lines[index] = setting
                replaced = True
        if not replaced:
            lines.append(setting)
        postgres_config.write_text("\n".join(lines) + "\n", encoding="utf-8")
    manager.start_postgres(config, env, created)
    psql = str(manager.PG_BIN / "psql")
    probe = manager.run_output(
        [
            psql,
            "-X",
            "-A",
            "-t",
            "-F",
            "|",
            "-c",
            "SELECT current_database(), current_user, "
            "(to_regclass('public._prisma_migrations') IS NOT NULL)::text, "
            "(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::text;",
        ],
        env=manager.db_env(config),
        timeout=15,
    )
    if probe.returncode:
        raise RuntimeError("Cannot verify the new T033 PostgreSQL database")
    fields = probe.stdout.strip().split("|")
    if len(fields) != 4 or fields[:2] != [DATABASE, DB_ROLE]:
        raise RuntimeError("T033 database identity mismatch; refusing to mutate it")
    pnpm = manager.command_path("pnpm")
    if not pnpm or manager.command_version(pnpm, ["--version"]) != "10.13.1":
        raise RuntimeError("Pinned pnpm 10.13.1 is unavailable")
    migration_dir = ROOT / "infra" / "database" / "prisma" / "migrations"
    expected = sum(path.is_dir() for path in migration_dir.iterdir())
    if fields[2] == "true" and int(fields[3]) > 0:
        applied = manager.run_output(
            [
                psql,
                "-X",
                "-A",
                "-t",
                "-F",
                "|",
                "-c",
                'SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text, '
                'count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text '
                'FROM "_prisma_migrations";',
            ],
            env=manager.db_env(config),
            timeout=15,
        )
        if applied.returncode or applied.stdout.strip() != f"{expected}|0":
            raise RuntimeError("Existing T033 migration state is incomplete; refusing to rerun migrations")
        print(f"T033 PostgreSQL: retained {expected} completed migrations")
    else:
        if int(fields[3]) != 0:
            raise RuntimeError("T033 database is non-empty without its Prisma migration ledger")
        print("T033 PostgreSQL: confirmed empty task-owned database; applying migrations and bootstrap seed")
        manager.run_checked(
            [str(pnpm), "--filter", "@yuzan/database", "generate"],
            env=env,
            config=config,
            timeout=300,
        )
        manager.run_checked(
            [str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"],
            env=env,
            config=config,
            timeout=300,
        )
        seed_env = dict(env)
        seed_env["P0_BOOTSTRAP_ONLY"] = "true"
        manager.run_checked(
            [str(pnpm), "--filter", "@yuzan/database", "seed"],
            env=seed_env,
            config=config,
            timeout=600,
        )
    manager.run_checked(
        [str(pnpm), "--filter", "@yuzan/api", "build"],
        env=env,
        config=config,
        timeout=600,
    )


def prepare_bucket(manager, config, env) -> None:
    script = r'''
const path = require("node:path");
const { createRequire } = require("node:module");
const api = createRequire(path.resolve(process.cwd(), "backend/api/package.json"));
const { CreateBucketCommand, HeadBucketCommand, S3Client } = api("@aws-sdk/client-s3");
const client = new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
(async()=>{try{await client.send(new HeadBucketCommand({Bucket:process.env.S3_BUCKET}));}catch{await client.send(new CreateBucketCommand({Bucket:process.env.S3_BUCKET}));}finally{client.destroy();}})().catch(error=>{process.stderr.write((error.name||"MINIO_BUCKET_FAILED")+"\n");process.exitCode=1;});
'''
    result = manager.run_output(
        [str(NODE), "-e", script],
        env=env,
        cwd=ROOT,
        timeout=45,
    )
    if result.returncode:
        raise RuntimeError("Could not prepare the T033-owned MinIO bucket: " + result.stderr[-1000:])
    print(f"T033 MinIO bucket ready: {config['S3_BUCKET']}")


def question_bank_args(source: Path) -> list[str]:
    return [
        "--all",
        "--school-id",
        "11111111-1111-4111-8111-111111111111",
        "--class-id",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "--source-dir",
        str(source),
    ]


def prepare_question_bank(manager, config, env) -> None:
    required = ("题库【三改】.docx", "答案及评分细则.docx", "题库音频及图片.zip")
    missing = [name for name in required if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise RuntimeError("Read-only Question Bank source is incomplete: " + ", ".join(missing))
    if not manager.minio_health(config):
        raise RuntimeError("T033 MinIO is not healthy; Question Bank import was not attempted")
    pnpm = manager.command_path("pnpm")
    args = [str(pnpm), "qb:source:apply", "--", *question_bank_args(SOURCE_DIR)]
    dry_run = manager.run_checked(args, env=env, config=config, timeout=3600)
    if "DRY RUN" not in dry_run or "NO DATABASE WRITE" not in dry_run or "NO MINIO WRITE" not in dry_run:
        raise RuntimeError("Question Bank importer did not confirm its no-write preflight")
    (EVIDENCE / "question-bank-preflight.txt").write_text(dry_run, encoding="utf-8")
    print("T033 Question Bank dry run: PASS; source remained read-only")
    manager.run_checked(
        [str(pnpm), "qb:source:apply", "--", "--apply", *question_bank_args(SOURCE_DIR)],
        env=env,
        config=config,
        timeout=3600,
    )
    print(f"T033 Question Bank import: PASS; database={DATABASE}; bucket={BUCKET}")


def test_environment(config: dict[str, str], env: dict[str, str], manager) -> dict[str, str]:
    CHROME_TMP.mkdir(parents=True, exist_ok=True, mode=0o700)
    CHROME_TMP.parent.chmod(0o700)
    CHROME_TMP.chmod(0o700)
    result = dict(env)
    result.update(
        {
            "TMPDIR": str(CHROME_TMP),
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
            "YZ_T033_EVIDENCE_DIR": str(EVIDENCE),
            "YZ_T033_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T033_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T033_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T029_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T029_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T029_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T029_DATABASE_NAME": DATABASE,
            "YZ_T029_DATABASE_USER": DB_ROLE,
            "YZ_T029_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T029_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T029_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T029_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T029_EVIDENCE_DIR": str(EVIDENCE / "invitation"),
            "YZ_T029_CHROMIUM": str(manager.CHROME),
            "YZ_T030_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T030_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T030_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T030_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T030_DATABASE_NAME": DATABASE,
            "YZ_T030_DATABASE_USER": DB_ROLE,
            "YZ_T030_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T030_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T030_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T030_EVIDENCE_DIR": str(EVIDENCE / "growth"),
            "YZ_T030_CHROMIUM": str(manager.CHROME),
            "YZ_T030_S3_BUCKET": BUCKET,
            "YZ_T030_S3_ENDPOINT": config["S3_ENDPOINT"],
            "YZ_T030_S3_REGION": config["S3_REGION"],
            "YZ_T030_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
            "YZ_T030_S3_SECRET_KEY": config["S3_SECRET_KEY"],
            "YZ_T030_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
            "YZ_T011_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T011_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T011_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T011_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T011_DATABASE_NAME": DATABASE,
            "YZ_T011_DATABASE_USER": DB_ROLE,
            "YZ_T011_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T011_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T011_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T011_S3_BUCKET": BUCKET,
            "YZ_T011_S3_ENDPOINT": config["S3_ENDPOINT"],
            "YZ_T011_S3_REGION": config["S3_REGION"],
            "YZ_T011_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
            "YZ_T011_S3_SECRET_KEY": config["S3_SECRET_KEY"],
            "YZ_T011_MINIO_API_PORT": config["MINIO_API_PORT"],
            "YZ_T011_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
            "YZ_T011_EVIDENCE_DIR": str(EVIDENCE / "growth"),
            "YZ_T031_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T031_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T031_EVIDENCE_DIR": str(EVIDENCE / "course"),
            "YZ_T031_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T031_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T031_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
            "YZ_T032_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T032_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T032_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T032_EVIDENCE_DIR": str(EVIDENCE / "csv"),
        }
    )
    return result


def redact(text: str, config: dict[str, str]) -> str:
    for key in (
        "DATABASE_URL",
        "POSTGRES_PASSWORD",
        "REDIS_PASSWORD",
        "SESSION_SECRET",
        "S3_SECRET_KEY",
        "E2E_TEST_PASSWORD",
    ):
        value = config.get(key)
        if value:
            text = text.replace(value, "<redacted>")
    text = __import__("re").sub(r"Bearer\s+[A-Za-z0-9._~-]+", "Bearer <redacted>", text)
    text = __import__("re").sub(
        r"(['\"]accessToken['\"]\s*:\s*['\"])[^'\"]+(['\"])",
        r"\1<redacted>\2",
        text,
    )
    return text


def run_e2e(manager, config, env) -> tuple[int, str]:
    test_env = test_environment(config, env, manager)
    result = subprocess.run(
        [
            str(manager.TEST_PYTHON),
            "-m",
            "pytest",
            "-q",
            "-s",
            str(TEST_FILE),
        ],
        cwd=ROOT,
        env=test_env,
        capture_output=True,
        text=True,
        timeout=5400,
        check=False,
    )
    output = redact(result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else ""), config)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "native-e2e.log").write_text(output, encoding="utf-8")
    print(output[-16000:])
    return result.returncode, output


def record_runtime(manager, config, *, start_status: int, test_status: int, stop_status: int) -> None:
    services = {}
    for name in SERVICE_NAMES:
        record = manager.read_record(name)
        port = {
            "postgres": int(config["POSTGRES_PORT"]),
            "api": int(config["API_PORT"]),
            "web": int(config["PORT"]),
            "redis": int(config["REDIS_PORT"]),
            "minio": int(config["MINIO_API_PORT"]),
        }[name]
        listeners = sorted(manager.port_listener_pids(port))
        services[name] = {
            "pidBeforeStop": PIDS_BEFORE_STOP.get(name),
            "port": port,
            "listenerPidsAfterStop": listeners,
            "stopped": not listeners,
        }
    data = {
        "task": "YZ-RD-T033",
        "runtime": "native; Docker/Compose not used",
        "database": DATABASE,
        "databaseRole": DB_ROLE,
        "postgresVersion": "17.11",
        "minioBucket": BUCKET,
        "node": subprocess.run([str(NODE), "--version"], check=True, capture_output=True, text=True).stdout.strip(),
        "pnpm": manager.command_version(manager.command_path("pnpm"), ["--version"]),
        "chromium": manager.command_version(manager.command_path("google-chrome"), ["--version"]),
        "startExitCode": start_status,
        "e2eExitCode": test_status,
        "stopExitCode": stop_status,
        "services": services,
        "evidenceGeneratedAt": datetime.now(timezone.utc).isoformat(),
        "dataRetained": True,
    }
    (EVIDENCE / "native-runtime-evidence.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def stop_owned_services(manager) -> int:
    result = manager.stop_all()
    if result == 0:
        return 0
    deadline = manager.time.monotonic() + 45
    names = ("test", "worker", "web", "api", "minio", "redis", "postgres")
    while manager.time.monotonic() < deadline:
        unresolved = False
        for name in names:
            record = manager.read_record(name)
            if not record:
                continue
            pid = record.get("pid")
            try:
                expected_start = str(record["start_ticks"])
                actual_start = manager.process_start_ticks(int(pid))
            except (KeyError, TypeError, ValueError):
                unresolved = True
                break
            if actual_start is not None and actual_start == expected_start:
                unresolved = True
                break
            if actual_start is not None and actual_start != expected_start:
                unresolved = True
                break
        if not unresolved:
            return manager.stop_all()
        manager.time.sleep(2)
    print("T033 task-owned service shutdown is still pending; no force kill was attempted")
    return 1


def main() -> int:
    if not NODE.is_file():
        raise RuntimeError("Pinned Node 24.20.0 is missing")
    os.environ["PATH"] = str(NODE_DIR) + os.pathsep + os.environ.get("PATH", "")
    os.environ["DSH_NODE"] = str(NODE)
    manager = load_manager()
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    RUNTIME.chmod(0o700)
    config = config_values(manager)
    env = manager.runtime_env(config)
    task_tmp = RUNTIME / "tmp"
    task_tmp.mkdir(parents=True, exist_ok=True, mode=0o700)
    task_tmp.chmod(0o700)
    env["TMPDIR"] = str(task_tmp)
    os.environ["TMPDIR"] = str(task_tmp)
    manager.EVIDENCE.mkdir(parents=True, exist_ok=True, mode=0o700)
    EVIDENCE.mkdir(parents=True, exist_ok=True)

    start_status = 1
    test_status = 2
    stop_status = 2
    exit_status = 1
    try:
        start_status = manager.start("assessment")
        if start_status != 0:
            exit_status = start_status
        else:
            config = manager.load_config()
            env = manager.runtime_env(config)
            env["TMPDIR"] = str(task_tmp)
            prepare_bucket(manager, config, env)
            prepare_question_bank(manager, config, env)
            test_status, _ = run_e2e(manager, config, env)
            exit_status = test_status
    finally:
        PIDS_BEFORE_STOP.update(
            {
                name: (manager.read_record(name) or {}).get("pid")
                for name in SERVICE_NAMES
            }
        )
        try:
            stop_status = stop_owned_services(manager)
        except (OSError, subprocess.TimeoutExpired) as error:
            stop_status = 1
            print("T033 ownership-aware stop did not finish: " + type(error).__name__)
        record_runtime(
            manager,
            config,
            start_status=start_status,
            test_status=test_status,
            stop_status=stop_status,
        )
        if test_status != 0:
            print("T033 native E2E did not pass; evidence and task-owned DB/MinIO state were retained")
        if stop_status != 0:
            print("T033 owned services did not fully stop; see native-runtime-evidence.json")
            exit_status = 1
    return exit_status


if __name__ == "__main__":
    raise SystemExit(main())
