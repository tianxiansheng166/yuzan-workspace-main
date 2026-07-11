import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { Class, ClassEnrollment } from "./domain/class.types.js";

export class ClassesPolicy {
  canReadClassList(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canReadClass(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canReadClassMembers(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canCreateClass(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.SCHOOL_ADMIN,
      MembershipRole.PLATFORM_ADMIN,
    ]);
  }

  canUpdateClass(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.SCHOOL_ADMIN,
      MembershipRole.PLATFORM_ADMIN,
    ]);
  }

  canDeleteClass(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.SCHOOL_ADMIN,
      MembershipRole.PLATFORM_ADMIN,
    ]);
  }

  canManageEnrollment(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.SCHOOL_ADMIN,
      MembershipRole.PLATFORM_ADMIN,
    ]);
  }

  canAccessClassAsTeacher(
    auth: AuthContext,
    schoolId: string,
    classItem: Class,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return (
      hasRole(auth, MembershipRole.SCHOOL_ADMIN) ||
      classItem.teacherUserIds.includes(auth.principal.userId)
    );
  }

  canAccessClassAsStudent(
    auth: AuthContext,
    schoolId: string,
    enrollments: readonly ClassEnrollment[],
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return enrollments.some(
      (e) =>
        e.userId === auth.principal.userId &&
        e.roleInClass === MembershipRole.STUDENT,
    );
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
