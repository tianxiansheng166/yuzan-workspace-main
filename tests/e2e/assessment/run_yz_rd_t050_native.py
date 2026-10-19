#!/usr/bin/env python3
"""Task-owned T050 native Chrome/API/PostgreSQL/Redis/MinIO integration run."""

from __future__ import annotations

import importlib.util
import json
import os
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = ROOT / "runtime-local" / "native-web-t050-r12"
SHARED_RUNTIME_ROOT = ROOT.parents[1] / "yuzan-workspace-main" / "runtime-local" / "native-web"
T047_RUNTIME = ROOT.parents[0] / "yuzan-workspace-t047" / "runtime-local" / "native-web-t047"
ATTEMPT_NAME = os.environ.get("YZ_T050_ATTEMPT", "attempt-04")
EVIDENCE_DIR = ROOT / "evidence" / "yz-rd-t050" / "e2e" / ATTEMPT_NAME
BUCKET_PREP = ROOT / "tests" / "e2e" / "assessment" / "prepare_yz_rd_t050_bucket.mjs"
E2E_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t050_integrated_speech_review.py"
DATABASE_NAME = "yuzan_t050_native"
DATABASE_USER = "yz_t050"
PORTS = {
    "API_PORT": "4261",
    "PORT": "4461",
    "POSTGRES_PORT": "55761",
    "REDIS_PORT": "6561",
    "MINIO_API_PORT": "59772",
    "MINIO_CONSOLE_PORT": "59773",
}
T047_RESERVED_PORTS = (55747, 6547, 59747, 59748, 4247, 4447)


