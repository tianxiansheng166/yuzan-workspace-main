import type { AuthContext } from "../../common/security/auth.types.js";
import { hasAnyRole, isActive, MembershipRole } from "../../common/security/index.js";

export class ReportingPolicy {
  canListReports(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN]);
  }

  canCreateReport(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN]);
  }

  canReadReport(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }
}
