# YZ-RD-T091 Results

- `TASK_ID`: YZ-RD-T091
- `STATUS`: COMPLETE
- `BASE`: `418362afc4377f1107401908ce17509aa721f2cf`
- `OUTPUT_BRANCH`: `feat/yz-rd-t091-question-bank-security-fixture-alignment`
- `WORKTREE`: `/home/tian/.devspace/worktrees/yuzan-workspace-t091`
- `REPO_AGENTS`: `/home/tian/.devspace/worktrees/yuzan-workspace-t091/AGENTS.md` (read)
- `ROOT_SAFETY_AGENTS`: `/home/tian/code/AGENTS.md` (read)
- `NOTION_POLICY_READ`: `READ_OK` (policy and lane pages fetched successfully; no Notion writes)
- `READY_TO_MERGE`: `NO`
- `HISTORICAL_L4_INCIDENT_OPEN`: `YES`

## Ownership and baseline

Before creating the worktree, the exact base was verified in T088's checkout. The owned security spec was clean in every registered worktree; the requested local/remote branch and T091 worktree did not exist. T088's `evidence/yz-rd-t088/question-bank-security.txt` records the same two failures reproduced below. Development and verification ran in the task-isolated T091 worktree.

The first security test expected the question version's `deliverySpec` snapshot to be created, but `PracticeService.createOrResume` rejected the fixture at `practice.service.ts:242` with `练习引用的题库题目版本不可用`. The fixture had a matching `questionVersionId`, `id`, `PUBLISHED` status, delivery/scoring specs, and same-school item, but no `publishedAt`. The negative security test expected `受保护的评分字段`, but received the same availability error before the protected-key assertion could run; its unsafe version also lacked `publishedAt` and `item` metadata.

The actual eligibility gate requires the reference and related version IDs to match, `status=PUBLISHED`, a finite non-future `publishedAt`, and `item.schoolId` equal to the current school before validating delivery fields. T087's `legitimateVersion()` fixture and invalid-case tests establish these minimum publication fields. No raw question-bank assets were scanned or opened.

## Change

Only `backend/api/test/assessment/question-bank.security.spec.ts` was edited. The two fixtures now include a valid past `publishedAt` and `item.schoolId` matching the active school (retaining `stableKey`). Their version IDs and relation IDs still match. Existing student-visible `deliverySpec`, backend-only `scoringSpec`, negative protected-key payload, assertions, and write-block assertion are unchanged. No service or production file was modified, and no test was weakened, skipped, or deleted.

## Verification

Commands below were run from the T091 worktree with Node `v24.20.0` and Corepack pnpm `10.13.1`. Exit codes and raw output are saved alongside this file.

| Check | Result | Raw log |
|---|---:|---|
| Baseline `question-bank.security.spec.ts` | `FAIL`, 2/2 as expected, exit 1 | `question-bank-security-baseline.log` |
| `question-bank.security.spec.ts` after fixture repair | `PASS`, 2/2, exit 0 | `question-bank-security.log` |
| T088 `practice.service.spec.ts` | `PASS`, 26/26, exit 0 | `t088-practice.log` |
| T087 `t087-practice-eligibility.spec.ts` | `PASS`, 30/30, exit 0 | `t087-practice-eligibility.log` |
| Authorized `assessment.service.spec.ts` | `PASS`, 30/30, exit 0 | `assessment-service-auth.log` |
| API source typecheck | `PASS`, exit 0 | `api-source-typecheck.log` |
| ESLint on modified spec | `PASS`, exit 0 | `target-lint.log` |
| `git diff --check` and `git diff --cached --check` | `PASS`, exit 0 | rerun against final staged state before commit |

No test cases were skipped. Each readable `.log` has a byte-exact `.raw.log.gz` sibling. The raw baseline attempt log is `question-bank-security-baseline-attempts.raw.log.gz`; it also retains an initial dependency-resolution invocation that could not start Vitest before the root dependency symlink was in place. The actual baseline reproduction in `question-bank-security-baseline.raw.log.gz` is the subsequent 2-failure run. Readable `.log` copies trim only trailing spaces in Vitest's source excerpt display.

A dependency install was attempted once from the launcher directory by mistake and stopped with exit 1 when workspace discovery encountered an external package lacking a lockfile. The attempt created no project files there; see `dependency-install-attempt.md` and `dependency-install.raw.log.gz`. For tests, only the task worktree's code/config was used. Temporary dependency symlinks to the already-installed T088 packages were removed afterward.

## Runtime boundary and final guard

- `PG_E2E=NOT_RUN`: no isolated, task-exclusive PostgreSQL/port proof was available or attempted. No service, database, Docker/Compose, or T089 runtime was started or touched.
- `ZERO_WRITES_INVALID_IF_APPLICABLE=NOT_APPLICABLE`: no database ran. The retained negative unit assertion verifies `assessmentItem.createMany` is not called for a delivery spec containing a protected scoring key.
- `FILE_OWNER_GUARD=PASS`: final changes are confined to the one owned spec and `evidence/yz-rd-t091/**`.
- The task branch is kept separate and is not merged into a shared branch.
