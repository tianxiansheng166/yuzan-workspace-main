# Frontend Binding Guide — MVP V3.1 Backend Integration

> Branch: `integration/windows-backend-v31-mvp-20260712`  
> API prefix: `/api/v1`  
> Auth: Bearer access token or `access_token` / `refresh_token` httpOnly cookies  
> Active tenant: every school-scoped request must include `:schoolId` in path; the guard fail-closes on cross-school access.

---

## 1. login / select-school

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Login form | `/auth/login` | POST | READY | Returns `accessToken`, `activeSchoolId`, `user` with `memberships` |
| Session refresh | `/auth/refresh` | POST | READY | Uses refresh cookie or `Authorization` header |
| Logout | `/auth/logout` | POST | READY | Clears cookies, revokes session |
| School picker | `/auth/select-school` | POST | READY | Switch active tenant; returns new token pair |
| Current user card | `/me` | GET | READY | `activeSchoolId` is the currently selected tenant |

**Frontend contract**
- Store `accessToken` in memory; let cookies handle refresh.
- On app bootstrap call `GET /me`; if 401, call `POST /auth/refresh`; if still 401, redirect to login.
- School picker renders `user.memberships` and calls `POST /auth/select-school` with chosen `schoolId`.

---

## 2. teacher

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Course drafts list | `/schools/:schoolId/course-versions` | GET | READY | Teacher sees own drafts + published; student sees only published |
| Create draft | `/schools/:schoolId/course-versions` | POST | READY | Title + language + activities required |
| Edit draft | `/schools/:schoolId/course-versions/:versionId` | PATCH | READY | Only DRAFT editable |
| Publish version | `/schools/:schoolId/course-versions/:versionId/publish` | POST | READY | Server increments version number |
| Class list | `/schools/:schoolId/classes` | GET | READY | |
| Create class | `/schools/:schoolId/classes` | POST | READY | |
| Edit class | `/schools/:schoolId/classes/:classId` | PATCH | READY | |
| Assignment list | `/schools/:schoolId/assignments` | GET | READY | |
| Create assignment | `/schools/:schoolId/assignments` | POST | READY | |
| Open / close assignment | `/schools/:schoolId/assignments/:assignmentId/open\|close` | POST | READY | |
| Feedback on submission | `/schools/:schoolId/submissions/:submissionId/feedback` | POST | READY | |
| Student growth profile | `/schools/:schoolId/student-growth/:enrollmentId` | GET | READY | Reporting P1 |

---

## 3. student / courses

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Published courses | `/schools/:schoolId/course-versions` | GET | READY | Filtered to published |
| Today's tasks | `/schools/:schoolId/learning/today` | GET | READY | Student role only |
| Activity detail | `/schools/:schoolId/learning/activities/:activityId` | GET | READY | |
| Report progress | `/schools/:schoolId/learning/activities/:activityId/progress` | POST | READY | |
| Submit assignment | `/schools/:schoolId/assignments/:assignmentId/submissions` | POST | READY | |
| View submission | `/schools/:schoolId/submissions/:submissionId` | GET | READY | |
| View feedback | `/schools/:schoolId/submissions/:submissionId/feedback` | GET | READY | |

---

## 4. admin

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| School list | `/admin/schools` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Create school | `/admin/schools` | POST | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| User list | `/admin/users` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Invite user | `/admin/users/invitations` | POST | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Audit logs | `/audit/logs` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Provider registry | `/audit/providers` | GET/POST | STUBBED | Returns `PROVIDER_NOT_CONFIGURED` (503) |

**Frontend contract**
- Admin pages may render a placeholder banner: "后台管理持久层尚未接入，当前操作不可用。"
- Do NOT mock success; rely on the returned gap codes.

---

## 5. volunteer

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Volunteer list | `/schools/:schoolId/volunteers` | GET | READY | |
| Register volunteer | `/schools/:schoolId/volunteers` | POST | READY | |
| Volunteer detail | `/schools/:schoolId/volunteers/:volunteerId` | GET | READY | |
| Training list | `/schools/:schoolId/training` | GET | READY | |
| Create training | `/schools/:schoolId/training` | POST | READY | |
| Training detail | `/schools/:schoolId/training/:trainingId` | GET | READY | |
| Support pairings | `/schools/:schoolId/support-pairings` | GET/POST | READY | |
| Cooperation leads | `/schools/:schoolId/cooperation/leads` | GET/POST | READY | |
| Support applications | `/schools/:schoolId/cooperation/support-applications` | GET | READY | |
| Volunteer applications | `/schools/:schoolId/cooperation/volunteer-applications` | GET | READY | |

---

## 6. teacher-tools

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Tool list | `/schools/:schoolId/tools` | GET | READY | |
| Mindgraph job create | `/schools/:schoolId/tools/mindgraph/jobs` | POST | READY | |
| Mindgraph job status | `/schools/:schoolId/tools/mindgraph/jobs/:jobId` | GET | READY | |
| Click audit | `/schools/:schoolId/tools/click-audit` | POST | READY | |
| Translation jobs | `/schools/:schoolId/translations/jobs` | GET/POST | READY | |
| My translation jobs | `/schools/:schoolId/translations/jobs/me` | GET | READY | |
| Glossary | `/schools/:schoolId/translations/glossary` | GET | READY | |
| Community posts | `/schools/:schoolId/community/posts` | GET/POST | READY | |
| Post detail / comments | `/schools/:schoolId/community/posts/:postId` | GET | READY | Comments: `.../comments` POST | |

---

## 7. plans

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Public plans list | `/plans` | GET | READY | Public, returns `{ items: [], nextCursor: null, hasMore: false }` |

**Frontend contract**
- Render empty state; no auth required.

---

## 8. research

| Page / Flow | Endpoint | Method | Status | Notes |
|-------------|----------|--------|--------|-------|
| Governance versions | `/research/governance/versions` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Governance version detail | `/research/governance/versions/:id` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| Submit review | `/research/governance/versions/:id/reviews` | POST | STUBBED | Returns `PERSISTENCE_PENDING` (503) |
| List reviews | `/research/governance/versions/:id/reviews` | GET | STUBBED | Returns `PERSISTENCE_PENDING` (503) |

**Frontend contract**
- Research pages render "教研治理持久层尚未接入" placeholder.
- Required role: `TEACHER`, `RESEARCHER`, or `SCHOOL_ADMIN`.

---

## Cross-cutting rules

1. **Tenant isolation**: every request under `/schools/:schoolId/*` is checked against the user's active membership. Cross-school calls return HTTP 403.
2. **Authentication**: `Authorization: Bearer <accessToken>` header or `access_token` cookie. Missing/invalid token returns 401.
3. **P2 stub behavior**: HTTP 503 with body `{ error: { code, message, scope }, meta: { requestId } }`. Codes are `PERSISTENCE_PENDING`, `UNAVAILABLE`, or `PROVIDER_NOT_CONFIGURED`. Never fake success.
4. **Health**: `GET /health/live` and `GET /operations/status` are public; use for startup readiness.
