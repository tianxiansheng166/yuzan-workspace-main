import type { AuthContext } from "../../../common/security/auth.types.js";
import type { CourseVersionStatus } from "../../curriculum/domain/course-version.types.js";
import type { GovernanceCourseVersion, ReviewDecisionType } from "../domain/governance.types.js";
import { GovernancePolicy } from "../domain/governance.policy.js";
import {
  GovernanceConflictException,
  GovernanceForbiddenException,
  GovernanceNotFoundException,
} from "../domain/governance.errors.js";

const VALID_TRANSITIONS: Record<ReviewDecisionType, readonly CourseVersionStatus[]> = {
  REQUEST_CHANGES: ["IN_REVIEW"],
  APPROVE: ["IN_REVIEW"],
  REJECT: ["IN_REVIEW"],
};

export function validateReviewAction(
  version: GovernanceCourseVersion,
  action: ReviewDecisionType,
  auth: AuthContext,
  policy: GovernancePolicy,
): void {
  if (!version) {
    throw new GovernanceNotFoundException();
  }

  const allowedStatuses = VALID_TRANSITIONS[action];

  if (!allowedStatuses.includes(version.status)) {
    throw new GovernanceConflictException(
      `当前状态 ${version.status} 不允许执行 ${action} 操作`,
    );
  }

  switch (action) {
    case "APPROVE":
      if (!policy.canApproveVersions(auth)) {
        throw new GovernanceForbiddenException("无权审批课程版本");
      }
      break;
    case "REQUEST_CHANGES":
    case "REJECT":
      if (!policy.canReviewVersions(auth)) {
        throw new GovernanceForbiddenException("无权审核课程版本");
      }
      break;
  }
}

export function validateCanBeReviewed(version: GovernanceCourseVersion): void {
  if (!version) {
    throw new GovernanceNotFoundException();
  }

  if (version.status !== "IN_REVIEW") {
    throw new GovernanceConflictException(
      `只有 IN_REVIEW 状态可以审核，当前状态为 ${version.status}`,
    );
  }
}

export function validateCanBePublished(version: GovernanceCourseVersion): void {
  if (!version) {
    throw new GovernanceNotFoundException();
  }

  if (version.status !== "APPROVED") {
    throw new GovernanceConflictException(
      `只有 APPROVED 状态可以发布，当前状态为 ${version.status}`,
    );
  }
}

export function validateCanBeRetired(version: GovernanceCourseVersion): void {
  if (!version) {
    throw new GovernanceNotFoundException();
  }

  if (version.status !== "PUBLISHED") {
    throw new GovernanceConflictException(
      `只有 PUBLISHED 状态可以退役，当前状态为 ${version.status}`,
    );
  }
}
