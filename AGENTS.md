# Codex development rules

## Cold start

At the start of a new conversation, run these commands and read these files in
order:

1. `git status`
2. `git branch --show-current`
3. `git log -1 --oneline`
4. `CURRENT_HANDOFF.md`
5. `CURRENT_TASK.md`

- A clear user request is this turn's goal.
- If the user says “continue”, “continue the project”, “continue development”,
  “继续”, “继续项目”, or “继续当前任务”, execute `CURRENT_TASK.md` directly.
- If the user gives a clear task, that user task takes priority over the current
  task file.
- Do not ask the user to re-explain repository context.

## Context and authority

Load only what is needed, in this order: this file, `CURRENT_HANDOFF.md`, then
`PROJECT_CONTEXT.md`, `DEVELOPMENT_STATUS.md`, and task-related source/tests.
Git branch and HEAD are runtime facts. Never require `CURRENT_HANDOFF.md` to contain
the commit SHA of the commit that contains the handoff itself. A handoff's latest
functional checkpoint is business recovery context, not live Git state. If Git, source,
or runtime conflicts with the handoff, follow those facts and correct the handoff.
`project-ops/**`, `docs/**`, old reports, prompts, and the old control plane are
historical references, loaded only when useful.

## Functionality first

Deliver one clear user outcome per task. Prefer existing code, small focused changes,
real runtime behavior, and targeted tests. Avoid speculative refactors, unrelated
cleanup, and governance work. Core behavior must be real; known non-critical bugs may
remain documented.

Ordinary feature work does **not** require PowerShell, `mvp-control.ps1`,
`task-context.ps1`, `task-gate.ps1`, a lease, fencing epoch, task JSON, CCR,
Integration Lead, or a worktree. Use those legacy mechanisms only when the user
explicitly requests legacy control-plane work. Lack of PowerShell must not block Linux
development.

## Repository safety

- Use pnpm from the repository root; do not run `npm install` in subpackages.
- Reuse existing models and contracts. Enforce server-side school/resource/user scope;
  never substitute fixed IDs, static business data, fake success, or silent fallbacks.
- Do not commit secrets, real student data, or unknown assets. Do not overwrite others'
  work, force-push, rewrite pushed history, or develop directly on `main` without
  explicit authorization.
- `local_sources/` is readable import input only: never commit, push, move, delete, or
  modify its original files without an explicit request. Word and ZIP files are import
  sources, not runtime storage.

## Git and verification

Make small meaningful commits and push the current feature branch every 1–3 commits or
at a clear checkpoint. Run the targeted tests that best prove the change; add stronger
checks for schema, security, authentication, or data-isolation work. Never claim an
unrun test passed; record unrelated existing failures.

On completion: run targeted tests; update `CURRENT_HANDOFF.md` and, when a milestone
changes, `DEVELOPMENT_STATUS.md`; inspect `git diff`; commit; and push. The final
checkpoint commit includes its handoff/status update. Never create a follow-up commit
only to write that commit's SHA back into the handoff. Update `PROJECT_CONTEXT.md` only
for durable product or architecture decisions. Report implementation, tests, final
commit SHA, known issues, and the recommended next task.

Ask the user only for secrets, interactive sudo, destructive user-data actions,
destructive Git-history actions, paid/production third-party operations, or a core
product decision with materially different meanings.
