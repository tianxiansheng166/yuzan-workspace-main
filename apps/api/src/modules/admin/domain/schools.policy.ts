import type { AuthContext } from "../../../common/security/auth.types.js";
import { isPlatformAdmin } from "../../../common/security/index.js";

export class SchoolsPolicy {
  canCreateSchool(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canUpdateSchool(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canActivateDeactivate(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canArchiveSchool(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canAssignPlan(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
