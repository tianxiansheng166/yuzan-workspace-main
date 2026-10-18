#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
RUNTIME_DIR="$(printenv YZ_T012_RUNTIME_ROOT || true)"
if [[ -z "$RUNTIME_DIR" ]]; then
  RUNTIME_DIR="$ROOT_DIR/runtime-local/native-web-t012"
fi
TOOLCHAIN_ROOT="$(printenv YZ_T012_TOOLCHAIN_ROOT || true)"
if [[ -z "$TOOLCHAIN_ROOT" ]]; then
  TOOLCHAIN_ROOT="$(dirname "$ROOT_DIR")/yuzan-workspace-main/runtime-local/native-web"
fi
cd "$ROOT_DIR"
EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t012"
CONFIG_FILE="$RUNTIME_DIR/.env.local"
PGDATA="$RUNTIME_DIR/postgres-data"
REDIS_DATA="$RUNTIME_DIR/redis-data"
MINIO_DATA="$RUNTIME_DIR/minio-data"
LOG_DIR="$RUNTIME_DIR/logs"
STATE_DIR="$RUNTIME_DIR/state"
PG_BIN="$TOOLCHAIN_ROOT/toolchain/pgdg/usr/lib/postgresql/17/bin"
PG_LIBRARY="$TOOLCHAIN_ROOT/toolchain/pgdg/usr/lib/x86_64-linux-gnu"
REDIS_BIN="$TOOLCHAIN_ROOT/toolchain/redis-7.4.10/src"
MINIO_BIN="$TOOLCHAIN_ROOT/toolchain/bin/minio"
PYTHON="$TOOLCHAIN_ROOT/venv/bin/python"
REDIS_CONF="$RUNTIME_DIR/redis-t012.conf"

PG_STARTED=0
REDIS_PID=""
MINIO_PID=""
API_PID=""
WEB_PID=""
REDIS_PASSWORD=""
POSTGRES_PASSWORD=""
PG_PORT="55637"
REDIS_PORT="6437"
MINIO_PORT="59200"
MINIO_CONSOLE_PORT="59201"
API_PORT="4094"
WEB_PORT="4294"
POSTGRES_USER="yz_t012"
POSTGRES_DB="yuzan_t012_native"
S3_BUCKET="yz-t012-native"

mkdir -p "$RUNTIME_DIR" "$PGDATA" "$REDIS_DATA" "$MINIO_DATA" "$LOG_DIR" "$STATE_DIR" "$EVIDENCE_DIR"
chmod 700 "$RUNTIME_DIR" "$PGDATA" "$REDIS_DATA" "$MINIO_DATA" "$LOG_DIR" "$STATE_DIR"

for required in "$PG_BIN/initdb" "$PG_BIN/pg_ctl" "$PG_BIN/psql" "$PG_BIN/createdb" "$REDIS_BIN/redis-server" "$REDIS_BIN/redis-cli" "$MINIO_BIN" "$PYTHON"; do
  if [[ ! -x "$required" ]]; then
    echo "T012 requires the existing T009 native toolchain; missing executable: $required" >&2
    exit 1
  fi
done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$node_major" != "24" ]] || [[ "$(pnpm --version)" != "10.13.1" ]]; then
  echo "T012 expects the installed Node 24 and pnpm 10.13.1 toolchain." >&2
  exit 1
fi
"$PYTHON" -c 'import playwright; print("T012 Playwright: installed")'
node --version
pnpm --version
"$MINIO_BIN" --version
"$PG_BIN/postgres" --version
"$REDIS_BIN/redis-server" --version

export PATH="$PG_BIN:$REDIS_BIN:$(dirname "$MINIO_BIN"):$PATH"
export LD_LIBRARY_PATH="$PG_LIBRARY"
export YZ_T012_PSQL="$PG_BIN/psql"

