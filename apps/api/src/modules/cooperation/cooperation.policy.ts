import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class CooperationPolicy {
  canSubmitLead(_auth: AuthContext | null): boolean {
    // Public: no school context required, but rate-limited at controller level
    return true;
  }

  canViewLeads(auth: AuthContext): boolean {
    if (!isActive(auth)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.PLATFORM_ADMIN,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canManageLeads(auth: AuthContext): boolean {
    if (!isActive(auth)) {
      return false;
    }
    return hasRole(auth, MembershipRole.PLATFORM_ADMIN);
  }

  canSubmitSupportApplication(_auth: AuthContext | null): boolean {
    // Public: rate-limited at controller level
    return true;
  }

  canViewApplications(auth: AuthContext): boolean {
    if (!isActive(auth)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.PLATFORM_ADMIN,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canSubmitVolunteerApplication(_auth: AuthContext | null): boolean {
    // Public: rate-limited at controller level
    return true;
  }

  canReviewApplications(auth: AuthContext): boolean {
    if (!isActive(auth)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.PLATFORM_ADMIN,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }
}
