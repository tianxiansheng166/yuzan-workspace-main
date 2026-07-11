import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { SupportPairing } from "./domain/support-pairing.types.js";

export class SupportPairingsPolicy {
  canCreatePairing(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canListPairings(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canViewOwnPairing(
    auth: AuthContext,
    schoolId: string,
    pairing: SupportPairing,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return pairing.volunteerUserId === auth.principal.userId;
  }

  canUpdateConsent(
    auth: AuthContext,
    schoolId: string,
    pairing: SupportPairing,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    if (
      hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN])
    ) {
      return true;
    }
    return pairing.studentUserId === auth.principal.userId;
  }

  canCreateSession(
    auth: AuthContext,
    schoolId: string,
    pairing: SupportPairing,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    if (
      hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN])
    ) {
      return true;
    }
    return pairing.volunteerUserId === auth.principal.userId;
  }

  canReviewSession(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  private isMemberOfSchool(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) {
      return false;
    }
    if (hasRole(auth, MembershipRole.PLATFORM_ADMIN)) {
      return true;
    }
    return auth.tenant.schoolId === schoolId;
  }
}
