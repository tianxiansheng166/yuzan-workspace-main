#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
SHARED_RUNTIME_ROOT="${YZ_T021_TOOLCHAIN_ROOT:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/runtime-local/native-web}"
RUNTIME_DIR="$ROOT_DIR/runtime-local/native-web-t021"
PGDATA="$RUNTIME_DIR/postgres-data"
REDIS_DATA="$RUNTIME_DIR/redis-data"
MINIO_DATA="$RUNTIME_DIR/minio-data"
SOCKET_DIR="$RUNTIME_DIR/state/socket"
LOG_DIR="$RUNTIME_DIR/logs"
STATE_DIR="$RUNTIME_DIR/state"
CONFIG_FILE="$RUNTIME_DIR/.env.local"
EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t021"
PG_BIN="$SHARED_RUNTIME_ROOT/toolchain/pgdg/usr/lib/postgresql/17/bin"
PG_LIBRARY="$SHARED_RUNTIME_ROOT/toolchain/pgdg/usr/lib/x86_64-linux-gnu"
REDIS_BIN="$SHARED_RUNTIME_ROOT/toolchain/redis-7.4.10/src"
MINIO_BIN="$SHARED_RUNTIME_ROOT/toolchain/bin/minio"
PYTHON="$SHARED_RUNTIME_ROOT/venv/bin/python"
PNPM_CJS="$HOME/.cache/node/corepack/v1/pnpm/10.13.1/bin/pnpm.cjs"

PG_PORT=55639
REDIS_PORT=6439
MINIO_API_PORT=59204
MINIO_CONSOLE_PORT=59205
API_PORT=4096
WEB_PORT=4296
POSTGRES_DB=yuzan_t021_native
POSTGRES_USER=yz_t021
S3_BUCKET=yz-t021-native

PG_STARTED=0
REDIS_PID=""
MINIO_PID=""
API_PID=""
WEB_PID=""
STOP_FAILED=0

mkdir -p "$RUNTIME_DIR" "$PGDATA" "$REDIS_DATA" "$MINIO_DATA" "$SOCKET_DIR" "$LOG_DIR" "$STATE_DIR" "$EVIDENCE_DIR"
chmod 700 "$RUNTIME_DIR" "$PGDATA" "$REDIS_DATA" "$MINIO_DATA" "$SOCKET_DIR" "$LOG_DIR" "$STATE_DIR" "$EVIDENCE_DIR"

for required in "$PG_BIN/initdb" "$PG_BIN/pg_ctl" "$PG_BIN/psql" "$PG_BIN/createdb" "$REDIS_BIN/redis-server" "$REDIS_BIN/redis-cli" "$MINIO_BIN" "$PYTHON" "$PNPM_CJS"; do
  if [[ ! -x "$required" ]]; then echo "T021 native dependency is missing: $required" >&2; exit 1; fi
