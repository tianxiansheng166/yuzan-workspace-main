# CURRENT TASK

Task: QB-009B — Real speech benchmark and calibration decision
Status: TODO / EXTERNAL_INPUT

## Goal

Use an approved, consented benchmark to decide whether any production speech
provider can be calibrated for formal scoring. QB-009A is complete, but all
providers remain diagnostic-only, `UNCALIBRATED`, `NEEDS_REVIEW`, and
non-finalizable.

## Verified state

- `disabled`, `local`, `iflytek`, and `tencent` are supported by the
  provider-neutral server boundary.
- iFlytek streaming and Tencent new SOE adapters, immutable audio preparation,
  fixture tests, and the DB-free benchmark harness are implemented.
- Cloud credentials are not present/verified and the example benchmark contains
  only synthetic references; no real recordings or labels were inspected.
- The direct Level 1 script failed in the default runtime because
  `MOCK_SPEECH_SCORING` was absent. A controlled mock-scoring rerun reached the
  three local diagnostic payloads but the protected script still exited
  non-zero at its assertion; browser verification therefore remains unresolved.
  This does not authorize enabling formal scoring.

## Remaining work

- Obtain approval and 30–50 consented, de-identified recordings with teacher
  labels and dimension definitions.
- Run the benchmark with approved credentials/audio, review MAE/RMSE,
  correlation, tolerance bands, latency, and review-required rates.
- Make an explicit product decision; only then could a separate task define a
  calibration artifact, versioning, rollout, and rollback plan.

## Acceptance criteria

- No formal provider activation without approved real data, teacher review, and
  an explicit calibration decision.
- `AssessmentItem.scoredScore` remains null for provider evidence until the
  formal authority changes the policy.
- Benchmark output is reproducible, privacy-safe, and reports insufficient or
  skipped inputs without fabricating calibration results.

## Protected paths

Do not modify or stage `pnpm-workspace.yaml`,
`infra/database/prisma/seed.ts`, `tests/e2e/assessment/question-bank-runner.spec.py`,
or `frontend/assessment/assets/question-bank/`. Never modify original files
under `local_sources/`.

## Commands

- `pnpm speech:benchmark -- --manifest <approved-manifest> --providers local,iflytek,tencent --live`
- Targeted Worker/API/Python tests and the configured Level 1 browser regression
- Review `docs/speech-providers.md` before any live provider operation

## External-input status

- iFlytek credentials: not supplied.
- Tencent credentials: not supplied.
- Consented 30–50 recordings and teacher labels: not supplied.
- Calibration/product approval: not supplied.

## Stop conditions

- Do not call cloud providers with real student audio or export recordings.
- Do not print or commit credentials, provider raw payloads, or PII.
- Do not enable formal automatic speech scoring based on synthetic data or
  provider self-scores.
