# MVP Gaps — B31-103 Stabilized Handoff

> Branch: `task/b31-103-admin-products`  
> Base commit: `22e3e1443bf82cf3d5b9b14c3de606126ece5e39`  
> This document lists everything that is intentionally incomplete or blocked for the Windows backend v31 MVP.

## P0 — Completed (live in AppModule)

- Auth/session: login, refresh, logout, `/me`
- `POST /auth/select-school` with session rotation and cross-school fail-closed
- Course draft CRUD + publish via `CurriculumModule`
- B31-101 classes/assignments/learning/submissions/feedback (implemented in sibling `b31-101` worktree and wired there)

## P1 — Not wired in this build

| Area | Status | Notes |
|---|---|---|
| Reporting / offline / operations | NOT_WIRED | No reporting or offline-sync controllers are imported into `AppModule`. |
| Volunteer training / service / pairing | NOT_WIRED | Belongs to `b31-104` worktree. |
| Tool / provider status | NOT_WIRED | `AuditModule` exists but is not wired. |
| Public plans read | NOT_WIRED | `ProductPlansModule` exists but is not wired. |

## P2 — Persistence pending / unavailable by design

| Feature | Status | Details |
|---|---|---|
| Admin write persistence | PERSISTENCE_PENDING | `PrismaAdminSchoolRepository`, `PrismaAdminUserRepository`, `PrismaAdminMetricsRepository` are implemented and unit-tested, but `AdminModule` is not imported into `AppModule`. |
| Audit / provider real persistence | REAL_REPOSITORIES_IMPLEMENTED_BUT_NOT_WIRED | `PrismaAuditRepository`, `PrismaProviderRepository`, `PrismaProviderSecretRepository` replace the unavailable placeholders in source, yet `AuditModule` is not wired. |
| Research governance persistence | PERSISTENCE_PENDING | `PrivacyModule` models and services exist; module not wired. |
| Assessment incomplete persistence | PERSISTENCE_PENDING | `CurriculumGovernanceModule` and assessment material/link models exist; module not wired. |

### Important distinction

- **UnavailableRepository placeholders** (`UnavailableAuditRepository`, `UnavailableProviderRepository`, `UnavailableProviderSecretRepository`) remain in the ports folder. They throw `*UnavailableException` and **do not count as completed persistence**.
- **Placeholder provider health** (static `UNKNOWN` status, no real provider probe) is also **not counted as completed**.
- Real repositories are complete at the application layer but only count as MVP-ready once they are wired into `AppModule` and covered by integration tests.

## Known defects / cleanup items

1. **Curriculum publish route literal**
   - File: `apps/api/src/modules/curriculum/curriculum.controller.ts:104`
   - Current: `@Post(":courseVersionId:publish")`
   - Expected: `@Post(":courseVersionId/publish")`
   - Impact: The publish endpoint is unreachable as currently declared. No test currently covers the routing literal directly. Fix when integrating `b31-102` or the full curriculum flow.

2. **Admin dashboard controller method name**
   - Already fixed in this branch: `DashboardController.getMetrics` now calls `DashboardService.getPlatformMetrics`.

3. **User invite status semantics**
   - `UserStatus` enum does not include `INVITED`; invited users are created with `UserStatus.ACTIVE` and `MembershipStatus.INVITED`. A future migration may add `UserStatus.INVITED` if the product requires it.

4. **OpenAPI / contracts not regenerated**
   - `packages/contracts/openapi/openapi.yaml` documents the live P0 surface. New admin/audit/provider/product-plan schemas are not yet reflected in the published contract. Regenerate after modules are wired.

## Integration checklist before declaring MVP ready

- [ ] Integration controller reviews and approves each present-but-not-wired module.
- [ ] Approved modules added to `AppModule.imports`.
- [ ] Placeholder `Unavailable*` repositories removed or kept only for optional provider fallbacks.
- [ ] Provider health check performs a real probe or is removed from MVP scope.
- [ ] `prisma migrate deploy` applied to target database.
- [ ] `pnpm --filter @yuzan/database generate && validate` passes.
- [ ] `pnpm --filter @yuzan/api typecheck` passes.
- [ ] `pnpm --filter @yuzan/api build` passes.
- [ ] `pnpm --filter @yuzan/api test` passes (single fork).
- [ ] API started locally; auth/select-school and cross-school fail-closed verified.
- [ ] OpenAPI contracts regenerated and `@yuzan/contracts` built.