done
if [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" != 24 ]] || [[ "$(node "$PNPM_CJS" --version)" != 10.13.1 ]]; then
  echo "T021 requires the installed Node 24 and pnpm 10.13.1 toolchain." >&2
  exit 1
fi
"$PYTHON" -c 'import playwright, pytest; print("T021 Playwright and pytest: installed")'

check_ports_available() {
  python3 - "$PG_PORT" "$REDIS_PORT" "$MINIO_API_PORT" "$MINIO_CONSOLE_PORT" "$API_PORT" "$WEB_PORT" <<'PY'
import socket
import sys
occupied = []
for value in sys.argv[1:]:
    probe = socket.socket()
    probe.settimeout(0.2)
    try:
        if probe.connect_ex(("127.0.0.1", int(value))) == 0:
            occupied.append(value)
    finally:
        probe.close()
if occupied:
    raise SystemExit("T021 refuses occupied ports: " + ", ".join(occupied))
PY
}

create_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    python3 - "$CONFIG_FILE" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
values = {}
for line in path.read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        values[key] = value
expected = {"POSTGRES_DB":"yuzan_t021_native", "POSTGRES_USER":"yz_t021", "POSTGRES_PORT":"55639", "REDIS_PORT":"6439", "MINIO_API_PORT":"59204", "MINIO_CONSOLE_PORT":"59205", "API_PORT":"4096", "PORT":"4296", "S3_BUCKET":"yz-t021-native"}
if any(values.get(key) != value for key, value in expected.items()):
    raise SystemExit("Refusing T021 config with a different database, account, bucket, or port identity.")
if path.stat().st_mode & 0o777 != 0o600:
    raise SystemExit("T021 config must stay mode 0600.")
PY
    return
  fi
  python3 - "$CONFIG_FILE" <<'PY'
import os
import secrets
import sys
from pathlib import Path
path = Path(sys.argv[1])
pg_password = secrets.token_hex(32)
s3_password = secrets.token_hex(32)
values = {
    "DATABASE_URL": f"postgresql://yz_t021:{pg_password}@127.0.0.1:55639/yuzan_t021_native?schema=public",
    "POSTGRES_PASSWORD": pg_password,
    "REDIS_PASSWORD": secrets.token_hex(32),
    "SESSION_SECRET": secrets.token_hex(48),
    "API_INTERNAL_KEY": secrets.token_hex(32),
    "S3_SECRET_KEY": s3_password,
    "NODE_ENV": "development",
    "API_HOST": "127.0.0.1",
    "API_PORT": "4096",
    "API_BASE_URL": "http://127.0.0.1:4096",
    "POSTGRES_USER": "yz_t021",
    "POSTGRES_DB": "yuzan_t021_native",
    "POSTGRES_PORT": "55639",
    "REDIS_HOST": "127.0.0.1",
    "REDIS_PORT": "6439",
    "WEB_HOST": "127.0.0.1",
    "WEB_ORIGIN": "http://127.0.0.1:4296",
    "PORT": "4296",
    "S3_ENDPOINT": "http://127.0.0.1:59204",
    "S3_REGION": "us-east-1",
    "S3_BUCKET": "yz-t021-native",
    "S3_ACCESS_KEY": "yz_t021_local",
    "S3_ACCESS_KEY_ID": "yz_t021_local",
    "S3_SECRET_ACCESS_KEY": s3_password,
    "S3_FORCE_PATH_STYLE": "true",
    "MINIO_API_PORT": "59204",
    "MINIO_CONSOLE_PORT": "59205",
    "COOKIE_SECURE": "false",
    "COOKIE_SAME_SITE": "lax",
    "MINIO_API_CORS_ALLOW_ORIGIN": "http://127.0.0.1:4296",
    "SPEECH_PROVIDER": "disabled",
    "API_INTERNAL_URL": "http://127.0.0.1:4096/api/v1/internal",
    "WORKER_HEARTBEAT_KEY": "yuzan:t021:worker:heartbeat",
    "WORKER_HEARTBEAT_INTERVAL_MS": "15000",
    "WORKER_HEARTBEAT_TTL_SECONDS": "60",
    "LOG_LEVEL": "info",
}
path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
    handle.write("# T021-only native runtime secrets; do not commit.\n")
    handle.writelines(f"{key}={value}\n" for key, value in values.items())
PY
}

