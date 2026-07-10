#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
cd "$REPO"

git rev-parse --is-inside-work-tree >/dev/null
BRANCH="$(git branch --show-current)"
HEAD="$(git rev-parse HEAD)"
STATUS="$(git status --porcelain)"

echo "branch=$BRANCH"
echo "head=$HEAD"
echo "status_lines=$(printf '%s\n' "$STATUS" | sed '/^$/d' | wc -l)"
echo "remote_origin=$(git remote get-url origin)"

if [[ -z "$BRANCH" ]]; then
  echo "PREFLIGHT_DETACHED_HEAD_FOR_DEVELOPMENT" >&2
  exit 41
fi

if [[ -n "$STATUS" ]]; then
  echo "PREFLIGHT_DIRTY_WORKTREE" >&2
  printf '%s\n' "$STATUS" >&2
  exit 42
fi

test -f package.json
test -d apps/web
test -d packages/contracts
test -d packages/ui

echo "PREFLIGHT_OK"
