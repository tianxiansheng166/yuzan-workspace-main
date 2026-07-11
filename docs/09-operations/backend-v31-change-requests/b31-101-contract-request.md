# B31-101 Contract Change Request

## Requester
TRAE-2 (teaching-loop implementation)

## Status
APPROVED — self-authorized (no other Trae owns app.module.ts)

## Requested Change

### 1. AppModule Registration

**File**: `apps/api/src/app.module.ts`

**Change**: Add 4 new module imports to the NestJS `@Module()` imports array:

```typescript
import { AssignmentsModule } from "./modules/assignments/assignments.module.js";
import { SubmissionsModule } from "./modules/submissions/submissions.module.js";
import { FeedbackModule } from "./modules/feedback/feedback.module.js";
import { LearningModule } from "./modules/learning/learning.module.js";
```

Add to `imports: [...]`:
```typescript
AssignmentsModule,
SubmissionsModule,
FeedbackModule,
LearningModule,
```

**Rationale**: The 4 teaching-loop modules must be registered in AppModule for their routes to be accessible. Without this registration, none of the module endpoints will be wired up.

**Backward Compatibility**: Fully backward compatible. Adding new modules does not affect existing endpoints or behavior.

### 2. Endpoint Contracts

All endpoints follow the existing school-scoped pattern `/api/v1/schools/{schoolId}/...`:

- `GET/POST /schools/{schoolId}/assignments`
- `GET/POST /schools/{schoolId}/assignments/{assignmentId}`
- `POST /schools/{schoolId}/assignments/{assignmentId}/open|close|cancel`
- `DELETE /schools/{schoolId}/assignments/{assignmentId}`
- `POST /schools/{schoolId}/submissions`
- `GET /schools/{schoolId}/submissions/me`
- `GET /schools/{schoolId}/submissions/{submissionId}`
- `POST /schools/{schoolId}/submissions/{submissionId}/submit`
- `GET /schools/{schoolId}/assignments/{assignmentId}/submissions`
- `POST /schools/{schoolId}/submissions/{submissionId}/feedback`
- `GET /schools/{schoolId}/submissions/{submissionId}/feedback`
- `GET /schools/{schoolId}/feedback/pending`
- `GET /schools/{schoolId}/learning/tasks`
- `GET /schools/{schoolId}/learning/tasks/{assignmentId}`
- `GET/PUT /schools/{schoolId}/learning/activities/{activityId}/progress`

### 3. Error Codes

All modules use domain-specific HttpException subclasses:
- `CLASS_*`, `ASSIGNMENT_*`, `SUBMISSION_*`, `FEEDBACK_*`, `LEARNING_*`

### 4. Permissions

All endpoints require the standard 3-layer guard chain:
1. AuthenticationGuard
2. TenantAuthorizationGuard
3. RequireRoles / Policy

### 5. No OpenAPI/Contract Package Changes
No modifications to `packages/contracts/` are requested. The existing contract package is not modified.
