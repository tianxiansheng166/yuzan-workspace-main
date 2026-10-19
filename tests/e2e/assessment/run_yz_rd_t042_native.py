#!/usr/bin/env python3
"""Own and verify T042's native Chromium/API/PostgreSQL/Redis/MinIO runtime."""

from __future__ import annotations

import importlib.util
import io
import os
import subprocess
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNNER_SOURCE = ROOT / "tests" / "e2e" / "assessment" / "run_yz_rd_t037_native.py"
RUNTIME = ROOT / "runtime-local" / "native-web-t042"
EVIDENCE = ROOT / "evidence" / "yz-rd-t042"
DATABASE = "yuzan_t042_native"
DB_ROLE = "yz_t042"
BUCKET = "yz-t042-native"
PORTS = {
    "POSTGRES_PORT": "55692",
    "REDIS_PORT": "6492",
    "MINIO_API_PORT": "59492",
    "MINIO_CONSOLE_PORT": "59493",
    "API_PORT": "4192",
    "WEB_PORT": "4392",
}
TEST_FILES = [
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t034_teacher_class_roster.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t037_today_showcase.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t036_student_history.py",
    ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t042_cross_module.py",
]


def load_source_runner():
    spec = importlib.util.spec_from_file_location("yz_rd_t042_runtime_base", RUNNER_SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the existing ownership-aware native runtime harness")
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)

    runner.TASK = "T042"
    runner.RUNTIME = RUNTIME
    runner.EVIDENCE = EVIDENCE
    runner.DATABASE = DATABASE
    runner.DB_ROLE = DB_ROLE
    runner.BUCKET = BUCKET
    runner.PORTS = PORTS
    runner.REPORT_EVIDENCE = RUNTIME / "evidence" / "upstream-report"
    runner.SERVICE_PORTS["minio_console"] = "MINIO_CONSOLE_PORT"

    source_load_manager = runner.load_manager

    def load_manager():
        manager = source_load_manager()
        state_root = Path("/tmp/yz-rd-t042")
        state_dir = state_root / "state"
        socket_dir = state_dir / "socket"
        for path in (state_root, state_dir, socket_dir):
            if path.is_symlink():
                raise RuntimeError("T042 private runtime state path is a symlink; preserving it")
            if path.exists() and (not path.is_dir() or path.stat().st_uid != os.getuid()):
                raise RuntimeError("T042 private runtime state path is not owned by this user; preserving it")
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            path.chmod(0o700)
        manager.STATE = state_dir
        return manager

    runner.load_manager = load_manager
    source_test_environment = runner.test_environment

    def test_environment(manager, config):
        env = source_test_environment(manager, config)
        env.update(
            {
                "YZ_T034_BASE_URL": config["WEB_ORIGIN"],
                "YZ_T034_DATABASE_URL": config["DATABASE_URL"],
                "YZ_T034_PASSWORD": config["E2E_TEST_PASSWORD"],
                "YZ_T034_EVIDENCE_DIR": str(EVIDENCE / "teacher-roster"),
                "YZ_T034_EXPECTED_DATABASE_NAME": DATABASE,
                "YZ_T034_EXPECTED_DATABASE_USER": DB_ROLE,
                "YZ_T036_BASE_URL": config["WEB_ORIGIN"],
                "YZ_T036_DATABASE_URL": config["DATABASE_URL"],
                "YZ_T036_PASSWORD": config["E2E_TEST_PASSWORD"],
                "YZ_T036_PSQL": str(manager.PG_BIN / "psql"),
                "YZ_T036_EVIDENCE_DIR": str(EVIDENCE / "student-history"),
                "YZ_T036_EXPECTED_DATABASE_NAME": DATABASE,
                "YZ_T036_EXPECTED_DATABASE_USER": DB_ROLE,
                "YZ_T042_BASE_URL": config["WEB_ORIGIN"],
                "YZ_T042_API_BASE_URL": config["API_BASE_URL"],
                "YZ_T042_DATABASE_URL": config["DATABASE_URL"],
                "YZ_T042_PASSWORD": config["E2E_TEST_PASSWORD"],
                "YZ_T042_EVIDENCE_DIR": str(EVIDENCE),
                "YZ_T042_CHROMIUM": "/usr/bin/google-chrome",
                "YZ_T042_INTEGRATED_NATIVE": "true",
            }
        )
        return env

    runner.test_environment = test_environment

    def run_e2e(manager, config):
        env = test_environment(manager, config)
        temp_dir = Path("/tmp/yz-rd-t042/chromium")
        temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        temp_dir.chmod(0o700)
        env["TMPDIR"] = str(temp_dir)
        for path in TEST_FILES:
            if not path.is_file():
                raise RuntimeError("Missing T042 integration E2E: " + str(path))
        result = subprocess.run(
            [str(manager.TEST_PYTHON), "-m", "pytest", "-q", "-s", *map(str, TEST_FILES)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=5400,
            check=False,
        )
        output = runner.redact(result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else ""), config)
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        (EVIDENCE / "native-e2e.log").write_text(output, encoding="utf-8")
        print(output[-24000:])
        return result.returncode, output

    runner.run_e2e = run_e2e
    return runner


def main() -> int:
    runner = load_source_runner()
    stdout = io.StringIO()
    stderr = io.StringIO()
    with redirect_stdout(stdout), redirect_stderr(stderr):
        result = runner.main()
    log = (stdout.getvalue() + stderr.getvalue()).replace("T037", "T042")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "native-runtime.log").write_text(log, encoding="utf-8")
    sys.stdout.write(log)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
