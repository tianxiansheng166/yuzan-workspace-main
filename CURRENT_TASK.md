# CURRENT TASK

Task: QB-006 — Read-aloud speech diagnostic scoring
Status: DONE

## Goal

Establish the real Level 1 `READ_ALOUD` diagnostic loop:

`Recording → SpeechJob → BullMQ Worker → local speech provider → Python scorer →
server-side policy → safe student diagnostic`.

The local provider is an R&D / learning diagnostic baseline. It is not an
exam-grade, official, or formal Mandarin examination score.

## Verified state

- The published Level 1 bank contains three `SPEECH_READING` versions; each has
  a four-point scoring configuration, for twelve read-aloud points in total.
- The authored read-aloud source includes rubric and deduction fields that the
  current local scorer cannot fully implement as a formal four-point rubric.
- The worker now uses a provider-neutral local contract and sends one validated
  result callback; it no longer writes `AssessmentItem.scoredScore`.
- The API owns strategy/target/max-score validation, computes a bounded
  `candidatePoints`, persists a safe diagnostic, keeps `scoredScore = null`,
  marks the job `NEEDS_REVIEW`, and moves the recording to `READY`.
- Level 1 `PICTURE_SPEAKING` is `SPEECH_OPEN_RESPONSE` and must remain outside
  the read-aloud scorer.

## Completed implementation

- Added the provider-neutral local adapter and fail-closed provider
  configuration (`disabled` or `local`).
- Routed only published Question Bank `SPEECH_READING` items with
  server-authoritative target text; picture speaking records normally but does
  not create a read-aloud job.
- Added server-side result validation, bounded diagnostics, idempotent callback
  handling, failure preservation, and student-safe response shaping.
- Added worker/API/Python coverage and ran the database-backed MinIO → BullMQ →
  Worker → Python → API callback smoke plus the canonical Level 1 E2E.

## Acceptance criteria

- Three Level 1 read-aloud items route to the local reading scorer; the one
  picture-speaking item does not create a read-aloud SpeechJob. PASS.
- Provider responses are validated for shape and 0–100 metric bounds. PASS.
- `candidatePoints` is deterministic and bounded to the item max score (4),
  while local baseline processing never writes `AssessmentItem.scoredScore`.
  PASS.
- Successful local results are persisted as `SpeechJob=NEEDS_REVIEW` with a
  safe student diagnostic and the Recording is `READY`. PASS.
- SpeechJob/Recording/AssessmentItem/question-version/strategy/max-score links
  are checked server-side; malformed, mismatched, unsupported, or stale input
  fails closed. PASS.
- QB-005 deterministic scores remain unchanged; rubric and picture-speaking
  items remain pending, the session remains `PROCESSING`, and no false final
  report is created. PASS.
- Python scorer, worker speech, API targeted speech/assessment, security
  regression, and the available Level 1 E2E/smoke checks were run; the
  security suite retains five unrelated pre-existing failures documented in
  the final handoff.

## Protected paths

Do not modify or stage the task-start dirty `pnpm-workspace.yaml`,
`infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.

## Commands

- `corepack pnpm --filter @yuzan/worker test`
- `corepack pnpm --filter @yuzan/worker typecheck`
- `corepack pnpm --filter @yuzan/api test`
- `corepack pnpm --filter @yuzan/api typecheck`
- `python -m pytest backend/speech-scoring/tests`
- `python -m uvicorn app.main:app --host 127.0.0.1 --port 8100` from
  `backend/speech-scoring/` for local health/pipeline smoke.
- The repository's Level 1 browser E2E and database-backed smoke commands when
  their required services are available.

## Known limitations

- The local scorer's ASR and tone analysis remain experimental and uncalibrated;
  tone metadata must remain truthful.
- The available smoke/E2E environment used an explicit `MOCK_SPEECH_SCORING=true`
  Python response with legal silent WAV input because FunASR/torchaudio model
  dependencies are not installed; this proves pipeline control flow, not ASR
  recognition quality.
- The authored read-aloud rubric is not fully reproduced by this provider.
- The local diagnostic is never an official or exam-grade score and cannot
  finalize a formal result.
- Level 2 source inconsistency and QB-007 picture-speaking scoring remain out of
  scope.

## Stop conditions

QB-006 is complete. Do not import Levels 2–6, implement `PICTURE_SPEAKING`
scoring, add 讯飞/腾讯/LLM providers, perform formal calibration, or begin
QB-007 in this task.
