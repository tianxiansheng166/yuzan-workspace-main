import type { AuthContext } from "../../../../src/common/security/auth.types.js";
import { createAuthContext } from "../../../../src/common/security/auth-context.js";
import { MembershipRole, MembershipStatus } from "../../../../src/common/security/index.js";

export function studentPrincipal(overrides: { userId?: string } = {}) {
  return {
    userId: overrides.userId ?? "student-1",
    roles: [MembershipRole.STUDENT] as readonly MembershipRole[],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  };
}

export function teacherPrincipal(overrides: { userId?: string } = {}) {
  return {
    userId: overrides.userId ?? "teacher-1",
    roles: [MembershipRole.TEACHER] as readonly MembershipRole[],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  };
}

export function schoolAdminPrincipal(overrides: { userId?: string } = {}) {
  return {
    userId: overrides.userId ?? "admin-1",
    roles: [MembershipRole.SCHOOL_ADMIN] as readonly MembershipRole[],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  };
}

export function platformAdminPrincipal(overrides: { userId?: string } = {}) {
  return {
    userId: overrides.userId ?? "platform-admin-1",
    roles: [MembershipRole.PLATFORM_ADMIN] as readonly MembershipRole[],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  };
}

/**
 * Create an auth context for a volunteer user.
 * Volunteers have STUDENT role but are identified by their userId
 * matching the pairing's volunteerUserId.
 */
export function volunteerAuth(schoolId = "school-1", overrides: { userId?: string } = {}) {
  return createAuthContext("req-1", studentPrincipal({ userId: overrides.userId ?? "volunteer-1" }), { schoolId });
}

export function studentAuth(schoolId = "school-1", overrides: { userId?: string } = {}) {
  return createAuthContext("req-1", studentPrincipal(overrides), { schoolId });
}

export function teacherAuth(schoolId = "school-1", overrides: { userId?: string } = {}) {
  return createAuthContext("req-1", teacherPrincipal(overrides), { schoolId });
}

export function schoolAdminAuth(schoolId = "school-1", overrides: { userId?: string } = {}) {
  return createAuthContext("req-1", schoolAdminPrincipal(overrides), { schoolId });
}

export function platformAdminAuth(schoolId = "school-1", overrides: { userId?: string } = {}) {
  return createAuthContext("req-1", platformAdminPrincipal(overrides), { schoolId });
}
