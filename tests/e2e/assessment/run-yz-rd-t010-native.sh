#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SHARED_RUNTIME_ROOT="${YZ_T009_NATIVE_RUNTIME_ROOT:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/runtime-local/native-web}"
SOURCE_DIR="${YZ_T010_SOURCE_DIR:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/习题课程资源}"
MODE="${1:-all}"
STARTED=0

native() {
  "$ROOT_DIR/scripts/dev-native-web" --task t010 --shared-runtime-root "$SHARED_RUNTIME_ROOT" "$@"
}

stop_owned_runtime() {
  if [[ "$STARTED" == "1" ]]; then
    native stop
    STARTED=0
  fi
}
trap stop_owned_runtime EXIT INT TERM

if [[ ! -x "$SHARED_RUNTIME_ROOT/toolchain/pgdg/usr/lib/postgresql/17/bin/psql" || ! -x "$SHARED_RUNTIME_ROOT/venv/bin/python" ]]; then
  echo "T009 native PostgreSQL/Chromium toolchain is unavailable at the expected shared runtime root." >&2
  echo "Set YZ_T009_NATIVE_RUNTIME_ROOT to the existing T009 runtime; this entrypoint does not install dependencies." >&2
  exit 1
fi

case "$MODE" in
  status)
    native status
    exit $?
    ;;
  t007|t008|all)
    ;;
  *)
    echo "Usage: $0 [t007|t008|all|status]" >&2
    exit 2
    ;;
esac

status_output="$(native status)"
if printf '%s\n' "$status_output" | rg -q 'Config: ERROR|\[(UP|DOWN|IDENTITY_ERROR|RUNNING)\]|port owned by \['; then
  echo "Refusing to reuse a configured or occupied T010 runtime. Inspect it with: $0 status" >&2
  printf '%s\n' "$status_output" >&2
  exit 1
fi

native doctor --profile assessment
native start --profile assessment
STARTED=1
native import-question-bank --source-dir "$SOURCE_DIR"

if [[ "$MODE" == "t007" || "$MODE" == "all" ]]; then
  native test t007-assignment
fi
if [[ "$MODE" == "t008" || "$MODE" == "all" ]]; then
  native test t008-student-history
fi

native stop
STARTED=0
final_status="$(native status)"
printf '%s\n' "$final_status"
if printf '%s\n' "$final_status" | rg -q '\[(UP|DOWN|IDENTITY_ERROR|RUNNING)\]|port owned by \['; then
  echo "T010 native process/port cleanup did not reach a stopped state." >&2
  exit 1
fi
echo "T010 native browser acceptance: PASS ($MODE)"
