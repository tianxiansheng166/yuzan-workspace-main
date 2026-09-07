# CURRENT TASK

Task: COMP-DEMO-04 — 诊断到强化与教师复核
Status: DONE / BROWSER VERIFIED

COMP-DEMO-03 is complete: one real lesson (`《春》生字认读与易错音纠正`) is
published and open to the seeded real student account. Do not import the other
four demonstration lessons.

COMP-DEMO-01+02 completed the ISE adapter's live credential/transport check,
the real 6-level Question Bank runtime import, and the 1920×1080
reading/report presentation work. The live ISE call returned real nullable
dimensions as uncalibrated, review-required diagnostic evidence; it did not
write a formal score. This task continues that real ISE evidence through
teacher review, formal diagnosis, and remediation.

QB-017A Student Today — Next Best Learning Action MVP is DONE / BROWSER VERIFIED.
本轮执行 COMP-DEMO-04：验证真实 ISE 诊断、教师复核、正式报告与专项巩固闭环。

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
