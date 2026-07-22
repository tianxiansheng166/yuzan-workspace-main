import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class FeedbackPolicy {
  canCreateFeedback(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canReadFeedback(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canReadOwnFeedback(
    auth: AuthContext,
    schoolId: string,
    enrollmentUserId: string,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    if (hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN])) {
      return true;
    }
    return auth.principal.userId === enrollmentUserId;
  }

  canListPendingFeedback(auth: AuthContext, schoolId: string): boolean {
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
    if (hasAnyRole(auth, [MembershipRole.PLATFORM_ADMIN])) {
      return true;
    }
    return auth.tenant.schoolId === schoolId;
  }
}
