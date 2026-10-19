#!/usr/bin/env python3
"""Task-owned integrated native Chromium/API/PostgreSQL/Redis/MinIO run for T047."""

from __future__ import annotations

import importlib.util
import builtins
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SOURCE_RUNNER = ROOT / "tests" / "e2e" / "assessment" / "run_yz_rd_t037_native.py"
RUNTIME = ROOT / "runtime-local" / "native-web-t047"
SHARED_RUNTIME = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
EVIDENCE = ROOT / "evidence" / "yz-rd-t047"
DATABASE = "yuzan_t047_native"
DB_ROLE = "yz_t047"
BUCKET = "yz-t047-native"
PORTS = {
    "POSTGRES_PORT": "55747",
    "REDIS_PORT": "6547",
    "MINIO_API_PORT": "59747",
    "MINIO_CONSOLE_PORT": "59748",
    "API_PORT": "4247",
    "WEB_PORT": "4447",
}
TEST_FILES = [
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t037_today_showcase.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_qb017a_student_today.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t044_practice_catalog.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t045_practice_catalog.py",
]
REPORT_TEST_FILES = [
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t037_today_showcase.py",
]


def load_source_runner():
    spec = importlib.util.spec_from_file_location("yz_rd_t047_native_source", SOURCE_RUNNER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the established task-owned native runtime helpers")
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)

    runner.TASK = "T047"
    runner.RUNTIME = RUNTIME
    runner.SHARED_RUNTIME = SHARED_RUNTIME
    runner.EVIDENCE = EVIDENCE / "e2e" / "today-and-report"
    runner.DATABASE = DATABASE
    runner.DB_ROLE = DB_ROLE
    runner.BUCKET = BUCKET
    runner.PORTS = PORTS
    runner.SERVICE_PORTS = {
        "postgres": "POSTGRES_PORT",
        "redis": "REDIS_PORT",
        "minio": "MINIO_API_PORT",
        "api": "API_PORT",
        "web": "PORT",
    }
    runner.REPORT_EVIDENCE = RUNTIME / "evidence" / "upstream-report"
    runner.PIDS_BEFORE_STOP = {}

    original_command_version = runner.command_version

    def command_version(binary: Path | None, args: list[str]) -> str:
        try:
            return original_command_version(binary, args)
        except subprocess.TimeoutExpired:
            if binary and Path(binary) == Path("/usr/bin/google-chrome"):
                return "TIMEOUT"
            raise

    runner.command_version = command_version

    def load_manager():
        manager_path = ROOT / "scripts" / "dev-native-web.py"
        manager_spec = importlib.util.spec_from_file_location("yz_rd_t047_runtime_manager", manager_path)
        if manager_spec is None or manager_spec.loader is None:
            raise RuntimeError("Cannot load the ownership-aware native runtime manager")
        manager = importlib.util.module_from_spec(manager_spec)
        sys.modules[manager_spec.name] = manager
        manager_spec.loader.exec_module(manager)

        manager.TASK_ID = runner.TASK
        manager.BASE_RUNTIME = SHARED_RUNTIME
        manager.RUNTIME = RUNTIME
        manager.CONFIG_FILE = RUNTIME / ".env.local"
        state_root = Path("/tmp/yz-rd-t047")
        state_dir = state_root / "state"
        socket_dir = state_dir / "socket"
        for path in (state_root, state_dir, socket_dir):
            if path.is_symlink():
                raise RuntimeError("T047 private runtime state path is a symlink; preserving it")
            if path.exists() and (not path.is_dir() or path.stat().st_uid != os.getuid()):
                raise RuntimeError("T047 private runtime state path is not owned by this user; preserving it")
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            path.chmod(0o700)
        manager.STATE = state_dir
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
        manager.node_binary = lambda: runner.NODE
        manager.command_version = lambda binary, args, env=None: runner.command_version(
            Path(binary) if binary else None, args
        )
        original_wait_for_http = manager.wait_for_http

        def wait_for_http(name, url, *, expected=200, timeout=45):
            # The host was heavily contended during the first attempt. Keep the
            # health gate fail-closed, but allow the isolated API longer to boot.
            return original_wait_for_http(name, url, expected=expected, timeout=max(timeout, 180))

        manager.wait_for_http = wait_for_http
        manager.expected_database_identity = lambda: (DATABASE, DB_ROLE)
        manager.create_local_config = lambda: runner.create_config(manager)
        manager.prepare_database_and_api = lambda config, env, created: runner.prepare_database_and_api(
            manager, config, env, created
        )
        return manager

    runner.load_manager = load_manager
    original_create_config = runner.create_config

    def create_config(manager):
        original_create_config(manager)
        config_text = manager.CONFIG_FILE.read_text(encoding="utf-8")
        config_text = config_text.replace("Local-only T037 runtime credentials", "Local-only T047 runtime credentials")
        config_text = config_text.replace("yuzan:t037:worker:heartbeat", "yuzan:t047:worker:heartbeat")
        manager.CONFIG_FILE.write_text(config_text, encoding="utf-8")
        manager.CONFIG_FILE.chmod(0o600)

    runner.create_config = create_config

    original_test_environment = runner.test_environment

    def test_environment(manager, config):
        env = original_test_environment(manager, config)
        e2e_root = EVIDENCE / "e2e"
        env.update(
            {
                "YZ_T044_BASE_URL": config["WEB_ORIGIN"],
                "YZ_T044_DATABASE_URL": config["DATABASE_URL"],
                "YZ_T044_PASSWORD": config["E2E_TEST_PASSWORD"],
                "YZ_T044_EVIDENCE_DIR": str(e2e_root / "t044-catalog"),
                "YZ_T044_PSQL": str(manager.PG_BIN / "psql"),
                "YZ_T044_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
                "YZ_T044_S3_BUCKET": config["S3_BUCKET"],
                "YZ_T044_S3_ENDPOINT": config["S3_ENDPOINT"],
                "YZ_T044_S3_REGION": config["S3_REGION"],
                "YZ_T044_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
                "YZ_T044_S3_SECRET_KEY": config["S3_SECRET_KEY"],
                "YZ_T044_POSTGRES_PORT": config["POSTGRES_PORT"],
                "YZ_T044_POSTGRES_USER": DB_ROLE,
                "YZ_T044_POSTGRES_DB": DATABASE,
                "YZ_T044_EXPECTED_DATABASE": DATABASE,
                "YZ_T044_EXPECTED_DATABASE_USER": DB_ROLE,
                "YZ_T045_BASE_URL": config["WEB_ORIGIN"],
                "YZ_T045_DATABASE_URL": config["DATABASE_URL"],
                "YZ_T045_PASSWORD": config["E2E_TEST_PASSWORD"],
                "YZ_T045_EVIDENCE_DIR": str(e2e_root / "t045-mobile-catalog"),
                "YZ_T045_PSQL": str(manager.PG_BIN / "psql"),
                "YZ_T045_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
                "YZ_T045_S3_BUCKET": config["S3_BUCKET"],
                "YZ_T045_S3_ENDPOINT": config["S3_ENDPOINT"],
                "YZ_T045_S3_REGION": config["S3_REGION"],
                "YZ_T045_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
                "YZ_T045_S3_SECRET_KEY": config["S3_SECRET_KEY"],
                "YZ_T045_POSTGRES_PORT": config["POSTGRES_PORT"],
                "YZ_T045_POSTGRES_USER": DB_ROLE,
                "YZ_T045_POSTGRES_DB": DATABASE,
                "YZ_T045_EXPECTED_DATABASE": DATABASE,
                "YZ_T045_EXPECTED_DATABASE_USER": DB_ROLE,
                "QB_RELEASE_BASE_URL": config["WEB_ORIGIN"],
                "QB_RELEASE_DATABASE_URL": config["DATABASE_URL"],
                "QB_RELEASE_PSQL": str(manager.PG_BIN / "psql"),
                "QB_RELEASE_PG_LIBRARY": str(manager.PG_LIBRARY),
                "QB_RELEASE_DB_USER": DB_ROLE,
                "QB_RELEASE_DB_NAME": DATABASE,
                # The older report proof's integrated path navigates to the
                # API-resolved practice ID instead of using its legacy tile selector.
                "YZ_T042_INTEGRATED_NATIVE": "true",
            }
        )
        return env

    def run_e2e(manager, config):
        env = test_environment(manager, config)
        report_only = os.environ.get("YZ_T047_REPORT_ONLY") == "1"
        test_files = REPORT_TEST_FILES if report_only else TEST_FILES
        temp_dir = Path("/tmp/yz-rd-t047/chromium")
        temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        temp_dir.chmod(0o700)
        env["TMPDIR"] = str(temp_dir)
        for path in test_files:
            if not path.is_file():
                raise RuntimeError("Missing T047 integrated native E2E: " + str(path))
        result = subprocess.run(
            [str(manager.TEST_PYTHON), "-m", "pytest", "-q", "-s", *map(str, test_files)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=5400,
            check=False,
        )
        output = runner.redact(
            result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else ""), config
        )
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        log_name = "native-e2e-report-replay.log" if report_only else "native-e2e-full.log"
        (EVIDENCE / log_name).write_text(output, encoding="utf-8")
        print(output[-24000:])
        return result.returncode, output

    runner.test_environment = test_environment
    runner.run_e2e = run_e2e
    return runner


if __name__ == "__main__":
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    native_runner = load_source_runner()
    native_runner.print = lambda *args, **kwargs: builtins.print(
        *(str(value).replace("T037", "T047") for value in args), **kwargs
    )
    raise SystemExit(native_runner.main())
