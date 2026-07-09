/**
 * Local copy of Prisma MembershipRole enum.
 *
 * We intentionally avoid importing @prisma/client in the API runtime so that
 * GOV-006 stays decoupled from the database layer. IDN-001/ORG-001/CUR-001
 * should only consume these domain types.
 */
export enum MembershipRole {
  STUDENT = "STUDENT",
  TEACHER = "TEACHER",
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
  [MembershipRole.RESEARCHER]: 3,
  [MembershipRole.SCHOOL_ADMIN]: 4,
  [MembershipRole.PLATFORM_ADMIN]: 5,
};

export function roleRank(role: MembershipRole): number {
  return ROLE_RANK[role] ?? 0;
}
