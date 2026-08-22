# CURRENT TASK

Task: QB-003A-F — Strict source importer finalization
Status: IN_PROGRESS

## Goal

Finish the strict importer that reads the question DOCX, answer/rubric DOCX, and
media ZIP into a trusted, versioned question-bank manifest without inventing or
silently dropping authored content.

## Why this task exists

The repository needs a reproducible source-to-question-bank boundary. Authoring
Word and ZIP files are import inputs only; runtime must use versioned database and
resource data, and inconsistent source structure must fail explicitly.

## Current verified state

- Environment: Node 24.19.0, pnpm 10.13.1, Vitest 3.2.7, TypeScript 5.9.3,
  Prisma 7.8.0.
- `sharp` loads successfully.
- `pnpm install --frozen-lockfile` passes.
- Question DOCX: 6 levels, 90 embedded images.
- Answer DOCX: 6 levels.
- Media ZIP: 126 files: 90 images and 36 audio files; each level has 15 images
  and 6 audio files.
- Parser output across all levels: 119 parsed items.
- The only confirmed structural source missing is L2 `READ_ALOUD`: structure
  expects 3 items, while the authored body contains 2.
- L3/L5 `SENTENCE_COMPLETION` are not source omissions. They use independent
  paragraph blocks followed by the next heading boundary and must be handled by
  generic grammar.

## Work already completed

- QB-001: independent, versioned question bank — DONE.
- QB-002: unified student runner — DONE.
- QB-003A primary source inventory.
- QB-003A Level 1 initial dry-run.
- QB-003A DOCX structure investigation.
- QB-003A L3/L5 parser root-cause evidence.
- QB-003A all-level structure count: 119 items.
- QB-003A real L2 missing `READ_ALOUD` detection.
- QB-003A dependency workspace recovery.

## Remaining work

1. Land generic numbered/unnumbered paragraph grammar.
2. Complete paragraph start/end `sourceTrace`.
3. Implement Answer DOCX entry parsing.
4. Bind answers by level + family + source ordinal.
5. Produce Level 1 `scoringSpec` 20/20.
6. Preserve rubric/deduction source trace.
7. Complete the synthetic validation matrix.
8. Run `pnpm test:question-import`.
9. Run the Level 1 real dry-run.
10. Run the all-level real dry-run.
11. Verify L3/L5 false `SENTENCE_COMPLETION` errors are eliminated.
12. Verify the genuine L2 `READ_ALOUD` issue remains detected.
13. Update `CURRENT_HANDOFF.md` and `DEVELOPMENT_STATUS.md`.
14. Commit and push the completed checkpoint.

## Acceptance criteria

- [ ] Numbered parser passes.
- [ ] Unnumbered parser passes.
- [ ] No level-specific parser hack.
- [ ] Level 1 items = 20.
- [ ] Level 1 points = 100.
- [ ] Level 1 scoring bindings = 20/20.
- [ ] Missing scoring = 0.
- [ ] Ambiguous scoring = 0.
- [ ] `deliverySpec` leak = 0.
- [ ] All parsed question items = 119.
- [ ] L3 false `SENTENCE_COMPLETION` error eliminated.
- [ ] L5 false `SENTENCE_COMPLETION` error eliminated.
- [ ] L2 `READ_ALOUD` expected 3 / actual 2 detected.
- [ ] Synthetic importer tests pass.
- [ ] Database writes = 0 during validation/dry-run.
- [ ] MinIO writes = 0 during validation/dry-run.
- [ ] Commits pushed.

## Files / areas likely involved

- Question-bank source importer, parser, validation, and source-trace code.
- Question-bank importer tests and fixtures.
- `package.json` scripts related to question import.
- `CURRENT_HANDOFF.md` and `DEVELOPMENT_STATUS.md` at completion.

## Protected / unrelated worktree

These paths are outside this task's ownership. If they are dirty at task start,
preserve the changes and do not modify, stage, or delete them:

- `pnpm-workspace.yaml` (currently dirty at task start).
- `infra/database/prisma/seed.ts`.
- `tests/e2e/assessment/question-bank-runner.spec.py`.
- `frontend/assessment/assets/question-bank/`.

Do not use broad staging such as `git add .` or `git add -A`.

## Commands / verification

```bash
corepack pnpm test:question-import
corepack pnpm qb:source:validate -- --level 1
corepack pnpm qb:source:validate -- --all
```

## Known blockers

- Project blocker: none.
- Task blocker: none; the dependency workspace blocker has recovered.
- Source blocker: L2 `READ_ALOUD` has 2 authored items where structure requires
  3. This blocks Level 2 completeness but does not block a trusted Level 1
  manifest.
- Non-blocking issue: the existing `@eslint/js` configuration issue is outside
  this task.

## Stop conditions

Stop and ask the user only when a secret, interactive privilege, destructive
user-data action, destructive Git-history action, unresolvable conflicting
worktree change, or source ambiguity that prevents trustworthy Level 1
interpretation is encountered.

Parser bugs, test failures, dependency rebuilds, fixture failures, and type errors
are not stop conditions; resolve them within the task.

## On completion

Record QB-003A-F as historical DONE in `DEVELOPMENT_STATUS.md`, then overwrite
this file with the next active task, QB-003B. `CURRENT_TASK.md` must describe only
the current task, not retain a completed task as the active one.
