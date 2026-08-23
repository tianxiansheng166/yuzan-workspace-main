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
branch. The next task is QB-009 in [`CURRENT_TASK.md`](CURRENT_TASK.md).

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

## Runtime state

- Canonical validation: 120 items / 600 points, six levels, zero errors and
  zero warnings.
- Every level: 20 items / 100 points; `LISTEN 6/24`, `SPEAK 4/26`,
  `READ 6/24`, `WRITE 4/26`; 15 image and 6 audio bindings.
- Published practices: six canonical 20-item practices, four sections each,
  20 references each, one open delivery each. Catalog total is 12 including
  the six legacy practices.
- Media: 90 unique images and 36 unique audio resources.
- First `--apply --all`: created 100 question items, 100 question versions,
  five practices, five practice versions, 20 sections, 100 refs, five
  deliveries, and 105 resources; existing Level 1 records were reused where
  appropriate.
- Second `--apply --all`: all apply counters were zero-created and fully
  reused, confirming idempotence.
- Security audit of active canonical deliveries: 20 refs per practice, four
  sections, zero student-visible source-trace leaks.

## Verification snapshot

- Importer tests: `16 passed`.
- Assessment targeted suite: `63 passed, 2 skipped`.
- Worker tests: `38 passed`; worker typecheck/build passed.
- Frontend tests passed.
- API typecheck/build passed.
- Source validation passed for `--level 1` and `--all`.
- Dry-run apply passed for `--level 1` and `--all`.
- Parameterized browser coverage now exercises Levels 1–6, but the run is
  environment-blocked: the local speech scorer on `127.0.0.1:8100` is not
  available, so read-aloud jobs repeatedly fail with `fetch failed`. This is
  an infrastructure limitation, not a content-validation failure.
- Full API-suite exploratory run was `56 passed, 14 failed, 32 skipped`; the
  failures are existing test-environment isolation/fixture issues (dev DB FK
  cleanup, test DB naming, and a pre-existing app-composition dependency).

## Known limitations and next task

Local speech diagnostics remain experimental and uncalibrated; they do not
produce formal automatic rubric scores. QB-009 should benchmark a production
speech provider and calibrate scoring while preserving the server-side review
boundary and student-safe payload contract.

## Protected paths

Do not modify or stage `pnpm-workspace.yaml`, `infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.
