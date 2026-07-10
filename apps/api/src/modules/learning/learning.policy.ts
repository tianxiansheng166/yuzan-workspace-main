import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasRole,
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";

export class LearningPolicy {
  canAccessLearning(auth: AuthContext, schoolId: string): boolean {
    return (
      auth.tenant.schoolId === schoolId &&
      hasRole(auth, MembershipRole.STUDENT) &&
      auth.principal.membershipStatus === MembershipStatus.ACTIVE
    );
  }
}
