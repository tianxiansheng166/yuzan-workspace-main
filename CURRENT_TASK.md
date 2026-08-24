# CURRENT TASK

Task: QB-016 — Pilot observability and feedback loop
Status: TODO

QB-015F Release Evidence Closure is DONE / READY_FOR_PILOT. Its four release
blockers passed in the isolated runtime and are recorded in
[`RELEASE_READINESS.md`](RELEASE_READINESS.md).

Do not start QB-016 in the completed QB-015F task turn. QB-009B remains
`PARKED / EXTERNAL_INPUT`; do not call real iFlytek/Tencent APIs or begin
calibration without the required external inputs and product decision.

## Protected paths

- Do not modify or stage `pnpm-workspace.yaml` (pre-existing user change).
- Do not modify `infra/database/prisma/seed.ts` or
  `tests/e2e/assessment/question-bank-runner.spec.py`.
- Do not modify `frontend/assessment/assets/question-bank/` or original files
  under `local_sources/`.
