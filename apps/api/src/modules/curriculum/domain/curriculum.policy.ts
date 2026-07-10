import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasPermission,
  hasRole,
  MembershipRole,
  Permission,
} from "../../../common/security/index.js";
import type { CourseVersion } from "./course-version.types.js";

export class CurriculumPolicy {
  canReadList(auth: AuthContext): boolean {
    return hasPermission(auth, Permission.CONTENT_READ);
  }

  canManage(auth: AuthContext, version: CourseVersion): boolean {
    if (!hasPermission(auth, Permission.COURSE_MANAGE)) {
      return false;
    }

    if (hasAnyRole(auth, [MembershipRole.SCHOOL_ADMIN])) {
      return auth.tenant.schoolId === version.schoolId;
    }

    if (hasAnyRole(auth, [MembershipRole.TEACHER])) {
      return (
        auth.tenant.schoolId === version.schoolId &&
        auth.principal.userId === version.authorUserId
      );
    }

    return false;
  }

  canPublish(auth: AuthContext, version: CourseVersion): boolean {
    return this.canManage(auth, version);
  }

  canReadAsStudent(auth: AuthContext, version: CourseVersion): boolean {
    return (
      hasRole(auth, MembershipRole.STUDENT) &&
      auth.tenant.schoolId === version.schoolId &&
      version.status === "PUBLISHED"
    );
  }

  canCreateDraft(auth: AuthContext, schoolId: string): boolean {
    return (
      hasPermission(auth, Permission.COURSE_MANAGE) &&
      auth.tenant.schoolId === schoolId
    );
  }
}
