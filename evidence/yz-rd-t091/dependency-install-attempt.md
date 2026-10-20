# Dependency setup attempt

- Command: `corepack pnpm install --frozen-lockfile --filter @yuzan/api...`
- Initial working directory: `/home/tian/code` (the launcher directory), not the task worktree.
- Exit code: 1. The workspace scan found an external workspace package without a lockfile and stopped before installation.
- No project files were created at the launcher root (`node_modules`, `package.json`, and `pnpm-lock.yaml` were absent when checked).
- The actual test commands were run from the T091 worktree with the pinned Corepack pnpm 10.13.1 and preinstalled API dependencies temporarily symlinked from T088. Both links were removed after verification. No T088 source files were changed.
