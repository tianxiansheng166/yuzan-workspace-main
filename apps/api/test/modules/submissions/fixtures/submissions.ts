import type { Submission, SubmissionSummary } from "../../../../src/modules/submissions/domain/submission.types.js";

export function submission(overrides: Partial<Submission> = {}): Submission {
  const now = new Date();
  return {
    id: "submission-1",
    schoolId: "school-a",
    assignmentId: "assignment-1",
    enrollmentId: "enrollment-1",
    attemptNo: 1,
    status: "IN_PROGRESS",
    idempotencyKey: "idem-key-1",
    revision: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function submissionSummary(overrides: Partial<SubmissionSummary> = {}): SubmissionSummary {
  const now = new Date();
  return {
    id: "submission-1",
    schoolId: "school-a",
    assignmentId: "assignment-1",
    enrollmentId: "enrollment-1",
    attemptNo: 1,
    status: "IN_PROGRESS",
    revision: 0,
    createdAt: now,
    ...overrides,
  };
}
