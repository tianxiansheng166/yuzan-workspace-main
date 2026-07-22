import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "./membership-role.js";

export const REQUIRED_ROLES_KEY = "requiredRoles";

/**
 * Require at least one of the given roles.
 *
 * Must be combined with PolicyGuard (via AuthModule APP_GUARD or local
 * @UseGuards) to be enforced.
 */
export const RequireRoles = (...roles: MembershipRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
