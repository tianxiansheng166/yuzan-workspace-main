# CURRENT TASK

Task: QB-008 — Level 2–6 bulk import and rollout
Status: TODO

## Goal

After the Level 2 source is corrected and re-audited, import Levels 2–6 through
the strict question-bank pipeline and publish only source-complete runtime
content.

## Verified prior checkpoint

QB-007 is complete on `feat/question-bank-v1`:

- Level 1 picture speaking uses `SPEECH_OPEN_RESPONSE`, not the read-aloud
  target-text scorer.
- The local open-response service supplies bounded audio/ASR evidence only;
  formal semantic points are assigned by teacher review.
- A generic, class-scoped teacher review queue/detail/submit flow resolves
  `RUBRIC_TEXT`, `SPEECH_READING`, and `SPEECH_OPEN_RESPONSE` items.
- The Level 1 completion gate requires all 20 `scoredScore` values and creates
  one point-based report with `totalMaxPoints = 100`.

## Start condition / blocker

Do not start QB-008 until the Level 2 source is corrected or an explicit
product decision resolves the mismatch: the authored structure declares three
read-aloud questions while the authored body currently contains two. The
importer must continue to fail closed; it must not invent a question.

## Acceptance criteria

- Re-audit the corrected Level 2–6 source before any runtime write.
- Import through the canonical strict parser with stable identities and
  immutable versions.
- Preserve delivery/scoring separation and fail closed on missing media,
  answer/rubric binding, or count mismatches.
- Verify idempotence, tenant/resource scope, published practice composition,
  and student-safe payloads before marking the rollout complete.

## Protected paths

Do not modify or stage the task-start dirty `pnpm-workspace.yaml`,
`infra/database/prisma/seed.ts`, `tests/e2e/assessment/question-bank-runner.spec.py`,
or `frontend/assessment/assets/question-bank/`. Never modify original files
under `local_sources/`.

## Commands

- `pnpm --filter @yuzan/api typecheck`
- `pnpm --filter @yuzan/api exec vitest run --pool=forks --poolOptions.forks.singleFork`
- `pnpm --filter @yuzan/worker test`
- `pnpm --filter @yuzan/worker typecheck`
- `pnpm --filter @yuzan/frontend test`
- `python -m pytest backend/speech-scoring/tests`

## Known limitations

- Local speech diagnostics are experimental and uncalibrated; they are not
  formal Mandarin examination scoring.
- The Level 1 authored delivery for `L1-READ-WORD_RECOGNITION-003` exposes
  options B/C/D while its authored reference key is A. QB-007 preserved the
  source and records the resulting runtime score honestly; it was not silently
  repaired.

## Stop conditions

Do not begin Level 2–6 import, add semantic LLM/third-party scoring, or make
unrelated refactors until the Level 2 source blocker is resolved.
