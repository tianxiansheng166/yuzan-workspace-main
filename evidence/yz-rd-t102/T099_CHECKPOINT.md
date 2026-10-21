# YZ-RD-T102 checkpoint — unanswered assessment submission

- TASK_ID: `YZ-RD-T102`
- BASE: `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`
- Source task reviewed: T099 `f2c28565e50601e55cd22e1954f743a4031fd0fe`
- Commit SHA: recorded after this checkpoint is committed.
- Purpose: allow partial and fully unanswered submissions while preserving authentication, session ownership and state checks, failed-upload blocking, pending-save handling, and idempotency. Blank/missing written answers are left unanswered; nonblank persisted answers can be finalized at submit. Valid QuestionBank written items without answers are recorded as zero with `UNANSWERED`, while real recordings stay on the speech review path.

## Files

- `backend/api/src/modules/assessment/assessment.service.ts`
- `backend/api/src/modules/assessment/question-bank-deterministic-scoring.service.ts`
- `backend/api/test/assessment/assessment.service.spec.ts`
- `backend/api/test/assessment/question-bank-deterministic-scoring.service.spec.ts`
- `frontend/assessment/assets/app.js`
- `frontend/assessment/assets/runner.js`
- `frontend/assessment/assets/runner.css`
- `frontend/tests/assessment/t102-unanswered-submit.test.mjs`

## Verification

- PASS: focused T102 Runner/formal-submit regressions, 10/10.
- PASS: API package suite, 66 files / 1,056 tests passed; 10 files / 64 tests skipped by existing suite configuration. The package test script ran the full API suite despite the supplied file filter.
- PASS: API TypeScript typecheck.
- PASS: changed JavaScript syntax checks and `git diff --check` at this checkpoint.
- FAIL (tooling): API ESLint could not start because the checkout's ESLint config imports missing package `@eslint/js`; no source diagnostics were produced.
- NOT_RUN: authenticated browser/API E2E and database-backed submission flow; no isolated runtime was authorized or started.

## Known limitations and rollback

- The zero-score behavior applies to valid QuestionBank deterministic written items. Speech/audio items still require their existing recording or review behavior.
- Roll back this checkpoint with `git revert <checkpoint-commit-sha>` on the T102 branch. Do not reset or clean the worktree.
