import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  isPlatformAdmin,
  hasRole,
  MembershipRole,
} from "../../../common/security/index.js";

export class GovernancePolicy {
  canReviewVersions(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canApproveVersions(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canPublishVersions(context: AuthContext): boolean {
    return isPlatformAdmin(context) || hasRole(context, MembershipRole.SCHOOL_ADMIN);
  }

  canRetireVersions(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewAllVersions(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewReviewHistory(context: AuthContext): boolean {
    return isPlatformAdmin(context) || hasRole(context, MembershipRole.SCHOOL_ADMIN);
  }
}
