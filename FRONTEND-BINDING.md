# Frontend Binding Guide — B31-103 Stabilized Handoff

> Scope: backend API surface as of `task/b31-103-admin-products` at base `22e3e14`.
> Only modules imported into `AppModule` are live. New admin/audit/product-plans/privacy/curriculum-governance modules are present in source but intentionally not wired; their controllers return no routes until the integration controller accepts them.

## Common conventions

- Global prefix: `/api/v1`
- Standard envelope: `{ data: ..., meta: { requestId: string } }`
- Auth: access token in `Authorization: Bearer <token>` cookie or header; refresh token in `refresh_token` cookie.
- Roles: `STUDENT`, `TEACHER`, `SCHOOL_ADMIN`, `PLATFORM_ADMIN`, `RESEARCHER`.
- Tenant: every school-scoped route enforces that the caller's active membership matches `:schoolId`.

---

## 1. Login / Select School

Pages: `/login`, `/select-school`, `/logout`

| Purpose | Method | Route | Request | Response |
|---|---|---|---|---|
| Login | `POST` | `/api/v1/auth/login` | `{ identifier, password }` | `AuthSessionResponse` (sets `access_token`, `refresh_token` cookies) |
| Select active school | `POST` | `/api/v1/auth/select-school` | `{ schoolId }` | `AuthSessionResponse` with rotated tokens |
| Refresh session | `POST` | `/api/v1/auth/refresh` | Bearer or `refresh_token` cookie | `AuthSessionResponse` |
| Logout | `POST` | `/api/v1/auth/logout` | Bearer or `access_token` cookie | `204 No Content` |
| Current user | `GET` | `/api/v1/me` | — | `CurrentUserResponse` including `activeSchoolId` and memberships |

Frontend notes:
- After login, call `GET /me` to discover memberships and decide whether to route to `/select-school` or the default school dashboard.
- `select-school` requires a valid access token but is marked public so the gateway does not reject an expired token before the identity service can rotate it.
- On 401, redirect to `/login`. On 403 (cross-school), redirect to `/select-school`.

---

## 2. Teacher

Pages: teacher dashboard, class list, course list, course draft editor, assignment list, submissions/feedback

| Purpose | Method | Route | Auth roles |
|---|---|---|---|
| List my classes | `GET` | `/api/v1/schools/{schoolId}/classes/teachers/me` | TEACHER, SCHOOL_ADMIN |
| List school classes | `GET` | `/api/v1/schools/{schoolId}/classes` | STUDENT, TEACHER, SCHOOL_ADMIN |
| Get class | `GET` | `/api/v1/schools/{schoolId}/classes/{classId}` | STUDENT, TEACHER, SCHOOL_ADMIN |
| List class members | `GET` | `/api/v1/schools/{schoolId}/classes/{classId}/members` | TEACHER, SCHOOL_ADMIN |
| List course versions | `GET` | `/api/v1/schools/{schoolId}/course-versions?status=&limit=&cursor=` | STUDENT, TEACHER, SCHOOL_ADMIN |
| Create course draft | `POST` | `/api/v1/schools/{schoolId}/course-versions` | TEACHER, SCHOOL_ADMIN |
| Get course draft | `GET` | `/api/v1/schools/{schoolId}/course-versions/{courseVersionId}` | STUDENT, TEACHER, SCHOOL_ADMIN |
| Update course draft | `PATCH` | `/api/v1/schools/{schoolId}/course-versions/{courseVersionId}` | TEACHER, SCHOOL_ADMIN |
| Publish course version | `POST` | `/api/v1/schools/{schoolId}/course-versions/{courseVersionId}/publish` | TEACHER, SCHOOL_ADMIN |

