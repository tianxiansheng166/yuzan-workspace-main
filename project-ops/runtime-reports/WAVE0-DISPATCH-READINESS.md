# WAVE0-DISPATCH-READINESS

## 1. Final Status

- Status: `WAVE0_READY`
- Can dispatch five Wave 0 tasks in parallel: `Yes`

## 2. Real Source of the 258 / 259 Dirty States

Main repo before cleanup:

- `257` tracked dirty entries were permission-only drift
- exact pattern: `100644 => 100755`
- content delta summary at inventory time: `257 files changed, 0 insertions(+), 0 deletions(-)`
- `34` untracked entries were Prisma-generated client files under `infra/database/generated/client/**`

Five old worktrees before rebuild:

- each showed the same permission-only drift pattern as main
- each was still pinned to old commit `6db5f8e`
- sampled `git diff --stat` output showed `0` line insertions / deletions, confirming no business-code edits

Conclusion:

- the dirty state did **not** come from started GOV-001 / GOV-002 / GOV-003 / GOV-004 / MIG-001 implementation
- the dirty state came from:
  - bulk executable-bit drift
  - reproducible Prisma output not yet ignored
  - missing Prettier ignore baseline

## 3. Deleted / Ignored / Formatted / Committed File Classes

Deleted runtime-generated files:

- `yuzan-next/infra/database/generated/**`

Ignored going forward:

- `infra/database/generated/`
- `build/`
- `.cache/`
- existing ignored dependency/build paths retained

Prettier excluded via new `.prettierignore`:

- `node_modules/`
- `.pnpm-store/`
- `.nuxt/`
- `.output/`
- `dist/`
- `build/`
- `coverage/`
- `.cache/`
- `playwright-report/`
- `test-results/`
- `*.log`
- `infra/database/generated/`
- `source-materials/`

Formatted in the cleanup baseline:

- app/package/config source files
- selected docs under `docs/**`
- task JSON files under `orchestration/tasks/**`
- repo-level config files

Permission normalization:

- restored `257` tracked files from accidental executable bit back to repo-declared non-executable mode

## 4. generated Directory Handling

Decision:

- `infra/database/generated/` is reproducible Prisma output and should **not** be committed

Evidence:

- Prisma schema declares:
  - `generator client { output = "../generated/client" }`
- runtime code imports it through:
  - `infra/database/src/index.ts -> ../generated/client/client.js`

Handling applied:

1. added `infra/database/generated/` to `.gitignore`
2. deleted the generated working copy
3. reran `pnpm db:generate`
4. confirmed regeneration succeeds
5. confirmed generated files no longer pollute `git status`

## 5. Validation Results

Command exit codes from `runtime-reports/wave0-cleanup-logs`:

- `pnpm install --frozen-lockfile` -> `0`
- `pnpm db:generate` -> `0`
- `pnpm db:validate` -> `0`
- `pnpm typecheck` -> `0`
- `pnpm build` -> `0`
- `pnpm exec prettier --check .` -> `0`
- `pnpm contract:validate` -> `1`
- `pnpm lint` -> `1`
- `pnpm test` -> `1`
- `pnpm check` -> `1`

Interpretation:

- `db:generate` passed
- `db:validate` passed
- `typecheck` passed
- `build` passed
- `prettier` passed
- `contract:validate` fails only on the known GOV-002 OpenAPI baseline issues
- `lint` fails only because `packages/contracts` delegates to the same Redocly contract lint
- `test` fails only because `packages/contracts` delegates to the same Redocly contract lint
- `check` now passes Prettier first and then fails only when the same contract lint is reached through `lint`

## 6. Known contract:validate Failure Summary

Observed known failure set:

- `18` OpenAPI errors
- primary recurring rule: missing operation `summary`
- representative paths:
  - `/health/live`
  - `/health/ready`
  - `/auth/login`
  - `/auth/refresh`
  - `/auth/logout`
  - `/me`
  - `/course-versions`
  - `/classes`
  - `/assignments`
  - `/students/me/today`
  - `/activities/{activityId}/progress`
  - `/submissions/{submissionId}/feedback`
  - `/sync/push`
  - `/sync/pull`

These remain reserved for `GOV-002` and were not changed in this round.

## 7. Main HEAD and Git Status

- Main HEAD: `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- Main short SHA: `7cace54`
- Cleanup baseline commit hash: `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- Cleanup baseline commit message: `chore: normalize repository baseline before wave0`
- Previous baseline commit retained in history:
  - `3bf720579637b679c97d7b319f141045e0aafd6a`

Main git status after cleanup:

- empty

## 8. Worktree Rebuild Result

Old worktrees removed:

- `worktrees/gov-001`
- `worktrees/gov-002`
- `worktrees/gov-003`
- `worktrees/gov-004`
- `worktrees/mig-001`

Old branches removed:

- `task/gov-001-governance`
- `task/gov-002-contract`
- `task/gov-003-database`
- `task/gov-004-design-system`
- `task/mig-001-migration`

New worktrees recreated from latest `main` using `orchestration/scripts/bootstrap_worktree.sh`.

Final HEAD alignment:

- `main` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- `gov-001` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- `gov-002` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- `gov-003` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- `gov-004` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- `mig-001` -> `7cace5434ab8fb7187783fb2ecc88d94c862601b`

Final git status:

- `main` -> clean
- `gov-001` -> clean
- `gov-002` -> clean
- `gov-003` -> clean
- `gov-004` -> clean
- `mig-001` -> clean

## 9. Prompt Regeneration

Generated prompt files:

- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/GOV-001.txt`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/GOV-002.txt`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/GOV-003.txt`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/GOV-004.txt`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/MIG-001.txt`

Prompt verification:

- all five now contain absolute worktree paths
- all five contain the correct `task/*` branch
- no Windows paths found
- no real secrets found

Note:

- prompt generation required a workspace-level helper adjustment in `orchestration/scripts/render_task_prompt.py` so generated prompts emit absolute worktree paths

## 10. Actual Files Modified This Round

Committed into `yuzan-next` main:

- `.gitignore`
- `.prettierignore`
- formatted repo source/config/docs/task files across `apps/**`, `docs/**`, `infra/**`, `orchestration/tasks/**`, `packages/**`, and root config files

Modified outside repo Git but used for dispatch preparation:

- `/home/admin01/Documents/yuzan-workspace-main/orchestration/scripts/render_task_prompt.py`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-prompts/wave0/*.txt`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-reports/PRE-WAVE0-CLEANUP-INVENTORY.md`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-reports/wave0-cleanup-logs/*.log`

## 11. Residual Risks

- `packages/contracts/openapi/openapi.yaml` still contains the known `18` GOV-002 errors, so `contract:validate`, `lint`, `test`, and `check` remain non-zero until GOV-002 is executed
- the absolute-path fix for prompt generation currently lives in the workspace orchestration helper outside the `yuzan-next` repo; if that helper is replaced externally, prompts should be rechecked before another dispatch cycle

## 12. Overall Conclusion

Wave 0 dispatch prerequisites are satisfied:

- main is clean
- all five worktrees are clean
- all five worktrees match main HEAD
- Prettier passes
- Prisma generate/validate pass
- typecheck/build pass
- lint/test/check fail only for the already-known GOV-002 contract errors
- task prompts were regenerated and verified with correct absolute worktree paths
