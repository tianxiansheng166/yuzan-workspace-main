import type { AuthContext } from "../../../common/security/auth.types.js";
import type { GovernanceCourseVersion, ReviewDecisionType } from "../domain/governance.types.js";
import { GovernancePolicy } from "../domain/governance.policy.js";
import {
  GovernanceForbiddenException,
  GovernanceNotFoundException,
} from "../domain/governance.errors.js";
import type { GovernanceRepositoryPort } from "../ports/governance-repository.port.js";
import type { GovernanceReviewRepositoryPort } from "../ports/governance-review-repository.port.js";
import { validateReviewAction, validateCanBePublished, validateCanBeRetired } from "./review.validator.js";

export async function executeGovernanceReview(
  governanceRepo: GovernanceRepositoryPort,
  reviewRepo: GovernanceReviewRepositoryPort,
  auth: AuthContext,
  schoolId: string,
  courseVersionId: string,
  decision: ReviewDecisionType,
  comment?: string,
): Promise<GovernanceCourseVersion> {
  const version = await governanceRepo.findById(schoolId, courseVersionId);

  if (!version) {
    throw new GovernanceNotFoundException();
  }

  const policy = new GovernancePolicy();

  validateReviewAction(version, decision, auth, policy);

  const now = new Date();

  let newStatus: GovernanceCourseVersion["status"];
  let timestampFields: Record<string, Date>;

  switch (decision) {
    case "APPROVE":
      newStatus = "APPROVED";
      timestampFields = { approvedAt: now };
      break;
    case "REQUEST_CHANGES":
      newStatus = "CHANGES_REQUESTED";
      timestampFields = {};
      break;
    case "REJECT":
      newStatus = "DRAFT";
      timestampFields = {};
      break;
  }

  await reviewRepo.save({
    courseVersionId,
    reviewerUserId: auth.principal.userId,
    decision,
    comment: comment ?? null,
  });

  const updated = await governanceRepo.updateStatus(
    schoolId,
    courseVersionId,
    newStatus,
    timestampFields,
    version.updatedAt,
  );

  return updated;
}

export async function executeSubmitForReview(
  governanceRepo: GovernanceRepositoryPort,
  auth: AuthContext,
  schoolId: string,
  courseVersionId: string,
): Promise<GovernanceCourseVersion> {
  const version = await governanceRepo.findById(schoolId, courseVersionId);

  if (!version) {
    throw new GovernanceNotFoundException();
  }

  if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") {
    throw new GovernanceForbiddenException(
      "只有 DRAFT 或 CHANGES_REQUESTED 状态可以提交审核",
    );
  }

  const now = new Date();

  const updated = await governanceRepo.updateStatus(
    schoolId,
    courseVersionId,
    "IN_REVIEW",
    { submittedAt: now },
    version.updatedAt,
  );

  return updated;
}

export async function executePublish(
  governanceRepo: GovernanceRepositoryPort,
  auth: AuthContext,
  schoolId: string,
  courseVersionId: string,
): Promise<GovernanceCourseVersion> {
  const version = await governanceRepo.findById(schoolId, courseVersionId);

  if (!version) {
    throw new GovernanceNotFoundException();
  }

  validateCanBePublished(version);

  const now = new Date();

  const updated = await governanceRepo.updateStatus(
    schoolId,
    courseVersionId,
    "PUBLISHED",
    { publishedAt: now },
    version.updatedAt,
  );

  return updated;
}

export async function executeRetire(
  governanceRepo: GovernanceRepositoryPort,
  auth: AuthContext,
  schoolId: string,
  courseVersionId: string,
): Promise<GovernanceCourseVersion> {
  const version = await governanceRepo.findById(schoolId, courseVersionId);

  if (!version) {
    throw new GovernanceNotFoundException();
  }

  validateCanBeRetired(version);

  const now = new Date();

  const updated = await governanceRepo.updateStatus(
    schoolId,
    courseVersionId,
    "RETIRED",
    { retiredAt: now },
    version.updatedAt,
  );

  return updated;
}
