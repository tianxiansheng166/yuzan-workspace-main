#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime-local/native-web-t031"
CONFIG_FILE="$RUNTIME_DIR/.env.local"
SHARED_RUNTIME="/home/tian/code/yuzan-workspace-main/runtime-local/native-web"
PYTHON="$SHARED_RUNTIME/venv/bin/python"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "T031 runtime config is missing; start the isolated T031 runtime first." >&2
  exit 2
fi
if [[ ! -x "$PYTHON" ]]; then
  echo "Shared native Playwright environment is missing; no replacement was installed." >&2
  exit 2
fi

set -a
. "$CONFIG_FILE"
set +a

export YZ_T031_BASE_URL="$WEB_ORIGIN"
export YZ_T031_API_BASE_URL="$API_BASE_URL"
export YZ_T031_EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t031"
export YZ_T031_API_PACKAGE="$ROOT_DIR/backend/api/package.json"
export YZ_T031_PSQL="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/postgresql/17/bin/psql"
export YZ_T022_BASE_URL="$WEB_ORIGIN"
export YZ_T022_API_BASE_URL="$API_BASE_URL"
export YZ_T022_EVIDENCE_DIR="$ROOT_DIR/evidence/yz-rd-t031"
export YZ_T022_API_PACKAGE="$ROOT_DIR/backend/api/package.json"
export YZ_T022_PSQL="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/postgresql/17/bin/psql"
export YZ_T010_BASE_URL="$WEB_ORIGIN"
export YZ_T010_DATABASE_URL="$DATABASE_URL"
export YZ_T010_PASSWORD="$E2E_TEST_PASSWORD"
export YZ_NATIVE_TASK_ID="T031"
export PYTHONPATH="$ROOT_DIR/tests/e2e/assessment${PYTHONPATH:+:$PYTHONPATH}"
export LD_LIBRARY_PATH="$SHARED_RUNTIME/toolchain/pgdg/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

case "${1:-baseline}" in
  baseline)
    "$PYTHON" -m pytest -q -s "$ROOT_DIR/evidence/yz-rd-t031/baseline_return_repro.py"
    ;;
  final)
    "$PYTHON" -m pytest -q -s "$ROOT_DIR/evidence/yz-rd-t031/native_return_e2e.py"
    ;;
  *)
    echo "Usage: run-native.sh [baseline|final]" >&2
    exit 2
    ;;
esac
