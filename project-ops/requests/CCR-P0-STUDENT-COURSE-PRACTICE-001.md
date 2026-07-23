# Contract Change Request: P0-STUDENT-COURSE-PRACTICE-001

- Status: submitted for Integration Lead review
- Owner: Integration Lead
- Consumer: `frontend/student/courses/course-detail`
- Providers: student courses API and practice API
- Schema impact: none

## Current mismatch

The OpenAPI already lists the student course aggregate, course submission and practice-attempt
endpoints, but the create-or-resume practice operation does not document its course-context
request body. The browser must send all three server-validated identifiers together:
`assignmentId`, `submissionId` and `activityId`.

## Authorized contract clarification

- Define a `CoursePracticeContextRequest` object with the three UUID fields.
- Require all three fields together for course-linked practice; an empty body remains valid for
  self-practice.
- Document the create/resume response fields used by the consumer: `attemptId`, `status`,
  `resumed`, `mode` and `courseContext`.
- Do not change authorization, data meaning, route names or Prisma schema.

## Provider and consumer proof

- Provider tests must cover partial context, wrong school/student/submission/reference and
  create/resume idempotency.
- Consumer tests must prove the exact three-ID payload and reject missing context.
- Runtime evidence must use IDs dynamically returned by login and APIs.

## Rollback

Revert the OpenAPI clarification and consumer bridge together. Existing endpoints and persisted
assessment/course rows are unchanged.
