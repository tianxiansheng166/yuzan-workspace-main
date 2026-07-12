import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import { PlanPolicy } from "../../src/modules/product-plans/domain/plan.policy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("PlanPolicy", () => {
  const policy = new PlanPolicy();
  const schoolId = "school-1";

  describe("canManagePlans", () => {
    it("allows PLATFORM_ADMIN to manage plans", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canManagePlans(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN from managing plans", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canManagePlans(auth)).toBe(false);
    });

    it("denies TEACHER from managing plans", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canManagePlans(auth)).toBe(false);
    });

    it("denies STUDENT from managing plans", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canManagePlans(auth)).toBe(false);
    });
  });

  describe("canViewPlans", () => {
    it("allows PLATFORM_ADMIN to view plans", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canViewPlans(auth)).toBe(true);
    });

    it("allows SCHOOL_ADMIN to view plans", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canViewPlans(auth)).toBe(true);
    });

    it("denies TEACHER from viewing plans", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canViewPlans(auth)).toBe(false);
    });

    it("denies STUDENT from viewing plans", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canViewPlans(auth)).toBe(false);
    });
  });
});
