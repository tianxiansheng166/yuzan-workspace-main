# CURRENT HANDOFF

Last updated: 2026-08-23
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`. Their live results are
authoritative.

Expected active development branch: `feat/question-bank-v1`

Latest functional checkpoint: QB-005 deterministic non-speech scoring (this
closing checkpoint; inspect live Git HEAD on resume).

Recent operations checkpoint: validated Level 1 source-to-runtime apply, the
20-item real student Runner E2E, deterministic scoring against the real
published versions, and retry-idempotent persistence.

## Resume in 60 seconds

QB-001, QB-002, **QB-003A-F — Strict source importer finalization**,
**QB-003B — Level 1 runtime import**, and **QB-005 — deterministic non-speech
scoring** are complete. Recovery state for the next task is in
[`CURRENT_TASK.md`](CURRENT_TASK.md).

Next action: begin QB-006 only when explicitly requested.

## Environment

The package engine target is Node `>=24 <27` with pnpm `10.13.1`. Docker services
for PostgreSQL, Redis, and MinIO support the NestJS API, frontend, and worker in
this repository. The current local runtime can emit a Node 22 engine warning;
it is non-blocking for the validated development checkpoint. Local path:
`/home/tian/文档/program_test/yuzanxinsheng_test` (informational only; never a start gate).

## Completed checkpoints

- **Environment ready** — root pnpm workspace and local Docker services available.
- **QB-001 done** — independent, versioned question bank with separated delivery and
  scoring data. Commits: `917e4c5`, `a8bddc0`, `e9072ac`, `896c565`.
- **QB-002 done** — unified student question runner. Commit `7e52d30`; subsequent
  runner asset fix `caa9111`. Verified: text/image/audio stimuli; choice/text/speech
  responses; choice and text persistence; speech attachment; refresh restoration; and
  runner E2E.
- **QB-003B done** — validated Level 1 now imports through the canonical parser
  into 21 global Resources/MinIO objects, 20 published global question-bank
  versions with source provenance, and one published system practice with four
  ordered sections and 20 version references. The Runner resolves `resourceId`
  and `imageResourceId` through authorized playback URLs. Actual apply and a
  repeat apply verified zero duplicate creation; real browser E2E verified all
  20 items, refresh, recording, submission, and the 7-item student catalog.
- **QB-005 done** — audited the 20 canonical published Level 1 versions as
  9 `EXACT_CHOICE` (33 points), 3 `DICTATION_ALIGNMENT` (15), 2
  `ACCEPTED_TEXT` (10), 2 `RUBRIC_TEXT` (16), and 4 speech items (26).
  `qb-deterministic-v1` scores only finalized written answers from the
  question-version `scoringSpec`, persists bounded safe results, and fails
  closed for unsupported dictation categories. The real database integration
  test confirms 14/20 auto-scored items and 58/100 deterministic point
  coverage; the Level 1 browser flow confirms those 14 scores, 2 rubric items,
  and 4 speech items while the session remains `PROCESSING`. Question Bank
  reports use point aggregation and are withheld until every required item is
  resolved; legacy reports retain their existing average aggregation.

## Current active task

**QB-006 — read-aloud speech scoring** (`TODO`). Do not start it unless
explicitly requested.

## Current question-bank source

`local_sources/question-bank/` contains the primary input set:

- `题库【三改】.docx`
- `答案及评分细则.docx`
- `题库音频及图片.zip`

Other material, including the large demonstration-course archive, is secondary input.

## Known source issues

Level 2 read-aloud structure marks three questions while its body currently contains
only two. The importer must hard-fail this inconsistency; it must never invent a
question with AI.

## Major blockers

- Project blocker: none.
- Task blocker: none for QB-005.
- Source blocker carried forward: L2 `READ_ALOUD` structure expects 3 questions but
  the authored body contains 2. The importer fails explicitly; it never invents a
  question with AI. This blocks Level 2 completeness, not trusted Level 1 work.
- Non-blocking issue: the existing `@eslint/js` configuration issue is outside the
  current task.
- Historical local fixture: the old school-scoped `QB-V1-*` audio-verification
  records remain preserved, but their explicitly temporary practice delivery is
  closed so it no longer competes with the real system Level 1 practice.

## DO NOT START YET

Do not begin QB-006, Level 2–6 bulk import, picture-speaking scoring, or
unrelated large refactors in this handoff.
