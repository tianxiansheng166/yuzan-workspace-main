import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { TrainingEnrollment } from "./domain/training.types.js";

export class TrainingPolicy {
  canListPrograms(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canManagePrograms(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canEnroll(
    auth: AuthContext,
    schoolId: string,
    volunteerUserId: string,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    if (hasRole(auth, MembershipRole.VOLUNTEER)) {
      return auth.principal.userId === volunteerUserId;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canViewOwnEnrollment(
    auth: AuthContext,
    schoolId: string,
    enrollment: TrainingEnrollment,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return enrollment.volunteerUserId === auth.principal.userId;
  }

  canListEnrollments(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canManageExams(auth: AuthContext, schoolId: string): boolean {
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
