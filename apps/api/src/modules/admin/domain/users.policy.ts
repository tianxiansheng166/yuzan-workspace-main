import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  hasRole,
  isPlatformAdmin,
  MembershipRole,
} from "../../../common/security/index.js";

export class UsersPolicy {
  canInviteUser(context: AuthContext): boolean {
    return (
      isPlatformAdmin(context) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canBulkImport(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canUpdateMembership(
    context: AuthContext,
    targetSchoolId: string,
  ): boolean {
    if (isPlatformAdmin(context)) {
      return true;
    }
    if (hasRole(context, MembershipRole.SCHOOL_ADMIN)) {
      return context.tenant.schoolId === targetSchoolId;
    }
    return false;
  }

  canRevokeSessions(
    context: AuthContext,
    targetSchoolId: string,
  ): boolean {
    if (isPlatformAdmin(context)) {
      return true;
    }
    if (hasRole(context, MembershipRole.SCHOOL_ADMIN)) {
      return context.tenant.schoolId === targetSchoolId;
    }
    return false;
  }
}
