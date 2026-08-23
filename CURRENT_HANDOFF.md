# CURRENT HANDOFF

Last updated: 2026-08-23
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`; live Git results
are authoritative. Expected active branch: `feat/question-bank-v1`.

Latest functional checkpoint: QB-007 Level 1 picture-speaking diagnostic and
human-review completion. Do not infer a commit SHA from this document.

## Resume in 60 seconds

QB-001, QB-002, QB-003A-F, QB-003B, QB-005, QB-006, and QB-007 are complete.
The next task is QB-008 in [`CURRENT_TASK.md`](CURRENT_TASK.md), but it is
blocked until the Level 2 source count mismatch is corrected or explicitly
resolved.

## QB-007 completed behavior

- Level 1 remains 20 items / 100 authored points: 14 deterministic items (58
  points), three read-aloud items (12), two rubric items (16), and one picture
  speaking item (14).
- `SPEECH_OPEN_RESPONSE` has its own Python endpoint and provider-neutral
  Worker route. It does not send target text to `/v1/score/reading`, does not
  compute target-relative accuracy/completeness/tone, and never writes a formal
  semantic score.
- Successful open and read diagnostics persist bounded server-side evidence,
  keep `SpeechJob=NEEDS_REVIEW`, keep `AssessmentItem.scoredScore = null`, and
  mark the recording `READY`.
- The generic review workflow is restricted to `RUBRIC_TEXT`,
  `SPEECH_READING`, and `SPEECH_OPEN_RESPONSE`. Queue/detail/submit enforce
  same-school, active teacher, and session-class scope; deterministic items are
  rejected; scores are bounded; repeats are idempotent; and optimistic
  revision checks prevent silent concurrent overwrite.
- Teacher detail exposes only authorized delivery, rubric/reference/deduction,
  recording playback, and server-side speech evidence. Student delivery/report
  payloads remain free of scoring specs, answer keys, rubrics, deduction rules,
  source trace, and teacher-only transcript.
- The finalization gate requires all 20 formal scores and creates one
  point-based report with `totalMaxPoints = 100`; repeated finalization does
  not create a second report.
- No database migration was needed: `SpeechJob.targetText` was already
  nullable and `AssessmentItem` already had review fields.

## Verification snapshot

- Python speech scorer: `9 passed` with the bundled speech virtualenv.
- API targeted QB/speech/review tests: `24 passed`.
- API full Vitest: `973 passed, 58 skipped` across 62 files / 1031 tests.
- Worker targeted speech tests: `38 passed` across 3 files; Worker typecheck
  and build passed.
- API typecheck and build passed; frontend runtime verification passed.
- Fresh browser E2E:
  `tests/e2e/assessment/test_qb007_picture_review.py` → `1 passed in 159.96s`.
  It drove 20 student items, observed six teacher queue items, opened picture
  and audio evidence, submitted all six reviews, and verified a student report
  with 20/20 scored items and `totalMaxPoints = 100`.
- The fresh E2E report score was 96 because the authored
  `L1-READ-WORD_RECOGNITION-003` reference key is A while its visible delivery
  options are B/C/D. The test follows the visible options and reports the real
  score; QB-007 did not alter the source.
- The local E2E used `MOCK_SPEECH_SCORING=true`; this proves control flow and
  authorization, not calibrated ASR or semantic picture-speaking quality.

## Environment

The repository uses Node `>=24 <27`, pnpm `10.13.1`, PostgreSQL, Redis, MinIO,
NestJS API, frontend, Worker, and the local Python speech service. Local runtime
Node engine warnings are non-blocking when the targeted checks pass.

## Blockers and known source issues

- QB-008 blocker: Level 2 read-aloud structure declares three questions while
  the authored body currently contains two. The strict importer must fail
  closed and must not synthesize content.
- Level 1 retains the authored choice/reference mismatch described above.
- Local speech diagnostics remain experimental and do not reproduce the
  authored read-aloud rubric as formal automatic scoring.

## Do not start yet

Do not begin QB-008, Levels 2–6 bulk import, semantic LLM/third-party speech
scoring, formal provider calibration, or unrelated large refactors until the
Level 2 source blocker is resolved.
