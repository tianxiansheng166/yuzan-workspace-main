#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
SHARED_RUNTIME_ROOT="${YZ_T044_TOOLCHAIN_ROOT:-$ROOT_DIR/runtime-local/native-web}"
MODE="${1:-all}"
STARTED=0

native() {
  "$ROOT_DIR/scripts/dev-native-web" --task t044 --shared-runtime-root "$SHARED_RUNTIME_ROOT" "$@"
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
native test t044-practice-catalog
native stop
STARTED=0
final_status="$(native status)"
printf '%s\n' "$final_status"
if printf '%s\n' "$final_status" | rg -q '\[(UP|DOWN|IDENTITY_ERROR|RUNNING)\]|port owned by \['; then
  echo "T044 native process/port cleanup did not reach a stopped state." >&2
  exit 1
fi
echo "T044 native Chromium/API/PostgreSQL/MinIO acceptance: PASS ($MODE)"