wait_http() {
  local url="$1" attempt
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
    then return 0; fi
    sleep 0.5
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

stop_pid() {
  local pid="$1" token="$2" label="$3" cmdline="" attempt
  [[ -n "$pid" ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then wait "$pid" 2>/dev/null || true; return 0; fi
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  if [[ "$cmdline" != *"$token"* ]]; then echo "$label PID identity mismatch; refusing to stop PID $pid." >&2; return 1; fi
  kill -TERM "$pid" 2>/dev/null || true
  for attempt in $(seq 1 40); do
    if ! kill -0 "$pid" 2>/dev/null; then wait "$pid" 2>/dev/null || true; return 0; fi
    sleep 0.25
  done
  echo "$label did not stop after TERM; no KILL was sent." >&2
  return 1
}

stop_owned_runtime() {
  set +e
  [[ -z "$WEB_PID" ]] || stop_pid "$WEB_PID" "frontend/server.mjs" "T021 Web" || STOP_FAILED=1
  [[ -z "$API_PID" ]] || stop_pid "$API_PID" "backend/api/dist/main.js" "T021 API" || STOP_FAILED=1
  if [[ -n "$MINIO_PID" ]]; then
    actual="$(readlink -f "/proc/$MINIO_PID/exe" 2>/dev/null || true)"
    if [[ "$actual" == "$(readlink -f "$MINIO_BIN")" ]]; then stop_pid "$MINIO_PID" "server" "T021 MinIO" || STOP_FAILED=1
    elif kill -0 "$MINIO_PID" 2>/dev/null; then echo "T021 MinIO executable identity mismatch; refusing to stop PID $MINIO_PID." >&2; STOP_FAILED=1; fi
  fi
  if [[ -n "$REDIS_PID" ]]; then
    REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
    stop_pid "$REDIS_PID" "redis-server" "T021 Redis" || STOP_FAILED=1
  fi
  if [[ "$PG_STARTED" == "1" ]]; then
    if "$PG_BIN/pg_ctl" --pgdata "$PGDATA" --mode=fast --wait --timeout=45 stop >/dev/null; then echo "T021 PostgreSQL: stopped"; else echo "T021 PostgreSQL did not stop; data preserved." >&2; STOP_FAILED=1; fi
    PG_STARTED=0
  fi
  set -e
}

trap 'stop_owned_runtime' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

check_ports_available
create_config
set -a
source "$CONFIG_FILE"
set +a
export PATH="$(dirname "$PNPM_CJS"):$(dirname "$PG_BIN"):$(dirname "$REDIS_BIN"):$(dirname "$MINIO_BIN"):$PATH"
export LD_LIBRARY_PATH="$PG_LIBRARY${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  if [[ -n "$(ls -A "$PGDATA")" ]]; then echo "T021 PGDATA is non-empty without PG_VERSION; refusing initialization." >&2; exit 1; fi
  password_file="$STATE_DIR/postgres-init-password"
  printf '%s\n' "$POSTGRES_PASSWORD" > "$password_file"
  chmod 600 "$password_file"
  "$PG_BIN/initdb" --pgdata "$PGDATA" --username "$POSTGRES_USER" --pwfile "$password_file" --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --locale=C.utf8 > "$LOG_DIR/initdb.log" 2>&1
  rm -f "$password_file"
elif [[ "$(cat "$PGDATA/PG_VERSION")" != 17 ]]; then echo "T021 PGDATA is not PostgreSQL 17; refusing to start it." >&2; exit 1; fi
if "$PG_BIN/pg_ctl" --pgdata "$PGDATA" status >/dev/null 2>&1; then echo "T021 PostgreSQL already has a live process; refusing to reuse it." >&2; exit 1; fi
if ! rg -q "# YZ-RD-T021 isolated native runtime" "$PGDATA/postgresql.conf"; then
  cat >> "$PGDATA/postgresql.conf" <<EOF

# YZ-RD-T021 isolated native runtime
listen_addresses = '127.0.0.1'
port = $PG_PORT
unix_socket_directories = '$SOCKET_DIR'
logging_collector = off
log_destination = 'stderr'
EOF
fi
PG_STARTED=1
"$PG_BIN/pg_ctl" --pgdata "$PGDATA" --log "$LOG_DIR/postgres.log" --wait --timeout=60 start >/dev/null
export PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE=postgres
if ! "$PG_BIN/psql" -X -A -t -c "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB';" | rg -q '^1$'; then "$PG_BIN/createdb" --host=127.0.0.1 --port "$PG_PORT" --username "$POSTGRES_USER" "$POSTGRES_DB"; fi
PGDATABASE="$POSTGRES_DB" identity="$("$PG_BIN/psql" -X -A -t -F '|' -c 'SELECT current_database(), current_user, version();')"
if [[ "$identity" != yuzan_t021_native\|yz_t021\|PostgreSQL\ 17.* ]]; then echo "T021 PostgreSQL identity mismatch." >&2; exit 1; fi
echo "T021 PostgreSQL identity verified: $POSTGRES_DB / $POSTGRES_USER / PostgreSQL 17"

cat > "$RUNTIME_DIR/redis.conf" <<EOF
bind 127.0.0.1
port $REDIS_PORT
protected-mode yes
daemonize no
dir $REDIS_DATA
appendonly no
save ""
requirepass $REDIS_PASSWORD
loglevel notice
EOF
chmod 600 "$RUNTIME_DIR/redis.conf"
"$REDIS_BIN/redis-server" "$RUNTIME_DIR/redis.conf" > "$LOG_DIR/redis.log" 2>&1 & REDIS_PID=$!
for attempt in $(seq 1 40); do
  if REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" PING 2>/dev/null | rg -q '^PONG$'; then break; fi
  sleep 0.5
done
REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_BIN/redis-cli" -h 127.0.0.1 -p "$REDIS_PORT" PING | rg -q '^PONG$'

env -i HOME="$HOME" PATH="$PATH" MINIO_ROOT_USER="$S3_ACCESS_KEY" MINIO_ROOT_PASSWORD="$S3_SECRET_KEY" MINIO_API_CORS_ALLOW_ORIGIN="$WEB_ORIGIN" \
  "$MINIO_BIN" server --address "127.0.0.1:$MINIO_API_PORT" --console-address "127.0.0.1:$MINIO_CONSOLE_PORT" "$MINIO_DATA" > "$LOG_DIR/minio.log" 2>&1 & MINIO_PID=$!
wait_http "http://127.0.0.1:$MINIO_API_PORT/minio/health/live"

run_pnpm() {
  env -i HOME="$HOME" PATH="$PATH" LANG="${LANG:-C.UTF-8}" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" \
    DATABASE_URL="$DATABASE_URL" NODE_ENV=development WEB_ORIGIN="$WEB_ORIGIN" SESSION_SECRET="$SESSION_SECRET" \
    API_INTERNAL_KEY="$API_INTERNAL_KEY" node "$PNPM_CJS" "$@"
}
run_pnpm install --frozen-lockfile > "$LOG_DIR/pnpm-install.log" 2>&1
run_pnpm --filter @yuzan/contracts build > "$LOG_DIR/contracts-build.log" 2>&1
run_pnpm --filter @yuzan/domain build > "$LOG_DIR/domain-build.log" 2>&1
run_pnpm --filter @yuzan/database generate > "$LOG_DIR/database-generate.log" 2>&1
run_pnpm --filter @yuzan/database build > "$LOG_DIR/database-build.log" 2>&1
run_pnpm --filter @yuzan/database migrate:deploy > "$LOG_DIR/database-migrate.log" 2>&1
run_pnpm --filter @yuzan/api build > "$LOG_DIR/api-build.log" 2>&1

env -i HOME="$HOME" PATH="$PATH" NODE_ENV=development S3_ENDPOINT="$S3_ENDPOINT" S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_ACCESS_KEY="$S3_ACCESS_KEY" S3_SECRET_KEY="$S3_SECRET_KEY" \
  node - <<'NODE'
const { createRequire } = require("node:module");
const requireFromApi = createRequire(process.cwd() + "/backend/api/package.json");
const { CreateBucketCommand, HeadBucketCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");
const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
(async () => { try { try { await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET })); } catch { await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET })); } } finally { client.destroy(); } })().catch(error => { process.stderr.write((error.name || "S3_SETUP_FAILED") + "\n"); process.exitCode = 1; });
NODE

