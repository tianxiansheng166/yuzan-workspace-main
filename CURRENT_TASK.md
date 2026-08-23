# CURRENT TASK

Task: QB-013 — Teacher diagnostic dashboard
Status: TODO

## Starting point

- QB-012 is complete. `qb-progress-v1` is a read-only student progress view:
  formal trends compare only completed `STANDARD` Question Bank reports within
  the same `practiceDefinitionId`, while remediation compares only exact
  `questionVersionId` matches to its source formal session.
- QB-009B remains `PARKED / EXTERNAL_INPUT`. Do not call speech providers or
  start calibration work.

## Constraints

- Keep server-side school, resource, and student scope checks.
- Do not change formal report/diagnosis data or use provider candidate points
  as formal authority.
- Do not modify or stage `pnpm-workspace.yaml`,
  `infra/database/prisma/seed.ts`,
  `tests/e2e/assessment/question-bank-runner.spec.py`, or
  `frontend/assessment/assets/question-bank/`. Never modify original files
  under `local_sources/`.
