import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  hasRole,
  isPlatformAdmin,
  MembershipRole,
} from "../../../common/security/index.js";

export class ProviderPolicy {
  canViewProviders(context: AuthContext): boolean {
    return (
      isPlatformAdmin(context) || hasRole(context, MembershipRole.SCHOOL_ADMIN)
    );
  }

  canManageProviders(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canCheckHealth(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
