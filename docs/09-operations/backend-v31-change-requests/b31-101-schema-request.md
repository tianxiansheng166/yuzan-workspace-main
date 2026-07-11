# B31-101 Schema Change Request

## Requester
TRAE-2 (teaching-loop implementation)

## Status
NO CHANGE NEEDED

## Summary
The existing Prisma schema in `infra/database/prisma/schema.prisma` already contains all models and fields required by the teaching-loop implementation:

- **Assignment** model: id, schoolId, courseVersionId, createdByUserId, title, status, startsAt, dueAt, offlineRequired, completionRule, revision, openedAt, closedAt, timestamps, soft-delete
- **AssignmentTarget** model: id, schoolId, assignmentId, targetType, classId, enrollmentId
- **Submission** model: id, schoolId, assignmentId, enrollmentId, attemptNo, status, idempotencyKey, deviceId, revision, submittedAt, timestamps, soft-delete
- **Feedback** model: id, schoolId, submissionId, authorUserId, decision, comment, score, revision, releasedAt, timestamps, soft-delete
- **ActivityProgress** model: id, schoolId, activityId, enrollmentId, position, completed, revision, timestamps
- **ActivityAttempt** model: for attempt tracking

## Unique Constraints
- `@@unique([enrollmentId, idempotencyKey])` on Submission for idempotent creation
- `@@unique([activityId, enrollmentId])` on ActivityProgress for upsert

## No Schema Changes Required
All entities, fields, constraints, and indexes are already present in the schema. No migration is needed.
