# YZ-RD-T097 Results

## Scope and startup guards

- Repository: `tianxiansheng166/yuzan-workspace-main`
- BASE: `ef1227121f969c71aed6d3df8c6b8a7b7a6bc7e6`
- Branch/worktree: `fix/yz-rd-t097-submissions-test-config-fixture` at `/home/tian/.devspace/worktrees/yuzan-workspace-t097`
- `/home/tian/code/AGENTS.md`, BASE `AGENTS.md`, `README-FIRST.md`, `CURRENT_HANDOFF.md`, and `CURRENT_TASK.md` were read. BASE T095 results and the frozen submissions regression log were read before changes.
- Notion policy 17, 17A, the supplied YZ-RD project entry, and the YZ-RD route record were fetched: `NOTION_POLICY_READ=READ_OK`. `AA-DEV-V2.2` is not applicable to YZ-RD.
- The launcher checkout was dirty and at another commit; it and all other task worktrees were left untouched. The T097 worktree was created from the exact BASE after checking branch and path conflicts.
- The fresh worktree had no `node_modules`. Dependencies were materialized from the pnpm store with `pnpm install --offline --frozen-lockfile --ignore-scripts`: 783 packages reused, 0 downloaded. Prisma client generation used a non-routable placeholder `DATABASE_URL`; no DB connection, migration, or service was attempted. Workspace dependencies were built from BASE sources.

## Baseline

The scoped SubmissionsService test run reproduced **13 setup failures / 13 tests**, all before assertions. Nest could not resolve `ConfigService` for `SPEECH_QUEUE` in `SpeechJobModule` while constructing the imported `SubmissionsModule` fixture. The exact baseline log is [`submissions-baseline.log`](submissions-baseline.log).

## Test-harness repair

Only `backend/api/test/modules/submissions/submissions.service.spec.ts` changed. Its test module now imports a global `ConfigModule` that ignores `.env` and process environment values and loads the deterministic `SPEECH_PROVIDER=disabled` setting. `SpeechJobModule` therefore resolves `ConfigService` and returns a null queue without Redis. The SubmissionsService implementation and all 13 assertions remain unchanged; no production module wiring was altered.

## Validation

| Check | Result |
| --- | --- |
| Baseline SubmissionsService suite | **13 setup failures / 13 tests; no assertions ran** |
| Final SubmissionsService suite | **13 passed / 0 failed / 0 skipped** |
| T095 Feedback service and policy suite | **36 passed / 0 failed / 0 skipped** |
| API typecheck | **PASS** |
| Lint on changed test file | **PASS** |
| `git diff --check` | **PASS** |
| Full API lint | **Inherited, not rerun or waived:** T095 measured 320 errors / 0 warnings across 50/592 files; 0 findings in T095-owned paths; exit 1 |
| Native PostgreSQL E2E | **NOT_RUN**; no services were started or contacted |

Raw logs: [`submissions-final.log`](submissions-final.log), [`t095-feedback-tests.log`](t095-feedback-tests.log), [`api-typecheck.log`](api-typecheck.log), [`target-lint.log`](target-lint.log), [`git-diff-check.log`](git-diff-check.log), [`database-generate.log`](database-generate.log), and [`workspace-dependency-build.log`](workspace-dependency-build.log).

## Claim boundary and remaining blockers

- This repairs test setup so the existing read/list/create/submit business assertions run; it does not change production behavior or weaken tests.
- Full API lint debt remains inherited and unwaived. Native PostgreSQL E2E remains unverified. `READY_TO_MERGE=NO`.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`.
