import type { AuthContext } from "../../common/security/auth.types.js";
import { hasAnyRole, isActive, MembershipRole } from "../../common/security/index.js";

export class OfflinePolicy {
  canListPackages(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }

  canCreatePackage(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN]);
  }

  canReadPackage(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }

  canAuthorizeDownload(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    if (auth.tenant.schoolId !== schoolId) return false;
    return hasAnyRole(auth, [MembershipRole.STUDENT, MembershipRole.TEACHER]);
  }

  canCreateSyncBatch(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }

  canReadSyncBatch(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) return false;
    return auth.tenant.schoolId === schoolId;
  }
}
