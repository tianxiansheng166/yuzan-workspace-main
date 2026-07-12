import type { AuthContext } from "../../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../../common/security/index.js";

export class PlanPolicy {
  canManagePlans(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }

  canViewPlans(context: AuthContext): boolean {
    return (
      hasRole(context, MembershipRole.PLATFORM_ADMIN) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }
}
