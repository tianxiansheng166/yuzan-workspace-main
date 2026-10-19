# YZ-RD-T041 API lint debt slice

| Field | Value |
|---|---|
| TASK_ID | `YZ-RD-T041` |
| STATUS | `PARTIAL_WITH_DEBT` |
| BASE_SHA | `b3a731bb32f404f4a55f4d4f56d265514d324d40` |
| BRANCH | `feat/yz-rd-t041-api-lint-debt-first-slice` |
| FINAL_SHA | reported in the task return; this file is part of that commit |
| READY_TO_MERGE | `NO` |
| L4_OPEN | `OPEN` |

## Lint counts

| Measurement | Errors | Warnings | Evidence |
|---|---:|---:|---|
| T046 full API lint baseline | 1,201 | 1 | [raw T046 lint output](before-t046-api-lint.txt) |
| T041 full API lint, after | 1,960 | 0 | [raw T041 lint output](api-lint.txt) |
| T046 API `src` findings | 1,037 | 1 included above | Parsed from the same T046 output |
| T041 API `src` findings | 60 | 0 | Parsed from the same T041 output |

T046's 1,201 errors consisted of 1,037 source findings and 164 TypeScript project-service parsing errors for API tests. T041 gives the API tests a TypeScript project and resolves the lone `.mjs` default-project case; the final full lint has zero parser errors. Type-aware lint now reports 1,900 real test-file findings that were hidden behind those 164 parser errors, so the overall count is higher even though source findings fell by 977 (about 94%). These newly visible test findings are not waived.

The requested latest-evidence checkpoint is T046 commit `0f6ea3710797612aa08f37944a9ab9d92f033da1`; its RESULTS records 1,201 errors / 1 warning and its raw log is included above.

## Real fixes

- Added a test TypeScript project at `backend/api/test/tsconfig.json`, with source files in the program and no emitted output. ESLint can now type-check the test files.
- Configured the one JavaScript smoke file to use the parser service's default project. It continues to be linted; it is not ignored.
- Declared the flat-config import `@eslint/js@9.39.4` as an API development dependency and recorded it in `pnpm-lock.yaml`.
- Replaced `any` annotations in the practice catalog and remediation paths with generated Prisma payload types, `Prisma.TransactionClient`, typed selects, and a validated diagnosis shape.
- Added a shared Prisma JSON boundary converter and used it for AI lesson-plan snapshots, internal assessment results, and speech-provider results. It rejects non-JSON values before persistence.
- Removed unused imports. Unavailable adapters now return rejected promises directly, preserving their asynchronous failure contract without unnecessary `async` functions; required but unused port arguments are explicitly discarded with `void`.
- Applied ESLint's safe automatic fixes for unnecessary assertions. No ESLint rules were disabled and no `any` was added.

## Regression results

- API typecheck: **PASS** — `corepack pnpm --filter @yuzan/api typecheck` ([log](api-typecheck.txt)).
- API Vitest: **73 files passed, 10 environment-gated files skipped; 1,109 tests passed, 64 skipped** ([log](api-tests.txt)).
- Contracts: **6/6 passed** ([log](contracts-tests.txt)).
- `git diff --check`: **PASS**.

## Remaining debt

The final full lint still has **1,900 test errors and 60 source errors**. Test diagnostics are concentrated in test doubles and include unsafe member access (491), `require-await` (321), unsafe assignment (266), unsafe arguments (252), explicit `any` (240), unsafe calls (196), and unused variables (57). The remaining source diagnostics include 24 unsafe enum comparisons, 15 unsafe returns, 7 unsafe object stringifications, 5 unnecessary `async` methods, 3 unsafe assignments, and other smaller groups.

The API lint gate is still open. `READY_TO_MERGE=NO`; there is no waiver. L4 was not accessed and remains `OPEN`.

## Operating policy note

The target checkout's `AGENTS.md` has no `AA-DEV-V2.2` marker, and the task card supplied no Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline governed this offline source task. The task used a separate worktree from the exact base SHA; the shared `feat/question-bank-v1` checkout was not edited.
