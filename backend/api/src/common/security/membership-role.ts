/**
 * Active membership roles used by the API authorization runtime.
 *
 * These mirror the Prisma MembershipRole enum with the exception of
 * RESEARCHER, which exists in the database schema as a reserved future value
 * but is not an executable role in the current authorization baseline.
 *
 * IDN-001/ORG-001/CUR-001 should consume these domain types and never cast
 * arbitrary strings to roles.
 */
export enum MembershipRole {
  STUDENT = "STUDENT",
  TEACHER = "TEACHER",
  VOLUNTEER = "VOLUNTEER",
  RESEARCHER = "RESEARCHER",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
}

export const MEMBERSHIP_ROLES = Object.values(
  MembershipRole,
) as readonly MembershipRole[];

export function isMembershipRole(value: unknown): value is MembershipRole {
  return (
    typeof value === "string" &&
    MEMBERSHIP_ROLES.includes(value as MembershipRole)
  );
}

/**
 * Role hierarchy from least to most privileged.
 * Used by isAtLeastRole() for coarse-grained checks.
 */
const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.STUDENT]: 1,
  [MembershipRole.TEACHER]: 2,
  [MembershipRole.VOLUNTEER]: 2,
  [MembershipRole.RESEARCHER]: 2,
  [MembershipRole.SCHOOL_ADMIN]: 3,
  [MembershipRole.PLATFORM_ADMIN]: 4,
};

export function roleRank(role: MembershipRole): number {
  return ROLE_RANK[role] ?? 0;
}
