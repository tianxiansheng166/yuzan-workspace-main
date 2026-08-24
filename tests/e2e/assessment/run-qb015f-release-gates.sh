#!/usr/bin/env bash
# QB-015F release evidence runner.
#
# The runtime is intentionally isolated by Compose project, ports, database,
# Redis instance, and MinIO bucket. It refuses the historical p0-integration
# target before starting any test process.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
PROJECT="${QB_RELEASE_COMPOSE_PROJECT:-qb015f-release}"
DB_NAME="${QB_RELEASE_DB_NAME:-qb015f_fresh}"
DB_USER="${QB_RELEASE_DB_USER:-qb015f}"
DB_PASSWORD="${QB_RELEASE_DB_PASSWORD:-qb015f_ephemeral_only}"
DB_PORT="${QB_RELEASE_DB_PORT:-55445}"
REDIS_PORT="${QB_RELEASE_REDIS_PORT:-6389}"
MINIO_PORT="${QB_RELEASE_MINIO_PORT:-59020}"
MINIO_CONSOLE_PORT="${QB_RELEASE_MINIO_CONSOLE_PORT:-59021}"
API_PORT="${QB_RELEASE_API_PORT:-4015}"
WEB_PORT="${QB_RELEASE_WEB_PORT:-4176}"
SPEECH_PORT="${QB_RELEASE_SPEECH_PORT:-8115}"
BUCKET="${QB_RELEASE_BUCKET:-qb015f-question-bank}"
MINIO_USER="${QB_RELEASE_MINIO_USER:-qb015fminio}"
MINIO_PASSWORD="${QB_RELEASE_MINIO_PASSWORD:-qb015f_ephemeral_minio_secret}"
SESSION_SECRET="${QB_RELEASE_SESSION_SECRET:-qb015f-local-session-secret-2026-only}"
INTERNAL_KEY="${QB_RELEASE_INTERNAL_KEY:-qb015f-local-internal-key-2026-only}"
DB_CONTAINER="${PROJECT}-postgres-1"
BASE_URL="http://127.0.0.1:${WEB_PORT}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}?schema=public"
LOG_DIR="${QB_RELEASE_LOG_DIR:-$ROOT_DIR/evidence/qb015f-release}"
PIDS=()
CLEANED=0

die() { echo "QB-015F release gate: $*" >&2; exit 1; }
log() { echo "[qb015f] $*"; }

[[ "$PROJECT" != "p0-integration" ]] || die "refusing shared Compose project p0-integration"
[[ "$BASE_URL" != *"p0-integration"* ]] || die "refusing shared frontend target"
[[ "$DATABASE_URL" != *"yuzan_dev"* ]] || die "refusing shared development database"
[[ "$DB_CONTAINER" != "p0-integration-postgres-1" ]] || die "refusing shared database container"
command -v docker >/dev/null || die "docker is required"
command -v pnpm >/dev/null || die "pnpm is required"
command -v python >/dev/null || die "python is required"

mkdir -p "$LOG_DIR"
export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_DB="$DB_NAME" POSTGRES_USER="$DB_USER" POSTGRES_PASSWORD="$DB_PASSWORD"
export POSTGRES_PORT="$DB_PORT" POSTGRES_VOLUME_NAME="${PROJECT}-postgres"
export REDIS_PORT MINIO_API_PORT="$MINIO_PORT" MINIO_CONSOLE_PORT="$MINIO_CONSOLE_PORT"
export S3_ACCESS_KEY="$MINIO_USER" S3_SECRET_KEY="$MINIO_PASSWORD"
export MINIO_API_CORS_ALLOW_ORIGIN="$BASE_URL,http://localhost:${WEB_PORT}"

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
  [[ "$CLEANED" == "0" ]] || return
  CLEANED=1
  trap - EXIT INT TERM
  for pid in "${PIDS[@]}"; do stop_pid "$pid"; done
  if [[ "${QB_RELEASE_KEEP_RUNTIME:-false}" != "true" ]]; then
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    # Compose can leave a healthy bootstrap-only postgres attached when an
    # application process exits during a gate. These names are derived solely
    # from this runner's isolated project and never target p0-integration.
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
    docker network rm "${PROJECT}_default" >/dev/null 2>&1 || true
    docker volume rm "${PROJECT}-postgres" "${PROJECT}_yuzan-minio" >/dev/null 2>&1 || true
  else
    log "keeping only isolated runtime project $PROJECT by request"
  fi
  if [[ -z "${MOCK_SPEECH_SCORING:-}" ]]; then
    log "production shell MOCK_SPEECH_SCORING is unset"
  else
    die "release runner must not leave MOCK_SPEECH_SCORING in its shell"
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

wait_http() {
  local url="$1"
  local deadline=$((SECONDS + 60))
  until curl --fail --silent "$url" >/dev/null; do
    (( SECONDS < deadline )) || die "timed out waiting for $url"
    sleep 1
  done
}

start_process() {
  local name="$1"
  shift
  log "starting $name"
  "$@" >"$LOG_DIR/${name}.log" 2>&1 &
  PIDS+=("$!")
}

