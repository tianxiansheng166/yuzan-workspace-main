import type { AuthContext } from "../../../common/security/auth.types.js";
import { isPlatformAdmin } from "../../../common/security/index.js";

export class AuditPolicy {
  canViewAuditLogs(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }

  canSearchAudit(context: AuthContext): boolean {
    return isPlatformAdmin(context);
  }
}
