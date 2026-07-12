import { randomUUID } from "node:crypto";
import type { ReviewDecision } from "../../../src/modules/curriculum-governance/domain/governance.types.js";
import type { GovernanceReviewRepositoryPort } from "../../../src/modules/curriculum-governance/ports/governance-review-repository.port.js";

export class FakeGovernanceReviewRepository implements GovernanceReviewRepositoryPort {
  private readonly reviews = new Map<string, ReviewDecision>();

  add(...reviews: ReviewDecision[]): void {
    for (const review of reviews) {
      this.reviews.set(review.id, review);
    }
  }

  async findByCourseVersionId(
    courseVersionId: string,
  ): Promise<readonly ReviewDecision[]> {
    return Array.from(this.reviews.values()).filter(
      (r) => r.courseVersionId === courseVersionId,
    );
  }

  async save(
    review: Omit<ReviewDecision, "id" | "createdAt">,
  ): Promise<ReviewDecision> {
    const saved: ReviewDecision = {
      id: randomUUID(),
      ...review,
      createdAt: new Date(),
    };
    this.reviews.set(saved.id, saved);
    return saved;
  }
}
