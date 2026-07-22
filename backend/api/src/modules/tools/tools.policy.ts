import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class ToolsPolicy {
  canViewIntegrations(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canManageIntegrations(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canTriggerMindGraph(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canViewOwnJobs(
    auth: AuthContext,
    schoolId: string,
    jobUserId?: string,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    // Admins can view any job
    if (
      hasAnyRole(auth, [
        MembershipRole.SCHOOL_ADMIN,
        MembershipRole.PLATFORM_ADMIN,
      ])
    ) {
      return true;
    }
    // Users can view their own jobs
    if (jobUserId && jobUserId === auth.principal.userId) {
      return true;
    }
    // Listing own jobs is allowed for any member
    if (!jobUserId) {
      return true;
    }
    return false;
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