def load_runtime_module():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_native_runtime_t050", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the existing native runtime helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.configure_task("T014", shared_runtime_root=SHARED_RUNTIME_ROOT)
    module.TASK_ID = "T050"
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

    default_wait_for_http = module.wait_for_http

    def wait_for_http_with_cold_start_budget(name, url, *, expected=200, timeout=45):
        if name in {"API live", "Teacher Web"}:
            timeout = max(timeout, 180)
        return default_wait_for_http(name, url, expected=expected, timeout=timeout)

    module.wait_for_http = wait_for_http_with_cold_start_budget
    return module


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_t050_config(runtime) -> None:
    if runtime.CONFIG_FILE.is_file():
        os.chmod(runtime.CONFIG_FILE, 0o600)
        existing = runtime.load_config()
        expected = {
            **PORTS,
            "POSTGRES_DB": DATABASE_NAME,
            "POSTGRES_USER": DATABASE_USER,
            "S3_BUCKET": "yz-t047-native",
        }
        if any(existing.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Existing T050 config does not match the dedicated database, bucket, or port allocation")
        return

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
        "S3_BUCKET": "yz-t047-native",
        "S3_ACCESS_KEY": "yz_t050_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t050_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t050:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
        "E2E_TEST_PASSWORD": "YuzanTest!2026",
    }
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(runtime.CONFIG_FILE, flags, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write("# Local-only T050 native test runtime.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(runtime.CONFIG_FILE, 0o600)
    runtime.load_config()


def require_stopped_t047_fixture(runtime) -> dict[str, str]:
    source_config = T047_RUNTIME / ".env.local"
    source_pg = T047_RUNTIME / "postgres-data"
    source_minio = T047_RUNTIME / "minio-data"
    if not source_config.is_file() or not (source_pg / "PG_VERSION").is_file() or not source_minio.is_dir():
        raise RuntimeError("The retained T047 PostgreSQL/MinIO fixture is unavailable")
    source = parse_env_file(source_config)
    if source.get("POSTGRES_DB") != "yuzan_t047_native" or source.get("POSTGRES_USER") != "yz_t047":
        raise RuntimeError("The source fixture does not match the accepted T047 database identity")
    if source.get("S3_BUCKET") != "yz-t047-native":
        raise RuntimeError("The retained T047 MinIO identity differs from its accepted source")
    if (source_pg / "postmaster.pid").exists():
        raise RuntimeError("T047 PostgreSQL has a postmaster PID file; refusing to copy a possibly active data directory")
    for port in T047_RESERVED_PORTS:
        runtime.check_port_available(port)
    if (source_pg / "PG_VERSION").read_text(encoding="utf-8").strip() != "17":
        raise RuntimeError("The accepted T047 fixture is not PostgreSQL 17")
    return source


def copy_stopped_t047_fixture(runtime) -> None:
    source_pg = T047_RUNTIME / "postgres-data"
    source_minio = T047_RUNTIME / "minio-data"
    if not (runtime.PGDATA / "PG_VERSION").is_file():
        if any(runtime.PGDATA.iterdir()):
            raise RuntimeError("T050 PostgreSQL target is nonempty without PG_VERSION; preserving it")
        shutil.copytree(source_pg, runtime.PGDATA, dirs_exist_ok=True, ignore=shutil.ignore_patterns("postmaster.pid"))
    if not any(runtime.MINIO_DATA.iterdir()):
        shutil.copytree(source_minio, runtime.MINIO_DATA, dirs_exist_ok=True)
    if (runtime.PGDATA / "PG_VERSION").read_text(encoding="utf-8").strip() != "17":
        raise RuntimeError("T050 PostgreSQL data directory is not version 17")


def start_t050_postgres(runtime, config: dict[str, str], env: dict[str, str], source_config: dict[str, str]) -> None:
    pg_ctl = runtime.PG_BIN / "pg_ctl"
    socket_dir = runtime.STATE / "socket"
    socket_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    socket_dir.chmod(0o700)
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
            raise RuntimeError("T050 PostgreSQL start failed; see its task-owned log")
    pid_file = runtime.PGDATA / "postmaster.pid"
    if not pid_file.is_file():
        raise RuntimeError("T050 PostgreSQL did not create postmaster.pid")
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
    role_probe = runtime.run_output(
        [psql, "-X", "-A", "-t", "-c", f"SELECT 1 FROM pg_roles WHERE rolname='{DATABASE_USER}';"],
        env=source_env,
        timeout=20,
    )
    if role_probe.returncode != 0:
        raise RuntimeError("T050 PostgreSQL bootstrap identity could not connect to the copied fixture")
    role_sql = (
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='yz_t050') THEN "
        f"ALTER ROLE yz_t050 WITH LOGIN PASSWORD '{config['POSTGRES_PASSWORD']}'; "
        "ELSE "
        f"CREATE ROLE yz_t050 WITH LOGIN PASSWORD '{config['POSTGRES_PASSWORD']}'; "
        "END IF; END $$;"
    )
    role_result = subprocess.run(
        [psql, "-X", "-v", "ON_ERROR_STOP=1", "-q"], input=role_sql, text=True, capture_output=True, env=source_env, check=False
    )
    if role_result.returncode != 0:
        raise RuntimeError("T050 database role creation failed")
    db_probe = runtime.run_output(
        [psql, "-X", "-A", "-t", "-c", f"SELECT 1 FROM pg_database WHERE datname='{DATABASE_NAME}';"],
        env=source_env,
        timeout=20,
    )
    if db_probe.returncode != 0:
        raise RuntimeError("Unable to inspect the T050 database")
    if db_probe.stdout.strip() != "1":
        create_db = runtime.run_output(
            [
                str(runtime.PG_BIN / "createdb"), "--host=127.0.0.1", "--port", config["POSTGRES_PORT"],
                "--username", source_config["POSTGRES_USER"], "--owner", DATABASE_USER,
                "--template", source_config["POSTGRES_DB"], DATABASE_NAME,
            ],
            env=source_env,
            timeout=90,
        )
        if create_db.returncode != 0:
            raise RuntimeError("T050 dedicated database clone failed")
    target_env = dict(source_env, PGDATABASE=DATABASE_NAME)
    grants = (
        f"GRANT USAGE, CREATE ON SCHEMA public TO {DATABASE_USER}; "
        f"GRANT ALL ON ALL TABLES IN SCHEMA public TO {DATABASE_USER}; "
        f"GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO {DATABASE_USER}; "
        f"GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO {DATABASE_USER};"
    )
    grant_result = subprocess.run([psql, "-X", "-v", "ON_ERROR_STOP=1", "-q"], input=grants, text=True, capture_output=True, env=target_env, check=False)
    if grant_result.returncode != 0:
        raise RuntimeError("T050 database clone privileges could not be granted")


def run_bucket_prep(runtime, env: dict[str, str]) -> str:
    node = runtime.node_binary()
    if not node or not BUCKET_PREP.is_file():
        raise RuntimeError("Node 24 or the T050 bucket preparation script is unavailable")
    result = runtime.run_output([str(node), str(BUCKET_PREP)], env=env, cwd=ROOT, timeout=900)
    output = runtime.safe_text((result.stdout + result.stderr).strip(), runtime.load_config())
    if result.returncode != 0:
        raise RuntimeError("T050 MinIO bucket copy failed: " + output[-3000:])
    return output


def test_environment(runtime, config: dict[str, str], env: dict[str, str]) -> dict[str, str]:
    root = EVIDENCE_DIR
    common = {
        "BASE_URL": config["WEB_ORIGIN"],
        "DATABASE_URL": config["DATABASE_URL"],
        "PASSWORD": config["E2E_TEST_PASSWORD"],
        "DATABASE_NAME": DATABASE_NAME,
        "DATABASE_USER": DATABASE_USER,
        "S3_BUCKET": config["S3_BUCKET"],
        "S3_ENDPOINT": config["S3_ENDPOINT"],
        "S3_REGION": config["S3_REGION"],
        "S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
        "S3_SECRET_KEY": config["S3_SECRET_KEY"],
        "API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
        "POSTGRES_PORT": config["POSTGRES_PORT"],
        "POSTGRES_USER": DATABASE_USER,
        "POSTGRES_DB": DATABASE_NAME,
        "PSQL": str(runtime.PG_BIN / "psql"),
        "PG_LIBRARY": str(runtime.PG_LIBRARY),
        "CHROMIUM": "/usr/bin/google-chrome",
        "API_BASE_URL": config["API_BASE_URL"],
    }
    for prefix, subdir in (("T048", "teacher-review"), ("T045", "practice-catalog"),
                           ("T044", "practice-modes"), ("T034", "teacher-roster"),
                           ("T037", "personalized-today"), ("T030", "personalized-today/upstream-report"),
                           ("T050", "task-summary")):
        for key, value in common.items():
            env[f"YZ_{prefix}_{key}"] = value
        env[f"YZ_{prefix}_EVIDENCE_DIR"] = str(root / subdir)
    env["YZ_T048_MINIO_API_PORT"] = config["MINIO_API_PORT"]
    env["YZ_T034_EXPECTED_DATABASE_NAME"] = DATABASE_NAME
    env["YZ_T034_EXPECTED_DATABASE_USER"] = DATABASE_USER
    env["YZ_T044_EXPECTED_DATABASE"] = DATABASE_NAME
    env["YZ_T044_EXPECTED_DATABASE_USER"] = DATABASE_USER
    env["YZ_T045_EXPECTED_DATABASE"] = DATABASE_NAME
    env["YZ_T045_EXPECTED_DATABASE_USER"] = DATABASE_USER
    env["QB_RELEASE_BASE_URL"] = config["WEB_ORIGIN"]
    env["QB_RELEASE_DATABASE_URL"] = config["DATABASE_URL"]
    env["QB_RELEASE_PSQL"] = str(runtime.PG_BIN / "psql")
    env["QB_RELEASE_PG_LIBRARY"] = str(runtime.PG_LIBRARY)
    env["QB_RELEASE_DB_USER"] = DATABASE_USER
    env["QB_RELEASE_DB_NAME"] = DATABASE_NAME
    env["YZ_T042_INTEGRATED_NATIVE"] = "true"
    return env


def verify_redis_read_write(runtime, config: dict[str, str], env: dict[str, str]) -> dict[str, str]:
    redis_cli = runtime.REDIS_DIR / "redis-cli"
    if not redis_cli.is_file():
        raise RuntimeError("T050 Redis 7 redis-cli is unavailable")
    key = f"yuzan:t050:acceptance:{secrets.token_hex(8)}"
    value = f"TEST_FIXTURE_ONLY:{secrets.token_hex(8)}"
    redis_env = dict(env)
    redis_env["REDISCLI_AUTH"] = config["REDIS_PASSWORD"]
    write = runtime.run_output(
        [str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "SET", key, value],
        env=redis_env,
        timeout=10,
    )
    if write.returncode != 0 or write.stdout.strip() != "OK":
        raise RuntimeError("T050 Redis SET did not return OK")
    read = runtime.run_output(
        [str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "GET", key],
        env=redis_env,
        timeout=10,
    )
    if read.returncode != 0 or read.stdout.strip() != value:
        raise RuntimeError("T050 Redis GET did not return the written fixture value")
    delete = runtime.run_output(
        [str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "DEL", key],
        env=redis_env,
        timeout=10,
    )
    if delete.returncode != 0 or delete.stdout.strip() != "1":
        raise RuntimeError("T050 Redis cleanup did not remove its own acceptance key")
    evidence = {"write": "SET OK", "readBack": "exact value matched", "cleanup": "own key deleted", "redisPort": config["REDIS_PORT"]}
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "redis-rw.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    return evidence


def run_e2e(runtime, config: dict[str, str], env: dict[str, str]) -> tuple[int, str]:
    python = runtime.TEST_PYTHON
    if not python.is_file() or not E2E_FILE.is_file():
        raise RuntimeError("The pinned Playwright environment or T050 E2E file is unavailable")
    test_env = test_environment(runtime, config, dict(env))
    temp_dir = Path("/tmp/yz-rd-t050/chromium")
    if temp_dir.is_symlink() or (temp_dir.exists() and (not temp_dir.is_dir() or temp_dir.stat().st_uid != os.getuid())):
        raise RuntimeError("T050 private Chromium temp path is not an owned directory")
    temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp_dir.chmod(0o700)
    test_env["TMPDIR"] = str(temp_dir)
    pytest_args = [str(python), "-m", "pytest", "-q", "-s"]
    selection = os.environ.get("YZ_T050_PYTEST_K", "").strip()
    if selection:
        pytest_args.extend(["-k", selection])
    pytest_args.append(str(E2E_FILE))
    process = subprocess.Popen(
        pytest_args,
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
    (EVIDENCE_DIR / "t050-native-e2e.log").write_text(safe_output + ("\n" if safe_output and not safe_output.endswith("\n") else ""), encoding="utf-8")
    return process.returncode or 0, safe_output


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
            print(f"T050 cleanup: reaped exited owned {name} child PID {pid}.")
    return reaped


def main() -> int:
    runtime = load_runtime_module()
    created: list[str] = []
    test_result = 1
    try:
        write_t050_config(runtime)
        config = runtime.load_config()
        runtime.ensure_dirs()
        env = runtime.runtime_env(config)
        for port in (int(value) for value in PORTS.values()):
            runtime.check_port_available(port)
        source_config = require_stopped_t047_fixture(runtime)
        copy_stopped_t047_fixture(runtime)
        start_t050_postgres(runtime, config, env, source_config)
        runtime.start_redis(config, env, created)
        redis_evidence = verify_redis_read_write(runtime, config, env)
        print("T050 Redis read/write: PASS " + json.dumps(redis_evidence))
        runtime.start_minio(config, env, created)
        bucket_output = run_bucket_prep(runtime, env)
        print(bucket_output)
        pnpm = runtime.command_path("pnpm")
        if pnpm is None:
            raise RuntimeError("pnpm is not available")
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "build"], env=env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=600)
        runtime.run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=900)
        runtime.start_web_api(config, env, created)
        ready_url = f"{config['API_BASE_URL']}/api/v1/health/ready"
        ready_deadline = time.monotonic() + 180
        ready = None
        while time.monotonic() < ready_deadline:
            ready = runtime.http_status(ready_url, timeout=5)
            if ready == 200:
                break
            time.sleep(1)
        if ready != 200:
            raise RuntimeError(f"T050 API readiness did not pass (HTTP {ready})")
        print("T050 native runtime: PostgreSQL 17, Redis 7, MinIO, NestJS API and Web are ready; Worker remains stopped.")
        test_result, output = run_e2e(runtime, config, env)
        print(output[-30000:])
        print(f"Native Chromium/API/PostgreSQL/MinIO E2E: {'PASS' if test_result == 0 else 'FAIL'}")
    except Exception as error:
        print(f"T050 native runtime: FAIL — {runtime.safe_text(str(error), runtime.load_config(required=False))}")
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
                    print(f"T050 cleanup: port {port_name}={port} still has a listener")
                    test_result = 1
        print("T050 cleanup: runtime-owned services stopped; database, bucket and evidence retained.")
    return test_result


if __name__ == "__main__":
    raise SystemExit(main())
