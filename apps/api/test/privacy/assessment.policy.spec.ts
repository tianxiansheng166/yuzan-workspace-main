import { describe, expect, it } from "vitest";
import { AssessmentPolicy } from "../../src/modules/privacy/domain/assessment.policy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("AssessmentPolicy", () => {
  const policy = new AssessmentPolicy();
  const schoolId = "school-a";

  describe("canManageMaterials", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canManageMaterials(auth)).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canManageMaterials(auth)).toBe(true);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canManageMaterials(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canManageMaterials(auth)).toBe(false);
    });
  });

  describe("canPreview", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canPreview(auth)).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canPreview(auth)).toBe(true);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canPreview(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canPreview(auth)).toBe(false);
    });
  });

  describe("canPublish", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canPublish(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canPublish(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canPublish(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canPublish(auth)).toBe(false);
    });
  });

  describe("canArchive", () => {
    it("allows PLATFORM_ADMIN", () => {
      const auth = platformAdminAuth(schoolId);
      expect(policy.canArchive(auth)).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      const auth = schoolAdminAuth(schoolId);
      expect(policy.canArchive(auth)).toBe(false);
    });

    it("denies TEACHER", () => {
      const auth = teacherAuth(schoolId);
      expect(policy.canArchive(auth)).toBe(false);
    });

    it("denies STUDENT", () => {
      const auth = studentAuth(schoolId);
      expect(policy.canArchive(auth)).toBe(false);
    });
  });
});
