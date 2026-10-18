#!/usr/bin/env python3
"""Task-owned wrapper for the repository's native runtime manager."""

from __future__ import annotations

import argparse
import importlib.util
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME_SOURCE = ROOT / "scripts" / "dev-native-web.py"
TASK_RUNTIME = ROOT / "runtime-local" / "native-web-t017"
DATABASE_IDENTITY = ("yuzan_t017_native", "yz_t017")
TASK_PORTS = {
    "API_PORT": "4097",
    "PORT": "4297",
    "POSTGRES_PORT": "55640",
    "REDIS_PORT": "6440",
    "MINIO_API_PORT": "59210",
    "MINIO_CONSOLE_PORT": "59211",
}
SOURCE_PORTS = {
    "API_PORT": "4090",
    "PORT": "4290",
    "POSTGRES_PORT": "55630",
    "REDIS_PORT": "6430",
    "MINIO_API_PORT": "59184",
    "MINIO_CONSOLE_PORT": "59185",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run only YZ-RD-T017 native services using the installed shared toolchain.")
    parser.add_argument("--shared-runtime-root", type=Path, required=True, help="existing runtime-local/native-web toolchain directory")
    args, command_args = parser.parse_known_args()
    shared_root = args.shared_runtime_root.resolve()
    if not (shared_root / "toolchain" / "pgdg" / "usr" / "lib" / "postgresql" / "17" / "bin" / "initdb").is_file():
        raise SystemExit("T017 requires an installed PostgreSQL 17 toolchain")

    spec = importlib.util.spec_from_file_location("native_web_runtime", RUNTIME_SOURCE)
    if spec is None or spec.loader is None:
        raise SystemExit("Unable to load the repository native runtime manager")
    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    original_configure = runtime.configure_task
    original_create_config = runtime.create_local_config

    def configure_t017(_task_id: str, _shared_runtime_root: Path | None = None) -> None:
        original_configure("t011", shared_root)
        runtime.TASK_ID = "T017"
        runtime.RUNTIME = TASK_RUNTIME
        runtime.CONFIG_FILE = TASK_RUNTIME / ".env.local"
        runtime.STATE = TASK_RUNTIME / "state"
        runtime.LOGS = TASK_RUNTIME / "logs"
        runtime.PGDATA = TASK_RUNTIME / "postgres-data"
        runtime.REDIS_DATA = TASK_RUNTIME / "redis-data"
        runtime.MINIO_DATA = TASK_RUNTIME / "minio-data"
        runtime.EVIDENCE = TASK_RUNTIME / "evidence"
        runtime.TOOLCHAIN = shared_root / "toolchain"
        runtime.TASK_BIN = TASK_RUNTIME / "bin"
        runtime.TEST_PYTHON = shared_root / "venv" / "bin" / "python"
        runtime.PG_PREFIX = runtime.TOOLCHAIN / "pgdg"
        runtime.PG_BIN = runtime.PG_PREFIX / "usr" / "lib" / "postgresql" / "17" / "bin"
        runtime.PG_LIBRARY = runtime.PG_PREFIX / "usr" / "lib" / "x86_64-linux-gnu"
        runtime.REDIS_DIR = runtime.TOOLCHAIN / "redis-7.4.10" / "src"
        runtime.MINIO_BIN = runtime.TOOLCHAIN / "bin" / "minio"
        runtime.expected_database_identity = lambda: DATABASE_IDENTITY

    def create_t017_config() -> None:
        config_path = runtime.CONFIG_FILE
        if config_path.exists():
            content = config_path.read_text(encoding="utf-8")
            if "POSTGRES_DB=yuzan_t017_native" not in content or "POSTGRES_USER=yz_t017" not in content:
                raise RuntimeError("Existing T017 config has a different database identity; preserving it")
            if config_path.stat().st_mode & 0o777 != 0o600:
                os.chmod(config_path, 0o600)
            return

        runtime.TASK_ID = "T011"
        original_create_config()
        runtime.TASK_ID = "T017"
        content = config_path.read_text(encoding="utf-8")
        for key, source_port in SOURCE_PORTS.items():
            target_port = TASK_PORTS[key]
            content = re.sub(rf"(?m)^{re.escape(key)}={source_port}$", f"{key}={target_port}", content)
            content = content.replace(f"127.0.0.1:{source_port}", f"127.0.0.1:{target_port}")
        content = content.replace("yz-t011-native", "yz-t017-native")
        content = content.replace("yz_t011_local", "yz_t017_local")
        content = content.replace("yuzan:t011:worker:heartbeat", "yuzan:t017:worker:heartbeat")
        config_path.write_text(content, encoding="utf-8")
        os.chmod(config_path, 0o600)

    runtime.configure_task = configure_t017
    runtime.create_local_config = create_t017_config
    node_bin_dir = str(Path(shutil.which("node") or "").resolve().parent)
    os.environ["PATH"] = node_bin_dir + os.pathsep + os.environ.get("PATH", "")
    if command_args and command_args[0] == "e2e":
        runtime.configure_task("t011", shared_root)
        config = runtime.load_config()
        env = runtime.runtime_env(config)
        env.update({
            "YZ_T017_BASE_URL": config["WEB_ORIGIN"],
            "YZ_T017_API_BASE_URL": config["API_BASE_URL"],
            "YZ_T017_DATABASE_URL": config["DATABASE_URL"],
            "YZ_T017_PASSWORD": config["E2E_TEST_PASSWORD"],
            "YZ_T017_EVIDENCE_DIR": str(ROOT / "evidence" / "yz-rd-t017"),
            "YZ_T017_PG_BIN": str(runtime.PG_BIN),
            "YZ_T017_RUNTIME_ROOT": str(TASK_RUNTIME),
            "POSTGRES_USER": config["POSTGRES_USER"],
            "POSTGRES_PASSWORD": config["POSTGRES_PASSWORD"],
            "POSTGRES_DB": config["POSTGRES_DB"],
            "POSTGRES_PORT": config["POSTGRES_PORT"],
            "S3_ENDPOINT": config["S3_ENDPOINT"],
            "S3_BUCKET": config["S3_BUCKET"],
        })
        test_file = ROOT / "tests" / "e2e" / "course-learning" / "test_yz_rd_t017_student_courses.py"
        result = subprocess.run(
            [str(runtime.TEST_PYTHON), "-m", "pytest", "-q", "-s", str(test_file)],
            cwd=ROOT,
            env=env,
            check=False,
        )
        return result.returncode
    sys.argv = [str(RUNTIME_SOURCE), "--task", "t011", "--shared-runtime-root", str(shared_root), *command_args]
    return runtime.main()


if __name__ == "__main__":
    raise SystemExit(main())
