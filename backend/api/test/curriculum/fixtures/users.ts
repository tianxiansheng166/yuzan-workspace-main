import { randomUUID } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  type Principal,
} from "../../../src/common/security/index.js";

export function teacherPrincipal(
  overrides: Partial<Principal> = {},
): Principal {
  return {
    userId: randomUUID(),
    roles: [MembershipRole.TEACHER],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "stub",
    ...overrides,
  };
}

export function schoolAdminPrincipal(
  overrides: Partial<Principal> = {},
): Principal {
  return {
    userId: randomUUID(),
    roles: [MembershipRole.SCHOOL_ADMIN],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "stub",
    ...overrides,
  };
}

export function studentPrincipal(
  overrides: Partial<Principal> = {},
): Principal {
  return {
    userId: randomUUID(),
    roles: [MembershipRole.STUDENT],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "stub",
    ...overrides,
  };
}

export function unknownRolePrincipal(
  overrides: Partial<Principal> = {},
): Principal {
  return {
    userId: randomUUID(),
    roles: ["UNKNOWN_ROLE" as MembershipRole],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "stub",
    ...overrides,
  };
}
