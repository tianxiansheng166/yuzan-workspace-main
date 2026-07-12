import type { AuthContext } from "../../../common/security/auth.types.js";
import { isPlatformAdmin } from "../../../common/security/index.js";

export class PrivacyPolicy {
  canManageRetention(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewConsents(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canProcessDeletion(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canViewDeletionRequests(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
