import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type {
  GovernanceCourseVersion,
  GovernanceVersionListResult,
  ListGovernanceVersionsOptions,
  ReviewDecision,
  ReviewDecisionType,
} from "./domain/governance.types.js";
import { GovernancePolicy } from "./domain/governance.policy.js";
import {
  GovernanceForbiddenException,
  GovernanceNotFoundException,
} from "./domain/governance.errors.js";
import {
  GOVERNANCE_REPOSITORY,
  type GovernanceRepositoryPort,
} from "./ports/governance-repository.port.js";
import {
  GOVERNANCE_REVIEW_REPOSITORY,
  type GovernanceReviewRepositoryPort,
} from "./ports/governance-review-repository.port.js";
import {
  executeGovernanceReview,
  executeSubmitForReview,
  executePublish,
  executeRetire,
} from "./review/review.workflow.js";

@Injectable()
export class GovernanceService {
  private readonly policy = new GovernancePolicy();

  constructor(
    @Inject(GOVERNANCE_REPOSITORY)
    private readonly governanceRepo: GovernanceRepositoryPort,
    @Inject(GOVERNANCE_REVIEW_REPOSITORY)
    private readonly reviewRepo: GovernanceReviewRepositoryPort,
  ) {}

  async listAllVersions(
    auth: AuthContext,
    options: ListGovernanceVersionsOptions,
  ): Promise<GovernanceVersionListResult> {
    if (!this.policy.canViewAllVersions(auth)) {
      throw new GovernanceForbiddenException();
    }

    return this.governanceRepo.listAll(options);
  }

  async findById(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<GovernanceCourseVersion> {
    if (!this.policy.canViewAllVersions(auth)) {
      throw new GovernanceForbiddenException();
    }

    const version = await this.governanceRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new GovernanceNotFoundException();
    }

    return version;
  }

  async submitForReview(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<GovernanceCourseVersion> {
    if (!this.policy.canReviewVersions(auth)) {
      throw new GovernanceForbiddenException("无权提交课程版本审核");
    }

    return executeSubmitForReview(
      this.governanceRepo,
      auth,
      schoolId,
      courseVersionId,
    );
  }

  async reviewVersion(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
    decision: ReviewDecisionType,
    comment?: string,
  ): Promise<GovernanceCourseVersion> {
    if (decision === "APPROVE" && !this.policy.canApproveVersions(auth)) {
      throw new GovernanceForbiddenException("无权审批课程版本");
    }

    if (!this.policy.canReviewVersions(auth)) {
      throw new GovernanceForbiddenException("无权审核课程版本");
    }

    return executeGovernanceReview(
      this.governanceRepo,
      this.reviewRepo,
      auth,
      schoolId,
      courseVersionId,
      decision,
      comment,
    );
  }

  async publishVersion(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<GovernanceCourseVersion> {
    if (!this.policy.canPublishVersions(auth)) {
      throw new GovernanceForbiddenException("无权发布课程版本");
    }

    return executePublish(
      this.governanceRepo,
      auth,
      schoolId,
      courseVersionId,
    );
  }

  async retireVersion(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<GovernanceCourseVersion> {
    if (!this.policy.canRetireVersions(auth)) {
      throw new GovernanceForbiddenException("无权退役课程版本");
    }

    return executeRetire(
      this.governanceRepo,
      auth,
      schoolId,
      courseVersionId,
    );
  }

  async getReviewHistory(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<readonly ReviewDecision[]> {
    if (!this.policy.canViewReviewHistory(auth)) {
      throw new GovernanceForbiddenException("无权查看审核历史");
    }

    return this.reviewRepo.findByCourseVersionId(courseVersionId);
  }
}
