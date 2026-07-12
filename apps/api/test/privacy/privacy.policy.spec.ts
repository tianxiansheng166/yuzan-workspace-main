import { describe, expect, it } from "vitest";
import { PrivacyPolicy } from "../../src/modules/privacy/domain/privacy.policy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("PrivacyPolicy", () => {
  const policy = new PrivacyPolicy();
  const schoolId = "school-a";

  describe("canManageRetention", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canManageRetention(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canManageRetention(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canManageRetention(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canManageRetention(auth)).toBe(false);
    });
  });

  describe("canViewConsents", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canViewConsents(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canViewConsents(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canViewConsents(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canViewConsents(auth)).toBe(false);
    });
  });

  describe("canProcessDeletion", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canProcessDeletion(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canProcessDeletion(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canProcessDeletion(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canProcessDeletion(auth)).toBe(false);
    });
  });

  describe("canViewDeletionRequests", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canViewDeletionRequests(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canViewDeletionRequests(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canViewDeletionRequests(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canViewDeletionRequests(auth)).toBe(false);
    });
  });
});
