import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class SubmissionsPolicy {
  canCreateSubmission(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasRole(auth, MembershipRole.STUDENT);
  }

  canReadOwnSubmissions(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasRole(auth, MembershipRole.STUDENT);
  }

  canReadAssignmentSubmissions(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canSubmit(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasRole(auth, MembershipRole.STUDENT);
  }

  canTransitionStatus(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.STUDENT,
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
