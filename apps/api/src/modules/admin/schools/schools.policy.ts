import type { AuthContext } from "../../../common/security/auth.types.js";
import { isPlatformAdmin } from "../../../common/security/index.js";

export class AdminSchoolsPolicy {
  canManageSchools(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewAllSchools(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canArchiveSchool(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canAssignPlan(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
