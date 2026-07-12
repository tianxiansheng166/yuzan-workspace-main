import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import { RulePolicy } from "../../src/modules/product-plans/domain/rule.policy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("RulePolicy", () => {
  const policy = new RulePolicy();
  const schoolId = "school-1";

  describe("canManageRules", () => {
    it("allows PLATFORM_ADMIN to manage rules", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canManageRules(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN from managing rules", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canManageRules(auth)).toBe(false);
    });

    it("denies TEACHER from managing rules", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canManageRules(auth)).toBe(false);
    });

    it("denies STUDENT from managing rules", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canManageRules(auth)).toBe(false);
    });
  });

  describe("canViewRules", () => {
    it("allows PLATFORM_ADMIN to view rules", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canViewRules(auth)).toBe(true);
    });

    it("allows SCHOOL_ADMIN to view rules", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canViewRules(auth)).toBe(true);
    });

    it("denies TEACHER from viewing rules", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canViewRules(auth)).toBe(false);
    });

    it("denies STUDENT from viewing rules", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canViewRules(auth)).toBe(false);
    });
  });

  describe("canDetectConflicts", () => {
    it("allows PLATFORM_ADMIN to detect conflicts", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canDetectConflicts(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN from detecting conflicts", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canDetectConflicts(auth)).toBe(false);
    });

    it("denies TEACHER from detecting conflicts", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canDetectConflicts(auth)).toBe(false);
    });

    it("denies STUDENT from detecting conflicts", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canDetectConflicts(auth)).toBe(false);
    });
  });
});
