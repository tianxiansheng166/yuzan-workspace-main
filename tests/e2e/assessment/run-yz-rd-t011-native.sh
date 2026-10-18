#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SHARED_RUNTIME_ROOT="${YZ_T009_NATIVE_RUNTIME_ROOT:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/runtime-local/native-web}"
SOURCE_DIR="${YZ_T011_SOURCE_DIR:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/习题课程资源}"
MODE="${1:-all}"
STARTED=0

native() {
  "$ROOT_DIR/scripts/dev-native-web" --task t011 --shared-runtime-root "$SHARED_RUNTIME_ROOT" "$@"
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
  all|browser)
    ;;
  *)
    echo "Usage: $0 [all|browser|status]" >&2
    exit 2
    ;;
esac

native doctor --profile assessment
native start --profile assessment
STARTED=1
native import-question-bank --source-dir "$SOURCE_DIR"
native test teacher-dashboard
native test t007-assignment
native test t008-student-history
native test t011-draft-review-feedback
native stop
STARTED=0
final_status="$(native status)"
printf '%s\n' "$final_status"
if printf '%s\n' "$final_status" | rg -q '\[(UP|DOWN|IDENTITY_ERROR|RUNNING)\]|port owned by \['; then
  echo "T011 native process/port cleanup did not reach a stopped state." >&2
  exit 1
fi
echo "T011 native browser acceptance: PASS ($MODE)"
