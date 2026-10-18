#!/usr/bin/env python3
"""Isolated native development runtime for YZ-RD-T009."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import ProxyHandler, build_opener


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime-local" / "native-web"
CONFIG_FILE = RUNTIME / ".env.local"
STATE = RUNTIME / "state"
LOGS = RUNTIME / "logs"
PGDATA = RUNTIME / "postgres-data"
REDIS_DATA = RUNTIME / "redis-data"
MINIO_DATA = RUNTIME / "minio-data"
EVIDENCE = RUNTIME / "evidence"
TOOLCHAIN = RUNTIME / "toolchain"
PG_PREFIX = TOOLCHAIN / "pgdg"
PG_BIN = PG_PREFIX / "usr" / "lib" / "postgresql" / "17" / "bin"
PG_LIBRARY = PG_PREFIX / "usr" / "lib" / "x86_64-linux-gnu"
REDIS_DIR = TOOLCHAIN / "redis-7.4.10" / "src"
MINIO_BIN = TOOLCHAIN / "bin" / "minio"
CHROME = Path("/usr/bin/google-chrome")
TEST_FILE = ROOT / "tests" / "e2e" / "assessment" / "test_yz_rd_t009_native_teacher_dashboard.py"
STORAGE_TEST = ROOT / "backend" / "api" / "test" / "native-local-storage-smoke.mjs"
TEST_REQUIREMENTS = ROOT / "scripts" / "dev-native-web-requirements.txt"

REQUIRED_CONFIG = {
    "API_HOST",
    "API_PORT",
    "API_BASE_URL",
    "DATABASE_URL",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_PORT",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD",
    "SESSION_SECRET",
    "WEB_HOST",
    "WEB_ORIGIN",
    "PORT",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "MINIO_API_PORT",
    "MINIO_CONSOLE_PORT",
    "WORKER_HEARTBEAT_KEY",
    "WORKER_HEARTBEAT_INTERVAL_MS",
    "WORKER_HEARTBEAT_TTL_SECONDS",
    "SPEECH_PROVIDER",
}

SECRET_KEYS = ("POSTGRES_PASSWORD", "REDIS_PASSWORD", "SESSION_SECRET", "S3_SECRET_KEY")
SERVICE_ORDER = ("postgres", "api", "web", "redis", "minio", "worker")
STOP_ORDER = ("worker", "web", "api", "minio", "redis", "postgres")
DIRECT_HTTP = build_opener(ProxyHandler({}))


class RuntimeErrorMessage(Exception):
    pass


def run_output(args: list[str], *, env: dict[str, str] | None = None, cwd: Path | None = None, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def safe_text(value: str, config: dict[str, str] | None = None) -> str:
    result = value
    if config:
        for key in SECRET_KEYS:
            secret = config.get(key)
            if secret:
                result = result.replace(secret, "<redacted>")
        db_url = config.get("DATABASE_URL")
        if db_url:
            result = result.replace(db_url, "<DATABASE_URL redacted>")
    return result


def node_binary() -> Path | None:
    found = shutil.which("node")
    candidates = [Path(found)] if found else []
    candidates.extend(Path(p) for p in Path.home().glob(".nvm/versions/node/v*/bin/node"))
    compatible: list[tuple[tuple[int, ...], Path]] = []
    for candidate in candidates:
        if not candidate.is_file() or not os.access(candidate, os.X_OK):
            continue
        result = run_output([str(candidate), "--version"], timeout=5)
        match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)\s*", result.stdout)
        if match:
            version = tuple(int(part) for part in match.groups())
            if 24 <= version[0] <= 26:
                compatible.append((version, candidate.resolve()))
    return max(compatible, key=lambda item: item[0])[1] if compatible else None


def command_path(name: str) -> Path | None:
    value = shutil.which(name)
    if not value and name == "pnpm":
        candidate = Path.home() / ".local" / "bin" / "pnpm"
        if candidate.is_file() and os.access(candidate, os.X_OK):
            value = str(candidate)
    return Path(value).resolve() if value else None


def config_keys_from_example() -> set[str]:
    path = ROOT / ".env.example"
    if not path.is_file():
        raise RuntimeErrorMessage("仓库 .env.example 不存在，无法按现有配置模板建立隔离环境")
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            keys.add(line.split("=", 1)[0].strip())
    return keys


def create_local_config() -> None:
    if CONFIG_FILE.exists():
        if CONFIG_FILE.stat().st_mode & 0o777 != 0o600:
            os.chmod(CONFIG_FILE, 0o600)
        existing: dict[str, str] = {}
        for raw in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in raw and not raw.lstrip().startswith("#"):
                key, value = raw.split("=", 1)
                existing[key.strip()] = value.strip()
        additions: list[str] = []
        if "S3_ACCESS_KEY_ID" not in existing and existing.get("S3_ACCESS_KEY"):
            additions.append(f"S3_ACCESS_KEY_ID={existing['S3_ACCESS_KEY']}\n")
        if "S3_SECRET_ACCESS_KEY" not in existing and existing.get("S3_SECRET_KEY"):
            additions.append(f"S3_SECRET_ACCESS_KEY={existing['S3_SECRET_KEY']}\n")
        if additions:
            with CONFIG_FILE.open("a", encoding="utf-8") as handle:
                handle.writelines(additions)
            os.chmod(CONFIG_FILE, 0o600)
        return

    template_keys = config_keys_from_example()
    required_template_keys = {
        "API_PORT",
        "DATABASE_URL",
        "POSTGRES_DB",
        "POSTGRES_PASSWORD",
        "POSTGRES_USER",
        "REDIS_HOST",
        "REDIS_PORT",
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "SESSION_SECRET",
        "WEB_ORIGIN",
    }
    missing = sorted(required_template_keys - template_keys)
    if missing:
        raise RuntimeErrorMessage(".env.example 缺少本机开发所需字段: " + ", ".join(missing))

    pg_password = secrets.token_hex(32)
    redis_password = secrets.token_hex(32)
    s3_secret = secrets.token_hex(32)
    values = {
        "NODE_ENV": "development",
        "API_HOST": "127.0.0.1",
        "API_PORT": "4085",
        "API_BASE_URL": "http://127.0.0.1:4085",
        "DATABASE_URL": f"postgresql://yz_t009:{pg_password}@127.0.0.1:55617/yuzan_t009_native?schema=public",
        "POSTGRES_USER": "yz_t009",
        "POSTGRES_PASSWORD": pg_password,
        "POSTGRES_DB": "yuzan_t009_native",
        "POSTGRES_PORT": "55617",
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": "6428",
        "REDIS_PASSWORD": redis_password,
        "SESSION_SECRET": secrets.token_hex(48),
        "WEB_HOST": "127.0.0.1",
        "WEB_ORIGIN": "http://127.0.0.1:4285",
        "PORT": "4285",
        "S3_ENDPOINT": "http://127.0.0.1:59180",
        "S3_REGION": "us-east-1",
        "S3_BUCKET": "yz-t009-native",
        "S3_ACCESS_KEY": "yz_t009_local",
        "S3_SECRET_KEY": s3_secret,
        "S3_ACCESS_KEY_ID": "yz_t009_local",
        "S3_SECRET_ACCESS_KEY": s3_secret,
        "S3_FORCE_PATH_STYLE": "true",
        "MINIO_API_PORT": "59180",
        "MINIO_CONSOLE_PORT": "59181",
        "WORKER_HEARTBEAT_KEY": "yuzan:t009:worker:heartbeat",
        "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
        "WORKER_HEARTBEAT_TTL_SECONDS": "60",
        "SPEECH_PROVIDER": "disabled",
        "LOG_LEVEL": "info",
    }
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    content = "# Local-only native web runtime; derived from .env.example.\n"
    content += "".join(f"{key}={value}\n" for key, value in values.items())
    try:
        descriptor = os.open(CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(CONFIG_FILE, 0o600)


def load_config(*, required: bool = True) -> dict[str, str]:
    if not CONFIG_FILE.is_file():
        if required:
            raise RuntimeErrorMessage("隔离配置不存在；先运行 scripts/dev-native-web start --profile teacher")
        return {}
    mode = CONFIG_FILE.stat().st_mode & 0o777
    if mode != 0o600:
        raise RuntimeErrorMessage(f"隔离配置权限必须为 0600；当前为 {mode:04o}")
    values: dict[str, str] = {}
    for raw in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    missing = sorted(REQUIRED_CONFIG - values.keys())
    if missing:
        raise RuntimeErrorMessage("隔离配置缺少字段: " + ", ".join(missing))

    parsed = urlparse(values["DATABASE_URL"])
    if (
        parsed.scheme != "postgresql"
        or parsed.hostname != "127.0.0.1"
        or parsed.port != int(values["POSTGRES_PORT"])
        or parsed.username != values["POSTGRES_USER"]
        or parsed.path.lstrip("/") != "yuzan_t009_native"
        or values["POSTGRES_DB"] != "yuzan_t009_native"
    ):
        raise RuntimeErrorMessage("DATABASE_URL 必须指向本任务的 127.0.0.1/yuzan_t009_native 隔离数据库")
    if values["POSTGRES_USER"] != "yz_t009":
        raise RuntimeErrorMessage("本机隔离数据库用户必须为 yz_t009")
    if values["REDIS_HOST"] != "127.0.0.1":
        raise RuntimeErrorMessage("REDIS_HOST 必须绑定 127.0.0.1")
    if values["S3_ACCESS_KEY_ID"] != values["S3_ACCESS_KEY"] or values["S3_SECRET_ACCESS_KEY"] != values["S3_SECRET_KEY"]:
        raise RuntimeErrorMessage("本机 MinIO root 凭据与 API S3 凭据必须一致")
    s3 = urlparse(values["S3_ENDPOINT"])
    if s3.hostname != "127.0.0.1" or s3.port != int(values.get("MINIO_API_PORT", "59180")):
        raise RuntimeErrorMessage("S3_ENDPOINT 必须指向本任务的回环 MinIO")
    if values["SPEECH_PROVIDER"] != "disabled":
        raise RuntimeErrorMessage("本机开发环境必须设置 SPEECH_PROVIDER=disabled")
    ports = [int(values[key]) for key in ("POSTGRES_PORT", "API_PORT", "PORT", "REDIS_PORT", "MINIO_API_PORT", "MINIO_CONSOLE_PORT")]
    if any(port < 1024 or port > 65535 for port in ports) or len(set(ports)) != len(ports):
        raise RuntimeErrorMessage("本机端口必须是互不重复的 1024–65535 端口")
    return values


def runtime_env(config: dict[str, str]) -> dict[str, str]:
    inherited_keys = (
        "HOME",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "LOGNAME",
        "PATH",
        "SHELL",
        "TERM",
        "TMPDIR",
        "TZ",
        "USER",
    )
    env = {key: os.environ[key] for key in inherited_keys if key in os.environ}
    env.update(config)
    node = node_binary()
    extra = [str(PG_BIN), str(REDIS_DIR), str(TOOLCHAIN / "bin")]
    if node:
        extra.insert(0, str(node.parent))
    env["PATH"] = os.pathsep.join(value for value in [*extra, env.get("PATH", "")] if value)
    local_library_dirs = [str(path) for path in (PG_LIBRARY, PG_BIN.parent / "lib") if path.is_dir()]
    if local_library_dirs:
        env["LD_LIBRARY_PATH"] = os.pathsep.join([*local_library_dirs, env.get("LD_LIBRARY_PATH", "")]).rstrip(os.pathsep)
    env["HOST"] = config.get("WEB_HOST", "127.0.0.1")
    root_env = ROOT / ".env"
    if root_env.is_file():
        # Prisma's existing config loads the repository .env. Reserve only its
        # key names with empty values so local commands cannot inherit secrets.
        for raw in root_env.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", raw)
            if match:
                env.setdefault(match.group(1), "")
    return env


def db_env(config: dict[str, str]) -> dict[str, str]:
    env = runtime_env(config)
    parsed = urlparse(config["DATABASE_URL"])
    env.update(
        {
            "PGHOST": parsed.hostname or "127.0.0.1",
            "PGPORT": str(parsed.port),
            "PGUSER": parsed.username or config["POSTGRES_USER"],
            "PGPASSWORD": parsed.password or config["POSTGRES_PASSWORD"],
            "PGDATABASE": parsed.path.lstrip("/"),
        }
    )
    return env


def process_start_ticks(pid: int) -> str | None:
    try:
        content = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
        rest = content[content.rfind(")") + 2 :].split()
        return rest[19]
    except (OSError, IndexError):
        return None


def process_cmdline(pid: int) -> str:
    try:
        return Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode("utf-8", "replace").strip()
    except OSError:
        return ""


def process_group(pid: int) -> int | None:
    try:
        content = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
        rest = content[content.rfind(")") + 2 :].split()
        return int(rest[2])
    except (OSError, IndexError, ValueError):
        return None


def process_group_members(pgid: int) -> list[int]:
    members: list[int] = []
    for path in Path("/proc").iterdir():
        if not path.name.isdigit():
            continue
        try:
            content = (path / "stat").read_text(encoding="utf-8")
            rest = content[content.rfind(")") + 2 :].split()
            if int(rest[2]) == pgid and rest[0] != "Z":
                members.append(int(path.name))
        except (OSError, IndexError, ValueError):
            continue
    return members


def port_listener_pids(port: int) -> set[int]:
    ss = command_path("ss")
    if not ss:
        return set()
    result = run_output([str(ss), "-H", "-ltnp"], timeout=5)
    pids: set[int] = set()
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) < 4:
            continue
        local = fields[3].rsplit(":", 1)[-1].strip("]")
        if local != str(port):
            continue
        pids.update(int(value) for value in re.findall(r"pid=(\d+)", line))
    return pids


def http_status(url: str, timeout: float = 2.0) -> int | None:
    try:
        with DIRECT_HTTP.open(url, timeout=timeout) as response:
            return response.status
    except Exception as error:  # health probe only
        if isinstance(error, URLError):
            return getattr(error, "code", None)
        return getattr(error, "code", None)


def service_file(name: str) -> Path:
    return STATE / f"{name}.json"


def read_record(name: str) -> dict[str, object] | None:
    path = service_file(name)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write_record(name: str, record: dict[str, object]) -> None:
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = service_file(name)
    temp = target.with_suffix(f".json.{os.getpid()}.tmp")
    descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(record, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, target)
    os.chmod(target, 0o600)


def record_process_ok(name: str, record: dict[str, object], *, allow_unbound: bool = True) -> tuple[bool, str]:
    try:
        pid = int(record["pid"])
        expected_start = str(record["start_ticks"])
        expected_cmd = str(record["command_token"])
    except (KeyError, TypeError, ValueError):
        return False, "状态记录格式错误"
    actual_start = process_start_ticks(pid)
    if actual_start is None:
        return False, "进程已退出"
    if actual_start != expected_start:
        return False, "PID 已被复用"
    command = process_cmdline(pid)
    executable_matches = False
    if expected_cmd.startswith("/"):
        try:
            executable_matches = Path(f"/proc/{pid}/exe").resolve() == Path(expected_cmd).resolve()
        except OSError:
            executable_matches = False
    if expected_cmd not in command and not executable_matches:
        return False, "命令行与本任务记录不符"
    ports = [int(record["port"])] if record.get("port") else []
    ports.extend(int(port) for port in record.get("extra_ports", []))
    for port in ports:
        owners = port_listener_pids(port)
        if owners and pid not in owners:
            return False, "端口归属其他进程"
        if not owners and not allow_unbound:
            return False, "进程未持有记录端口"
    return True, "运行中"


def open_log(name: str):
    LOGS.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = LOGS / f"{name}.log"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    os.chmod(path, 0o600)
    return os.fdopen(descriptor, "ab", buffering=0)


def ensure_dirs() -> None:
    for path in (RUNTIME, STATE, LOGS, PGDATA, REDIS_DATA, MINIO_DATA, EVIDENCE):
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path != RUNTIME:
            os.chmod(path, 0o700)


def ensure_dependency(name: str, path: Path) -> Path:
    if not path.is_file() or not os.access(path, os.X_OK):
        raise RuntimeErrorMessage(f"缺少本机 {name} 可执行文件: {path}")
    return path


def check_port_available(port: int, *, own_pid: int | None = None) -> None:
    owners = port_listener_pids(port)
    if owners and (own_pid is None or owners != {own_pid}):
        raise RuntimeErrorMessage(f"127.0.0.1:{port} 已由其他进程监听；未尝试占用或停止它")


def task_port_owner(port: int, owners: set[int]) -> int | None:
    for name in SERVICE_ORDER:
        record = read_record(name)
        if not record:
            continue
        record_ports = [int(record["port"])] if record.get("port") else []
        record_ports.extend(int(item) for item in record.get("extra_ports", []))
        if port not in record_ports:
            continue
        okay, _detail = record_process_ok(name, record)
        pid = int(record.get("pid", -1))
        if okay and pid in owners:
            return pid
    return None


def record_for_pid(name: str, pid: int, command_token: str, port: int | None = None, pgid: int | None = None, extra_ports: list[int] | None = None) -> dict[str, object]:
    start = process_start_ticks(pid)
    if start is None:
        raise RuntimeErrorMessage(f"{name} 进程未能保持运行")
    record: dict[str, object] = {
        "owner": "YZ-RD-T009",
        "pid": pid,
        "start_ticks": start,
        "command_token": command_token,
        "port": port,
        "started_at": int(time.time()),
    }
    if pgid is not None:
        record["pgid"] = pgid
    if extra_ports:
        record["extra_ports"] = extra_ports
    write_record(name, record)
    return record


def launch_process(name: str, args: list[str], *, env: dict[str, str], command_token: str, port: int | None = None, extra_ports: list[int] | None = None, cwd: Path = RUNTIME) -> bool:
    previous = read_record(name)
    if previous:
        okay, detail = record_process_ok(name, previous)
        if okay:
            print(f"{name}: 已由本任务启动 (PID {previous['pid']})")
            return False
        if process_start_ticks(int(previous.get("pid", -1))) is not None:
            raise RuntimeErrorMessage(f"{name} 有存活进程但身份校验失败（{detail}），拒绝覆盖状态")
        service_file(name).unlink(missing_ok=True)
    if port:
        check_port_available(port)
    for extra_port in extra_ports or []:
        check_port_available(extra_port)
    output = open_log(name)
    try:
        process = subprocess.Popen(
            args,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
    finally:
        output.close()
    time.sleep(0.4)
    if process.poll() is not None:
        raise RuntimeErrorMessage(f"{name} 启动后立即退出；日志保留在 runtime-local/native-web/logs/{name}.log")
    record_for_pid(name, process.pid, command_token, port, process.pid, extra_ports)
    return True


def wait_for_http(name: str, url: str, *, expected: int = 200, timeout: int = 45) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if http_status(url) == expected:
            print(f"{name}: HTTP {expected} {url}")
            return
        time.sleep(0.5)
    raise RuntimeErrorMessage(f"{name} 健康检查超时: {url}")


def run_checked(args: list[str], *, env: dict[str, str], cwd: Path = ROOT, config: dict[str, str] | None = None, timeout: int = 300) -> str:
    result = run_output(args, env=env, cwd=cwd, timeout=timeout)
    output = safe_text((result.stdout + result.stderr).strip(), config)
    if result.returncode != 0:
        raise RuntimeErrorMessage(f"命令失败（退出码 {result.returncode}）: {' '.join(args)}\n{output[-5000:]}")
    if output:
        print(output[-5000:])
    return output


def ensure_database(config: dict[str, str], env: dict[str, str], created_names: list[str] | None = None) -> bool:
    pg_ctl = ensure_dependency("PostgreSQL pg_ctl", PG_BIN / "pg_ctl")
    initdb = ensure_dependency("PostgreSQL initdb", PG_BIN / "initdb")
    psql = ensure_dependency("PostgreSQL psql", PG_BIN / "psql")
    createdb = ensure_dependency("PostgreSQL createdb", PG_BIN / "createdb")
    share_source = PG_PREFIX / "usr" / "share" / "postgresql" / "17"
    share_link = PG_BIN.parent / "share"
    if share_source.is_dir():
        if share_link.is_symlink():
            if share_link.resolve() != share_source.resolve():
                raise RuntimeErrorMessage("PostgreSQL 隔离工具链 share 链接指向不匹配路径，保留现场")
        elif not share_link.exists():
            share_link.symlink_to(os.path.relpath(share_source, PG_BIN.parent))
        elif share_link.resolve() != share_source.resolve():
            raise RuntimeErrorMessage("PostgreSQL 隔离工具链 share 路径已存在且目标不匹配")
    version_file = PGDATA / "PG_VERSION"
    if not version_file.exists():
        if any(PGDATA.iterdir()):
            raise RuntimeErrorMessage("本任务 PostgreSQL 数据目录非空但无 PG_VERSION，保留现场并拒绝初始化")
        password_file = STATE / f"postgres-init-{os.getpid()}.pw"
        descriptor = os.open(password_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(config["POSTGRES_PASSWORD"] + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        try:
            run_checked(
                [
                    str(initdb),
                    "--pgdata",
                    str(PGDATA),
                    "--username",
                    config["POSTGRES_USER"],
                    "--pwfile",
                    str(password_file),
                    "--auth-local=trust",
                    "--auth-host=scram-sha-256",
                    "--encoding=UTF8",
                    "--locale=C.utf8",
                ],
                env=env,
                config=config,
                timeout=180,
            )
        finally:
            password_file.unlink(missing_ok=True)
    major = version_file.read_text(encoding="utf-8").strip().split(".", 1)[0]
    if major != "17":
        raise RuntimeErrorMessage(f"本任务 PGDATA 已属于 PostgreSQL {major}，拒绝升级或重置")
    conf = PGDATA / "postgresql.conf"
    local_settings = (
        "\n# YZ-RD-T009 isolated native runtime\n"
        "listen_addresses = '127.0.0.1'\n"
        f"port = {int(config['POSTGRES_PORT'])}\n"
        f"unix_socket_directories = '{STATE / 'socket'}'\n"
        "logging_collector = off\n"
        "log_destination = 'stderr'\n"
    )
    content = conf.read_text(encoding="utf-8")
    if "# YZ-RD-T009 isolated native runtime" not in content:
        with conf.open("a", encoding="utf-8") as handle:
            handle.write(local_settings)
    socket_dir = STATE / "socket"
    socket_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(socket_dir, 0o700)
    running = run_output([str(pg_ctl), "--pgdata", str(PGDATA), "status"], env=env, timeout=10)
    created = False
    if running.returncode != 0:
        check_port_available(int(config["POSTGRES_PORT"]), own_pid=None)
        result = run_output(
            [str(pg_ctl), "--pgdata", str(PGDATA), "--log", str(LOGS / "postgres.log"), "--wait", "start"],
            env=env,
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeErrorMessage("PostgreSQL 启动失败: " + safe_text(result.stderr[-2000:], config))
        created = True
        print(safe_text(result.stdout.strip(), config))
    else:
        print("PostgreSQL: 已在本任务 PGDATA 中运行")
    pid_file = PGDATA / "postmaster.pid"
    if not pid_file.is_file():
        raise RuntimeErrorMessage("PostgreSQL 没有生成 postmaster.pid")
    pid = int(pid_file.read_text(encoding="utf-8").splitlines()[0])
    record_for_pid("postgres", pid, str(PGDATA), int(config["POSTGRES_PORT"]))
    if created and created_names is not None:
        created_names.append("postgres")

    base_env = db_env(config)
    base_env["PGDATABASE"] = "postgres"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        ready = run_output([str(PG_BIN / "pg_isready"), "-h", "127.0.0.1", "-p", config["POSTGRES_PORT"]], env=env, timeout=5)
        if ready.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeErrorMessage("PostgreSQL pg_isready 超时")

    exists = run_output(
        [str(psql), "-X", "-A", "-t", "-c", f"SELECT 1 FROM pg_database WHERE datname = '{config['POSTGRES_DB']}';"],
        env=base_env,
        timeout=15,
    )
    if exists.returncode != 0:
        raise RuntimeErrorMessage("无法检查隔离数据库: " + safe_text(exists.stderr, config))
    if exists.stdout.strip() != "1":
        result = run_output(
            [str(createdb), "--host=127.0.0.1", "--port", config["POSTGRES_PORT"], "--username", config["POSTGRES_USER"], config["POSTGRES_DB"]],
            env=base_env,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeErrorMessage("隔离数据库创建失败: " + safe_text(result.stderr, config))
        print("PostgreSQL: 创建了本任务独立数据库 yuzan_t009_native")
    check = run_output(
        [str(psql), "-X", "-A", "-t", "-F", "|", "-c", "SELECT current_database(), current_user, version();"],
        env=db_env(config),
        timeout=15,
    )
    if check.returncode != 0:
        raise RuntimeErrorMessage("PostgreSQL 数据库连接验证失败: " + safe_text(check.stderr, config))
    row = check.stdout.strip()
    if not row.startswith("yuzan_t009_native|yz_t009|PostgreSQL 17."):
        raise RuntimeErrorMessage("PostgreSQL 数据库名、用户或版本不符合本任务隔离配置")
    print("PostgreSQL DB check: " + row.split("|", 2)[0] + " / " + row.split("|", 2)[1] + " / PostgreSQL 17.x")
    return created


def start_postgres(config: dict[str, str], env: dict[str, str], created_names: list[str]) -> bool:
    record = read_record("postgres")
    if record:
        okay, detail = record_process_ok("postgres", record)
        if okay:
            ensure_database(config, env, created_names)
            return False
        if process_start_ticks(int(record.get("pid", -1))) is not None:
            raise RuntimeErrorMessage(f"PostgreSQL 进程身份校验失败（{detail}），拒绝干预")
        service_file("postgres").unlink(missing_ok=True)
    return ensure_database(config, env, created_names)


def redis_config(config: dict[str, str]) -> Path:
    path = RUNTIME / "redis.conf"
    content = "\n".join(
        [
            "bind 127.0.0.1",
            f"port {config['REDIS_PORT']}",
            "protected-mode yes",
            "daemonize no",
            f"dir {REDIS_DATA}",
            "appendonly yes",
            'appendfilename "appendonly.aof"',
            "save 900 1",
            "save 300 10",
            "save 60 10000",
            f"requirepass {config['REDIS_PASSWORD']}",
            "loglevel notice",
        ]
    ) + "\n"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(content)
    os.chmod(path, 0o600)
    return path


def redis_ping(config: dict[str, str], env: dict[str, str]) -> bool:
    redis_cli = REDIS_DIR / "redis-cli"
    if not redis_cli.is_file():
        return False
    redis_env = dict(env)
    redis_env["REDISCLI_AUTH"] = config["REDIS_PASSWORD"]
    result = run_output([str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "PING"], env=redis_env, timeout=5)
    return result.returncode == 0 and result.stdout.strip() == "PONG"


def start_redis(config: dict[str, str], env: dict[str, str], created_names: list[str]) -> bool:
    binary = ensure_dependency("Redis 7 redis-server", REDIS_DIR / "redis-server")
    conf = redis_config(config)
    created = launch_process(
        "redis",
        [str(binary), str(conf)],
        env=env,
        command_token=str(binary),
        port=int(config["REDIS_PORT"]),
    )
    if created:
        created_names.append("redis")
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if redis_ping(config, env):
            print(f"Redis PING: PONG at 127.0.0.1:{config['REDIS_PORT']}")
            return created
        time.sleep(0.5)
    raise RuntimeErrorMessage("Redis PING 检查超时")


def minio_health(config: dict[str, str]) -> bool:
    return http_status(f"{config['S3_ENDPOINT']}/minio/health/live") == 200


def start_minio(config: dict[str, str], env: dict[str, str], created_names: list[str]) -> bool:
    binary = ensure_dependency("MinIO Server", MINIO_BIN)
    port = int(config["MINIO_API_PORT"])
    console_port = int(config["MINIO_CONSOLE_PORT"])
    check_port_available(console_port)
    local_env = dict(env)
    local_env["MINIO_ROOT_USER"] = config["S3_ACCESS_KEY"]
    local_env["MINIO_ROOT_PASSWORD"] = config["S3_SECRET_KEY"]
    created = launch_process(
        "minio",
        [str(binary), "server", "--address", f"127.0.0.1:{port}", "--console-address", f"127.0.0.1:{console_port}", str(MINIO_DATA)],
        env=local_env,
        command_token=str(binary),
        port=port,
        extra_ports=[console_port],
    )
    if created:
        created_names.append("minio")
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        record = read_record("minio")
        minio_pid = int(record["pid"]) if record else -1
        console_owned = minio_pid in port_listener_pids(console_port)
        if minio_health(config) and console_owned:
            print(f"MinIO health: HTTP 200 at {config['S3_ENDPOINT']}/minio/health/live; console port {console_port} owned")
            return created
        time.sleep(0.5)
    raise RuntimeErrorMessage("MinIO Health 检查超时")


def worker_heartbeat(config: dict[str, str], env: dict[str, str]) -> bool:
    redis_cli = REDIS_DIR / "redis-cli"
    redis_env = dict(env)
    redis_env["REDISCLI_AUTH"] = config["REDIS_PASSWORD"]
    result = run_output(
        [str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "GET", config["WORKER_HEARTBEAT_KEY"]],
        env=redis_env,
        timeout=5,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return False
    try:
        written_at_ms = int(result.stdout.strip())
    except ValueError:
        return False
    age_ms = int(time.time() * 1000) - written_at_ms
    return 0 <= age_ms <= int(config["WORKER_HEARTBEAT_INTERVAL_MS"]) * 2


def start_worker(config: dict[str, str], env: dict[str, str], created_names: list[str]) -> bool:
    main = ROOT / "backend" / "worker" / "dist" / "main.js"
    node = node_binary()
    if not node or not main.is_file():
        raise RuntimeErrorMessage("Worker 的 Node.js 或 dist/main.js 缺失")
    previous = read_record("worker")
    previous_running = bool(previous and record_process_ok("worker", previous)[0])
    if not previous_running:
        redis_cli = ensure_dependency("Redis 7 redis-cli", REDIS_DIR / "redis-cli")
        redis_env = dict(env)
        redis_env["REDISCLI_AUTH"] = config["REDIS_PASSWORD"]
        cleared = run_output(
            [str(redis_cli), "-h", config["REDIS_HOST"], "-p", config["REDIS_PORT"], "DEL", config["WORKER_HEARTBEAT_KEY"]],
            env=redis_env,
            timeout=5,
        )
        if cleared.returncode != 0:
            raise RuntimeErrorMessage("无法清理本任务 Redis 中过期的 Worker 心跳键")
    created = launch_process("worker", [str(node), str(main)], env=env, command_token=str(main))
    if created:
        created_names.append("worker")
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if worker_heartbeat(config, env):
            print("Worker heartbeat: Redis key 已更新；SPEECH_PROVIDER=disabled")
            return created
        time.sleep(0.5)
    raise RuntimeErrorMessage("Worker 未能在 Redis 写入心跳")


def start_web_api(config: dict[str, str], env: dict[str, str], created: list[str]) -> None:
    api_main = ROOT / "backend" / "api" / "dist" / "main.js"
    web_main = ROOT / "frontend" / "server.mjs"
    node = node_binary()
    if not node:
        raise RuntimeErrorMessage("需要 Node.js 24–26")
    if not api_main.is_file():
        raise RuntimeErrorMessage("API build 后仍未生成 backend/api/dist/main.js")
    if not (previous := read_record("api")) or not record_process_ok("api", previous)[0]:
        was_created = launch_process("api", [str(node), str(api_main)], env=env, command_token=str(api_main), port=int(config["API_PORT"]))
        if was_created:
            created.append("api")
    wait_for_http("API live", f"{config['API_BASE_URL']}/api/v1/health/live")

    if not (previous := read_record("web")) or not record_process_ok("web", previous)[0]:
        was_created = launch_process("web", [str(node), str(web_main)], env=env, command_token=str(web_main), port=int(config["PORT"]))
        if was_created:
            created.append("web")
    wait_for_http("Teacher Web", f"{config['WEB_ORIGIN']}/teacher/")


def prepare_database_and_api(config: dict[str, str], env: dict[str, str], created: list[str]) -> None:
    start_postgres(config, env, created)
    pnpm = command_path("pnpm")
    if not pnpm:
        raise RuntimeErrorMessage("缺少 pnpm 10")
    run_checked([str(pnpm), "--filter", "@yuzan/database", "generate"], env=env, config=config, timeout=300)
    run_checked([str(pnpm), "--filter", "@yuzan/database", "migrate:deploy"], env=env, config=config, timeout=300)
    run_checked([str(pnpm), "--filter", "@yuzan/database", "seed"], env=env, config=config, timeout=600)
    run_checked([str(pnpm), "--filter", "@yuzan/api", "build"], env=env, config=config, timeout=600)


def stop_service(name: str, config: dict[str, str], *, quiet: bool = False) -> bool:
    record = read_record(name)
    if not record:
        if not quiet:
            print(f"{name}: 无本任务 PID 记录；未停止任何进程")
        return True
    try:
        pid = int(record["pid"])
    except (KeyError, TypeError, ValueError):
        if not quiet:
            print(f"{name}: 状态记录无效，保留记录且未停止进程")
        return False
    actual_start = process_start_ticks(pid)
    if actual_start is None:
        service_file(name).unlink(missing_ok=True)
        if not quiet:
            print(f"{name}: 原进程已退出；清理了本任务的陈旧 PID 记录")
        return True
    okay, detail = record_process_ok(name, record, allow_unbound=True)
    if not okay:
        if not quiet:
            print(f"{name}: 身份/端口校验失败（{detail}）；拒绝停止")
        return False

    if name == "postgres":
        pg_ctl = PG_BIN / "pg_ctl"
        result = run_output([str(pg_ctl), "--pgdata", str(PGDATA), "--mode=fast", "--wait", "stop"], env=runtime_env(config), timeout=45)
        if result.returncode != 0:
            if not quiet:
                print("PostgreSQL 停止失败；数据目录保留，日志保留")
                print(safe_text(result.stderr[-1000:], config))
            return False
    else:
        try:
            if name == "test":
                pgid = int(record.get("pgid", pid))
                if process_group(pid) != pgid:
                    if not quiet:
                        print("test: 进程组与本任务记录不符；拒绝停止")
                    return False
                os.killpg(pgid, signal.SIGTERM)
            else:
                os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        process_gone = process_start_ticks(pid) != actual_start
        group_gone = name != "test" or not process_group_members(int(record.get("pgid", pid)))
        if process_gone and group_gone:
            service_file(name).unlink(missing_ok=True)
            if not quiet:
                print(f"{name}: 已停止 (PID {pid})")
            return True
        time.sleep(0.25)
    if not quiet:
        print(f"{name}: 收到 TERM 后仍在运行；保留 PID 记录，未强制终止")
    return False


def cleanup_created(names: list[str], config: dict[str, str]) -> None:
    for name in reversed(names):
        stop_service(name, config, quiet=False)


def command_version(binary: Path | None, args: list[str], *, env: dict[str, str] | None = None) -> str:
    if not binary or not binary.is_file():
        return "MISSING"
    result = run_output([str(binary), *args], env=env, timeout=10)
    value = (result.stdout or result.stderr).strip().splitlines()
    return value[0] if value else "UNKNOWN"


def doctor(profile: str) -> int:
    config = load_config(required=False)
    check_env = runtime_env(config)
    print(f"Runtime: {RUNTIME}")
    print(f"Host: {platform.system()} {platform.machine()}")
    print("Root .env: " + ("存在；未读取或改写" if (ROOT / ".env").exists() else "不存在"))
    print("Local config: " + ("present (0600, values hidden)" if config else "missing; start will create a 0600 isolated file"))
    node = node_binary()
    print(f"Node.js: {command_version(node, ['--version'])} ({node or 'missing'})")
    pnpm = command_path("pnpm")
    pnpm_version = command_version(pnpm, ["--version"])
    print(f"pnpm: {pnpm_version} ({pnpm or 'missing'})")
    corepack = command_path("corepack")
    print(f"corepack: {command_version(corepack, ['--version'])} ({corepack or 'missing'})")
    postgres = PG_BIN / "postgres"
    psql = PG_BIN / "psql"
    print(f"PostgreSQL: {command_version(postgres if postgres.is_file() else None, ['--version'], env=check_env)} ({postgres if postgres.is_file() else 'missing'})")
    print(f"psql: {command_version(psql if psql.is_file() else None, ['--version'], env=check_env)} ({psql if psql.is_file() else 'missing'})")
    for tool in ("pg_ctl", "initdb", "pg_isready", "createdb"):
        path = PG_BIN / tool
        print(f"{tool}: {command_version(path if path.is_file() else None, ['--version'], env=check_env)} ({path if path.is_file() else 'missing'})")
    redis_server = REDIS_DIR / "redis-server"
    redis_cli = REDIS_DIR / "redis-cli"
    print(f"Redis: {command_version(redis_server if redis_server.is_file() else None, ['--version'])} ({redis_server if redis_server.is_file() else 'missing'})")
    print(f"redis-cli: {command_version(redis_cli if redis_cli.is_file() else None, ['--version'])} ({redis_cli if redis_cli.is_file() else 'missing'})")
    print(f"MinIO: {command_version(MINIO_BIN if MINIO_BIN.is_file() else None, ['--version'])} ({MINIO_BIN if MINIO_BIN.is_file() else 'missing'})")
    mc = TOOLCHAIN / "bin" / "mc"
    print(f"mc: {command_version(mc if mc.is_file() else None, ['--version'])} ({mc if mc.is_file() else 'missing'})")
    ffmpeg = command_path("ffmpeg")
    print(f"ffmpeg: {command_version(ffmpeg, ['--version'])} ({ffmpeg or 'missing'})")
    chrome = command_path("google-chrome")
    print(f"Chromium: {command_version(chrome, ['--version'])}")
    python = RUNTIME / "venv" / "bin" / "python"
    if python.is_file():
        result = run_output([str(python), "-c", "from importlib.metadata import version; print('pytest='+version('pytest')); print('playwright='+version('playwright'))"], timeout=10)
        print("Python Playwright: " + (result.stdout.strip() if result.returncode == 0 else "MISSING"))
    else:
        print("Python Playwright: MISSING (needed for Chromium regression)")
    port_conflicts: list[str] = []
    if config:
        print(f"Environment permission: {CONFIG_FILE.stat().st_mode & 0o777:04o}")
        print(f"PostgreSQL data permission: {PGDATA.stat().st_mode & 0o777:04o}" if PGDATA.exists() else "PostgreSQL data directory: not initialized")
        ports = {
            "PostgreSQL": int(config["POSTGRES_PORT"]),
            "API": int(config["API_PORT"]),
            "Web": int(config["PORT"]),
        }
        if profile == "full":
            ports.update({"Redis": int(config["REDIS_PORT"]), "MinIO API": int(config["MINIO_API_PORT"]), "MinIO Console": int(config["MINIO_CONSOLE_PORT"])})
        for name, port in ports.items():
            owners = sorted(port_listener_pids(port))
            owner = task_port_owner(port, set(owners)) if owners else None
            if owner:
                detail = f"owned by this runtime PID {owner}"
            elif owners:
                detail = f"BLOCKED by PID(s) {owners}"
                port_conflicts.append(f"{name}:{port}")
            else:
                detail = "available"
            print(f"Port {name} 127.0.0.1:{port}: {detail}")
    missing: list[str] = []
    if not node:
        missing.append("Node.js 24–26")
    if not pnpm:
        missing.append("pnpm 10")
    elif not re.fullmatch(r"10\.\d+\.\d+", pnpm_version):
        missing.append("pnpm 10")
    for name, path in (("PostgreSQL 17", PG_BIN / "postgres"), ("psql", PG_BIN / "psql")):
        if not path.is_file():
            missing.append(name)
    if profile == "full":
        if not (REDIS_DIR / "redis-server").is_file():
            missing.append("Redis 7")
        if not MINIO_BIN.is_file():
            missing.append("MinIO")
    if missing or port_conflicts:
        if missing:
            print("Doctor: BLOCKED / missing: " + ", ".join(missing))
        if port_conflicts:
            print("Doctor: BLOCKED / occupied ports: " + ", ".join(port_conflicts))
        return 1
    print(f"Doctor: PASS for profile {profile}")
    return 0


def service_health(name: str, record: dict[str, object] | None, config: dict[str, str]) -> tuple[str, str, str]:
    if name == "test":
        if not record:
            return "STOPPED", "-", "no active isolated test process"
        okay, detail = record_process_ok(name, record)
        return ("RUNNING" if okay else "IDENTITY_ERROR", str(record.get("pid", "?")), detail)
    port: int | None = None
    if name == "postgres":
        port = int(config["POSTGRES_PORT"])
    elif name == "api":
        port = int(config["API_PORT"])
    elif name == "web":
        port = int(config["PORT"])
    elif name == "redis":
        port = int(config["REDIS_PORT"])
    elif name == "minio":
        port = int(config["MINIO_API_PORT"])
    if not record:
        owners = port_listener_pids(port) if port else set()
        return "NOT_OWNED", "-", f"port owned by {sorted(owners)}" if owners else "stopped"
    okay, detail = record_process_ok(name, record)
    pid = str(record.get("pid", "?"))
    port_text = str(port) if port else "—"
    if not okay:
        return "IDENTITY_ERROR", pid, detail
    if name == "postgres":
        check = run_output([str(PG_BIN / "pg_isready"), "-h", "127.0.0.1", "-p", str(port)], env=runtime_env(config), timeout=5)
        return ("UP" if check.returncode == 0 else "DOWN", pid, f"127.0.0.1:{port}")
    if name == "api":
        status = http_status(f"{config['API_BASE_URL']}/api/v1/health/live")
        return ("UP" if status == 200 else "DOWN", pid, f"127.0.0.1:{port} HTTP {status}")
    if name == "web":
        status = http_status(f"{config['WEB_ORIGIN']}/teacher/")
        return ("UP" if status == 200 else "DOWN", pid, f"127.0.0.1:{port} HTTP {status}")
    if name == "redis":
        okay = redis_ping(config, runtime_env(config))
        return ("UP" if okay else "DOWN", pid, f"127.0.0.1:{port} PING {'PONG' if okay else 'FAIL'}")
    if name == "minio":
        console_port = int(config["MINIO_CONSOLE_PORT"])
        console_owned = int(record["pid"]) in port_listener_pids(console_port)
        okay = minio_health(config) and console_owned
        return ("UP" if okay else "DOWN", pid, f"127.0.0.1:{port} health {'PASS' if okay else 'FAIL'}; console 127.0.0.1:{console_port} {'owned' if console_owned else 'down'}")
    if name == "worker":
        okay = worker_heartbeat(config, runtime_env(config))
        return ("UP" if okay else "DOWN", pid, f"Redis heartbeat {'PASS' if okay else 'missing'}")
    return "UNKNOWN", pid, port_text


def status() -> int:
    try:
        config = load_config(required=False)
    except RuntimeErrorMessage as error:
        print(f"Config: ERROR ({error})")
        config = {}
    if not config:
        print("Runtime status: not configured / not started")
        return 0
    overall = 0
    print("SERVICE  PID     PORT / HEALTH")
    for name in SERVICE_ORDER:
        record = read_record(name)
        if name in ("redis", "minio", "worker") and not record:
            continue
        health, pid, detail = service_health(name, record, config)
        if health in ("DOWN", "IDENTITY_ERROR"):
            overall = 1
        print(f"{name:<8} {pid:<7} {detail} [{health}]")
    test_record = read_record("test")
    if test_record:
        health, pid, detail = service_health("test", test_record, config)
        print(f"{'test':<8} {pid:<7} {detail} [{health}]")
    ready = http_status(f"{config['API_BASE_URL']}/api/v1/health/ready")
    print(f"API dependency readiness: HTTP {ready if ready is not None else 'unreachable'}")
    if ready not in (200, None):
        print("  teacher profile may run with Redis/MinIO pending; full profile requires HTTP 200")
        if all(read_record(name) for name in ("redis", "minio", "worker")):
            overall = 1
    return overall


def start(profile: str) -> int:
    create_local_config()
    config = load_config()
    ensure_dirs()
    env = runtime_env(config)
    missing: list[str] = []
    if not node_binary() or not command_path("pnpm"):
        missing.append("Node.js 24–26 and pnpm 10")
    if not (PG_BIN / "initdb").is_file():
        missing.append("PostgreSQL 17 binaries")
    if profile == "full" and not (REDIS_DIR / "redis-server").is_file():
        missing.append("Redis 7 binaries")
    if profile == "full" and not MINIO_BIN.is_file():
        missing.append("MinIO Server binary")
    if missing:
        print("Start blocked: " + ", ".join(missing))
        return 1
    created: list[str] = []
    try:
        prepare_database_and_api(config, env, created)
        start_web_api(config, env, created)
        if profile == "full":
            start_redis(config, env, created)
            start_minio(config, env, created)
            if run_test("storage") != 0:
                raise RuntimeErrorMessage("MinIO S3 smoke test failed")
            if http_status(f"{config['API_BASE_URL']}/api/v1/health/ready", timeout=3) != 200:
                raise RuntimeErrorMessage("API 依赖 readiness 未通过（需要 PostgreSQL、Redis、MinIO 均 UP）")
            pnpm = str(command_path("pnpm"))
            run_checked([pnpm, "--filter", "@yuzan/worker", "build"], env=env, config=config, timeout=600)
            start_worker(config, env, created)
        print(f"Start: PASS --profile {profile}")
        print(f"Teacher Web: {config['WEB_ORIGIN']}/teacher/")
        print(f"API live: {config['API_BASE_URL']}/api/v1/health/live")
        if profile == "full":
            print("API readiness: HTTP 200; Redis, MinIO, Worker connected")
        return 0
    except (RuntimeErrorMessage, subprocess.TimeoutExpired, OSError) as error:
        print("Start failed: " + safe_text(str(error), config))
        if created:
            print("Stopping only services created by this start attempt:")
            cleanup_created(created, config)
        return 1


def run_test(suite: str) -> int:
    config = load_config()
    env = runtime_env(config)
    if suite == "teacher-dashboard":
        python = RUNTIME / "venv" / "bin" / "python"
        if not python.is_file():
            raise RuntimeErrorMessage("缺少 runtime-local/native-web/venv；先运行 scripts/dev-native-web setup-test")
        env["YZ_T009_BASE_URL"] = config["WEB_ORIGIN"]
        env["YZ_T009_DATABASE_URL"] = config["DATABASE_URL"]
        env["YZ_T009_EVIDENCE_DIR"] = str(EVIDENCE)
        args = [str(python), "-m", "pytest", "-q", str(TEST_FILE)]
        port = None
    else:
        node = node_binary()
        if not node or not STORAGE_TEST.is_file():
            raise RuntimeErrorMessage("缺少 Node.js 或 MinIO 存储 smoke test")
        args = [str(node), str(STORAGE_TEST)]
        port = None
    test_record = read_record("test")
    if test_record and record_process_ok("test", test_record)[0]:
        raise RuntimeErrorMessage("本任务已有回归测试正在运行")
    process = subprocess.Popen(
        args,
        cwd=ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    record_for_pid("test", process.pid, str(TEST_FILE if suite == "teacher-dashboard" else STORAGE_TEST), port, process.pid)
    try:
        output, _ = process.communicate()
    finally:
        current = read_record("test")
        if current and int(current.get("pid", -1)) == process.pid:
            service_file("test").unlink(missing_ok=True)
    print(safe_text(output, config))
    print(f"Test suite {suite}: {'PASS' if process.returncode == 0 else 'FAIL'}")
    return process.returncode or 0


def setup_test_environment() -> int:
    venv = RUNTIME / "venv"
    python = venv / "bin" / "python"
    if not python.is_file():
        result = run_output([sys.executable, "-m", "venv", str(venv)], cwd=ROOT, timeout=120)
        if result.returncode != 0:
            raise RuntimeErrorMessage("创建本机隔离 Python venv 失败: " + result.stderr[-1000:])
    pip = venv / "bin" / "pip"
    result = run_output(
        [str(pip), "install", "--disable-pip-version-check", "--index-url", "https://pypi.org/simple", "-r", str(TEST_REQUIREMENTS)],
        cwd=ROOT,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeErrorMessage("安装隔离 Chromium 回归依赖失败: " + result.stderr[-2000:])
    print("Python regression environment: PASS (runtime-local/native-web/venv)")
    print(run_output([str(python), "-c", "from importlib.metadata import version; print('pytest='+version('pytest')); print('playwright='+version('playwright'))"], cwd=ROOT, timeout=10).stdout.strip())
    return 0


def stop_all() -> int:
    try:
        config = load_config(required=False)
    except RuntimeErrorMessage as error:
        print(f"Config warning: {error}")
        config = {}
    if not config:
        print("No isolated config; no process was stopped")
        return 0
    result = 0
    for name in ("test", *STOP_ORDER):
        if read_record(name) and not stop_service(name, config):
            result = 1
    print("Stop: " + ("PASS" if result == 0 else "INCOMPLETE; see identity checks above"))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Isolated native Web/API development runtime; no container runtime is used.")
    sub = parser.add_subparsers(dest="command", required=True)
    doctor_parser = sub.add_parser("doctor", help="check local versions, dependencies, ports, and permissions")
    doctor_parser.add_argument("--profile", choices=("teacher", "full"), default="teacher")
    start_parser = sub.add_parser("start", help="start the isolated runtime")
    start_parser.add_argument("--profile", choices=("teacher", "full"), default="teacher")
    sub.add_parser("status", help="show owned processes, ports, and health")
    sub.add_parser("stop", help="stop only verified YZ-RD-T009 processes")
    test_parser = sub.add_parser("test", help="run an isolated targeted regression")
    test_parser.add_argument("suite", choices=("teacher-dashboard", "storage"))
    sub.add_parser("setup-test", help="install pinned pytest and Playwright into the ignored local venv")
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            return doctor(args.profile)
        if args.command == "start":
            return start(args.profile)
        if args.command == "status":
            return status()
        if args.command == "stop":
            return stop_all()
        if args.command == "test":
            return run_test(args.suite)
        if args.command == "setup-test":
            return setup_test_environment()
    except (RuntimeErrorMessage, OSError, subprocess.TimeoutExpired) as error:
        print("ERROR: " + str(error))
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
