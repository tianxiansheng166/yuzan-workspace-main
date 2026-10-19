"""Run T025 on task-owned native resources without Docker or shared DBs."""

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
SHARED_NATIVE = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
RUNTIME = ROOT / "runtime-local" / "native-web-t025"
DATABASE_NAME = "yuzan_t025_native"
DATABASE_USER = "yz_t025"
BUCKET = "yz-t025-native"
PORTS = {
    "POSTGRES_PORT": "55650",
    "REDIS_PORT": "6450",
    "MINIO_API_PORT": "59224",
    "MINIO_CONSOLE_PORT": "59225",
    "API_PORT": "4125",
    "WEB_PORT": "4325",
}
QUESTION_BANK_SOURCE = Path("/home/tian/code/yuzan-workspace-main/习题课程资源")
EVIDENCE = ROOT / "evidence" / "yz-rd-t025"


def load_native_manager():
    path = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_t025_native_manager", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load existing native runtime manager")
    manager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(manager)

    manager.TASK_ID = "T025"
    manager.BASE_RUNTIME = SHARED_NATIVE
    manager.RUNTIME = RUNTIME
    manager.CONFIG_FILE = RUNTIME / ".env.local"
    manager.STATE = RUNTIME / "state"
    manager.LOGS = RUNTIME / "logs"
    manager.PGDATA = RUNTIME / "postgres-data"
    manager.REDIS_DATA = RUNTIME / "redis-data"
    manager.MINIO_DATA = RUNTIME / "minio-data"
    manager.EVIDENCE = EVIDENCE / "native-runtime"
    manager.TOOLCHAIN = SHARED_NATIVE / "toolchain"
    manager.TASK_BIN = RUNTIME / "bin"
    manager.PG_PREFIX = manager.TOOLCHAIN / "pgdg"
    manager.PG_BIN = manager.PG_PREFIX / "usr" / "lib" / "postgresql" / "17" / "bin"
    manager.PG_LIBRARY = manager.PG_PREFIX / "usr" / "lib" / "x86_64-linux-gnu"
    manager.REDIS_DIR = manager.TOOLCHAIN / "redis-7.4.10" / "src"
    manager.MINIO_BIN = manager.TOOLCHAIN / "bin" / "minio"
    manager.TEST_PYTHON = SHARED_NATIVE / "venv" / "bin" / "python"
    manager.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)
    manager.TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t025_student_growth.py"
    manager.T013_TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t013_student_today_growth.py"
    return manager


def config_values(manager):
    if manager.CONFIG_FILE.exists():
        config = manager.load_config()
        expected = {
            "POSTGRES_DB": DATABASE_NAME,
            "POSTGRES_USER": DATABASE_USER,
            "S3_BUCKET": BUCKET,
            "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
            "REDIS_PORT": PORTS["REDIS_PORT"],
            "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
            "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
            "API_PORT": PORTS["API_PORT"],
            "PORT": PORTS["WEB_PORT"],
        }
        mismatches = [key for key, value in expected.items() if config.get(key) != value]
        if mismatches:
            raise RuntimeError("existing T025 runtime config has mismatched resource identity: " + ", ".join(mismatches))
        return config

    password = secrets.token_urlsafe(32)
    redis_password = secrets.token_urlsafe(32)
    s3_secret = secrets.token_urlsafe(32)
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1",
        "API_PORT": PORTS["API_PORT"],
        "API_BASE_URL": f"http://127.0.0.1:{PORTS['API_PORT']}",
        "DATABASE_URL": f"postgresql://{DATABASE_USER}:{password}@127.0.0.1:{PORTS['POSTGRES_PORT']}/{DATABASE_NAME}?schema=public",
        "POSTGRES_USER": DATABASE_USER,
        "POSTGRES_PASSWORD": password,
        "POSTGRES_DB": DATABASE_NAME,
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
        "S3_ACCESS_KEY": f"{DATABASE_USER}_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": f"{DATABASE_USER}_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
        "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
        "WORKER_HEARTBEAT_KEY": "yuzan:t025:worker:heartbeat",
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
        handle.write("# Local-only YZ-RD-T025 native runtime.\n")
        handle.writelines(f"{key}={value}\n" for key, value in values.items())
        handle.flush()
        os.fsync(handle.fileno())
    manager.CONFIG_FILE.chmod(0o600)
    return manager.load_config()


