## [LRN-20260717-002] correction

**Logged**: 2026-07-17T00:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

Do not equate a Nuxt process rooted in the canonical checkout with the requested new visual surface.

### Details

The canonical server was correctly started from `yuzan-next`, but `/` still rendered the prior brand-system page. The user correctly identified it as the old page. The required source was the already-delivered pixel-v3 runtime, whose Nuxt migration note explicitly maps its root page to `apps/web/app/pages/index.vue`.

### Suggested Action

Verify the browser screenshot against the requested visual source before reporting a cutover complete; retain only real Nuxt routes and live backend behavior when porting the visual layer.

### Metadata

- Source: user_feedback
- Related Files: apps/web/app/pages/index.vue, runtime-audit-temp/yuzan-pixel-v3-runtime/NUXT-INTEGRATION.md
- Tags: launch-target, visual-cutover, correction

---

## [LRN-20260722-001] best_practice

**Logged**: 2026-07-22T18:05:00+08:00
**Priority**: high
**Status**: promoted
**Area**: infra

### Summary

Use one canonical clone plus short-lived sibling worktrees; do not use multiple complete clones as concurrent workers.

### Details

Six complete clones duplicated Git objects, pnpm dependencies and stale governance. The integration branch deleted its orchestration directory while copied root documents still referenced it, so new sessions could not find a valid source of truth.

### Suggested Action

Keep root `AGENTS.md`, `project-ops/CURRENT.md` and active task JSON inside every commit; create tasks under `../worktrees` and remove clean worktrees after integration.

### Metadata

- Source: repository migration
- Related Files: AGENTS.md, project-ops/CURRENT.md, scripts/repo/new-worktree.ps1
- Tags: canonical-root, worktree, governance, recovery
- Promoted: AGENTS.md

---