log "isolated runtime identity: project=$PROJECT db=$DB_NAME dbContainer=$DB_CONTAINER api=$API_PORT frontend=$WEB_PORT minioBucket=$BUCKET"
compose --profile bootstrap-db up -d postgres redis minio
until compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do sleep 1; done
[[ "$(docker inspect "$DB_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}')" == "$PROJECT" ]] || die "database container is not owned by isolated project"

export NODE_ENV=test DATABASE_URL WEB_ORIGIN="$BASE_URL" SESSION_SECRET
pnpm --filter @yuzan/database generate
pnpm --filter @yuzan/database validate
pnpm --filter @yuzan/database migrate:deploy
P0_BOOTSTRAP_ONLY=true pnpm --filter @yuzan/database seed
pnpm --filter @yuzan/api build
pnpm --filter @yuzan/worker build
S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_REGION=us-east-1 S3_BUCKET="$BUCKET" S3_ACCESS_KEY_ID="$MINIO_USER" S3_SECRET_ACCESS_KEY="$MINIO_PASSWORD" S3_FORCE_PATH_STYLE=true pnpm qb:source:apply -- --apply --all

start_process speech env MOCK_SPEECH_SCORING=true python -m uvicorn app.main:app --app-dir "$ROOT_DIR/backend/speech-scoring" --host 127.0.0.1 --port "$SPEECH_PORT"
wait_http "http://127.0.0.1:${SPEECH_PORT}/health"
start_process api env NODE_ENV=test DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" WEB_ORIGIN="$BASE_URL" API_PORT="$API_PORT" COOKIE_SECURE=false COOKIE_SAME_SITE=lax S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_REGION=us-east-1 S3_BUCKET="$BUCKET" S3_ACCESS_KEY_ID="$MINIO_USER" S3_SECRET_ACCESS_KEY="$MINIO_PASSWORD" S3_FORCE_PATH_STYLE=true REDIS_HOST=127.0.0.1 REDIS_PORT="$REDIS_PORT" SPEECH_PROVIDER=local SPEECH_API_URL="http://127.0.0.1:${SPEECH_PORT}" API_INTERNAL_KEY="$INTERNAL_KEY" API_INTERNAL_URL="http://127.0.0.1:${API_PORT}/api/v1/internal" node "$ROOT_DIR/backend/api/dist/main.js"
wait_http "http://127.0.0.1:${API_PORT}/api/v1/health/live"
start_process worker env NODE_ENV=test DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" REDIS_HOST=127.0.0.1 REDIS_PORT="$REDIS_PORT" SPEECH_PROVIDER=local SPEECH_API_URL="http://127.0.0.1:${SPEECH_PORT}" API_INTERNAL_KEY="$INTERNAL_KEY" API_INTERNAL_URL="http://127.0.0.1:${API_PORT}/api/v1/internal" node "$ROOT_DIR/backend/worker/dist/main.js"
start_process frontend env PORT="$WEB_PORT" API_BASE_URL="http://127.0.0.1:${API_PORT}" S3_ENDPOINT="http://127.0.0.1:${MINIO_PORT}" S3_BUCKET="$BUCKET" node "$ROOT_DIR/frontend/server.mjs"
wait_http "$BASE_URL/login/"

export QB_RUNTIME_DATABASE_URL="$DATABASE_URL"
export QB_RELEASE_BASE_URL="$BASE_URL" QB_RELEASE_DB_CONTAINER="$DB_CONTAINER" QB_RELEASE_DB_USER="$DB_USER" QB_RELEASE_DB_NAME="$DB_NAME" QB_RELEASE_COMPOSE_PROJECT="$PROJECT"
export SPEECH_API_PORT="$SPEECH_PORT"

log "running real PostgreSQL QB-014F assignment and speech closure"
pnpm --filter @yuzan/api exec vitest run test/assessment/qb015f.teacher-assignment.runtime.integration.spec.ts | tee "$LOG_DIR/qb015f-postgres.log"
log "running deterministic QB-014F Chromium assignment closure"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb015f_teacher_assignment.py" | tee "$LOG_DIR/qb015f-chromium.log"
log "running Level 1 full learning loop closure"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb007_picture_review.py" -k '1' --maxfail=1 | tee "$LOG_DIR/qb015f-level1.log"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb011_remediation.py" | tee "$LOG_DIR/qb015f-qb011.log"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb012_progress.py" | tee "$LOG_DIR/qb015f-qb012.log"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb017a_student_today.py" | tee "$LOG_DIR/qb017a-today.log"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb013_teacher_diagnostics.py" | tee "$LOG_DIR/qb015f-qb013.log"
log "running isolated six-level Chromium release suite"
pytest -q "$ROOT_DIR/tests/e2e/assessment/test_qb007_picture_review.py" | tee "$LOG_DIR/qb015f-levels1-6.log"

log "running fast source/API smoke after release changes"
pnpm qb:source:validate -- --all >/dev/null
pnpm --filter @yuzan/contracts validate
pnpm --filter @yuzan/frontend test
log "QB-015F release gates passed in isolated project $PROJECT"
