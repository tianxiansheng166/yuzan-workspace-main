# AGENTS.md

Read `../README-FIRST.md`, `../orchestration/AI-COLLABORATION-PROTOCOL.md`, and the task JSON before changing code.

## Hard rules

- Work only in the assigned branch/worktree.
- Modify only task `allowed_paths`.
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
