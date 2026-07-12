import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import { LinkPolicy } from "../../src/modules/product-plans/domain/link.policy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("LinkPolicy", () => {
  const policy = new LinkPolicy();
  const schoolId = "school-1";

  describe("canViewLinks", () => {
    it("allows PLATFORM_ADMIN to view links", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canViewLinks(auth)).toBe(true);
    });

    it("allows SCHOOL_ADMIN to view links", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canViewLinks(auth)).toBe(true);
    });

    it("denies TEACHER from viewing links", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canViewLinks(auth)).toBe(false);
    });

    it("denies STUDENT from viewing links", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canViewLinks(auth)).toBe(false);
    });
  });

  describe("canDisableLink", () => {
    it("allows PLATFORM_ADMIN to disable links", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canDisableLink(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN from disabling links", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canDisableLink(auth)).toBe(false);
    });

    it("denies TEACHER from disabling links", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canDisableLink(auth)).toBe(false);
    });

    it("denies STUDENT from disabling links", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canDisableLink(auth)).toBe(false);
    });
  });

  describe("canRegenerateLink", () => {
    it("allows PLATFORM_ADMIN to regenerate links", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canRegenerateLink(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN from regenerating links", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canRegenerateLink(auth)).toBe(false);
    });

    it("denies TEACHER from regenerating links", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canRegenerateLink(auth)).toBe(false);
    });

    it("denies STUDENT from regenerating links", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canRegenerateLink(auth)).toBe(false);
    });
  });
});
