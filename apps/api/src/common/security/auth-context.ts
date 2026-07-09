import type {
  AuthContext,
  Principal,
  RolePermissionSet,
  TenantContext,
} from "./auth.types.js";
import { MembershipRole, roleRank } from "./membership-role.js";
import { Permission } from "./permission.js";

/**
 * MVP authorization matrix: role -> permissions.
 *
 * This is intentionally static and coarse. Future tasks can replace the
 * matrix with database-driven permissions without changing guard interfaces.
 */
export const ROLE_PERMISSIONS: RolePermissionSet = {
  [MembershipRole.STUDENT]: [
    Permission.ASSIGNMENT_SUBMIT,
    Permission.PROGRESS_READ_OWN,
    Permission.CONTENT_READ,
  ],
  [MembershipRole.TEACHER]: [
    Permission.COURSE_MANAGE,
    Permission.ASSIGNMENT_MANAGE,
    Permission.ASSIGNMENT_REVIEW,
    Permission.FEEDBACK_PROVIDE,
    Permission.CONTENT_READ,
  ],
  [MembershipRole.SCHOOL_ADMIN]: [
    Permission.SCHOOL_MANAGE_MEMBERS,
    Permission.SCHOOL_MANAGE_CLASSES,
    Permission.SCHOOL_MANAGE_COURSES,
    Permission.SCHOOL_VIEW_REPORTS,
    Permission.COURSE_MANAGE,
    Permission.ASSIGNMENT_MANAGE,
    Permission.ASSIGNMENT_REVIEW,
    Permission.FEEDBACK_PROVIDE,
    Permission.CONTENT_READ,
  ],
  [MembershipRole.PLATFORM_ADMIN]: [
    Permission.PLATFORM_MANAGE_SCHOOLS,
    Permission.PLATFORM_VIEW_AUDIT_LOGS,
  ],
};

export function createAuthContext(
  requestId: string,
  principal: Principal,
  tenant: TenantContext,
): AuthContext {
  return { requestId, principal, tenant };
}

/**
 * Return all permissions granted to the principal's roles.
 */
export function permissionsForPrincipal(
  principal: Principal,
): readonly Permission[] {
  const set = new Set<Permission>();
  for (const role of principal.roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      set.add(permission);
    }
  }
  return Array.from(set);
}

export function hasPermission(
  context: AuthContext,
  permission: Permission,
): boolean {
  return permissionsForPrincipal(context.principal).includes(permission);
}

export function hasAnyPermission(
  context: AuthContext,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(context, permission));
}

export function hasRole(context: AuthContext, role: MembershipRole): boolean {
  return context.principal.roles.includes(role);
}

export function hasAnyRole(
  context: AuthContext,
  roles: readonly MembershipRole[],
): boolean {
  return roles.some((role) => hasRole(context, role));
}

/**
 * Check whether the principal holds a role at least as privileged as `role`.
 */
export function isAtLeastRole(
  context: AuthContext,
  role: MembershipRole,
): boolean {
  const requiredRank = roleRank(role);
  return context.principal.roles.some((r) => roleRank(r) >= requiredRank);
}

export function isActive(context: AuthContext): boolean {
  return context.principal.membershipStatus === "ACTIVE";
}

export function isPlatformAdmin(context: AuthContext): boolean {
  return hasRole(context, MembershipRole.PLATFORM_ADMIN);
}
