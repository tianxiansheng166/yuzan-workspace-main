# API Contract Change Request — b31-104

**Branch:** `task/b31-104-volunteer-tools-community`
**Author:** TRAE-5 Implementation
**Date:** 2026-07-11

## Summary

New API endpoints for 7 modules under `schools/:schoolId/` prefix (except Cooperation public routes). All school-scoped endpoints require authentication and role-based authorization.

---

## 1. Volunteers Module

**Base path:** `schools/:schoolId/volunteers`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/` | STUDENT, TEACHER, SCHOOL_ADMIN | Apply as volunteer |
| GET | `/` | TEACHER, SCHOOL_ADMIN | List volunteers |
| GET | `/me` | STUDENT, TEACHER | Get my volunteer profile |
| GET | `/:volunteerId` | TEACHER, SCHOOL_ADMIN | Get volunteer by ID |
| POST | `/:volunteerId/transition` | SCHOOL_ADMIN, PLATFORM_ADMIN | Transition volunteer status |
| GET | `/:volunteerId/service-tasks` | STUDENT, TEACHER, SCHOOL_ADMIN | List my service tasks |
| GET | `/service-tasks` | TEACHER, SCHOOL_ADMIN | List all service tasks |
| POST | `/service-tasks/:taskId/assign` | TEACHER, SCHOOL_ADMIN | Assign task to volunteer |
| POST | `/incidents` | TEACHER, SCHOOL_ADMIN | Report incident |
| GET | `/incidents` | TEACHER, SCHOOL_ADMIN | List incidents |
| GET | `/incidents/:incidentId` | TEACHER, SCHOOL_ADMIN | Get incident |

### Volunteer Status State Machine
```
APPLIED → SCREENING → ACCEPTED → TRAINING_REQUIRED → TRAINING_IN_PROGRESS → EXAM_READY → QUALIFIED → ACTIVE
                                                                                                        ↓
                                                                                                  SUSPENDED / LEFT
```

---

## 2. Training Module

**Base path:** `schools/:schoolId/training`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/programs` | TEACHER, SCHOOL_ADMIN | List training programs |
| GET | `/programs/:programId` | TEACHER, SCHOOL_ADMIN | Get program |
| POST | `/programs` | SCHOOL_ADMIN, PLATFORM_ADMIN | Create program |
| POST | `/programs/:programId/enroll` | STUDENT, TEACHER | Enroll in program |
| GET | `/enrollments` | SCHOOL_ADMIN, PLATFORM_ADMIN | List all enrollments |
| GET | `/enrollments/me` | STUDENT, TEACHER | List my enrollments |
| GET | `/enrollments/:enrollmentId/progress` | STUDENT, TEACHER, SCHOOL_ADMIN | Get progress |
| PATCH | `/enrollments/:enrollmentId/progress` | STUDENT, TEACHER, SCHOOL_ADMIN | Update progress |
| POST | `/exams` | SCHOOL_ADMIN, PLATFORM_ADMIN | Schedule exam |
| POST | `/exams/:examId/attempt` | STUDENT, TEACHER | Submit exam attempt |
| GET | `/exams/:examId/results` | STUDENT, TEACHER, SCHOOL_ADMIN | Get exam results |

---

## 3. Support-Pairings Module

**Base path:** `schools/:schoolId/support-pairings`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/` | SCHOOL_ADMIN, PLATFORM_ADMIN | Create pairing |
| GET | `/` | TEACHER, SCHOOL_ADMIN | List pairings |
| GET | `/:pairingId` | TEACHER, SCHOOL_ADMIN, involved student/volunteer | Get pairing |
| PATCH | `/:pairingId/consent` | involved student/volunteer | Update consent |
| PATCH | `/:pairingId/status` | SCHOOL_ADMIN, PLATFORM_ADMIN | Update pairing status |
| GET | `/me` | STUDENT, TEACHER | List my pairings |
| POST | `/:pairingId/sessions` | TEACHER, SCHOOL_ADMIN | Create session |
| GET | `/:pairingId/sessions` | TEACHER, SCHOOL_ADMIN, involved users | List sessions |
| PATCH | `/sessions/:sessionId/review` | TEACHER, SCHOOL_ADMIN | Review session |

### Consent Flow
- Pairing created with `PENDING_CONSENT` status
- Both student and volunteer must grant consent (`GRANTED`)
- Only then can pairing transition to `ACTIVE`

---

## 4. Tools Module

**Base path:** `schools/:schoolId/tools`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/integrations` | SCHOOL_ADMIN, PLATFORM_ADMIN | List integrations |
| GET | `/integrations/:key` | SCHOOL_ADMIN, PLATFORM_ADMIN | Get integration |
| PATCH | `/integrations/:key` | SCHOOL_ADMIN, PLATFORM_ADMIN | Update integration |
| POST | `/mind-graph/jobs` | TEACHER, SCHOOL_ADMIN | Create MindGraph job |
| GET | `/mind-graph/jobs/:jobId` | TEACHER, SCHOOL_ADMIN | Get job status |
| GET | `/mind-graph/jobs` | TEACHER, SCHOOL_ADMIN | List my jobs |
| POST | `/audit/click` | TEACHER, SCHOOL_ADMIN | Record click audit |

