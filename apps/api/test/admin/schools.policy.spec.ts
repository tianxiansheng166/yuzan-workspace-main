import { describe, expect, it } from "vitest";
import { SchoolsPolicy } from "../../src/modules/admin/domain/schools.policy.js";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";

describe("SchoolsPolicy", () => {
  const policy = new SchoolsPolicy();
  const schoolId = "school-a";

  function auth(roles: MembershipRole[]): AuthContext {
    return createAuthContext("req-1", {
      userId: "user-1",
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    }, { schoolId });
  }

  describe("canCreateSchool", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canCreateSchool(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canCreateSchool(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canCreateSchool(auth([MembershipRole.TEACHER]))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canCreateSchool(auth([MembershipRole.STUDENT]))).toBe(false);
    });
  });

  describe("canUpdateSchool", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canUpdateSchool(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canUpdateSchool(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });
  });

  describe("canActivateDeactivate", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canActivateDeactivate(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canActivateDeactivate(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });
  });

  describe("canArchiveSchool", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canArchiveSchool(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canArchiveSchool(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });
  });

  describe("canAssignPlan", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canAssignPlan(auth([MembershipRole.PLATFORM_ADMIN]))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canAssignPlan(auth([MembershipRole.SCHOOL_ADMIN]))).toBe(false);
    });
  });
});
