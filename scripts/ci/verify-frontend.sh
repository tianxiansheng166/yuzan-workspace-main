#!/usr/bin/env bash
set -euo pipefail

# Local verification script for the canonical frontend layer.
# Does NOT run root-level checks affected by the pending GOV-002 baseline.
# For full repository checks, see .github/workflows/ci.yml (root-baseline job).

export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
echo "==> install"
pnpm install --frozen-lockfile

echo "==> frontend test"
pnpm --filter @yuzan/frontend test

echo "==> frontend typecheck"
pnpm --filter @yuzan/frontend typecheck

echo "==> frontend build"
pnpm --filter @yuzan/frontend build

echo "==> format check"
pnpm format:check

echo "==> git whitespace check"
git diff --check

echo "==> web verification passed"
