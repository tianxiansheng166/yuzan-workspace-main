import type { AuthContext } from "../../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../../common/security/index.js";

export class RulePolicy {
  canManageRules(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }

  canViewRules(context: AuthContext): boolean {
    return (
      hasRole(context, MembershipRole.PLATFORM_ADMIN) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canDetectConflicts(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }
}
