import type { AuthContext } from "../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../common/security/index.js";

export class TeacherPolicy {
  canAccess(auth: AuthContext, schoolId: string): boolean {
    return (
      auth.tenant.schoolId === schoolId &&
      (hasRole(auth, MembershipRole.TEACHER) ||
        hasRole(auth, MembershipRole.SCHOOL_ADMIN) ||
        hasRole(auth, MembershipRole.VOLUNTEER))
    );
  }
}