env -i HOME="$HOME" PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" API_HOST=127.0.0.1 API_PORT="$API_PORT" DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" \
  NODE_ENV=development WEB_ORIGIN="$WEB_ORIGIN" COOKIE_SECURE=false COOKIE_SAME_SITE=lax REDIS_HOST=127.0.0.1 REDIS_PORT="$REDIS_PORT" REDIS_PASSWORD="$REDIS_PASSWORD" \
  S3_ENDPOINT="$S3_ENDPOINT" S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" S3_FORCE_PATH_STYLE=true \
  API_INTERNAL_KEY="$API_INTERNAL_KEY" API_INTERNAL_URL="$API_INTERNAL_URL" SPEECH_PROVIDER=disabled LOG_LEVEL=info \
  node "$ROOT_DIR/backend/api/dist/main.js" > "$LOG_DIR/api.log" 2>&1 & API_PID=$!
wait_http "http://127.0.0.1:$API_PORT/api/v1/health/live"
env -i HOME="$HOME" PATH="$PATH" PORT="$WEB_PORT" API_BASE_URL="$API_BASE_URL" S3_ENDPOINT="$S3_ENDPOINT" S3_BUCKET="$S3_BUCKET" \
  node "$ROOT_DIR/frontend/server.mjs" > "$LOG_DIR/web.log" 2>&1 & WEB_PID=$!
