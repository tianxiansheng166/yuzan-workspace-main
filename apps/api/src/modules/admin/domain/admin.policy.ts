import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  hasRole,
  isPlatformAdmin,
  MembershipRole,
} from "../../../common/security/index.js";

export class AdminPolicy {
  canViewDashboard(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canManageSchools(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canManageUsers(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canManageSchoolUsers(
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

  canManageProviders(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewAuditLogs(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
