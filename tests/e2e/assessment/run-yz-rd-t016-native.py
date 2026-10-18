#!/usr/bin/env python3
"""Run the T016 acceptance in its own native PostgreSQL/API/web runtime."""

from __future__ import annotations

import importlib.util
import os
import secrets
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SHARED_TOOLCHAIN = Path(
    os.environ.get(
        "YZ_T016_TOOLCHAIN_ROOT",
        "/home/tian/code/yuzan-workspace-main/runtime-local/native-web",
    )
).resolve()
RUNTIME = ROOT / "runtime-local" / "native-web-t016"
EVIDENCE = ROOT / "evidence" / "yz-rd-t016"
TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t016_student_navigation.py"
DATABASE_NAME = "yuzan_t016_navigation"
DATABASE_USER = "yz_t016"
PORTS = {
    "POSTGRES_PORT": "55639",
    "API_PORT": "4096",
    "PORT": "4296",
    "REDIS_PORT": "6439",
    "MINIO_API_PORT": "59204",
    "MINIO_CONSOLE_PORT": "59205",
}
BUCKET = "yz-t016-navigation"


def prepare_runtime(native):
    native.TASK_ID = "T016"
    native.RUNTIME = RUNTIME
    native.CONFIG_FILE = RUNTIME / ".env.local"
    native.STATE = RUNTIME / "state"
    native.LOGS = RUNTIME / "logs"
    native.PGDATA = RUNTIME / "postgres-data"
    native.REDIS_DATA = RUNTIME / "redis-data"
    native.MINIO_DATA = RUNTIME / "minio-data"
    native.EVIDENCE = RUNTIME / "evidence"
    native.TASK_BIN = RUNTIME / "bin"
    native.expected_database_identity = lambda: (DATABASE_NAME, DATABASE_USER)

    def create_t016_config():
        RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
        if native.CONFIG_FILE.exists():
            config = native.load_config()
            if config["POSTGRES_DB"] != DATABASE_NAME or config["POSTGRES_USER"] != DATABASE_USER:
                raise RuntimeError("现有 T016 配置数据库身份不匹配，保留现场")
            for key, value in PORTS.items():
                if config[key] != value:
                    raise RuntimeError("现有 T016 配置端口与本次任务端口不匹配，保留现场")
            if config["S3_BUCKET"] != BUCKET:
                raise RuntimeError("现有 T016 配置存储桶不匹配，保留现场")
            return

        db_password = secrets.token_urlsafe(32)
        redis_password = secrets.token_urlsafe(32)
        s3_secret = secrets.token_urlsafe(32)
        values = {
            "NODE_ENV": "development",
            "API_HOST": "127.0.0.1",
            "API_PORT": PORTS["API_PORT"],
            "API_BASE_URL": "http://127.0.0.1:" + PORTS["API_PORT"],
            "DATABASE_URL": (
                "postgresql://" + DATABASE_USER + ":" + db_password + "@127.0.0.1:"
                + PORTS["POSTGRES_PORT"] + "/" + DATABASE_NAME + "?schema=public"
            ),
            "POSTGRES_USER": DATABASE_USER,
            "POSTGRES_PASSWORD": db_password,
            "POSTGRES_DB": DATABASE_NAME,
            "POSTGRES_PORT": PORTS["POSTGRES_PORT"],
            "REDIS_HOST": "127.0.0.1",
            "REDIS_PORT": PORTS["REDIS_PORT"],
            "REDIS_PASSWORD": redis_password,
            "SESSION_SECRET": secrets.token_urlsafe(48),
            "WEB_HOST": "127.0.0.1",
            "WEB_ORIGIN": "http://127.0.0.1:" + PORTS["PORT"],
            "PORT": PORTS["PORT"],
            "S3_ENDPOINT": "http://127.0.0.1:" + PORTS["MINIO_API_PORT"],
            "S3_REGION": "us-east-1",
            "S3_BUCKET": BUCKET,
            "S3_ACCESS_KEY": DATABASE_USER + "_local",
            "S3_SECRET_KEY": s3_secret,
            "S3_ACCESS_KEY_ID": DATABASE_USER + "_local",
            "S3_SECRET_ACCESS_KEY": s3_secret,
            "S3_FORCE_PATH_STYLE": "true",
            "MINIO_API_PORT": PORTS["MINIO_API_PORT"],
            "MINIO_CONSOLE_PORT": PORTS["MINIO_CONSOLE_PORT"],
            "WORKER_HEARTBEAT_KEY": "yuzan:t016:worker:heartbeat",
            "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
            "WORKER_HEARTBEAT_TTL_SECONDS": "60",
            "SPEECH_PROVIDER": "disabled",
            "LOG_LEVEL": "info",
            "E2E_TEST_PASSWORD": "YuzanTest!2026",
        }
        native.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor = os.open(native.CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write("# T016 isolated native test runtime; do not commit.\n")
            handle.writelines(key + "=" + value + "\n" for key, value in values.items())
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(native.CONFIG_FILE, 0o600)

    native.create_local_config = create_t016_config
    original_configure = native.configure_task

    def configure_t016(_task_id, shared_runtime_root=None):
        original_configure("t011", shared_runtime_root or SHARED_TOOLCHAIN)
        prepare_runtime(native)

    native.configure_task = configure_t016
    return native


def load_native_manager():
    manager_file = ROOT / "scripts" / "dev-native-web.py"
    spec = importlib.util.spec_from_file_location("yz_t016_native_manager", manager_file)
    if spec is None or spec.loader is None:
        raise RuntimeError("无法加载仓库现有原生服务管理器")
    native = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = native
    spec.loader.exec_module(native)
    return prepare_runtime(native)


def invoke_native(native, *arguments):
    saved_argv = sys.argv
    sys.argv = [
        str(ROOT / "scripts" / "dev-native-web.py"),
        "--task",
        "t011",
        "--shared-runtime-root",
        str(SHARED_TOOLCHAIN),
        *arguments,
    ]
    try:
        return native.main()
    finally:
        sys.argv = saved_argv


def run_browser_test(native):
    config = native.load_config()
    env = native.runtime_env(config)
    env.update(
        {
            "YZ_T016_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T016_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T016_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T016_POSTGRES_PORT": config["POSTGRES_PORT"],
            "YZ_T016_POSTGRES_USER": config["POSTGRES_USER"],
            "YZ_T016_POSTGRES_DB": config["POSTGRES_DB"],
            "YZ_T016_PSQL": str(native.PG_BIN / "psql"),
            "YZ_T016_CHROME": str(native.CHROME),
            "YZ_T016_SCREENSHOT_DIR": str(EVIDENCE / "screenshots"),
        }
    )
    python = native.TEST_PYTHON
    if not python.is_file():
        raise RuntimeError("复用自 T009 的 Playwright 测试环境不存在")
    result = subprocess.run(
        [str(python), "-m", "pytest", "-q", "-s", str(TEST_FILE)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    output = native.safe_text(result.stdout + result.stderr, config)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "chromium-api-postgres-e2e.log").write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    if result.returncode:
        raise RuntimeError("T016 Chromium/API/PostgreSQL E2E failed with exit " + str(result.returncode))
    return 0


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode not in {"all", "start", "stop", "status"}:
        print("Usage: run-yz-rd-t016-native.py [all|start|stop|status]", file=sys.stderr)
        return 2

    native = load_native_manager()
    if mode == "status":
        return invoke_native(native, "status")
    if mode == "stop":
        return invoke_native(native, "stop")
    if mode == "start":
        if invoke_native(native, "doctor", "--profile", "assessment"):
            return 1
        return invoke_native(native, "start", "--profile", "assessment")

    started = False
    result = 1
    try:
        if invoke_native(native, "doctor", "--profile", "assessment"):
            return 1
        if invoke_native(native, "start", "--profile", "assessment"):
            return 1
        started = True
        result = run_browser_test(native)
    finally:
        stop_result = invoke_native(native, "stop")
        if stop_result:
            print("T016 stop retry: checking stale records after the owned processes exited.")
            stop_result = invoke_native(native, "stop")
        status_result = invoke_native(native, "status")
        if stop_result:
            result = 1
        print("T016 native PostgreSQL/API/web/Redis/MinIO cleanup: " + ("PASS" if stop_result == 0 else "FAIL"))
        if status_result:
            result = 1
    return result


if __name__ == "__main__":
    raise SystemExit(main())
