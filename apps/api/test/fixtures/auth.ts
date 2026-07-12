import { randomUUID } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  type Principal,
} from "../../src/common/security/index.js";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";

export function platformAdminPrincipal(
  overrides: Partial<Principal> = {},
): Principal {
  return {
    userId: randomUUID(),
    roles: [MembershipRole.PLATFORM_ADMIN],
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

export function platformAdminAuth(
  schoolId: string,
  overrides: Partial<Principal> = {},
): AuthContext {
  return createAuthContext(
    randomUUID(),
    platformAdminPrincipal(overrides),
    { schoolId },
  );
}

export function schoolAdminAuth(
  schoolId: string,
  overrides: Partial<Principal> = {},
): AuthContext {
  return createAuthContext(
    randomUUID(),
    schoolAdminPrincipal(overrides),
    { schoolId },
  );
}

export function teacherAuth(
  schoolId: string,
  overrides: Partial<Principal> = {},
): AuthContext {
  return createAuthContext(
    randomUUID(),
    teacherPrincipal(overrides),
    { schoolId },
  );
}

export function studentAuth(
  schoolId: string,
  overrides: Partial<Principal> = {},
): AuthContext {
  return createAuthContext(
    randomUUID(),
    studentPrincipal(overrides),
    { schoolId },
  );
}
