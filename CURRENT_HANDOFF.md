# CURRENT HANDOFF

Last updated: 2026-08-22
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`. Their live results are
authoritative.

Expected active development branch: `feat/question-bank-v1`

Latest functional checkpoint: `caa9111 fix(runner): resolve assets outside http server`

Recent operations checkpoint: `6d6a6d1 docs(ops): simplify codex cold-start handoff`

## Resume in 60 seconds

QB-001 and QB-002 are complete. The current active task is **QB-003A-F — Strict
source importer finalization**. Its detailed execution state, remaining work, and
acceptance criteria are in [`CURRENT_TASK.md`](CURRENT_TASK.md).

Next action: continue `CURRENT_TASK.md`.

## Environment

Node `>=24 <27`, pnpm `10.13.1`, Docker services for PostgreSQL, Redis, and MinIO,
with NestJS API, frontend, and worker in this repository. Local path:
`/home/tian/文档/program_test/yuzanxinsheng_test` (informational only; never a start gate).

## Completed checkpoints

- **Environment ready** — root pnpm workspace and local Docker services available.
- **QB-001 done** — independent, versioned question bank with separated delivery and
  scoring data. Commits: `917e4c5`, `a8bddc0`, `e9072ac`, `896c565`.
- **QB-002 done** — unified student question runner. Commit `7e52d30`; subsequent
  runner asset fix `caa9111`. Verified: text/image/audio stimuli; choice/text/speech
  responses; choice and text persistence; speech attachment; refresh restoration; and
  runner E2E.

## Current active task

**QB-003A-F — Strict source importer finalization** (`IN_PROGRESS`).
Detailed execution state: `CURRENT_TASK.md`.

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
- Task blocker: none.
- Source blocker: L2 `READ_ALOUD` structure expects 3 questions but the authored
  body contains 2. The importer must fail explicitly and must not invent content;
  this blocks Level 2 completeness, not trusted Level 1 work.
- Non-blocking issue: the existing `@eslint/js` configuration issue is outside the
  current task.

## DO NOT START YET

Level 2–6 bulk import, speech-provider integration, picture-speaking scoring, and large
refactors.
