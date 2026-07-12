import type { AdminMembership, AdminUser } from "../domain/admin.types.js";

export interface AdminMembershipResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly role: string;
  readonly status: string;
  readonly joinedAt: string;
}

export interface AdminUserResponse {
  readonly id: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly status: string;
  readonly memberships: readonly AdminMembershipResponse[];
  readonly lastActiveAt: string | null;
  readonly createdAt: string;
}

export function toAdminMembershipResponse(
  membership: AdminMembership,
): AdminMembershipResponse {
  return {
    id: membership.id,
    schoolId: membership.schoolId,
    schoolName: membership.schoolName,
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt.toISOString(),
  };
}

/**
 * Maps AdminUser to AdminUserResponse.
 * CRITICAL: NEVER includes passwordHash. The domain AdminUser type
 * does not carry passwordHash, ensuring it can never leak.
 */
export function toAdminUserResponse(user: AdminUser): AdminUserResponse {
  return {
    id: user.id,
    loginIdentifier: user.loginIdentifier,
    displayName: user.displayName,
    preferredLocale: user.preferredLocale,
    status: user.status,
    memberships: user.memberships.map(toAdminMembershipResponse),
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