def run_suite(manager, config, *, test_file: Path, env: dict[str, str], log_name: str) -> None:
    python = manager.TEST_PYTHON
    if not python.is_file():
        raise RuntimeError("the existing native Playwright venv is missing")
    result = subprocess.run(
        [str(python), "-m", "pytest", "-q", "-s", str(test_file)],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=1800,
        check=False,
    )
    log_path = EVIDENCE / log_name
    log_path.parent.mkdir(parents=True, exist_ok=True)
    content = result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else "")
    for secret_key in manager.SECRET_KEYS:
        secret = config.get(secret_key)
        if secret:
            content = content.replace(secret, "<redacted>")
    database_url = config.get("DATABASE_URL")
    if database_url:
        content = content.replace(database_url, "<DATABASE_URL redacted>")
    log_path.write_text(content, encoding="utf-8")
    print(content[-12000:])
    if result.returncode != 0:
        raise RuntimeError(f"{log_name} failed with exit code {result.returncode}; see {log_path}")


def main() -> int:
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10+ is required for the isolated native manager")
    required_sources = ("题库【三改】.docx", "答案及评分细则.docx", "题库音频及图片.zip")
    missing = [name for name in required_sources if not (QUESTION_BANK_SOURCE / name).is_file()]
    if missing:
        raise RuntimeError("read-only Question Bank source is incomplete: " + ", ".join(missing))

    manager = load_native_manager()
    config = config_values(manager)
    started = False
    try:
        if manager.doctor("assessment") != 0:
            raise RuntimeError("T025 native runtime doctor did not pass")
        if manager.start("assessment") != 0:
            raise RuntimeError("T025 native API/PostgreSQL/Redis/MinIO startup failed")
        started = True

        env = manager.runtime_env(config)
        pnpm = manager.command_path("pnpm")
        if not pnpm:
            raise RuntimeError("pnpm 10.13.1 was not found")
        manager.run_checked(
            [
                str(pnpm), "qb:source:apply", "--", "--apply", "--all",
                "--school-id", "11111111-1111-4111-8111-111111111111",
                "--class-id", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                "--source-dir", str(QUESTION_BANK_SOURCE),
            ],
            env=env,
            config=config,
            timeout=3600,
        )
        print(f"T025 Question Bank import: PASS; source read only; target bucket={BUCKET}")

        t025_env = dict(env)
        t025_env.update({
            "YZ_NATIVE_TASK_ID": "T025",
            "YZ_T025_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T025_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T025_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T025_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T025_DATABASE_NAME": config["POSTGRES_DB"],
            "YZ_T025_DATABASE_USER": config["POSTGRES_USER"],
            "YZ_T025_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T025_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T025_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T025_EVIDENCE_DIR": str(EVIDENCE / "native-e2e"),
            "YZ_T025_CHROMIUM": str(manager.CHROME),
            "YZ_T025_S3_BUCKET": config["S3_BUCKET"],
            "YZ_T025_S3_ENDPOINT": config["S3_ENDPOINT"],
            "YZ_T025_S3_REGION": config["S3_REGION"],
            "YZ_T025_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
            "YZ_T025_S3_SECRET_KEY": config["S3_SECRET_KEY"],
            "YZ_T025_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
            "YZ_T011_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T011_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T011_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T011_DATABASE_NAME": config["POSTGRES_DB"],
            "YZ_T011_DATABASE_USER": config["POSTGRES_USER"],
            "YZ_T011_S3_BUCKET": config["S3_BUCKET"],
            "YZ_T011_S3_ENDPOINT": config["S3_ENDPOINT"],
            "YZ_T011_S3_REGION": config["S3_REGION"],
            "YZ_T011_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
            "YZ_T011_S3_SECRET_KEY": config["S3_SECRET_KEY"],
            "YZ_T011_MINIO_API_PORT": config["MINIO_API_PORT"],
            "YZ_T011_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
            "YZ_T011_EVIDENCE_DIR": str(EVIDENCE / "native-e2e"),
            "POSTGRES_USER": config["POSTGRES_USER"],
            "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
            "POSTGRES_DB": config["POSTGRES_DB"],
            "POSTGRES_PORT": config["POSTGRES_PORT"],
            "S3_BUCKET": config["S3_BUCKET"],
            "S3_ENDPOINT": config["S3_ENDPOINT"],
            "S3_REGION": config["S3_REGION"],
            "S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
            "S3_SECRET_KEY": config["S3_SECRET_KEY"],
        })
        run_suite(
            manager,
            config,
            test_file=manager.TEST_FILE,
            env=t025_env,
            log_name="native-e2e.log",
        )

        t013_env = dict(t025_env)
        t013_env.update({
            "YZ_T013_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T013_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T013_TEST_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T013_DATABASE_NAME": config["POSTGRES_DB"],
            "YZ_T013_DATABASE_USER": config["POSTGRES_USER"],
            "YZ_T013_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T013_PSQL": str(manager.PG_BIN / "psql"),
            "YZ_T013_PG_LIBRARY": str(manager.PG_LIBRARY),
            "YZ_T013_EVIDENCE_DIR": str(EVIDENCE / "t013-regression"),
        })
        run_suite(
            manager,
            config,
            test_file=manager.T013_TEST_FILE,
            env=t013_env,
            log_name="t013-native-regression.log",
        )
        return 0
    finally:
        if started:
            owned_before_stop = {name: manager.read_record(name) for name in manager.SERVICE_ORDER}
            stop_attempts = []
            stop_result = manager.stop_all()
            stop_attempts.append("PASS" if stop_result == 0 else "INCOMPLETE")
            if stop_result != 0:
                time.sleep(2)
                stop_result = manager.stop_all()
                stop_attempts.append("PASS" if stop_result == 0 else "INCOMPLETE")
            ports = {
                "postgres": int(config["POSTGRES_PORT"]),
                "redis": int(config["REDIS_PORT"]),
                "minio_api": int(config["MINIO_API_PORT"]),
                "minio_console": int(config["MINIO_CONSOLE_PORT"]),
                "api": int(config["API_PORT"]),
                "web": int(config["PORT"]),
            }
            process_exit = {}
            for name, record in owned_before_stop.items():
                if not record:
                    continue
                pid = int(record["pid"])
                current_ticks = manager.process_start_ticks(pid)
                process_exit[name] = {
                    "pid": pid,
                    "stopped_or_pid_reused": current_ticks != str(record.get("start_ticks")),
                    "record_cleared": manager.read_record(name) is None,
                }
            port_exit = {
                name: {"port": port, "free": not manager.port_listener_pids(port)}
                for name, port in ports.items()
            }
            exit_evidence = {
                "task": "YZ-RD-T025",
                "stopAttempts": stop_attempts,
                "stopResult": "PASS" if stop_result == 0 else "FAIL",
                "processes": process_exit,
                "ports": port_exit,
                "databaseRetained": RUNTIME.joinpath("postgres-data").exists(),
                "minioDataRetained": RUNTIME.joinpath("minio-data").exists(),
                "L4HistoryPostgreSQLDockerVolume": "OPEN_UNTOUCHED",
                "DockerComposeP1SIM": "NOT_USED",
            }
            (EVIDENCE / "runtime-exit.json").parent.mkdir(parents=True, exist_ok=True)
            (EVIDENCE / "runtime-exit.json").write_text(json.dumps(exit_evidence, indent=2), encoding="utf-8")
            print("T025 own native runtime exit: " + ("PASS" if stop_result == 0 else "FAIL"))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"T025 native run failed: {error}", file=sys.stderr)
        raise SystemExit(1)
