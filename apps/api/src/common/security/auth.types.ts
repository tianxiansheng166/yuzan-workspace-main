import type { MembershipRole } from "./membership-role.js";
import type { Permission } from "./permission.js";

/**
 * Membership status aligned with Prisma MembershipStatus.
 */
export enum MembershipStatus {
  INVITED = "INVITED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  LEFT = "LEFT",
}

/**
 * The authenticated human or service account.
 *
 * Principal is intentionally free of PII. It only carries identifiers,
 * roles and membership status required for authorization decisions.
 */
export interface Principal {
  readonly userId: string;
  readonly roles: readonly MembershipRole[];
  readonly membershipStatus: MembershipStatus;
  /**
   * Distinguishes real identity sources from demo/test adapters.
   * IDN-001 will set this to "session"; GOV-006 stub uses "stub".
   */
  readonly source: string;
}

/**
 * The tenant (school) scope of the current request.
 */
export interface TenantContext {
  readonly schoolId: string;
}

/**
 * Combined authorization context for a single request.
 */
export interface AuthContext {
  readonly requestId: string;
  readonly principal: Principal;
  readonly tenant: TenantContext;
}

/**
 * Static set of permissions granted to a role in the MVP baseline.
 */
export type RolePermissionSet = Readonly<
  Record<MembershipRole, readonly Permission[]>
>;
