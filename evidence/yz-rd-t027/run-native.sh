#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime-local/native-web-t027"
CONFIG_FILE="$RUNTIME_DIR/.env.local"
SHARED_RUNTIME="/home/tian/code/yuzan-workspace-main/runtime-local/native-web"
PYTHON="$SHARED_RUNTIME/venv/bin/python"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "T027 runtime config is missing; start the isolated T027 runtime first." >&2
  exit 2
fi
if [[ ! -x "$PYTHON" ]]; then
  echo "Shared native Playwright environment is missing; no replacement was installed." >&2
  exit 2
fi

set -a
. "$CONFIG_FILE"
set +a

export YZ_T027_BASE_URL="$WEB_ORIGIN"
export YZ_T027_API_BASE_URL="$API_BASE_URL"
export YZ_T027_EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t027"
export YZ_T022_BASE_URL="$WEB_ORIGIN"
export YZ_T022_API_BASE_URL="$API_BASE_URL"
export YZ_T022_EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t027"
export YZ_T022_API_PACKAGE="$ROOT_DIR/backend/api/package.json"
export YZ_T022_PSQL="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/postgresql/17/bin/psql"
export YZ_T010_BASE_URL="$WEB_ORIGIN"
export YZ_T010_DATABASE_URL="$DATABASE_URL"
export YZ_T010_PASSWORD="$E2E_TEST_PASSWORD"
export YZ_NATIVE_TASK_ID="T027"
export PYTHONPATH="$ROOT_DIR/tests/e2e/assessment${PYTHONPATH:+:$PYTHONPATH}"
export LD_LIBRARY_PATH="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

case "${1:-handoff}" in
  handoff)
    "$PYTHON" -m pytest -q -s "$ROOT_DIR/tests/e2e/assessment/test_yz_rd_t027_native_handoff.py"
    ;;
  full)
    "$PYTHON" -m pytest -q -s "$ROOT_DIR/tests/e2e/assessment/test_yz_rd_t027_native_activity.py"
    ;;
  *)
    echo "Usage: run-native.sh [handoff|full]" >&2
    exit 2
    ;;
esac
