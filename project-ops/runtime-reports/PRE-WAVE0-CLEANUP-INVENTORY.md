# PRE-WAVE0-CLEANUP-INVENTORY

## Scope

- Workspace root: `/home/admin01/Documents/yuzan-workspace-main`
- Main repo: `/home/admin01/Documents/yuzan-workspace-main/yuzan-next`
- Baseline commit at inventory time: `3bf720579637b679c97d7b319f141045e0aafd6a`

## Main Repo Command Snapshot

Executed:

- `git status --short`
- `git status --porcelain=v1 -uall`
- `git diff --stat`
- `git diff --name-status`
- `git ls-files --others --exclude-standard`
- `git diff --summary`

Observed:

- Tracked modified entries: `257`
- Untracked entries: `34`
- Content diff summary: `257 files changed, 0 insertions(+), 0 deletions(-)`
- Root cause of tracked changes: `257` tracked files are permission-only drift, all `100644 => 100755`
- Root cause of untracked changes: Prisma generated client files under `infra/database/generated/client/**`

## Worktree Snapshot

Checked:

- `worktrees/gov-001`
- `worktrees/gov-002`
- `worktrees/gov-003`
- `worktrees/gov-004`
- `worktrees/mig-001`

Observed:

- Each worktree shows the same permission-only drift pattern as `main`
- No content diff evidence was found in sampled worktree status output
- Current worktree branches still point to the old pre-baseline commit `6db5f8e`

## Categorized Status

### A. Tracked Source Changes

- Count: `257`
- Actual source/content delta: `none detected`
- Real change type: permission mode drift only
- Pattern: `100644 => 100755`

Breakdown:

- Repo root and meta files: `76`
- Workspace source and config files: `86`
- Docs and source-material files: `95`

Representative paths:

- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `apps/api/src/main.ts`
- `apps/web/app/pages/index.vue`
- `infra/database/src/index.ts`
- `packages/domain/src/sync/merge-progress.ts`
- `orchestration/tasks/GOV-001.json`
- `docs/03-architecture/04-离线同步架构.md`

Conclusion:

- These are not business-code edits.
- They are bulk file-mode drift and can be normalized safely after inventory.

### B. Untracked Generated Files

- Count: `34`
- Path root: `infra/database/generated/client/**`

Examples:

- `infra/database/generated/client/client.ts`
- `infra/database/generated/client/models/User.ts`
- `infra/database/generated/client/internal/class.ts`

Conclusion:

- These files are reproducible outputs from Prisma generate.

### C. Prisma Generated Files

- Source of generation:
  - `infra/database/prisma/schema.prisma`
  - generator output: `../generated/client`
- Runtime import path:
  - `infra/database/src/index.ts` exports from `../generated/client/client.js`

Conclusion:

- `infra/database/generated/` is required at runtime/build time but is generated, not hand-authored.
- It should be treated as reproducible generated output, not manual task code.

### D. Nuxt / Vite / Build Outputs

- Status at inventory time in Git:
  - no tracked `.nuxt/`, `.output/`, `dist/`, `build/`, `coverage/` deltas under repo status
- Existing ignore coverage:
  - `.nuxt/`
  - `.output/`
  - `dist/`
  - `coverage/`

Conclusion:

- These are not the source of the `258/259` dirty states.

### E. node_modules / Dependency Artifacts

- `node_modules/` already ignored
- No `node_modules` files appeared in repo status

Conclusion:

- Dependency directories are not the source of current dirty state.

### F. Logs and Runtime Reports

- No runtime report files appeared in repo Git status
- Runtime reports live outside repo root under `/home/admin01/Documents/yuzan-workspace-main/runtime-reports`

Conclusion:

- Runtime reports are not contaminating new-repo Git state.

### G. Formatting-Related Changes

- `pnpm exec prettier --check .` reported `147` formatting warnings before cleanup
- Warning distribution before ignore tuning:
  - Markdown: `17`
  - TypeScript / JavaScript: `19`
  - JSON: `62`
  - Vue: `8`
  - CSS: `3`
  - YAML: `3`
  - Generated files: `34`
- Main hotspots:
  - app/package/config source files
  - `orchestration/tasks/*.json`
  - selected docs
  - Prisma generated client files
  - `source-materials/other-ai/*.md`

Conclusion:

- Part of the 147 warnings are real baseline formatting gaps.
- Part are unwanted scan targets, especially `infra/database/generated/**` and migration/raw-material directories.

### H. Task Business Code Changes

- Count: `0` confirmed content changes
- No sampled diff showed source line edits, only mode changes

Conclusion:

- No evidence of started GOV-001 / GOV-002 / GOV-003 / GOV-004 / MIG-001 implementation was found in the current dirty state.

### I. Unclear or Cannot-Judge Files

- Count: `0` currently
- No file required a stop-the-line ambiguity escalation at inventory time

## Ignore / Generated Assessment

Current `.gitignore` already covers:

- `node_modules/`
- `.nuxt/`
- `.output/`
- `dist/`
- `coverage/`
- `*.log`
- `.env*` except `.env.example`

Current gaps relevant to this cleanup:

- `infra/database/generated/` is not ignored
- no `.prettierignore` exists

## Preliminary Findings

1. The dirty `258/259` state is primarily not business development; it is permission drift plus generated Prisma output.
2. The five existing task worktrees are outdated and inherit the same non-business dirty state.
3. Cleanup can proceed if it:
   - normalizes permission bits,
   - defines generated-file policy for `infra/database/generated/`,
   - creates a proper `.prettierignore`,
   - formats only intended repo files,
   - revalidates main cleanliness before worktree rebuild.