check_ports_available() {
  python3 - "$PG_PORT" "$REDIS_PORT" "$MINIO_PORT" "$MINIO_CONSOLE_PORT" "$API_PORT" "$WEB_PORT" <<'PY'
import socket
import sys

conflicts = []
for value in sys.argv[1:]:
    port = int(value)
    probe = socket.socket()
    probe.settimeout(0.25)
    try:
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            conflicts.append(port)
    finally:
        probe.close()
if conflicts:
    raise SystemExit("T012 refuses occupied ports: " + ", ".join(map(str, conflicts)))
PY
}

create_config() {
  python3 - "$CONFIG_FILE" "$ROOT_DIR" <<'PY'
import os
import secrets
import sys
from pathlib import Path

path = Path(sys.argv[1])
root = Path(sys.argv[2])
if path.exists():
    values = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    expected = {
        "POSTGRES_DB": "yuzan_t012_native",
        "POSTGRES_USER": "yz_t012",
        "POSTGRES_PORT": "55637",
        "REDIS_PORT": "6437",
        "MINIO_API_PORT": "59200",
        "MINIO_CONSOLE_PORT": "59201",
        "API_PORT": "4094",
        "PORT": "4294",
        "S3_BUCKET": "yz-t012-native",
    }
    if any(values.get(key) != value for key, value in expected.items()):
        raise SystemExit("Refusing a T012 runtime config with a different database, bucket, or port identity.")
    if path.stat().st_mode & 0o777 != 0o600:
        raise SystemExit("T012 runtime config must stay mode 0600.")
    print("T012 isolated configuration: verified")
    raise SystemExit(0)

pg_password = secrets.token_hex(32)
redis_password = secrets.token_hex(32)
s3_secret = secrets.token_hex(32)
session_secret = secrets.token_hex(48)
internal_key = secrets.token_hex(32)
web_origin = "http://127.0.0.1:4294"
api_base = "http://127.0.0.1:4094"
values = {
    "NODE_ENV": "development",
    "API_HOST": "127.0.0.1",
    "API_PORT": "4094",
    "API_BASE_URL": api_base,
    "DATABASE_URL": f"postgresql://yz_t012:{pg_password}@127.0.0.1:55637/yuzan_t012_native?schema=public",
    "POSTGRES_USER": "yz_t012",
    "POSTGRES_PASSWORD": pg_password,
    "POSTGRES_DB": "yuzan_t012_native",
    "POSTGRES_PORT": "55637",
    "POSTGRES_VOLUME_NAME": "yz-rd-t012-native",
    "REDIS_HOST": "127.0.0.1",
    "REDIS_PORT": "6437",
    "REDIS_PASSWORD": redis_password,
    "SESSION_SECRET": session_secret,
    "ACCESS_TOKEN_TTL_SECONDS": "900",
    "REFRESH_TOKEN_TTL_SECONDS": "1209600",
    "WEB_HOST": "127.0.0.1",
    "WEB_ORIGIN": web_origin,
    "PORT": "4294",
    "S3_ENDPOINT": "http://127.0.0.1:59200",
    "S3_REGION": "us-east-1",
    "S3_BUCKET": "yz-t012-native",
    "S3_ACCESS_KEY": "yz_t012_local",
    "S3_SECRET_KEY": s3_secret,
    "S3_ACCESS_KEY_ID": "yz_t012_local",
    "S3_SECRET_ACCESS_KEY": s3_secret,
    "S3_FORCE_PATH_STYLE": "true",
    "MINIO_API_PORT": "59200",
    "MINIO_CONSOLE_PORT": "59201",
    "MINIO_API_CORS_ALLOW_ORIGIN": web_origin,
    "SPEECH_PROVIDER": "disabled",
    "SPEECH_API_TIMEOUT_MS": "60000",
    "SPEECH_API_MAX_RETRIES": "0",
    "API_INTERNAL_URL": api_base + "/api/v1/internal",
    "API_INTERNAL_KEY": internal_key,
    "FLOWISE_BASE_URL": "http://127.0.0.1:4300",
    "FLOWISE_FLOW_ID": "",
    "FLOWISE_API_KEY": "",
    "WORKER_HEARTBEAT_KEY": "yuzan:t012:worker:heartbeat",
    "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
    "WORKER_HEARTBEAT_TTL_SECONDS": "60",
    "LOG_LEVEL": "info",
    "E2E_TEST_PASSWORD": "YuzanTest!2026",
}
path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
    handle.write("# T012-only local native runtime configuration\n")
    handle.writelines(f"{key}={value}\n" for key, value in values.items())
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(path, 0o600)
print("T012 isolated configuration: created")
PY
}

