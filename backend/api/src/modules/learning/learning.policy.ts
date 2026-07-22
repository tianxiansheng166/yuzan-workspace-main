import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";

export class LearningPolicy {
  canViewTasks(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }

  canUpdateProgress(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [MembershipRole.STUDENT]);
  }

  isMemberOfSchool(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) {
      return false;
    }
    if (hasAnyRole(auth, [MembershipRole.PLATFORM_ADMIN])) {
      return true;
    }
    return auth.tenant.schoolId === schoolId;
  }
}
