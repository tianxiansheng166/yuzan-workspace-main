#!/usr/bin/env bash
# Run the Level 1 control-flow regression against an explicitly mock-enabled
# local scorer.  It never writes MOCK_SPEECH_SCORING to .env or production
# configuration, and restores a normal local scorer if it replaced one.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SPEECH_DIR="$ROOT_DIR/backend/speech-scoring"
SPEECH_PORT="${SPEECH_API_PORT:-8100}"
TEST_FILE="$ROOT_DIR/tests/e2e/assessment/level-one-question-bank.spec.py"
SPEECH_LOG="$(mktemp -t yuzan-level-one-speech.XXXXXX.log)"
ORIGINAL_PID=""
MOCK_PID=""

stop_process() {
  local pid="$1"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    wait "$pid" 2>/dev/null || true
  fi
}

wait_for_scorer() {
  local deadline=$((SECONDS + 30))
  until curl --fail --silent "http://127.0.0.1:${SPEECH_PORT}/health" >/dev/null; do
    if (( SECONDS >= deadline )); then
      echo "Mock speech scorer did not become healthy; log follows:" >&2
      tail -n 100 "$SPEECH_LOG" >&2 || true
      return 1
    fi
    sleep 1
  done
}

start_scorer() {
  local mode="$1"
  (
    cd "$SPEECH_DIR"
    if [[ "$mode" == "mock" ]]; then
      exec env MOCK_SPEECH_SCORING=true python -m uvicorn app.main:app \
        --host 127.0.0.1 --port "$SPEECH_PORT"
    fi
    exec env -u MOCK_SPEECH_SCORING python -m uvicorn app.main:app \
      --host 127.0.0.1 --port "$SPEECH_PORT"
  ) >"$SPEECH_LOG" 2>&1 &
  MOCK_PID=$!
  wait_for_scorer
}

restore_default_scorer() {
  stop_process "$MOCK_PID"
  MOCK_PID=""
  if ! lsof -t -iTCP:"$SPEECH_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    start_scorer default
    echo "Restored the default local speech scorer with MOCK_SPEECH_SCORING unset."
  fi
  rm -f "$SPEECH_LOG"
}

trap restore_default_scorer EXIT

mapfile -t listening_pids < <(lsof -t -iTCP:"$SPEECH_PORT" -sTCP:LISTEN || true)
if (( ${#listening_pids[@]} > 1 )); then
  echo "Expected at most one local speech scorer on port $SPEECH_PORT; found: ${listening_pids[*]}" >&2
  exit 1
fi
if (( ${#listening_pids[@]} == 1 )); then
  ORIGINAL_PID="${listening_pids[0]}"
  original_command="$(ps -p "$ORIGINAL_PID" -o command=)"
  if [[ "$original_command" != *"uvicorn app.main:app"* ]]; then
    echo "Port $SPEECH_PORT is owned by an unrelated process: $original_command" >&2
    exit 1
  fi
  stop_process "$ORIGINAL_PID"
fi

start_scorer mock
echo "Running Level 1 regression with MOCK_SPEECH_SCORING=true (test-only process)."
if (( $# > 0 )); then
  "$@"
else
  python "$TEST_FILE"
fi
