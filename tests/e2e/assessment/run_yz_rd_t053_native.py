#!/usr/bin/env python3
"""Task-owned native Chromium/API/PostgreSQL/Redis/MinIO run for T053."""

from __future__ import annotations

import builtins
import hashlib
import importlib.util
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SOURCE_RUNNER = ROOT / "tests" / "e2e" / "assessment" / "run_yz_rd_t037_native.py"
RUNTIME = ROOT / "runtime-local" / "native-web-t053-r1"
SHARED_RUNTIME = Path("/home/tian/code/yuzan-workspace-main/runtime-local/native-web")
EVIDENCE = ROOT / "evidence" / "yz-rd-t053"
DATABASE = "yuzan_t053_native"
DB_ROLE = "yz_t053"
BUCKET = "yz-t053-native"
PORTS = {
    "POSTGRES_PORT": "55753",
    "REDIS_PORT": "6553",
    "MINIO_API_PORT": "62153",
    "MINIO_CONSOLE_PORT": "62154",
    "API_PORT": "4253",
    "WEB_PORT": "4453",
}
TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t053_unified_course_speech.py"
NODE = Path.home() / ".nvm" / "versions" / "node" / "v24.20.0" / "bin" / "node"
SERVICE_PORTS = {
    "postgres": "POSTGRES_PORT",
    "redis": "REDIS_PORT",
    "minio": "MINIO_API_PORT",
    "api": "API_PORT",
    "web": "PORT",
}
PIDS_BEFORE_STOP: dict[str, int | None] = {}


