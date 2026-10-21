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
    return (
      this.isMemberOfSchool(auth, schoolId) &&
      hasAnyRole(auth, [
        MembershipRole.STUDENT,
        MembershipRole.TEACHER,
        MembershipRole.SCHOOL_ADMIN,
      ])
    );
  }

  canReadOwnFeedback(
    auth: AuthContext,
    schoolId: string,
    enrollmentUserId: string,
  ): boolean {
    return (
      this.canReadFeedback(auth, schoolId) &&
      hasAnyRole(auth, [MembershipRole.STUDENT]) &&
      auth.principal.userId === enrollmentUserId
    );
  }

  canReadAsTeacher(auth: AuthContext, schoolId: string): boolean {
    return (
      this.isMemberOfSchool(auth, schoolId) &&
      hasAnyRole(auth, [MembershipRole.TEACHER])
    );
  }

  isSchoolAdmin(auth: AuthContext, schoolId: string): boolean {
    return (
      this.isMemberOfSchool(auth, schoolId) &&
      hasAnyRole(auth, [MembershipRole.SCHOOL_ADMIN])
    );
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
    return isActive(auth) && auth.tenant.schoolId === schoolId;
  }
}