stop_pid() {
  local pid="$1"
  local token="$2"
  local name="$3"
  local command_line=""
  local attempt
  if [[ -z "$pid" ]]; then return 0; fi
  if ! kill -0 "$pid" 2>/dev/null; then wait "$pid" 2>/dev/null || true; return 0; fi
  if [[ -r "/proc/$pid/cmdline" ]]; then
    command_line="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  fi
  if [[ "$token" == exe:* ]]; then
    local expected_executable
    local actual_executable
    expected_executable="$(printf '%s' "$token" | sed 's/^exe://')"
    actual_executable="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
    if [[ "$actual_executable" != "$(readlink -f "$expected_executable")" ]]; then
      echo "$name executable identity did not match T012; refusing to stop PID $pid." >&2
      return 1
    fi
  elif [[ "$command_line" != *"$token"* ]]; then
    echo "$name PID identity did not match T012; refusing to stop PID $pid." >&2
    return 1
  fi
  kill -TERM "$pid" 2>/dev/null || true
  for attempt in $(seq 1 40); do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
      echo "$name: stopped"
      return 0
    fi
    sleep 0.25
  done
  echo "$name PID $pid did not exit after TERM; no KILL was sent." >&2
  return 1
}

stop_owned_runtime() {
  local failed=0
  if [[ -n "$WEB_PID" ]]; then stop_pid "$WEB_PID" "frontend/server.mjs" "T012 Web" || failed=1; fi
  if [[ -n "$API_PID" ]]; then stop_pid "$API_PID" "backend/api/dist/main.js" "T012 API" || failed=1; fi
  if [[ -n "$MINIO_PID" ]]; then stop_pid "$MINIO_PID" "exe:$MINIO_BIN" "T012 MinIO" || failed=1; fi
  if [[ -n "$REDIS_PID" ]]; then
    redis_server_pid="$(REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" --raw INFO server 2>/dev/null | awk -F: '$1 == "process_id" { gsub("\r", "", $2); print $2; exit }' || true)"
    if [[ "$redis_server_pid" == "$REDIS_PID" ]]; then
      REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
    fi
    stop_pid "$REDIS_PID" "exe:$REDIS_BIN/redis-server" "T012 Redis" || failed=1
  fi
  if [[ "$PG_STARTED" == "1" ]]; then
    if "$PG_BIN/pg_ctl" --pgdata "$PGDATA" --mode=fast --wait --timeout=45 stop >/dev/null; then
      echo "T012 PostgreSQL: stopped"
    else
      echo "T012 PostgreSQL did not stop cleanly; PGDATA was preserved." >&2
      failed=1
    fi
    PG_STARTED=0
  fi
  return "$failed"
}

