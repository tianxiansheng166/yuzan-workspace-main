#!/usr/bin/env bash
# T008 browser proof in a private Compose project, database, Redis, and MinIO bucket.
set -euo pipefail
if [[ -x /opt/devspace-mcp/node/bin/node ]]; then PATH="/opt/devspace-mcp/node/bin:$PATH"; export PATH; fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
PROJECT="yz-rd-t008-20261018"
DB_NAME="yzrdt008_student_history"
DB_USER="yzrdt008"
DB_PASSWORD="yzrdt008_ephemeral_only"
DB_PORT="55448"
REDIS_PORT="6392"
MINIO_PORT="59028"
MINIO_CONSOLE_PORT="59029"
API_PORT="4018"
WEB_PORT="4178"
BUCKET="yz-rd-t008-student-history"
MINIO_USER="yzrdt008minio"
MINIO_PASSWORD="yzrdt008_ephemeral_minio_only"
SESSION_SECRET="yzrdt008-local-session-secret-2026-only"
INTERNAL_KEY="yzrdt008-local-internal-key"
DB_CONTAINER="${PROJECT}-postgres-1"
BASE_URL="http://127.0.0.1:${WEB_PORT}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}?schema=public"
LOG_DIR="${QB_RELEASE_LOG_DIR:-/tmp/yz-rd-t008-runtime}"
SOURCE_DIR="${QB_SOURCE_DIR:-/home/tian/code/yuzan-workspace-main/习题课程资源}"
PYTEST_BIN="${PYTEST_BIN:-pytest}"
PIDS=()
PROJECT_CREATED=0

die() { echo "T008 isolated browser proof: $*" >&2; exit 1; }
compose() { docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"; }

stop_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  for pid in "${PIDS[@]}"; do stop_pid "$pid"; done
  if [[ "$PROJECT_CREATED" == "1" ]]; then
    compose --profile bootstrap-db down --volumes --remove-orphans >/dev/null 2>&1 || true
    PROJECT_CREATED=0
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

wait_http() {
  local url="$1"
  local deadline=$((SECONDS + 90))
  until curl --fail --silent "$url" >/dev/null; do
    (( SECONDS < deadline )) || die "timed out waiting for $url"
    sleep 1
  done
}

start_process() {
  local name="$1"
  shift
  "$@" >"$LOG_DIR/${name}.log" 2>&1 &
  PIDS+=("$!")
}

[[ "${COMPOSE_PROJECT_NAME:-$PROJECT}" != "p0-integration" ]] || die "refusing the shared p0-integration project"
[[ "$DATABASE_URL" != *"yuzan_dev"* ]] || die "refusing the shared development database"
command -v docker >/dev/null || die "docker is required"
command -v pnpm >/dev/null || die "pnpm is required"
command -v "$PYTEST_BIN" >/dev/null || die "pytest is required (set PYTEST_BIN to its executable)"
command -v curl >/dev/null || die "curl is required"

mkdir -p "$LOG_DIR"
mkdir -p "$LOG_DIR/tmp"
export TMPDIR="$LOG_DIR/tmp"
[[ -f "$SOURCE_DIR/题库【三改】.docx" && -f "$SOURCE_DIR/答案及评分细则.docx" && -f "$SOURCE_DIR/题库音频及图片.zip" ]] || die "read-only Question Bank import inputs are unavailable at $SOURCE_DIR"
export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_DB="$DB_NAME" POSTGRES_USER="$DB_USER" POSTGRES_PASSWORD="$DB_PASSWORD"
export POSTGRES_PORT="$DB_PORT" POSTGRES_VOLUME_NAME="${PROJECT}-postgres"
export REDIS_PORT MINIO_API_PORT="$MINIO_PORT" MINIO_CONSOLE_PORT="$MINIO_CONSOLE_PORT"
export S3_ACCESS_KEY="$MINIO_USER" S3_SECRET_KEY="$MINIO_PASSWORD"
export MINIO_API_CORS_ALLOW_ORIGIN="$BASE_URL,http://localhost:${WEB_PORT}"

[[ -z "$(compose ps -q)" ]] || die "Compose project $PROJECT already has containers; leaving it untouched"
[[ -z "$(docker volume ls -q --filter "name=${PROJECT}")" ]] || die "Compose project $PROJECT already has volumes; leaving them untouched"
for port in "$DB_PORT" "$REDIS_PORT" "$MINIO_PORT" "$MINIO_CONSOLE_PORT" "$API_PORT" "$WEB_PORT"; do
  if timeout 1 bash -c "</dev/tcp/127.0.0.1/${port}" 2>/dev/null; then
    die "port $port is already in use; leaving the existing service untouched"
  fi
done

PROJECT_CREATED=1
compose --profile bootstrap-db up -d postgres redis minio
until compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do sleep 1; done
[[ "$(docker inspect "$DB_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}')" == "$PROJECT" ]] || die "database container is not owned by $PROJECT"

export NODE_ENV=test DATABASE_URL WEB_ORIGIN="$BASE_URL" SESSION_SECRET
pnpm --filter @yuzan/database generate
pnpm --filter @yuzan/database validate
pnpm --filter @yuzan/database migrate:deploy
P0_BOOTSTRAP_ONLY=true pnpm --filter @yuzan/database seed
pnpm --filter @yuzan/api build
S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_REGION=us-east-1 S3_BUCKET="$BUCKET" S3_ACCESS_KEY_ID="$MINIO_USER" S3_SECRET_ACCESS_KEY="$MINIO_PASSWORD" S3_FORCE_PATH_STYLE=true pnpm qb:source:apply -- --apply --all --source-dir "$SOURCE_DIR"

start_process api env NODE_ENV=test DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" WEB_ORIGIN="$BASE_URL" API_PORT="$API_PORT" COOKIE_SECURE=false COOKIE_SAME_SITE=lax S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_REGION=us-east-1 S3_BUCKET="$BUCKET" S3_ACCESS_KEY_ID="$MINIO_USER" S3_SECRET_ACCESS_KEY="$MINIO_PASSWORD" S3_FORCE_PATH_STYLE=true REDIS_HOST=127.0.0.1 REDIS_PORT="$REDIS_PORT" API_INTERNAL_KEY="$INTERNAL_KEY" API_INTERNAL_URL="http://127.0.0.1:${API_PORT}/api/v1/internal" node "$ROOT_DIR/backend/api/dist/main.js"
start_process frontend env PORT="$WEB_PORT" API_BASE_URL="http://127.0.0.1:${API_PORT}" S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_BUCKET="$BUCKET" node "$ROOT_DIR/frontend/server.mjs"
wait_http "http://127.0.0.1:${API_PORT}/api/v1/health/live"
wait_http "$BASE_URL/login/"

export QB_RUNTIME_DATABASE_URL="$DATABASE_URL"
export QB_RELEASE_BASE_URL="$BASE_URL" QB_RELEASE_DB_CONTAINER="$DB_CONTAINER" QB_RELEASE_DB_USER="$DB_USER" QB_RELEASE_DB_NAME="$DB_NAME" QB_RELEASE_COMPOSE_PROJECT="$PROJECT"
export PYTHONPATH="$ROOT_DIR/tests/e2e/assessment${PYTHONPATH:+:$PYTHONPATH}"
pnpm --filter @yuzan/frontend test
"$PYTEST_BIN" -q -s "$ROOT_DIR/tests/e2e/assessment/test_yz_rd_t008_student_history.py" | tee "$LOG_DIR/chromium-api-db.log"
