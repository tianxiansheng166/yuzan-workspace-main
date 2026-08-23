# CURRENT TASK

Task: QB-014 — Teacher targeted remediation assignment
Status: TODO

## Starting point

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
