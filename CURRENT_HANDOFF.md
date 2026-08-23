# CURRENT HANDOFF

Last updated: 2026-08-23
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`; live Git results
are authoritative. Expected active branch: `feat/question-bank-v1`.

Do not infer a commit SHA from this document. The task-start dirty change in
`pnpm-workspace.yaml` is pre-existing and protected; do not stage or modify it.

## Current outcome

QB-008R and the Levels 1–6 rollout are implemented on the current feature
branch. QB-009A is now complete; the next task is QB-009B in
[`CURRENT_TASK.md`](CURRENT_TASK.md), pending external benchmark inputs.

The original DOCX/ZIP files under `local_sources/` were inspected as read-only
inputs and were not modified, moved, deleted, or staged.

## Recovery and provenance

The importer now executes:

`raw source → parser → structural recovery → explicit repair ledger → canonical
validation → immutable runtime apply`.

Structural recovery is generic and structure-driven. An unlabeled candidate
followed by `B/C/D` becomes `A/B/C/D`; two unlabeled candidates followed by
`C/D` become `A/B/C/D`. Ambiguous or unsafe patterns fail closed. Existing
`A/B/C/D` input is unchanged. Recovered values carry server-side provenance and
are never included in student payloads.

Authorized repairs are recorded in
[`content-repairs.json`](tools/question-bank-importer/content-repairs.json):

- `L1-READ-WORD_RECOGNITION-003`: structural recovery restored option `A`.
  The old published v1 remains immutable; the corrected item is published as
  v2 and the Level 1 practice as a new immutable version.
- `L2-SPEAK-READ_ALOUD-003`: exactly one reproducible
  `AI_AUTHORED_GAP_FILL` item, family `READ_ALOUD`, scoring mode
  `SPEECH_READING`, max score 4. Its trace is explicitly derived and has no
  fabricated Word paragraph range.
- An isolated Level 4 two-label omission was recovered structurally using the
  same generic rule; it is represented as `STRUCTURAL_RECOVERY` provenance.

## QB-009A speech provider boundary

- iFlytek uses the official ISE streaming WebSocket adapter with backend-only
  AppID/APIKey/APISecret configuration and HMAC request signing.
- Tencent uses the official new SOE WebSocket adapter with backend-only
  AppID/SecretID/SecretKey configuration, signed query parameters, 16 kHz
  40 ms binary frames, and an explicit end frame.
- Both adapters accept only server-prepared 16 kHz / 16-bit / mono WAV bytes,
  preserve nullable vendor dimensions, and keep raw vendor responses in
  server-side audit data only. Auth, malformed response, timeout, and provider
  configuration failures fail closed; non-transient failures are not retried.
- Cloud providers handle `SPEECH_READING` only. Open response/picture speaking
  remains on the local diagnostic route.
- Every provider result is `experimental: true`, `calibrationStatus:
  UNCALIBRATED`, `finalizable: false`, and `requiresReview: true`. The API
  policy rejects calibrated/finalizable cloud evidence and never writes a
  formal `scoredScore` from it.

## QB-009A benchmark and privacy status

- `pnpm speech:benchmark` supports manifest-driven synthetic or explicitly
  approved live runs and reports validity/failure, MAE/RMSE, Pearson/Spearman,
  tolerance bands, p50/p95 latency, and review-required rate.
- The checked-in example is synthetic only: 2 samples, 0 real samples. Cloud
  smoke was skipped as `SKIPPED_NOT_CONFIGURED`; no credentials were printed,
  committed, or used to call a provider.
- With fewer than 30 real labelled samples the report is
  `INSUFFICIENT_CALIBRATION_DATA`; formal runtime activation remains
  `DISABLED` and teacher review remains the authority.

## Runtime state

- Canonical validation: 120 items / 600 points, six levels, zero errors and
  zero warnings.
- Every level: 20 items / 100 points; `LISTEN 6/24`, `SPEAK 4/26`,
  `READ 6/24`, `WRITE 4/26`; 15 image and 6 audio bindings.
- Published practices: six canonical 20-item practices, four sections each,
  20 references each, one open delivery each. Catalog total is 12 including
  the six legacy practices.
- Media: 90 unique images and 36 unique audio resources.
- Repeated `--apply --all` runs were fully reused: resources, question items,
  question versions, practices, practice versions, sections, refs, and
  deliveries all reported zero new records on the verification reruns.
  Existing Level 1 v1 remains present and the corrected v2 is the active
  published version.
- Security audit of active canonical deliveries: 20 refs per practice, four
  sections, zero student-visible source-trace leaks.

## Verification snapshot

- Importer tests: `16 passed`.
- API verification: full Vitest run `975 passed` with no failures; the real-DB
  deterministic/runtime integration run passed `3/3` tests.
- Worker tests: `51 passed`; provider contract, audio preparation, benchmark,
  routing-safety, and existing worker tests pass. Worker typecheck/build pass.
- Frontend tests passed.
- Speech-scoring tests: `9 passed`.
- API typecheck/build passed.
- API speech policy/service tests: `30 passed`.
- Contracts validation/test/typecheck and frontend test/build passed.
- Benchmark CLI completed with synthetic data and safe cloud skips.
- Source validation passed for `--level 1` and `--all`.
- Dry-run apply passed for `--level 1` and `--all`.
- Parameterized browser coverage exercises Levels 1–6 end to end and passed
  `6 passed in 984.34s`, including media loading, answer persistence,
  submission, teacher review, and the point-based report gate. The run used
  the repository's explicit mock speech scorer for diagnostics only.

## Known limitations and next task

Local and cloud speech diagnostics remain experimental and uncalibrated; they
do not produce formal automatic rubric scores. The direct Level 1 browser script
failed in the default runtime because `MOCK_SPEECH_SCORING` was absent. A
controlled mock-scoring rerun reached the three local diagnostic payloads, but
the protected script still exited non-zero at its assertion; keep browser
verification unresolved rather than treating it as green.

The next task is QB-009B: obtain approved consented recordings and teacher
labels, run live benchmark/calibration analysis, and make an explicit product
decision. Do not infer activation from the synthetic report.

## Protected paths

Do not modify or stage `pnpm-workspace.yaml`, `infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.
