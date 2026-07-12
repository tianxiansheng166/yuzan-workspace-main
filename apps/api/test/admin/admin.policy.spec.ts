import { describe, expect, it } from "vitest";
import { AdminPolicy } from "../../src/modules/admin/domain/admin.policy.js";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";

describe("AdminPolicy", () => {
  const policy = new AdminPolicy();
  const schoolId = "school-a";

  function auth(roles: MembershipRole[], tenantSchoolId = schoolId): AuthContext {
    return createAuthContext("req-1", {
      userId: "user-1",
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    }, { schoolId: tenantSchoolId });
  }

  describe("canViewDashboard", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canViewDashboard(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canViewDashboard(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canViewDashboard(auth([MembershipRole.TEACHER]))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canViewDashboard(auth([MembershipRole.STUDENT]))).toBe(false);
    });
  });

  describe("canManageSchools", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canManageSchools(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canManageSchools(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canManageSchools(auth([MembershipRole.TEACHER]))).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canManageUsers(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canManageUsers(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canManageUsers(auth([MembershipRole.TEACHER]))).toBe(false);
    });
  });

  describe("canManageSchoolUsers", () => {
    it("allows PLATFORM_ADMIN for any school", () => {
      expect(policy.canManageSchoolUsers(auth([MembershipRole.PLATFORM_ADMIN]), "school-b")).toBe(true);
    });

    it("allows SCHOOL_ADMIN for their own school", () => {
      expect(policy.canManageSchoolUsers(auth([MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies SCHOOL_ADMIN for different school", () => {
      expect(policy.canManageSchoolUsers(auth([MembershipRole.SCHOOL_ADMIN], schoolId), "school-b")).toBe(false);
    });

    it("denies TEACHER even for own school", () => {
      expect(policy.canManageSchoolUsers(auth([MembershipRole.TEACHER], schoolId), schoolId)).toBe(false);
    });
  });
});
