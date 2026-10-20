# YZ-RD-T051 API test lint first slice

| Field | Value |
|---|---|
| TASK_ID | YZ-RD-T051 |
| STATUS | PARTIAL_WITH_DEBT |
| BASE_SHA | 987e7321157033001b8548e0c0b4318d9f14e503 |
| BRANCH | feat/yz-rd-t051-api-test-lint-first-slice |
| FINAL_SHA | reported in task return; this evidence is part of that commit |
| READY_TO_MERGE | NO |
| L4_OPEN | OPEN |

## Lint counts

| Measurement | Before | After | Change |
|---|---:|---:|---:|
| API src errors | 60 | 60 | 0 |
| API test errors | 1,900 | 1,780 | -120 |
| API total errors | 1,960 | 1,840 | -120 |
| Warnings | 0 | 0 | 0 |
| TypeScript parser errors | 0 | 0 | 0 |

The before counts and distribution come from T041’s original full lint log, [api-lint.txt](../yz-rd-t041/api-lint.txt). The final full lint output is [api-lint-after.txt](api-lint-after.txt). It exited 1 because the wider API debt remains.

## Distribution and owned test files

T041 reported 1,900 test findings across 86 test files. The selected module was assessment. The 10 selected files carried 120 findings, concentrated in no-explicit-any (37), no-unsafe-argument (33), require-await (22), no-unsafe-member-access (14), no-unsafe-assignment (8), no-unsafe-call (3), and prefer-const (3).

All selected files now pass targeted ESLint:

- [assessment-review.queue.spec.ts](../../backend/api/test/assessment/assessment-review.queue.spec.ts)
- [qb015f.teacher-assignment.runtime.integration.spec.ts](../../backend/api/test/assessment/qb015f.teacher-assignment.runtime.integration.spec.ts)
- [question-bank-assessment-scoring.spec.ts](../../backend/api/test/assessment/question-bank-assessment-scoring.spec.ts)
- [question-bank-deterministic.integration.spec.ts](../../backend/api/test/assessment/question-bank-deterministic.integration.spec.ts)
- [question-bank-progress.runtime.integration.spec.ts](../../backend/api/test/assessment/question-bank-progress.runtime.integration.spec.ts)
- [question-bank-progress.service.spec.ts](../../backend/api/test/assessment/question-bank-progress.service.spec.ts)
- [question-bank.runtime.integration.spec.ts](../../backend/api/test/assessment/question-bank.runtime.integration.spec.ts)
- [question-bank.security.spec.ts](../../backend/api/test/assessment/question-bank.security.spec.ts)
- [remediation.runtime.integration.spec.ts](../../backend/api/test/assessment/remediation.runtime.integration.spec.ts)
- [teacher-question-bank-diagnostic.service.spec.ts](../../backend/api/test/assessment/teacher-question-bank-diagnostic.service.spec.ts)

The fixes give test doubles concrete input and return types, use typed Prisma boundaries for generated clients, and remove unnecessary async callbacks. Existing scoring, ownership, school, class, and protected-field assertions remain in place. No ESLint rules were disabled, no eslint-disable directives were added, no any annotation was added, and no backend/api/src file changed.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Targeted ESLint for all 10 selected files | PASS; 0 errors, 0 warnings, 0 parser errors | [targeted-lint.txt](targeted-lint.txt) |
| Affected Vitest files | PASS; 20 passed, 0 failed, 7 skipped across 10 files | [api-tests.txt](api-tests.txt) |
| Full API lint | 60 src + 1,780 test = 1,840 errors; 0 warnings; 0 parser errors | [api-lint-after.txt](api-lint-after.txt) |
| git diff --check | PASS | command output |

The seven skips are database integration cases. DATABASE_URL and QB_RUNTIME_DATABASE_URL were unset for the targeted run so no database service was contacted. The database client was generated and built locally to make the fresh worktree’s API package resolvable.

## Remaining debt

The full API lint gate remains open with 1,780 test errors and 60 source errors. The largest remaining test rule groups are unsafe member access (477), require-await (299), unsafe assignment (258), unsafe arguments (219), explicit any (203), and unsafe calls (193). No waiver was applied.

The checkout AGENTS.md has no AA-DEV-V2.2 marker, and the task card supplied no Lane policy reference. The user-provided /home/tian/code/AGENTS.md safety baseline governed this offline source task. No L4 runtime or database service was accessed.
