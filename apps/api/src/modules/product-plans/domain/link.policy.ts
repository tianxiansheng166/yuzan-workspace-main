import type { AuthContext } from "../../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../../common/security/index.js";

export class LinkPolicy {
  canViewLinks(context: AuthContext): boolean {
    return (
      hasRole(context, MembershipRole.PLATFORM_ADMIN) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canDisableLink(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }

  canRegenerateLink(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }
}
