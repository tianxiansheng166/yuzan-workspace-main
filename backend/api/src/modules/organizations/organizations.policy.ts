import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { Membership } from "./domain/organization.types.js";

export class OrganizationsPolicy {
  canReadSchool(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) {
      return false;
    }
    if (hasRole(auth, MembershipRole.PLATFORM_ADMIN)) {
      return true;
    }
    return auth.tenant.schoolId === schoolId;
  }

  canListMembers(auth: AuthContext, schoolId: string): boolean {
    if (!this.canReadSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.SCHOOL_ADMIN,
      MembershipRole.TEACHER,
    ]);
  }

  canReadOwnMembership(auth: AuthContext, membership: Membership): boolean {
    if (!isActive(auth)) {
      return false;
    }
    return (
      auth.principal.userId === membership.userId &&
      auth.tenant.schoolId === membership.schoolId
    );
  }

  canListClasses(auth: AuthContext, schoolId: string): boolean {
    return this.canReadSchool(auth, schoolId);
  }

  canReadClass(auth: AuthContext, schoolId: string): boolean {
    return this.canReadSchool(auth, schoolId);
  }
}
