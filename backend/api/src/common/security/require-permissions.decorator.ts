import { SetMetadata } from "@nestjs/common";
import type { Permission } from "./permission.js";

export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

/**
 * Require at least one of the given permissions.
 *
 * Must be combined with PolicyGuard (via AuthModule APP_GUARD or local
 * @UseGuards) to be enforced.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
