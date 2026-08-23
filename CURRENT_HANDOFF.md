# CURRENT HANDOFF

Last updated: 2026-08-23
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`; live Git results
are authoritative. Expected active branch: `feat/question-bank-v1`.

Latest functional checkpoint: QB-007S Level 1 choice-scoring integrity repair
and fail-closed content block. Do not infer a commit SHA from this document.

## Resume in 60 seconds

QB-001, QB-002, QB-003A-F, QB-003B, QB-005, QB-006, QB-007, and QB-007S are
complete; QB-007S correctly leaves the authored Level 1 mismatch blocked.
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

## QB-007S forensic result

- Question Word `题库【三改】.docx`, source trace `paragraphStart=41`,
  `paragraphEnd=45`: `3、文具的意思是（ ）`; `笔墨纸砚等供学习用的器具`;
  `B. 课余玩耍的各类玩具`; `C. 日常穿戴的衣物配饰`; `D. 用来充饥的零食点心`.
  The authored option set is exactly `B/C/D`; the parser did not lose an A.
- Answer Word `答案及评分细则.docx`, answer group trace `paragraphStart=16`,
  `paragraphEnd=17`: `（一）单词认读`; `1.C 2.B 3.A`. Ordinal 3 is explicitly
  bound to reference key A.
- Canonical manifest preserves delivery option keys `B/C/D` and scoring
  reference `A`; its source traces point back to the paragraphs above. The
  first divergence is therefore the authoring-source conflict, before parser,
  binding, apply, or runtime.
- Runtime audit found one immutable published version (`version=1`) for
  `L1-READ-WORD_RECOGNITION-003`; its `QuestionBankItemVersion`, published
  `PracticeItemRef`, and practice version preserve `B/C/D` delivery and `A`
  scoring. No AssessmentItem snapshot for this stable key existed at audit
  time.
- All nine Level 1 `EXACT_CHOICE` structures were audited: `VALID` for
  `L1-LISTEN-LISTEN_IMAGE_CHOICE-001`,
  `L1-LISTEN-LISTEN_IMAGE_CHOICE-002`,
  `L1-LISTEN-LISTEN_IMAGE_CHOICE-003`,
  `L1-READ-WORD_RECOGNITION-001`, `L1-READ-WORD_RECOGNITION-002`,
  `L1-READ-SENTENCE_COMPREHENSION-001`,
  `L1-READ-SENTENCE_COMPREHENSION-002`, and
  `L1-READ-SENTENCE_COMPREHENSION-003`; `INVALID` only for
  `L1-READ-WORD_RECOGNITION-003`. All audited option keys were non-empty,
  unique, and source-order preserving.
- The canonical validator now emits `ANSWER_OPTION_INVALID` and
  `BLOCKED_CONTENT_MISMATCH`; Level 1 validation and runtime apply preflight
  fail closed. The existing published version was not edited and no guessed
  replacement version was created.
- The deterministic scorer now reads the real delivery options. A mismatch
  persists `scoredScore=null` with safe `SCORING_CONFIG_INVALID` evidence,
  keeps the session in `PROCESSING`, and remains outside teacher review. Student
  payloads reduce that state to `该题评分配置需复核`.

## Verification snapshot

- Question importer tests: `11 passed`.
- API assessment suite with the local runtime database: `63 passed, 2 skipped`;
  the real published-version deterministic DB integration is included.
- API typecheck passed.
- `pnpm qb:source:validate -- --level 1` fails as intended with the two
  content-gate errors for the invalid stable key; `qb:source:apply -- --level 1`
  stops at the same preflight before any database or MinIO write.
- The direct Playwright invocation of
  `tests/e2e/assessment/test_qb007_picture_review.py` fails as intended at
  item 13 when reference A is absent from the browser; it no longer falls back
  to a visible option and cannot produce the former 96-point report.
- The earlier QB-007 full closure remains historical evidence only; this task
  supersedes its 96-point result until the source author repairs the conflict.

## Environment

The repository uses Node `>=24 <27`, pnpm `10.13.1`, PostgreSQL, Redis, MinIO,
NestJS API, frontend, Worker, and the local Python speech service. Local runtime
Node engine warnings are non-blocking when the targeted checks pass.

## Blockers and known source issues

- QB-008 blocker: Level 2 read-aloud structure declares three questions while
  the authored body currently contains two. The strict importer must fail
  closed and must not synthesize content.
- Level 1 is blocked by the authored choice/reference mismatch described above;
  it must not be declared content-validation PASS or formally completed until
  the source is corrected and re-imported as a new immutable version.
- Local speech diagnostics remain experimental and do not reproduce the
  authored read-aloud rubric as formal automatic scoring.

## Do not start yet

Do not begin QB-008, Levels 2–6 bulk import, semantic LLM/third-party speech
scoring, formal provider calibration, or unrelated large refactors until the
Level 2 source blocker is resolved.
