import type { AuthContext } from "../../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../../common/security/index.js";

export class AssessmentPolicy {
  canManageMaterials(context: AuthContext): boolean {
    return (
      hasRole(context, MembershipRole.PLATFORM_ADMIN) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canPreview(context: AuthContext): boolean {
    return (
      hasRole(context, MembershipRole.PLATFORM_ADMIN) ||
      hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canPublish(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }

  canArchive(context: AuthContext): boolean {
    return hasRole(context, MembershipRole.PLATFORM_ADMIN);
  }
}
