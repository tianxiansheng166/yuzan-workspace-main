#!/usr/bin/env bash
set -euo pipefail
TASK_ID="${1:?Usage: bootstrap_worktree.sh TASK-ID}"
REPO="${2:-$(pwd)}"
BOARD="$(cd "$(dirname "$0")/.." && pwd)/tasks/${TASK_ID}.json"
test -f "$BOARD" || { echo "Unknown task: $TASK_ID"; exit 1; }
BRANCH=$(python -c "import json; print(json.load(open('$BOARD', encoding='utf-8'))['branch'])")
WORKTREE=$(python -c "import json; print(json.load(open('$BOARD', encoding='utf-8'))['worktree'])")
git -C "$REPO" worktree add -b "$BRANCH" "$WORKTREE" main
echo "Created $WORKTREE on $BRANCH"
