# Codex development rules

## Cold start

At the start of a new conversation, run `git status`, `git branch --show-current`,
and `git log -1 --oneline`, then read `CURRENT_HANDOFF.md`.

- A clear user request is this turn's goal.
- If the user says “continue”, “continue the project”, or “continue development”,
  execute the single **NEXT TASK** in `CURRENT_HANDOFF.md` directly.
- Do not ask the user to re-explain repository context.

## Context and authority

Load only what is needed, in this order: this file, `CURRENT_HANDOFF.md`, then
`PROJECT_CONTEXT.md`, `DEVELOPMENT_STATUS.md`, and task-related source/tests.
Git, source, runtime, and tests are the facts. If the handoff conflicts with them,
follow the facts and correct the handoff. `project-ops/**`, `docs/**`, old reports,
prompts, and the old control plane are historical references, loaded only when useful.

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

On completion: run targeted tests, inspect `git diff`, commit, push, update
`CURRENT_HANDOFF.md`, and update `DEVELOPMENT_STATUS.md` if a milestone changed.
Update `PROJECT_CONTEXT.md` only for durable product or architecture decisions. Report
implementation, tests, commit SHA, known issues, and the recommended next task.

Ask the user only for secrets, interactive sudo, destructive user-data actions,
destructive Git-history actions, paid/production third-party operations, or a core
product decision with materially different meanings.
