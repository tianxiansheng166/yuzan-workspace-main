# CURRENT TASK

Task: QB-012 — Learning progress and improvement tracking
Status: TODO

## Goal

Define the next product increment for learning progress and improvement tracking.
Do not begin implementation until it is separately authorized.

## Starting point

- QB-011 is complete: a completed formal session's persisted diagnosis can
  create a server-authoritative, scoped remediation attempt. It is not a
  formal report and does not change the source formal result.
- QB-009B remains `PARKED / EXTERNAL_INPUT`. Do not call speech providers or
  start calibration work.

## Constraints

- Keep server-side school, resource, and student scope checks.
- Keep formal assessment results distinct from future learning-progress views;
  never use provider candidate points as formal authority.
- Do not modify or stage `pnpm-workspace.yaml`,
  `infra/database/prisma/seed.ts`,
  `tests/e2e/assessment/question-bank-runner.spec.py`, or
  `frontend/assessment/assets/question-bank/`. Never modify original files
  under `local_sources/`.
