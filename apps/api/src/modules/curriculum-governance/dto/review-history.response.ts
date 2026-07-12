import type { ReviewDecision, ReviewDecisionType, ReviewHistory } from "../domain/governance.types.js";

export interface ReviewHistoryResponse {
  readonly items: readonly {
    readonly id: string;
    readonly courseVersionId: string;
    readonly reviewerUserId: string;
    readonly decision: ReviewDecisionType;
    readonly comment: string | null;
    readonly createdAt: string;
  }[];
}

export function toReviewHistoryResponse(
  history: ReviewHistory,
): ReviewHistoryResponse {
  return {
    items: history.items.map((decision) => ({
      id: decision.id,
      courseVersionId: decision.courseVersionId,
      reviewerUserId: decision.reviewerUserId,
      decision: decision.decision,
      comment: decision.comment,
      createdAt: decision.createdAt.toISOString(),
    })),
  };
}
