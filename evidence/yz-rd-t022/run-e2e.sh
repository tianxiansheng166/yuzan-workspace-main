#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime-local/native-web-t022"
CONFIG_FILE="$RUNTIME_DIR/.env.local"
SHARED_RUNTIME="/home/tian/code/yuzan-workspace-main/runtime-local/native-web"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "T022 runtime config is missing; start the isolated T022 runtime first." >&2
  exit 2
fi

set -a
. "$CONFIG_FILE"
set +a

export YZ_T022_BASE_URL="$WEB_ORIGIN"
export YZ_T022_API_BASE_URL="$API_BASE_URL"
export YZ_T022_EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t022"
export YZ_T022_API_PACKAGE="$ROOT_DIR/backend/api/package.json"
export YZ_T022_PSQL="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/postgresql/17/bin/psql"
export YZ_T010_BASE_URL="$WEB_ORIGIN"
export YZ_T010_DATABASE_URL="$DATABASE_URL"
export YZ_T010_PASSWORD="$E2E_TEST_PASSWORD"
export YZ_NATIVE_TASK_ID="T022"
export PYTHONPATH="$ROOT_DIR/tests/e2e/assessment${PYTHONPATH:+:$PYTHONPATH}"
export LD_LIBRARY_PATH="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

"$SHARED_RUNTIME/venv/bin/python" -m pytest -q -s "$ROOT_DIR/evidence/yz-rd-t022/course_activity_e2e.py"
