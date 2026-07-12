import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  hasRole,
  isPlatformAdmin,
  MembershipRole,
} from "../../../common/security/index.js";

export class AdminUsersPolicy {
  canManageUsers(context: AuthContext): boolean {
    return (
      isPlatformAdmin(context) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canInviteUsers(context: AuthContext): boolean {
    return (
      isPlatformAdmin(context) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canBulkImport(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canRevokeSessions(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewUsers(context: AuthContext): boolean {
    return (
      isPlatformAdmin(context) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }
}
