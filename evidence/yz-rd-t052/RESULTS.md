# YZ-RD-T052 API source lint

| Field | Value |
|---|---|
| TASK_ID | `YZ-RD-T052` |
| STATUS | `PARTIAL_WITH_DEBT` |
| BASE_SHA | `987e7321157033001b8548e0c0b4318d9f14e503` |
| BRANCH | `feat/yz-rd-t052-api-source-lint-remaining-60` |
| READY_TO_MERGE | `NO` |
| L4_OPEN | `OPEN` |

## Lint totals

Counts are ESLint errors (warnings: zero). The same full command, `eslint src test`, was run before and after on this isolated worktree.

| Measurement | Before | After |
|---|---:|---:|
| API `src` errors | 60 | 1 |
| API `test` errors | 1,900 | 1,900 |
| API full lint errors | 1,960 | 1,901 |

The before JSON is [api-lint-before.json](api-lint-before.json); the after JSON is [api-lint-after.json](api-lint-after.json). The before distribution matches the accepted T041 checkpoint and its [raw lint output](../yz-rd-t041/api-lint.txt).

## Fixes

Fixed 59 source diagnostics across 30 source files:

- 24 unsafe enum comparisons now compare the corresponding domain or Prisma enum members. This retains existing role and membership authorization decisions.
- 15 unsafe transform returns now expose `unknown` at DTO input boundaries; recursive log redaction now handles array entries as `unknown`.
- 7 object stringification findings now use validated strings, explicit primitive formatting, or JSON serialization. Invalid school-import fields are no longer converted to `"[object Object]"`.
- 5 `require-await` findings were corrected while retaining Promise behavior where callers rely on it; synchronous access checks and the database shutdown hook no longer claim to be asynchronous.
- The remaining 8 findings were fixed: 2 unbound methods, 3 unsafe assignments, 2 redundant string-union members, and 1 unnecessary regex escape.

No scoring calculations or manual review behavior changed. The edits preserve nullable score fields and formal numeric zero; the scoring regex change only removes an unnecessary escape. Contracts, tests, ESLint rules, L4 data, and T005-protected paths were not modified.

## T049 ownership

The only remaining source diagnostic is `@typescript-eslint/no-empty-object-type` at `backend/api/src/modules/curriculum/ports/prisma-course-version.repository.ts:700`. T049 is actively editing this file, so T052 left it untouched. No paths in the T052 source diff overlap the current T049 dirty path set. This is recorded as an ownership conflict on the remaining lint item, not an overlapping edit.

## Verification

- Full API lint: **1,901 errors, 0 warnings** after the fix (1 source error and 1,900 test errors). Test debt remains and is not waived.
- API source typecheck (`tsc -p tsconfig.json --noEmit`): **PASS**.
- API Vitest: **73 files passed, 10 environment-gated files skipped; 1,109 tests passed, 64 skipped** ([api-tests.txt](api-tests.txt)).
- API test-project typecheck (`tsc -p test/tsconfig.json --noEmit`): **269 diagnostics**. The exact baseline run has the same 269 diagnostics and no differences ([current](test-typecheck-current.txt), [baseline](test-typecheck-baseline.txt)); test files are outside this task's edit scope.
- `git diff --check`: **PASS**.

The first Vitest invocation lacked the isolated worktree's ignored database build output and failed during module loading. It was rerun with the existing same-base database build output available; the final full suite passed with the skips above.

## Policy and readiness

The target checkout `AGENTS.md` has no `AA-DEV-V2.2` marker, and this Task Card supplied no Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline governed this offline source task. No runtime services or L4 data were accessed.

`READY_TO_MERGE=NO`: full API lint still has 1,901 errors, including the 1,900 test-file findings and the one T049-owned source finding. `L4_OPEN=OPEN`.
