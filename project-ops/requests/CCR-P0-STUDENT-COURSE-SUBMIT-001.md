# Contract Change Request: P0-STUDENT-COURSE-SUBMIT-001

## Task
P0-STUDENT-COURSE-SUBMIT-001 — 闭合学生课程五类普通活动保存与整课提交闭环

## Change Description
学生课程活动保存 provider/consumer OpenAPI 契约变更。

### Endpoints Affected

1. **POST /api/v1/student-courses/:assignmentId/submissions/:submissionId/activities/:activityId/attempts**
   - Request body: `SaveActivityAttemptDto` — fields `kind`, `value`, `completed`, `videoPosition`, `expectedProgressRevision`
   - Response: `{ data: { attempt, progress, courseCompletion } }`
   - New: `kind` must match `LearningActivity.type`; `expectedProgressRevision` for atomic concurrency (409 on mismatch)

2. **POST /api/v1/student-courses/:assignmentId/submissions/:submissionId/submit**
   - Request body: `SubmitCourseDto` — field `revision`
   - Response: `{ data: { submission } }` with updated `status`, `revision`, `submittedAt`
   - New: Revision-based optimistic concurrency; 409 on mismatch; idempotent re-submit returns same result

3. **POST /api/v1/student-courses/:assignmentId/submissions/:submissionId/activities/:activityId/recordings/:recordingId/link**
   - Response: `{ data: { activityAttempt } }` with linked recording
   - New: Required for SPEECH completion; generic `saveActivityAttempt` rejects `completed: true` for SPEECH/PRACTICE

### Breaking Changes
None. All changes are additive or strengthening existing validation.

### Consumer Impact
- Frontend `course-api-adapter.js` updated to use new DTO fields and handle 409 conflict responses
- SPEECH activities must use `linkRecording` endpoint instead of generic save
- PRACTICE activities must use `completePractice` endpoint instead of generic save

### Rollback
Revert task branch commits. No Prisma schema or migration changes were made.

## Approval
- Task owner: Codex
- Integration Lead: pending review
