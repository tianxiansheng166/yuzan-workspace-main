import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasPermission,
  hasRole,
  MembershipRole,
} from "../../common/security/index.js";
import { Permission } from "../../common/security/permission.js";
import type {
  Assignment,
  AssignmentStatus,
} from "./domain/assignment.types.js";
import type { Clock } from "./ports/clock.port.js";

export class AssignmentsPolicy {
  canCreate(auth: AuthContext, schoolId: string): boolean {
    return (
      hasPermission(auth, Permission.ASSIGNMENT_MANAGE) &&
      auth.tenant.schoolId === schoolId
    );
  }

  canManage(
    auth: AuthContext,
    assignment: Assignment,
    isManagerOfClass: boolean,
  ): boolean {
    if (!hasPermission(auth, Permission.ASSIGNMENT_MANAGE)) {
      return false;
    }

    if (auth.tenant.schoolId !== assignment.schoolId) {
      return false;
    }

    return isManagerOfClass;
  }

  canRead(
    auth: AuthContext,
    assignment: Assignment,
    clock: Clock,
    isActiveMemberOfClass: boolean,
    isManagerOfClass: boolean,
  ): boolean {
    if (auth.tenant.schoolId !== assignment.schoolId) {
      return false;
    }

    if (isManagerOfClass) {
      return true;
    }

    if (hasRole(auth, MembershipRole.STUDENT)) {
      if (!isActiveMemberOfClass) {
        return false;
      }
      if (assignment.status !== "PUBLISHED") {
        return false;
      }
      if (
        assignment.publishAt &&
        assignment.publishAt.getTime() > clock.now().getTime()
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  isStudentVisible(
    assignment: { status: AssignmentStatus; publishAt?: Date | null },
    clock: Clock,
    isActiveMemberOfClass: boolean,
  ): boolean {
    if (!isActiveMemberOfClass) {
      return false;
    }
    if (assignment.status !== "PUBLISHED") {
      return false;
    }
    if (
      assignment.publishAt &&
      assignment.publishAt.getTime() > clock.now().getTime()
    ) {
      return false;
    }
    return true;
  }

  canListInClass(auth: AuthContext, schoolId: string): boolean {
    return (
      auth.tenant.schoolId === schoolId &&
      (hasPermission(auth, Permission.ASSIGNMENT_MANAGE) ||
        hasPermission(auth, Permission.ASSIGNMENT_SUBMIT))
    );
  }
}