### Critical Business Rules
- MindGraph: Must NOT return fabricated AI results when provider is unavailable
- MindGraph: Must throw `MindGraphProviderUnavailableException` when config status is `PROVIDER_UNAVAILABLE` or `OFFLINE`
- Click audit: All external link clicks must be auditable

---

## 5. Translations Module

**Base path:** `schools/:schoolId/translations`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/jobs` | TEACHER, SCHOOL_ADMIN | Create translation job |
| GET | `/jobs/:jobId` | TEACHER, SCHOOL_ADMIN | Get job status |
| GET | `/jobs` | TEACHER, SCHOOL_ADMIN | List my jobs |
| GET | `/admin/jobs` | SCHOOL_ADMIN, PLATFORM_ADMIN | List all jobs |
| GET | `/glossary` | TEACHER, SCHOOL_ADMIN | List glossary |

### Critical Business Rules
- Source text is encrypted at rest (`sourceTextEncrypted`) — never exposed in API responses
- Error codes are sanitized — only known safe codes returned to clients
- Provider details never leaked in error responses
- Rate limiting applies per school per time window

---

## 6. Community Module

**Base path:** `schools/:schoolId/community`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/posts` | STUDENT, TEACHER, SCHOOL_ADMIN | Create post |
| GET | `/posts` | STUDENT, TEACHER, SCHOOL_ADMIN | List posts |
| GET | `/posts/:postId` | STUDENT, TEACHER, SCHOOL_ADMIN | Get post |
| PATCH | `/posts/:postId` | STUDENT, TEACHER, SCHOOL_ADMIN | Update own post |
| POST | `/posts/:postId/submit` | STUDENT, TEACHER, SCHOOL_ADMIN | Submit for review |
| POST | `/posts/:postId/review` | TEACHER, SCHOOL_ADMIN | Review post |
| POST | `/posts/:postId/comments` | STUDENT, TEACHER, SCHOOL_ADMIN | Add comment |
| GET | `/posts/:postId/comments` | STUDENT, TEACHER, SCHOOL_ADMIN | List comments |
| POST | `/reports` | STUDENT, TEACHER, SCHOOL_ADMIN | Report content |
| GET | `/reports` | TEACHER, SCHOOL_ADMIN | List reports |
| PATCH | `/reports/:reportId` | TEACHER, SCHOOL_ADMIN | Review report |

### Content Lifecycle
```
DRAFT → PENDING_REVIEW → PUBLISHED
                   ↓          ↓
               REJECTED     HIDDEN (when report upheld)
```

---

## 7. Cooperation Module

**Public routes (no auth required):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/cooperation/leads` | Submit cooperation lead |
| POST | `/api/v1/cooperation/support-applications` | Submit support application |
| POST | `/api/v1/cooperation/volunteer-applications` | Submit volunteer application |

**School-scoped routes:** `schools/:schoolId/cooperation`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/leads` | SCHOOL_ADMIN, PLATFORM_ADMIN | List leads |
| GET | `/leads/:leadId` | SCHOOL_ADMIN, PLATFORM_ADMIN | Get lead |
| PATCH | `/leads/:leadId/status` | PLATFORM_ADMIN | Update lead status |
| GET | `/support-applications` | SCHOOL_ADMIN, PLATFORM_ADMIN | List support applications |
| GET | `/support-applications/:id` | SCHOOL_ADMIN, PLATFORM_ADMIN | Get application |
| PATCH | `/support-applications/:id/review` | SCHOOL_ADMIN, PLATFORM_ADMIN | Review application |
| GET | `/volunteer-applications` | SCHOOL_ADMIN, PLATFORM_ADMIN | List volunteer applications |
| GET | `/volunteer-applications/:id` | SCHOOL_ADMIN, PLATFORM_ADMIN | Get application |
| PATCH | `/volunteer-applications/:id/review` | SCHOOL_ADMIN, PLATFORM_ADMIN | Review application |

### Consent Requirement
All public form submissions require `consent: true` — throws `ConsentRequiredException` otherwise.

---

## Common Patterns

### Authentication
All school-scoped endpoints use `@RequireRoles()` decorator with `@CurrentPrincipal()` and `@CurrentTenant()` to extract auth context via `createAuthContext(requestId, principal, tenant)`.

### Authorization
Four-layer authorization:
1. **Authentication** — JWT/session validation
2. **Tenant isolation** — School-scoped data access
3. **Role check** — `@RequireRoles(MembershipRole.XXX)`
4. **Policy check** — Service-level business rule validation

### Error Sanitization
All errors returned to clients use `{ code: string, message: string }` format. Internal error details (stack traces, provider keys, encrypted data) are never exposed.

### Optimistic Concurrency
Write operations use `revision` field for conflict detection. Clients must send current revision; server rejects stale updates.

### Pagination
List endpoints return `{ items: T[], nextCursor: string | null, hasMore: boolean }` with cursor-based pagination.
