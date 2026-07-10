import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasPermission,
  hasRole,
  MembershipRole,
} from "../../common/security/index.js";
import { Permission } from "../../common/security/permission.js";
import type { Assignment } from "./domain/assignment.types.js";

export class AssignmentsPolicy {
  canCreate(auth: AuthContext, schoolId: string): boolean {
    return (
      hasPermission(auth, Permission.ASSIGNMENT_MANAGE) &&
      auth.tenant.schoolId === schoolId
    );
  }

  canManage(auth: AuthContext, assignment: Assignment): boolean {
    if (!hasPermission(auth, Permission.ASSIGNMENT_MANAGE)) {
      return false;
    }

    if (auth.tenant.schoolId !== assignment.schoolId) {
      return false;
    }

    if (hasRole(auth, MembershipRole.SCHOOL_ADMIN)) {
      return true;
    }

    if (hasRole(auth, MembershipRole.TEACHER)) {
      return assignment.createdByUserId === auth.principal.userId;
    }

    return false;
  }

  canRead(auth: AuthContext, assignment: Assignment): boolean {
    if (auth.tenant.schoolId !== assignment.schoolId) {
      return false;
    }

    if (this.canManage(auth, assignment)) {
      return true;
    }

    if (hasRole(auth, MembershipRole.STUDENT)) {
      return (
        assignment.status === "PUBLISHED" || assignment.status === "CLOSED"
      );
    }

    return false;
  }

  canListInClass(auth: AuthContext, schoolId: string): boolean {
    return (
      auth.tenant.schoolId === schoolId &&
      (hasPermission(auth, Permission.ASSIGNMENT_MANAGE) ||
        hasPermission(auth, Permission.ASSIGNMENT_SUBMIT))
    );
  }
}
