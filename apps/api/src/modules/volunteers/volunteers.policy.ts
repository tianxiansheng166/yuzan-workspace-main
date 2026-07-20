import type { AuthContext } from "../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../common/security/index.js";

export class VolunteersPolicy {
  canApply(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canListVolunteers(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.TEACHER) ||
      hasRole(auth, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canViewVolunteer(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.TEACHER) ||
      hasRole(auth, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canViewOwnVolunteerProfile(auth: AuthContext, schoolId: string): boolean {
    return (
      this.isMemberOfSchool(auth, schoolId) &&
      hasRole(auth, MembershipRole.VOLUNTEER)
    );
  }

  canTransitionVolunteerStatus(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.SCHOOL_ADMIN) ||
      hasRole(auth, MembershipRole.PLATFORM_ADMIN)
    );
  }

  canManageServiceTasks(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.TEACHER) ||
      hasRole(auth, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canViewAssignedServiceTasks(auth: AuthContext, schoolId: string): boolean {
    return (
      this.isMemberOfSchool(auth, schoolId) &&
      hasRole(auth, MembershipRole.VOLUNTEER)
    );
  }

  canReportIncident(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.TEACHER) ||
      hasRole(auth, MembershipRole.SCHOOL_ADMIN) ||
      hasRole(auth, MembershipRole.VOLUNTEER)
    );
  }

  canViewIncidents(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return (
      hasRole(auth, MembershipRole.TEACHER) ||
      hasRole(auth, MembershipRole.SCHOOL_ADMIN)
    );
  }

  private isMemberOfSchool(auth: AuthContext, schoolId: string): boolean {
    if (auth.tenant.schoolId !== schoolId) return false;
    return true;
  }
}
