import type { Feedback } from "../domain/feedback.types.js";

export interface FeedbackResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly submissionId: string;
  readonly authorUserId: string;
  readonly decision: string;
  readonly comment: string;
  readonly score?: number;
  readonly revision: number;
  readonly releasedAt: string;
}

export function toFeedbackResponse(feedback: Feedback): FeedbackResponse {
  return {
    id: feedback.id,
    schoolId: feedback.schoolId,
    submissionId: feedback.submissionId,
    authorUserId: feedback.authorUserId,
    decision: feedback.decision,
    comment: feedback.comment,
    ...(feedback.score !== undefined ? { score: feedback.score } : {}),
    revision: feedback.revision,
    releasedAt: feedback.releasedAt.toISOString(),
  };
}
