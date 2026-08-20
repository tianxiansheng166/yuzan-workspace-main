# Start a new Codex conversation

For a clear task, read `AGENTS.md`, run `git status`, `git branch --show-current`, and
`git log -1 --oneline`, then read `CURRENT_HANDOFF.md` and implement the task. If the
user says only “continue development”, take the one **NEXT TASK** from the handoff and
start it. Exact branch and HEAD come from Git, not from `CURRENT_HANDOFF.md`.

Use these files in order:

1. `AGENTS.md` — stable development and safety rules.
2. `CURRENT_HANDOFF.md` — current 60-second recovery point.
3. `PROJECT_CONTEXT.md` — product and architecture context when needed.
4. `DEVELOPMENT_STATUS.md` — milestones and known follow-up work.
5. Source, tests, and narrowly relevant documentation for the task.

`project-ops/`, old prompts, reports, and the control plane are historical reference
only. They are not startup gates for functionality-first development.

Minimal prompt:

> Read `AGENTS.md` and `CURRENT_HANDOFF.md`, check the current Git state, then execute
> my task. If I only say continue, execute the NEXT TASK. When finished, test, commit,
> push, and update the handoff.
