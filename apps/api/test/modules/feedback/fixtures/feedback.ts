import type { Feedback } from "../../../../src/modules/feedback/domain/feedback.types.js";

export function feedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    id: "feedback-1",
    schoolId: "school-a",
    submissionId: "submission-1",
    authorUserId: "teacher-1",
    decision: "ACCEPT",
    comment: "Good work",
    revision: 1,
    releasedAt: new Date(),
    ...overrides,
  };
}
