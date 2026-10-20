# YZ-RD-T088 — Practice legacy fixture alignment

TASK_ID: YZ-RD-T088
STATUS: PARTIAL — owned legacy Practice suite and T087 security suite pass; an additional out-of-owner Question Bank security spec still has two stale-fixture failures.
BASE: `49b4bf7e662b422155dd71ac209e5efbe2962d3d`
BRANCH: `feat/yz-rd-t088-practice-legacy-fixture-alignment`
WORKTREE: `/home/tian/.devspace/worktrees/yuzan-workspace-t088`
NOTION_POLICY_READ: READ_OK (policy and Lane pages fetched)
FINAL_SHA: Reported at task return; a commit cannot contain its own SHA.

## Scope and ownership

- `FILE_OWNER_GUARD=PASS`: the shared checkout had unrelated dirty T005/Contracts/course paths and was left untouched. The exact T087 base worktree and both task-owned test paths were clean before work. Changes are limited to `backend/api/test/assessment/practice.service.spec.ts` and this evidence directory.
- T087's `practice.service.ts` and `t087-practice-eligibility.spec.ts` are unchanged. No Prisma schema, Contracts, teacher authoring, frontend, or `student-courses` file was changed.
- The valid synthetic fixture now has a non-null `questionVersionId` equal to `questionVersion.id`, `PUBLISHED`, a valid historical `publishedAt`, same-school `item.schoolId`, a student-safe `deliverySpec`, and backend-only `scoringSpec`. Its legacy `config` contains poisoned fallback values; the persisted snapshot assertion confirms neither those values nor scoring data appear.
- Added no-write cases cover null reference, missing relation, DRAFT, foreign-school item, NULL-school item, and an already-open attempt with a DRAFT version. Each asserts `assessmentSession.create=0` and `assessmentItem.createMany=0`; invalid eligibility is rejected before querying an existing attempt.
- Existing standalone practice, course context, multi-enrollment, and same-attempt OPEN resume assertions remain and pass.

## Baseline and final tests

Environment: Node `v24.20.0`, pnpm `10.13.1`, Vitest `3.2.7`. No database connection was made. Database client generation and database/Contracts builds were local dependency preparation only.

| Suite | Baseline | Baseline exit | Final | Final exit |
| --- | ---: | ---: | ---: | ---: |
| `practice.service.spec.ts` | 10 PASS / 10 FAIL (20) | 1 | 26 PASS / 0 FAIL | 0 |
| `t087-practice-eligibility.spec.ts` | 30 PASS / 0 FAIL | 0 | 30 PASS / 0 FAIL | 0 |
| `assessment.service.spec.ts` authorization | — | — | 30 PASS / 0 FAIL | 0 |
| `question-bank.security.spec.ts` | — | — | 0 PASS / 2 FAIL | 1 |

Unique final targeted total: `86 PASS / 2 FAIL / 0 SKIP`. The Question Bank security failures are in an unchanged, out-of-owner test file: both fixture versions lack the publication metadata required by the T087 gate and are rejected before their payload assertions. No change was made outside the owner paths. An initial combined authorization run before building local workspace package outputs could not resolve `@yuzan/database`; after local package builds, `assessment.service.spec.ts` was rerun independently and passed 30/30. The separate Question Bank spec was also rerun after the builds and reproduced its two fixture failures.

Commands and exit codes are recorded in the adjacent `.txt` files. The baseline is consistent with T087's receipt: old Practice 10/20, T087 security 30/30.

## Additional gates

- `ZERO_WRITES_INVALID=PASS` for all six new invalid legacy cases.
- `LEGAL_OPEN_SAME_ATTEMPT=PASS`.
- `AUTH_COURSE_SCOPE=PASS` in the owned Practice coverage, T087 security coverage, and the 30-test Assessment authorization suite.
- API source typecheck: `PASS`, exit 0 (`api-typecheck.txt`).
- Target lint for the modified spec: `PASS`, exit 0 (`target-lint.txt`).
- Full API lint: `INHERITED_NOT_RERUN`.
- Native PostgreSQL E2E: `NOT_RUN`; no isolated database was available or started. No Docker/Compose, Redis, MinIO, or browser runtime was used.
- `TEST_FIXTURE_ONLY=YES`; this is not formal question-bank publication or native real-content E2E acceptance.
- `L4_SOURCE_READ=NO`; `L4_IMPORT_APPLIED=NO`; `L4_RUNTIME_OPENED=NO`; `HISTORICAL_L4_INCIDENT_OPEN=YES`.
- `git diff --check`: final result recorded at task return. `READY_TO_MERGE=NO`.
