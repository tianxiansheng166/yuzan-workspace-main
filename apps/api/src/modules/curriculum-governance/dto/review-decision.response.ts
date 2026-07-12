import type { ReviewDecision, ReviewDecisionType } from "../domain/governance.types.js";

export interface ReviewDecisionResponse {
  readonly id: string;
  readonly courseVersionId: string;
  readonly reviewerUserId: string;
  readonly decision: ReviewDecisionType;
  readonly comment: string | null;
  readonly createdAt: string;
}

export function toReviewDecisionResponse(
  decision: ReviewDecision,
): ReviewDecisionResponse {
  return {
    id: decision.id,
    courseVersionId: decision.courseVersionId,
    reviewerUserId: decision.reviewerUserId,
    decision: decision.decision,
    comment: decision.comment,
    createdAt: decision.createdAt.toISOString(),
  };
}
