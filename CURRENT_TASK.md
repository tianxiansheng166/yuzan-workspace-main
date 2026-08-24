# CURRENT TASK

Task: QB-015 — Question Bank release hardening and launch readiness
Status: BLOCKED / NOT_READY

## QB-015 checkpoint (2026-08-24)

Fresh install, isolated migration, source validation, fresh runtime apply,
media integrity, and the API/worker/frontend/Python gates passed. Two runtime
blockers were fixed: Prisma clean-worktree configuration now accepts a supplied
`DATABASE_URL` without a local `.env`, and a fresh MinIO Question Bank bootstrap
creates/verifies its configured bucket. A real PostgreSQL remediation query was
also corrected to handle legacy null origin rows safely.

Pilot approval remains blocked on the unimplemented executable evidence listed
in [`RELEASE_READINESS.md`](RELEASE_READINESS.md): QB-014 real-DB assignment,
QB-014 Chromium closure, teacher-assigned speech-review integration, and a
clean-runtime re-run of the six-level browser suite. Do not start QB-009B.

## Starting point

QB-014 is complete on `feat/question-bank-v1`: teacher-selected students can
receive a server-authoritative `REMEDIATION` subset from their own latest
completed Question Bank diagnosis. The next task is release hardening; do not
start speech calibration or call cloud speech providers.

## Existing context

- QB-013 is complete. Teachers can inspect a class-scoped, read-only Question
  Bank diagnostic dashboard for one `practiceDefinitionId`, including the
  latest formal result per active student, safe same-level self deltas, scoped
  remediation summaries, and existing review-queue handoff.
- QB-009B remains `PARKED / EXTERNAL_INPUT`. Do not call speech providers or
  start calibration work.

## Constraints

- Preserve QB-013's `AssessmentReviewService` class-scope authorization,
  no-ranking rule, aggregate privacy boundary, and formal/remediation isolation.
- Do not modify formal reports, persisted diagnoses, or historical assessment
  scores. Any assignment must be explicitly teacher-authorized and scoped.
- Do not modify or stage `pnpm-workspace.yaml`,
  `infra/database/prisma/seed.ts`,
  `tests/e2e/assessment/question-bank-runner.spec.py`, or
  `frontend/assessment/assets/question-bank/`. Never modify original files
  under `local_sources/`.
