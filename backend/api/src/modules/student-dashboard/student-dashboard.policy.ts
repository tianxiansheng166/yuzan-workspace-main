import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class StudentDashboardPolicy {
  canAccessDashboard(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (!this.isMemberOfSchool(auth, schoolId)) return false;
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }

  isMemberOfSchool(auth: AuthContext, schoolId: string): boolean {
    if (hasAnyRole(auth, [MembershipRole.PLATFORM_ADMIN])) return true;
    return auth.tenant.schoolId === schoolId;
  }
}
