import { Injectable } from "@nestjs/common";
import type {
  ReviewDecision,
} from "../domain/governance.types.js";
import { ReviewNotFoundException } from "../domain/governance.errors.js";
import type { GovernanceReviewRepositoryPort } from "./governance-review-repository.port.js";

@Injectable()
export class UnavailableReviewRepository implements GovernanceReviewRepositoryPort {
  private fail(): never {
    throw new ReviewNotFoundException("审核服务暂不可用");
  }

  async findByCourseVersionId(
    _courseVersionId: string,
  ): Promise<readonly ReviewDecision[]> {
    this.fail();
  }

  async save(
    _review: Omit<ReviewDecision, "id" | "createdAt">,
  ): Promise<ReviewDecision> {
    this.fail();
  }
}
