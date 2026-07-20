import type { AuthContext } from "../../common/security/auth.types.js";
import { hasAnyRole, isActive, MembershipRole } from "../../common/security/index.js";

export class AssessmentPolicy {
  canCreateSession(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN]);
  }

  canReadSession(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }

  canStartSession(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }

  canSubmitSession(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }

  canCancelSession(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN]);
  }

  canGenerateReport(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN]);
  }

  canDeviceCheck(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }
}
