import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasPermission,
  hasRole,
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";
import { Permission } from "../../common/security/permission.js";
import type { Assignment } from "../assignments/domain/assignment.types.js";
import type { Clock } from "../assignments/ports/clock.port.js";

export class AssessmentPolicy {
  canAccessAssessment(auth: AuthContext, schoolId: string): boolean {
    return (
      auth.tenant.schoolId === schoolId &&
      hasRole(auth, MembershipRole.STUDENT) &&
      auth.principal.membershipStatus === MembershipStatus.ACTIVE
    );
  }

  canManageAssessment(auth: AuthContext, schoolId: string): boolean {
    return (
      hasPermission(auth, Permission.ASSIGNMENT_MANAGE) &&
      auth.tenant.schoolId === schoolId
    );
  }

  checkVisibility(assignment: {
    readonly status: string;
    readonly publishAt?: Date | null;
    readonly dueAt?: Date | null;
    readonly latePolicy: string;
  }): {
    visible: boolean;
    canStart: boolean;
    canSubmit: boolean;
    reason?: string;
  } {
    const now = new Date();

    if (assignment.status !== "PUBLISHED") {
      return {
        visible: false,
        canStart: false,
        canSubmit: false,
        reason: "任务未发布",
      };
    }

    if (
      assignment.publishAt &&
      assignment.publishAt.getTime() > now.getTime()
    ) {
      return {
        visible: false,
        canStart: false,
        canSubmit: false,
        reason: "任务尚未开放",
      };
    }

    if (!assignment.dueAt || assignment.dueAt.getTime() >= now.getTime()) {
      return {
        visible: true,
        canStart: true,
        canSubmit: true,
      };
    }

    switch (assignment.latePolicy) {
      case "REJECT":
        return {
          visible: true,
          canStart: false,
          canSubmit: false,
          reason: "任务已截止，不接受 late 提交",
        };
      case "ACCEPT_WITH_PENALTY":
        return {
          visible: true,
          canStart: true,
          canSubmit: true,
          reason: "任务已截止，late 提交将扣分",
        };
      case "ACCEPT":
      default:
        return {
          visible: true,
          canStart: true,
          canSubmit: true,
          reason: "任务已截止，仍接受 late 提交",
        };
    }
  }

  canViewAnswerKey(
    auth: AuthContext,
    assignment: Assignment,
    clock: Clock,
    hasSubmitted: boolean,
  ): boolean {
    if (this.canManageAssessment(auth, assignment.schoolId)) {
      return true;
    }

    if (!hasRole(auth, MembershipRole.STUDENT)) {
      return false;
    }

    if (!hasSubmitted) {
      return false;
    }

    const now = clock.now();
    if (assignment.dueAt && assignment.dueAt.getTime() > now.getTime()) {
      return false;
    }

    return true;
  }
}
