#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
SHARED_RUNTIME_ROOT="${YZ_T015_TOOLCHAIN_ROOT:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/runtime-local/native-web}"
SOURCE_DIR="${YZ_T015_SOURCE_DIR:-$(dirname "$ROOT_DIR")/yuzan-workspace-main/习题课程资源}"
MODE="${1:-all}"
STARTED=0

native() {
  "$ROOT_DIR/scripts/dev-native-web" --task t015 --shared-runtime-root "$SHARED_RUNTIME_ROOT" "$@"
}

stop_owned_runtime() {
  if [[ "$STARTED" == "1" ]]; then
    native stop
    STARTED=0
  fi
}
trap stop_owned_runtime EXIT INT TERM

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
native setup-test
native start --profile assessment
STARTED=1
native import-question-bank --source-dir "$SOURCE_DIR"
native test t008-student-history
native test t012-student-practice
native test t013-student-today-growth
native test t011-draft-review-feedback
native stop
STARTED=0
final_status="$(native status)"
printf '%s\n' "$final_status"
if printf '%s\n' "$final_status" | rg -q '\[(UP|DOWN|IDENTITY_ERROR|RUNNING)\]|port owned by \['; then
  echo "T015 native process/port cleanup did not reach a stopped state." >&2
  exit 1
fi
echo "T015 native Chromium/API/PostgreSQL/MinIO acceptance: PASS ($MODE)"