Frontend notes:
- Course drafts are the only curriculum mutation surface live in this build.
- The publish route is implemented at `/api/v1/schools/{schoolId}/course-versions/{courseVersionId}/publish` (the controller source is missing the slash literal but tests validate the intent).
- Use `status` query to filter `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `CHANGES_REQUESTED`, `RETIRED`.

---

## 3. Student / Courses

Pages: student dashboard, my classes, course catalog, today's tasks, activity player, submission upload

| Purpose | Method | Route | Auth roles |
|---|---|---|---|
| List my classes | `GET` | `/api/v1/schools/{schoolId}/classes/students/me` | STUDENT |
| List course versions | `GET` | `/api/v1/schools/{schoolId}/course-versions` | STUDENT, TEACHER, SCHOOL_ADMIN |
| Get course version | `GET` | `/api/v1/schools/{schoolId}/course-versions/{courseVersionId}` | STUDENT, TEACHER, SCHOOL_ADMIN |

Frontend notes:
- Student course access is read-only through the curriculum controller.
- Assignment/learning/submission/feedback APIs are part of B31-101 and are implemented in the `b31-101` worktree; they are not wired in this build.

---

## 4. Admin

Pages: platform admin dashboard, school management, user management, product plans, system providers, audit logs

Live routes in this build: **none**. The `AdminModule`, `AuditModule`, and `ProductPlansModule` exist in source under `apps/api/src/modules/` but are not imported into `AppModule`.

Planned admin routes (pending integration):

| Purpose | Method | Route |
|---|---|---|
| Platform metrics | `GET` | `/api/v1/admin/dashboard/metrics` |
| List schools | `GET` | `/api/v1/admin/schools` |
| Create school | `POST` | `/api/v1/admin/schools` |
| Get school | `GET` | `/api/v1/admin/schools/{schoolId}` |
| Update school | `PATCH` | `/api/v1/admin/schools/{schoolId}` |
| Activate/deactivate/archive school | `POST` | `/api/v1/admin/schools/{schoolId}/activate` etc. |
| List users | `GET` | `/api/v1/admin/users` |
| Invite user | `POST` | `/api/v1/admin/users` |
| Bulk import users | `POST` | `/api/v1/admin/users/bulk-import` |
| Update membership | `PATCH` | `/api/v1/admin/schools/{schoolId}/users/{userId}/memberships/{membershipId}` |
| List product plans | `GET` | `/api/v1/admin/plans` |
| List providers | `GET` | `/api/v1/admin/providers` |
| Provider health check | `POST` | `/api/v1/admin/providers/{providerId}/health-check` |
| Search audit logs | `GET` | `/api/v1/admin/audit-logs` |

Frontend notes:
- Do not bind admin pages to the current deployment; wait for the integration controller to wire `AdminModule` into `AppModule`.
- Real Prisma repositories for admin, audit, and provider persistence exist but are not yet injected into the runtime graph.

---

## 5. Volunteer

Pages: volunteer training, translation tasks, service pairing

Live routes in this build: **none**. Volunteer features belong to the `b31-104` worktree.

Planned routes (pending `b31-104` integration):

| Purpose | Method | Route |
|---|---|---|
| List training modules | `GET` | `/api/v1/volunteer/training` |
| Submit translation | `POST` | `/api/v1/volunteer/translations` |
| List service opportunities | `GET` | `/api/v1/volunteer/services` |
| Pair with student/class | `POST` | `/api/v1/volunteer/pairings` |

Frontend notes:
- Build UI against mock data or wait for `b31-104` handoff before connecting.

---

## 6. Teacher Tools

Pages: curriculum governance recommendations, assessment material bank, feedback templates

Live routes in this build: **none**. Curriculum-governance and assessment modules exist in source but are not wired.

Planned routes (pending integration):

| Purpose | Method | Route |
|---|---|---|
| List recommendation rules | `GET` | `/api/v1/schools/{schoolId}/curriculum-governance/recommendations` |
| Create recommendation rule | `POST` | `/api/v1/schools/{schoolId}/curriculum-governance/recommendations` |
| List assessment materials | `GET` | `/api/v1/schools/{schoolId}/assessment-materials` |
| Create assessment material | `POST` | `/api/v1/schools/{schoolId}/assessment-materials` |

---

## 7. Plans

Pages: public plans/pricing, school plan assignment

Live routes in this build: **none**. `ProductPlansModule` is present but not wired.

Planned routes (pending integration):

| Purpose | Method | Route |
|---|---|---|
| List active public plans | `GET` | `/api/v1/plans` |
| Get plan details | `GET` | `/api/v1/plans/{planId}` |
| Assign plan to school (admin) | `PATCH` | `/api/v1/admin/schools/{schoolId}/plan` |

Frontend notes:
- The `ProductPlan` model and `ProductPlanTier` enum are already in the database schema and migration.
- School-to-plan relation field `School.planId` exists; use admin endpoints to assign.

---

## 8. Research

Pages: research governance, consent management, data deletion requests, retention policies

Live routes in this build: **none**. `PrivacyModule` is present but not wired.

Planned routes (pending integration):

| Purpose | Method | Route |
|---|---|---|
| List consent versions | `GET` | `/api/v1/admin/privacy/consent-versions` |
| Record consent | `POST` | `/api/v1/schools/{schoolId}/privacy/consent` |
| Request data deletion | `POST` | `/api/v1/privacy/deletion-requests` |
| List retention policies | `GET` | `/api/v1/admin/privacy/retention-policies` |

---

## Status legend

- **Live**: imported into `AppModule`; routes are served by the current build.
- **Present / not wired**: source and tests exist, but module is not imported into `AppModule`; no routes are served.
- **Pending**: not yet implemented in this worktree.

## Next integration step

The integration controller must:
1. Review each present-but-not-wired module for schema/contract compliance.
2. Add approved modules to `AppModule.imports`.
3. Re-run `pnpm --filter @yuzan/api typecheck`, `build`, and `test` before merging into `integration/windows-backend-v31-mvp-20260712`.