def load_source_runner():
    spec = importlib.util.spec_from_file_location("yz_rd_t053_native_source", SOURCE_RUNNER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the established ownership-aware native runtime runner")
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)
    runner.TASK = "T053"
    runner.RUNTIME = RUNTIME
    runner.SHARED_RUNTIME = SHARED_RUNTIME
    runner.EVIDENCE = EVIDENCE
    runner.DATABASE = DATABASE
    runner.DB_ROLE = DB_ROLE
    runner.BUCKET = BUCKET
    runner.PORTS = PORTS
    runner.TEST_FILE = TEST_FILE
    runner.SERVICE_PORTS = SERVICE_PORTS
    runner.PIDS_BEFORE_STOP = PIDS_BEFORE_STOP

    def load_manager():
        manager_path = ROOT / "scripts" / "dev-native-web.py"
        manager_spec = importlib.util.spec_from_file_location("yz_rd_t053_runtime_manager", manager_path)
        if manager_spec is None or manager_spec.loader is None:
            raise RuntimeError("Cannot load the ownership-aware native runtime manager")
        manager = importlib.util.module_from_spec(manager_spec)
        sys.modules[manager_spec.name] = manager
        manager_spec.loader.exec_module(manager)
        manager.TASK_ID = runner.TASK
        manager.BASE_RUNTIME = SHARED_RUNTIME
        manager.RUNTIME = RUNTIME
        manager.CONFIG_FILE = RUNTIME / ".env.local"
        state_root = Path("/tmp/yz-rd-t053-r1")
        state_dir = state_root / "state"
        socket_dir = state_dir / "socket"
        for path in (state_root, state_dir, socket_dir):
            if path.is_symlink():
                raise RuntimeError("T053 private runtime state path is a symlink; preserving it")
            if path.exists() and (not path.is_dir() or path.stat().st_uid != os.getuid()):
                raise RuntimeError("T053 private runtime state path is not owned by this user; preserving it")
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
        manager.node_binary = lambda: NODE
        manager.command_version = lambda binary, args, env=None: runner.command_version(Path(binary) if binary else None, args)
        manager.expected_database_identity = lambda: (DATABASE, DB_ROLE)
        manager.create_local_config = lambda: runner.create_config(manager)
        manager.prepare_database_and_api = lambda config, env, created: runner.prepare_database_and_api(manager, config, env, created)
        return manager

    runner.load_manager = load_manager
    def import_level_one_question_bank(manager, config, env):
        source_dir = Path("/home/tian/code/yuzan-workspace-main/习题课程资源")
        required = ("题库【三改】.docx", "答案及评分细则.docx", "题库音频及图片.zip")
        missing = [name for name in required if not (source_dir / name).is_file()]
        if missing:
            raise RuntimeError("Read-only Level 1 Question Bank source is incomplete: " + ", ".join(missing))

        def snapshot():
            values = []
            for name in required:
                path = source_dir / name
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                values.append((name, path.stat().st_size, digest))
            return values

        before = snapshot()
        pnpm = manager.command_path("pnpm")
        args = [
            "--level", "1",
            "--school-id", "11111111-1111-4111-8111-111111111111",
            "--class-id", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            "--source-dir", str(source_dir),
        ]
        dry_run = manager.run_checked(
            [str(pnpm), "qb:source:apply", "--", *args], env=env, config=config, timeout=3600
        )
        if "DRY RUN" not in dry_run or "NO DATABASE WRITE" not in dry_run or "NO MINIO WRITE" not in dry_run:
            raise RuntimeError("Level 1 Question Bank preflight did not confirm no writes")
        (EVIDENCE / "question-bank-level-1-preflight.txt").write_text(dry_run, encoding="utf-8")
        manager.run_checked(
            [str(pnpm), "qb:source:apply", "--", "--apply", *args], env=env, config=config, timeout=3600
        )
        after = snapshot()
        if before != after:
            raise RuntimeError("Read-only Question Bank source changed during Level 1 runtime apply")
        print("T053 Question Bank import: Level 1 only; Levels 2–6 were not applied")
        return "LEVEL_1_ONLY_PASS", "evidence/yz-rd-t053/question-bank-level-1-preflight.txt"

    runner.import_question_bank = import_level_one_question_bank
    original_create_config = runner.create_config

    def create_config(manager):
        original_create_config(manager)
        config_text = manager.CONFIG_FILE.read_text(encoding="utf-8")
        config_text = config_text.replace("Local-only T037 runtime credentials", "Local-only T053 runtime credentials")
        manager.CONFIG_FILE.write_text(config_text, encoding="utf-8")
        manager.CONFIG_FILE.chmod(0o600)

    runner.create_config = create_config

    original_test_environment = runner.test_environment

    def test_environment(manager, config):
        env = original_test_environment(manager, config)
        api_root = config["API_BASE_URL"]
        psql = str(manager.PG_BIN / "psql")
        common = {
            "YZ_T053_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T053_API_BASE_URL": api_root,
            "YZ_T053_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T053_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T053_CHROMIUM": "/usr/bin/google-chrome",
            "YZ_T053_EVIDENCE_DIR": str(EVIDENCE),
            "YZ_T022_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T022_API_BASE_URL": api_root,
            "YZ_T022_EVIDENCE_DIR": str(EVIDENCE),
            "YZ_T022_PSQL": psql,
            "YZ_T022_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
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
        for prefix in ("T048", "T010"):
            env.update({
                f"YZ_{prefix}_BASE_URL": config["WEB_ORIGIN"],
                f"YZ_{prefix}_API_BASE_URL": api_root,
                f"YZ_{prefix}_DATABASE_URL": config["DATABASE_URL"],
                f"YZ_{prefix}_PASSWORD": config["E2E_TEST_PASSWORD"],
                f"YZ_{prefix}_DATABASE_NAME": DATABASE,
                f"YZ_{prefix}_DATABASE_USER": DB_ROLE,
                f"YZ_{prefix}_POSTGRES_PORT": config["POSTGRES_PORT"],
                f"YZ_{prefix}_EVIDENCE_DIR": str(EVIDENCE),
                f"YZ_{prefix}_S3_BUCKET": BUCKET,
                f"YZ_{prefix}_S3_ENDPOINT": config["S3_ENDPOINT"],
                f"YZ_{prefix}_S3_REGION": config["S3_REGION"],
                f"YZ_{prefix}_S3_ACCESS_KEY": config["S3_ACCESS_KEY"],
                f"YZ_{prefix}_S3_SECRET_KEY": config["S3_SECRET_KEY"],
                f"YZ_{prefix}_API_PACKAGE": str(ROOT / "backend" / "api" / "package.json"),
                f"YZ_{prefix}_MINIO_API_PORT": config["MINIO_API_PORT"],
            })
        env["YZ_NATIVE_TASK_ID"] = "T053"
        return env

    def run_e2e(manager, config):
        env = test_environment(manager, config)
        temp_dir = Path("/tmp/yz-rd-t053-r1/chromium")
        temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        temp_dir.chmod(0o700)
        env["TMPDIR"] = str(temp_dir)
        if not TEST_FILE.is_file():
            raise RuntimeError("Missing T053 native E2E: " + str(TEST_FILE))
        result = subprocess.run(
            [str(manager.TEST_PYTHON), "-m", "pytest", "-q", "-s", str(TEST_FILE)],
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

    runner.test_environment = test_environment
    runner.run_e2e = run_e2e
    return runner


if __name__ == "__main__":
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    native_runner = load_source_runner()
    native_runner.print = lambda *args, **kwargs: builtins.print(
        *(str(value).replace("T037", "T053") for value in args), **kwargs
    )
    raise SystemExit(native_runner.main())
