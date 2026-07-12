import { describe, expect, it } from "vitest";
import { UsersPolicy } from "../../src/modules/admin/domain/users.policy.js";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";

describe("UsersPolicy", () => {
  const policy = new UsersPolicy();
  const schoolId = "school-a";
  const otherSchoolId = "school-b";

  function auth(roles: MembershipRole[], tenantSchoolId = schoolId): AuthContext {
    return createAuthContext("req-1", {
      userId: "user-1",
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    }, { schoolId: tenantSchoolId });
  }

  describe("canInviteUser", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canInviteUser(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      expect(policy.canInviteUser(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(policy.canInviteUser(auth([MembershipRole.TEACHER]))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canInviteUser(auth([MembershipRole.STUDENT]))).toBe(false);
    });
  });

  describe("canBulkImport", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canBulkImport(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canBulkImport(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canBulkImport(auth([MembershipRole.TEACHER]))).toBe(false);
    });
  });

  describe("canUpdateMembership", () => {
    it("allows PLATFORM_ADMIN for any school", () => {
      expect(policy.canUpdateMembership(auth([MembershipRole.PLATFORM_ADMIN]), otherSchoolId)).toBe(true);
    });

    it("allows SCHOOL_ADMIN for their own school", () => {
      expect(policy.canUpdateMembership(auth([MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies SCHOOL_ADMIN for different school", () => {
      expect(policy.canUpdateMembership(auth([MembershipRole.SCHOOL_ADMIN], schoolId), otherSchoolId)).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canUpdateMembership(auth([MembershipRole.TEACHER]), schoolId)).toBe(false);
    });
  });

  describe("canRevokeSessions", () => {
    it("allows PLATFORM_ADMIN for any school", () => {
      expect(policy.canRevokeSessions(auth([MembershipRole.PLATFORM_ADMIN]), otherSchoolId)).toBe(true);
    });

    it("allows SCHOOL_ADMIN for their own school", () => {
      expect(policy.canRevokeSessions(auth([MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies SCHOOL_ADMIN for different school", () => {
      expect(policy.canRevokeSessions(auth([MembershipRole.SCHOOL_ADMIN], schoolId), otherSchoolId)).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canRevokeSessions(auth([MembershipRole.TEACHER]), schoolId)).toBe(false);
    });
  });
});
