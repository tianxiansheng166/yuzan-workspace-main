# CURRENT TASK

Task: QB-017B — Pilot learning validation
Status: TODO

QB-017A Student Today — Next Best Learning Action MVP is DONE / BROWSER VERIFIED.
The next task is to validate the real pilot cohort's learning path, action
clarity, and teacher review loop using the deployed pilot runbook.

QB-016 Pilot Observability & Feedback Loop is DONE / PILOT_OBSERVABLE.
QB-015F Release Evidence Closure remains DONE / READY_FOR_PILOT. Its four
release blockers passed in the isolated runtime and are recorded in
[`RELEASE_READINESS.md`](RELEASE_READINESS.md).

QB-009B remains `PARKED / EXTERNAL_INPUT`; do not call real iFlytek/Tencent
APIs or begin calibration without the required external inputs and product
decision.

## Protected paths

- Do not modify or stage `pnpm-workspace.yaml` (pre-existing user change).
- Do not modify `infra/database/prisma/seed.ts` or
  `tests/e2e/assessment/question-bank-runner.spec.py`.
- Do not modify `frontend/assessment/assets/question-bank/` or original files
  under `local_sources/`.