wait_http() {
  local url="$1"
  local attempt
  for attempt in $(seq 1 120); do
    if python3 - "$url" <<'PY'
import sys
import urllib.request

try:
    urllib.request.urlopen(sys.argv[1], timeout=1).close()
except Exception as error:
    if getattr(error, "code", None) is not None:
        raise SystemExit(0)
    raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep 0.5
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

trap 'stop_owned_runtime' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

check_ports_available
create_config
set -a
source "$CONFIG_FILE"
set +a
REDIS_PASSWORD="$REDIS_PASSWORD"
POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
export API_HOST API_PORT API_BASE_URL DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT
export REDIS_HOST REDIS_PORT REDIS_PASSWORD SESSION_SECRET WEB_ORIGIN PORT
export S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_FORCE_PATH_STYLE
export MINIO_API_PORT MINIO_CONSOLE_PORT MINIO_API_CORS_ALLOW_ORIGIN SPEECH_PROVIDER LOG_LEVEL
export WORKER_HEARTBEAT_KEY WORKER_HEARTBEAT_INTERVAL_MS WORKER_HEARTBEAT_TTL_SECONDS
export API_INTERNAL_URL API_INTERNAL_KEY E2E_TEST_PASSWORD
export YZ_T012_POSTGRES_PORT="$POSTGRES_PORT"
export YZ_T012_POSTGRES_USER="$POSTGRES_USER"
export YZ_T012_POSTGRES_DB="$POSTGRES_DB"
export YZ_T012_S3_BUCKET="$S3_BUCKET"
export YZ_T012_BASE_URL="http://127.0.0.1:$PORT"
export YZ_T012_DATABASE_URL="$DATABASE_URL"
export YZ_T012_TEST_PASSWORD="$E2E_TEST_PASSWORD"
export YZ_T012_EVIDENCE_DIR="$EVIDENCE_DIR"

if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  if [[ -n "$(ls -A "$PGDATA")" ]]; then
    echo "T012 PGDATA is non-empty without PG_VERSION; refusing to initialize or erase it." >&2
    exit 1
  fi
  password_file="$STATE_DIR/postgres-password"
  printf '%s\n' "$POSTGRES_PASSWORD" > "$password_file"
  chmod 600 "$password_file"
  "$PG_BIN/initdb" --pgdata "$PGDATA" --username "$POSTGRES_USER" --pwfile "$password_file" --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --locale=C.utf8
  rm -f "$password_file"
elif [[ "$(cat "$PGDATA/PG_VERSION")" != 17 ]]; then
  echo "T012 PGDATA is not PostgreSQL 17; refusing to start it." >&2
  exit 1
fi

PG_CONF="$PGDATA/postgresql.conf"
mkdir -p "$STATE_DIR/socket"
if ! rg -q "# YZ-RD-T012 isolated native runtime" "$PG_CONF"; then
  cat >> "$PG_CONF" <<EOF

# YZ-RD-T012 isolated native runtime
listen_addresses = '127.0.0.1'
port = $POSTGRES_PORT
unix_socket_directories = '$STATE_DIR/socket'
logging_collector = off
log_destination = 'stderr'
EOF
fi
if ! "$PG_BIN/pg_ctl" --pgdata "$PGDATA" status >/dev/null 2>&1; then
  PG_STARTED=1
  "$PG_BIN/pg_ctl" --pgdata "$PGDATA" --log "$LOG_DIR/postgres.log" --wait --timeout=60 start
else
  echo "T012 PGDATA already has a live PostgreSQL process; refusing to reuse a service from another invocation." >&2
  exit 1
fi
export PGHOST="127.0.0.1"
export PGPORT="$POSTGRES_PORT"
export PGUSER="$POSTGRES_USER"
export PGPASSWORD="$POSTGRES_PASSWORD"
export PGDATABASE="postgres"
if ! "$PG_BIN/psql" -X -A -t -c "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB';" | rg -q '^1$'; then
  "$PG_BIN/createdb" --host=127.0.0.1 --port "$POSTGRES_PORT" --username "$POSTGRES_USER" "$POSTGRES_DB"
fi
export PGDATABASE="$POSTGRES_DB"
identity="$("$PG_BIN/psql" -X -A -t -F '|' -c 'SELECT current_database(), current_user, version();')"
if [[ "$identity" != yuzan_t012_native\|yz_t012\|PostgreSQL\ 17.* ]]; then
  echo "T012 PostgreSQL identity did not match its isolated database/user/version." >&2
  exit 1
fi
echo "T012 PostgreSQL identity: yuzan_t012_native / yz_t012 / PostgreSQL 17"

cat > "$REDIS_CONF" <<EOF
bind 127.0.0.1
port $REDIS_PORT
protected-mode yes
daemonize no
dir $REDIS_DATA
appendonly yes
appendfilename "appendonly.aof"
save 900 1
save 300 10
save 60 10000
requirepass $REDIS_PASSWORD
loglevel notice
EOF
chmod 600 "$REDIS_CONF"
"$REDIS_BIN/redis-server" "$REDIS_CONF" > "$LOG_DIR/redis.log" 2>&1 &
REDIS_PID=$!
printf '%s\n' "$REDIS_PID" > "$STATE_DIR/redis.pid"
redis_ready=0
for attempt in $(seq 1 40); do
  if REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" PING 2>/dev/null | rg -q '^PONG$'; then
    redis_ready=1
    break
  fi
  sleep 0.5
done
if [[ "$redis_ready" != "1" ]]; then
  echo "T012 Redis did not become ready; inspect its task-owned log." >&2
  exit 1
fi

export MINIO_ROOT_USER="$S3_ACCESS_KEY"
export MINIO_ROOT_PASSWORD="$S3_SECRET_KEY"
export MINIO_API_CORS_ALLOW_ORIGIN="$WEB_ORIGIN"
"$MINIO_BIN" server --address "127.0.0.1:$MINIO_API_PORT" --console-address "127.0.0.1:$MINIO_CONSOLE_PORT" "$MINIO_DATA" > "$LOG_DIR/minio.log" 2>&1 &
MINIO_PID=$!
printf '%s\n' "$MINIO_PID" > "$STATE_DIR/minio.pid"
wait_http "http://127.0.0.1:$MINIO_API_PORT/minio/health/live"

node - <<'NODE'
const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.cwd() + "/backend/api/package.json");
const { CreateBucketCommand, HeadBucketCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
(async () => {
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
    }
    process.stdout.write("T012 MinIO bucket identity: " + process.env.S3_BUCKET + "\n");
  } finally {
    client.destroy();
  }
})().catch(error => {
  process.stderr.write((error.name || "MINIO_BUCKET_CREATE_FAILED") + "\n");
  process.exitCode = 1;
});
NODE

