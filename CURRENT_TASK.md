# CURRENT TASK

Task: QB-009 — Production speech provider benchmark and scoring calibration
Status: TODO

## Recovery placeholder

QB-008R completed the authorized content-recovery and Levels 1–6 rollout:

- structural recovery is applied before canonical validation and records
  `STRUCTURAL_RECOVERY` provenance;
- Level 2 has one reproducible `AI_AUTHORED_GAP_FILL` READ_ALOUD ledger item;
- original DOCX/ZIP files under `local_sources/` remain read-only;
- all six level practices are published through the immutable question-bank
  runtime pipeline.

Do not begin QB-009 in this task. Local speech diagnostics remain experimental
and uncalibrated; any production provider benchmark must preserve the existing
server-side scoring/review boundary and must not turn diagnostics into formal
scores without an explicit calibration decision.

## Protected paths

Do not modify or stage the task-start dirty `pnpm-workspace.yaml`,
`infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.
