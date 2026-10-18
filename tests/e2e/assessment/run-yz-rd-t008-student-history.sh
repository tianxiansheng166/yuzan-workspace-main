#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'DISABLED: this legacy T008 launcher is retired. It no longer starts or cleans any shared service.' >&2
printf '%s\n' 'Use tests/e2e/assessment/run-yz-rd-t010-native.sh from the T010 integration worktree.' >&2
exit 2
