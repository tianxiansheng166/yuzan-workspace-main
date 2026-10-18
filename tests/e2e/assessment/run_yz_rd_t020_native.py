#!/usr/bin/env python3
"""T020 isolated native acceptance, reusing the stopped T011 fixture as a read-only seed."""

from __future__ import annotations

import importlib.util
import os
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t020"
SHARED_RUNTIME_ROOT = ROOT.parent / "yuzan-workspace-main" / "runtime-local" / "native-web"
T011_RUNTIME = ROOT.parent / "yuzan-workspace-t011" / "runtime-local" / "native-web-t011"
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t020"
BUCKET_PREP = ROOT / "tests" / "e2e" / "assessment" / "prepare_yz_rd_t020_bucket.mjs"
E2E_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t020_teacher_home.py"
DATABASE_NAME = "yuzan_t020_native"
DATABASE_USER = "yz_t020"
PORTS = {
    "API_PORT": "4120",
    "PORT": "4320",
    "POSTGRES_PORT": "55660",
    "REDIS_PORT": "6460",
    "MINIO_API_PORT": "59260",
    "MINIO_CONSOLE_PORT": "59261",
}
RESERVED_T011_PORTS = (55630, 6430, 59184, 59185, 4090, 4290)


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t020", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure_task("T014", shared_runtime_root=SHARED_RUNTIME_ROOT)
    module.TASK_ID = "T020"
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

    def live_process_start_ticks(pid: int) -> str | None:
        try:
            content = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
            rest = content[content.rfind(")") + 2 :].split()
            if rest[0] == "Z":
                return None
            return rest[19]
        except (OSError, IndexError):
            return None

    # Exited child processes can remain as zombies until this runner reaps them.
    # Treating Z-state PIDs as exited avoids delaying cleanup while preserving
    # the native helper's PID/start-time/command/port checks for live processes.
    module.process_start_ticks = live_process_start_ticks
    return module


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_t020_config(runtime, *, preserve_existing: bool = True) -> None:
    if runtime.CONFIG_FILE.is_file() and preserve_existing:
        os.chmod(runtime.CONFIG_FILE, 0o600)
        existing = runtime.load_config()
        if any(existing.get(key) != value for key, value in PORTS.items()):
            raise RuntimeError("Existing T020 config does not match its dedicated port allocation")
        return
    database_password = secrets.token_hex(32)
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
        "S3_BUCKET": "yz-t020-native",
        "S3_ACCESS_KEY": "yz_t020_local",
        "S3_SECRET_KEY": secrets.token_hex(32),
        "S3_ACCESS_KEY_ID": "yz_t020_local",
        "S3_SECRET_ACCESS_KEY": "",
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t020:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    values["S3_SECRET_ACCESS_KEY"] = values["S3_SECRET_KEY"]
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    descriptor = os.open(runtime.CONFIG_FILE, flags, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T020 native test runtime.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    runtime.load_config()


def require_t011_fixture(runtime) -> dict[str, str]:
    source_config = T011_RUNTIME / ".env.local"
    source_pg = T011_RUNTIME / "postgres-data"
    source_minio = T011_RUNTIME / "minio-data"
    if not source_config.is_file() or not source_pg.joinpath("PG_VERSION").is_file() or not source_minio.is_dir():
        raise RuntimeError("The retained T011 PostgreSQL/MinIO fixture is unavailable")
    source = parse_env_file(source_config)
    if source.get("POSTGRES_DB") != "yuzan_t011_native" or source.get("POSTGRES_USER") != "yz_t011":
        raise RuntimeError("The source fixture does not match the T011 database identity")
    if source_pg.joinpath("postmaster.pid").exists():
        raise RuntimeError("T011 PostgreSQL has a postmaster PID file; refusing to copy a possibly active data directory")
    for port in RESERVED_T011_PORTS:
        runtime.check_port_available(port)
    if source_pg.joinpath("PG_VERSION").read_text(encoding="utf-8").strip() != "17":
        raise RuntimeError("The T011 fixture is not PostgreSQL 17")
    return source


def copy_stopped_fixture(runtime) -> None:
    source_pg = T011_RUNTIME / "postgres-data"
    source_minio = T011_RUNTIME / "minio-data"
    target_pg = runtime.PGDATA
    target_minio = runtime.MINIO_DATA
    if not (target_pg / "PG_VERSION").is_file():
        if any(target_pg.iterdir()):
            raise RuntimeError("T020 PostgreSQL target is nonempty without PG_VERSION; preserving it")
        shutil.copytree(
            source_pg,
            target_pg,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("postmaster.pid"),
        )
    if not any(target_minio.iterdir()):
        shutil.copytree(source_minio, target_minio, dirs_exist_ok=True)
    if (target_pg / "PG_VERSION").read_text(encoding="utf-8").strip() != "17":
        raise RuntimeError("T020 PostgreSQL data directory is not version 17")


def start_t020_postgres(runtime, config: dict[str, str], env: dict[str, str], source_config: dict[str, str]) -> None:
    pg_ctl = runtime.PG_BIN / "pg_ctl"
    socket_dir = runtime.STATE / "socket"
    socket_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(socket_dir, 0o700)
    status = runtime.run_output([str(pg_ctl), "--pgdata", str(runtime.PGDATA), "status"], env=env, timeout=10)
    if status.returncode != 0:
        runtime.check_port_available(int(config["POSTGRES_PORT"]))
        result = runtime.run_output(
            [
                str(pg_ctl), "--pgdata", str(runtime.PGDATA), "--log", str(runtime.LOGS / "postgres.log"),
                "--options", f"-h 127.0.0.1 -p {config['POSTGRES_PORT']} -k {socket_dir}", "--wait", "start",
            ],
            env=env,
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError("T020 PostgreSQL start failed; see its task-owned log")
    pid_file = runtime.PGDATA / "postmaster.pid"
    if not pid_file.is_file():
        raise RuntimeError("T020 PostgreSQL did not create postmaster.pid")
    pid = int(pid_file.read_text(encoding="utf-8").splitlines()[0])
    runtime.record_for_pid("postgres", pid, str(runtime.PGDATA), int(config["POSTGRES_PORT"]), pid, [])

    source_env = dict(env)
    source_env.update({
        "PGHOST": "127.0.0.1",
        "PGPORT": config["POSTGRES_PORT"],
        "PGUSER": source_config["POSTGRES_USER"],
        "PGPASSWORD": source_config["POSTGRES_PASSWORD"],
        "PGDATABASE": "postgres",
    })
    psql = str(runtime.PG_BIN / "psql")
    role_exists = runtime.run_output([psql, "-X", "-A", "-t", "-c", f"SELECT 1 FROM pg_roles WHERE rolname='{DATABASE_USER}';"], env=source_env, timeout=20)
    if role_exists.returncode != 0:
        raise RuntimeError("T020 PostgreSQL bootstrap identity could not connect to the copied fixture")
    database_url = config["DATABASE_URL"]
    t020_password = database_url.split(":", 2)[2].split("@", 1)[0]
    role_sql = (
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='yz_t020') THEN "
        f"ALTER ROLE yz_t020 WITH LOGIN PASSWORD '{t020_password}'; "
        "ELSE "
        f"CREATE ROLE yz_t020 WITH LOGIN PASSWORD '{t020_password}'; "
        "END IF; END $$;"
    )
    role_result = subprocess.run([psql, "-X", "-v", "ON_ERROR_STOP=1", "-q"], input=role_sql, text=True, capture_output=True, env=source_env, check=False)
    if role_result.returncode != 0:
        raise RuntimeError("T020 database role creation failed")
    db_exists = runtime.run_output([psql, "-X", "-A", "-t", "-c", f"SELECT 1 FROM pg_database WHERE datname='{DATABASE_NAME}';"], env=source_env, timeout=20)
    if db_exists.returncode != 0:
        raise RuntimeError("Unable to inspect the T020 database")
    if db_exists.stdout.strip() != "1":
        create_db = runtime.run_output(
            [str(runtime.PG_BIN / "createdb"), "--host=127.0.0.1", "--port", config["POSTGRES_PORT"], "--username", source_config["POSTGRES_USER"], "--owner", DATABASE_USER, "--template", source_config["POSTGRES_DB"], DATABASE_NAME],
            env=source_env,
            timeout=60,
        )
        if create_db.returncode != 0:
            raise RuntimeError("T020 dedicated database clone failed")
    source_env["PGDATABASE"] = DATABASE_NAME
    grants = (
        "GRANT USAGE, CREATE ON SCHEMA public TO yz_t020; "
        "GRANT ALL ON ALL TABLES IN SCHEMA public TO yz_t020; "
        "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO yz_t020; "
        "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO yz_t020;"
    )
    grant_result = subprocess.run([psql, "-X", "-v", "ON_ERROR_STOP=1", "-q"], input=grants, text=True, capture_output=True, env=source_env, check=False)
    if grant_result.returncode != 0:
        raise RuntimeError("T020 database clone privileges could not be granted")


def run_bucket_prep(runtime, config: dict[str, str], env: dict[str, str]) -> str:
    node = runtime.node_binary()
    if not node or not BUCKET_PREP.is_file():
        raise RuntimeError("Node 24 or the T020 bucket preparation script is unavailable")
    result = runtime.run_output([str(node), str(BUCKET_PREP)], env=env, cwd=ROOT, timeout=900)
    output = runtime.safe_text((result.stdout + result.stderr).strip(), config)
    if result.returncode != 0:
        raise RuntimeError("T020 MinIO bucket copy failed: " + output[-3000:])
    return output


def run_e2e(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str, Path]:
    python = runtime.TEST_PYTHON
    if not python.is_file() or not E2E_FILE.is_file():
        raise RuntimeError("The reused T011 Playwright environment or T020 E2E file is unavailable")
    test_env = dict(env)
    test_env.update({
        "YZ_T020_BASE_URL": config["WEB_ORIGIN"],
        "YZ_T020_DATABASE_URL": config["DATABASE_URL"],
        "YZ_T020_PASSWORD": config["E2E_TEST_PASSWORD"],
        "YZ_T020_EVIDENCE_DIR": str(EVIDENCE_DIR),
        "YZ_T020_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
        "YZ_T020_S3_BUCKET": config["S3_BUCKET"],
        "YZ_T020_S3_ENDPOINT": config["S3_ENDPOINT"],
        "YZ_T020_S3_REGION": config["S3_REGION"],
        "YZ_T020_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "YZ_T020_S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "YZ_T020_MINIO_API_PORT": config["MINIO_API_PORT"],
        "POSTGRES_USER": config["POSTGRES_USER"],
        "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
        "POSTGRES_DB": config["POSTGRES_DB"],
        "POSTGRES_PORT": config["POSTGRES_PORT"],
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
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    log_path = EVIDENCE_DIR / "t020-native-playwright.log"
    log_path.write_text(safe_output + ("\n" if safe_output and not safe_output.endswith("\n") else ""), encoding="utf-8")
    return process.returncode or 0, safe_output, log_path


def reap_stopped_owned_children(runtime) -> int:
    reaped = 0
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
            reaped += 1
            print(f"T020 cleanup: reaped exited owned {name} child PID {pid}.")
    return reaped


def main() -> int:
    runtime = load_runtime_module()
    created: list[str] = []
    test_result = 1
    try:
        write_t020_config(runtime)
        config = runtime.load_config()
        runtime.ensure_dirs()
        env = runtime.runtime_env(config)
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        source_config = require_t011_fixture(runtime)
        copy_stopped_fixture(runtime)
        start_t020_postgres(runtime, config, env, source_config)
        runtime.start_postgres(config, env, created)
        runtime.start_redis(config, env, created)
        runtime.start_minio(config, env, created)
        bucket_output = run_bucket_prep(runtime, config, env)
        if bucket_output:
            print(bucket_output)
        pnpm = runtime.command_path("pnpm")
        if pnpm is None:
            raise RuntimeError("pnpm is not available")
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "build"], env=env, config=config, timeout=300)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)
        runtime.start_web_api(config, env, created)
        ready = runtime.http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=5)
        if ready != 200:
            raise RuntimeError(f"T020 API readiness did not pass (HTTP {ready})")
        print("T020 native runtime: PostgreSQL 17, Redis 7, MinIO, NestJS API and Web are ready; Worker remains stopped.")
        test_result, output, log_path = run_e2e(runtime, config, env)
        print(output)
        print(f"Native Chromium/API/PostgreSQL/MinIO E2E: {'PASS' if test_result == 0 else 'FAIL'}")
        print(f"E2E log: {log_path}")
    except Exception as error:
        print(f"T020 native runtime: FAIL — {runtime.safe_text(str(error), runtime.load_config(required=False))}")
        test_result = 1
    finally:
        runtime.stop_all()
        reap_stopped_owned_children(runtime)
        runtime.stop_all()
        status = runtime.status()
        if status != 0:
            test_result = 1
        config = runtime.load_config(required=False)
        if config:
            for port_name in ("POSTGRES_PORT", "API_PORT", "PORT", "REDIS_PORT", "MINIO_API_PORT", "MINIO_CONSOLE_PORT"):
                port = int(config[port_name])
                if runtime.port_listener_pids(port):
                    print(f"T020 cleanup: port {port_name}={port} still has a listener")
                    test_result = 1
        print("T020 cleanup: runtime-owned services stopped; database, bucket and evidence retained.")
    return test_result


if __name__ == "__main__":
    raise SystemExit(main())
