# CURRENT HANDOFF

Last updated: 2026-08-22
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`. Their live results are
authoritative.

Expected active development branch: `feat/question-bank-v1`

Latest functional checkpoint: QB-003B Level 1 runtime import (this closing
checkpoint; inspect live Git HEAD on resume).

Recent operations checkpoint: validated source-to-runtime apply, 20-item real
student Runner E2E, and idempotent replay completed for Level 1.

## Resume in 60 seconds

QB-001, QB-002, **QB-003A-F — Strict source importer finalization**, and
**QB-003B — Level 1 runtime import** are complete. Recovery state for the next
task is in [`CURRENT_TASK.md`](CURRENT_TASK.md).

Next action: begin QB-005 only when explicitly requested.

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

## Current active task

**QB-005 — deterministic non-speech scoring** (`TODO`). Do not start it unless
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
- Task blocker: none for QB-003B.
- Source blocker carried forward: L2 `READ_ALOUD` structure expects 3 questions but
  the authored body contains 2. The importer fails explicitly; it never invents a
  question with AI. This blocks Level 2 completeness, not trusted Level 1 work.
- Non-blocking issue: the existing `@eslint/js` configuration issue is outside the
  current task.
- Historical local fixture: the old school-scoped `QB-V1-*` audio-verification
  records remain preserved, but their explicitly temporary practice delivery is
  closed so it no longer competes with the real system Level 1 practice.

## DO NOT START YET

Do not begin Level 2–6 bulk import, speech-provider integration,
picture-speaking scoring, or unrelated large refactors in this handoff.
