import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { TranslationJob } from "./domain/translation.types.js";

export class TranslationsPolicy {
  canCreateTranslation(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canViewOwnJobs(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canViewAllJobs(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canViewJob(
    auth: AuthContext,
    schoolId: string,
    job: TranslationJob,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    if (hasRole(auth, MembershipRole.SCHOOL_ADMIN)) {
      return true;
    }
    if (
      hasRole(auth, MembershipRole.TEACHER) &&
      job.schoolId === schoolId
    ) {
      return true;
    }
    // Students can only view their own jobs — job ownership is checked at service level
    return job.schoolId === schoolId;
  }

  canViewGlossary(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
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