wait_http "http://127.0.0.1:$WEB_PORT/student/profile/"

printf 'postgres=%s\nredis=%s\nminio=%s\napi=%s\nweb=%s\n' "$(head -n 1 "$PGDATA/postmaster.pid")" "$REDIS_PID" "$MINIO_PID" "$API_PID" "$WEB_PID" > "$EVIDENCE_DIR/native-pids.txt"
export YZ_T021_BASE_URL="http://127.0.0.1:$WEB_PORT" YZ_T021_API_BASE_URL="http://127.0.0.1:$API_PORT" YZ_T021_DATABASE_URL="$DATABASE_URL"
export YZ_T021_DATABASE_NAME="$POSTGRES_DB" YZ_T021_DATABASE_USER="$POSTGRES_USER" YZ_T021_POSTGRES_PORT="$PG_PORT" YZ_T021_PSQL="$PG_BIN/psql" YZ_T021_PG_LIBRARY="$PG_LIBRARY"
export YZ_T021_EVIDENCE_DIR="$EVIDENCE_DIR" YZ_T021_CHROMIUM=/usr/bin/google-chrome LD_LIBRARY_PATH="$PG_LIBRARY${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

set +e
"$PYTHON" -m pytest -q -s "$ROOT_DIR/tests/e2e/assessment/test_yz_rd_t021_student_profile_invitation.py" 2>&1 | tee "$EVIDENCE_DIR/native-e2e.log"
test_status=${PIPESTATUS[0]}
set -e
stop_owned_runtime
trap - EXIT INT TERM
if [[ "$STOP_FAILED" != "0" ]]; then echo "T021 native cleanup did not fully stop its owned services." >&2; exit 1; fi
python3 - "$PG_PORT" "$REDIS_PORT" "$MINIO_API_PORT" "$MINIO_CONSOLE_PORT" "$API_PORT" "$WEB_PORT" <<'PY'
import socket
import sys
open_ports = []
for value in sys.argv[1:]:
    probe = socket.socket()
    probe.settimeout(0.2)
    try:
        probe.connect(("127.0.0.1", int(value)))
    except OSError:
        pass
    else:
        open_ports.append(value)
    finally:
        probe.close()
if open_ports:
    raise SystemExit("T021 owned ports are still open: " + ", ".join(open_ports))
PY
printf '%s\n' "T021 native process exit: PASS; ports $PG_PORT/$REDIS_PORT/$MINIO_API_PORT/$MINIO_CONSOLE_PORT/$API_PORT/$WEB_PORT are free" > "$EVIDENCE_DIR/native-process-exit.txt"
exit "$test_status"
