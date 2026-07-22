# AGENTS.md

Before changing code, read these repository-local sources in order:

1. `README-FIRST.md`
2. `PROJECT-CHARTER.md`
3. `project-ops/CURRENT.md`
4. the active task JSON under `project-ops/tasks/active/`

`D:/program/test_program/yuzanxinsheng/three/yuzan-next` is the canonical project root.
Concurrent task worktrees belong in the sibling `../worktrees/` directory. Do not
create full repository clones under the project root.

## Hard rules

- Work only in the assigned branch/worktree.
- Modify only task `allowed_paths`.
- Record dependencies, base commit and integration order in the task JSON.
- Keep stable decisions in `project-ops/decisions/`; do not leave them only in chat.
- Update `project-ops/CURRENT.md` at every accepted integration checkpoint.
- OpenAPI, Prisma schema, UI tokens, root config and CI are shared-owner files.
- Submit a Contract Change Request before changing shared facts.
- Never use legacy JSON files at runtime.
- Never hardcode business data to make a page appear complete.
- All reads/writes enforce school/resource scope server-side.
- No emoji as product icons.
- No generic card wall, card-in-card, purple-blue AI gradients or runtime DOM patch scripts.
- AI output is advisory, versioned, auditable and reviewable.
- Do not claim tests ran unless the commands actually ran.
- Do not commit secrets, real student data, licensed assets without proof, or generated images without the asset register.

## Required delivery

- implementation + tests;
- normal/loading/empty/error/offline/permission states where applicable;
- security and tenant-negative tests;
- screenshots for UI at 1440/1024/390;
- migration/rollback notes;
- completed handoff.