pnpm --filter @yuzan/database generate
pnpm --filter @yuzan/database migrate:deploy
P0_BOOTSTRAP_ONLY=true pnpm --filter @yuzan/database seed
pnpm --filter @yuzan/api build

node "$ROOT_DIR/backend/api/dist/main.js" > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
printf '%s\n' "$API_PID" > "$STATE_DIR/api.pid"
wait_http "http://127.0.0.1:$API_PORT/api/v1/health"

PORT="$WEB_PORT" API_BASE_URL="$API_BASE_URL" S3_ENDPOINT="$S3_ENDPOINT" S3_BUCKET="$S3_BUCKET" node "$ROOT_DIR/frontend/server.mjs" > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
printf '%s\n' "$WEB_PID" > "$STATE_DIR/web.pid"
wait_http "$YZ_T012_BASE_URL/student/practices/"

export YZ_T012_PSQL="$PG_BIN/psql"
export YZ_T012_API_PACKAGE="$ROOT_DIR/backend/api/package.json"
echo "T012 runtime ready: DB=$POSTGRES_DB user=$POSTGRES_USER bucket=$S3_BUCKET ports=$POSTGRES_PORT/$REDIS_PORT/$MINIO_API_PORT/$MINIO_CONSOLE_PORT/$API_PORT/$WEB_PORT"
"$PYTHON" -m pytest -q -s "$ROOT_DIR/tests/e2e/assessment/test_yz_rd_t012_student_practice.py"

stop_owned_runtime
trap - EXIT INT TERM
python3 - "$POSTGRES_PORT" "$REDIS_PORT" "$MINIO_API_PORT" "$MINIO_CONSOLE_PORT" "$API_PORT" "$WEB_PORT" <<'PY'
import socket
import sys

open_ports = []
for value in sys.argv[1:]:
    probe = socket.socket()
    probe.settimeout(0.25)
    try:
        probe.connect(("127.0.0.1", int(value)))
    except OSError:
        pass
    else:
        open_ports.append(value)
    finally:
        probe.close()
if open_ports:
    raise SystemExit("T012 services still own ports after cleanup: " + ", ".join(open_ports))
print("T012 native process exit: PASS; all task-owned ports are free.")
PY
echo "T012 native Chromium/API/PostgreSQL/MinIO E2E: PASS (1 passed, 0 skipped)"
