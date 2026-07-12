import type {
  ReviewDecision,
} from "../domain/governance.types.js";

export const GOVERNANCE_REVIEW_REPOSITORY = Symbol("GOVERNANCE_REVIEW_REPOSITORY");

export interface GovernanceReviewRepositoryPort {
  findByCourseVersionId(
    courseVersionId: string,
  ): Promise<readonly ReviewDecision[]>;

  save(
    review: Omit<ReviewDecision, "id" | "createdAt">,
  ): Promise<ReviewDecision>;
}
