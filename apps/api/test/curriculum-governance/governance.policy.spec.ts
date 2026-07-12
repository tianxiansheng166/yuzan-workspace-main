import { describe, expect, it } from "vitest";
import { GovernancePolicy } from "../../src/modules/curriculum-governance/domain/governance.policy.js";
import { platformAdminAuth, schoolAdminAuth, teacherAuth, studentAuth } from "../fixtures/auth.js";

describe("GovernancePolicy", () => {
  const policy = new GovernancePolicy();
  const schoolId = "school-a";

  describe("canReviewVersions", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canReviewVersions(platformAdminAuth(schoolId))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canReviewVersions(schoolAdminAuth(schoolId))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canReviewVersions(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canReviewVersions(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canApproveVersions", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canApproveVersions(platformAdminAuth(schoolId))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canApproveVersions(schoolAdminAuth(schoolId))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canApproveVersions(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canApproveVersions(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canPublishVersions", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canPublishVersions(platformAdminAuth(schoolId))).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      expect(policy.canPublishVersions(schoolAdminAuth(schoolId))).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(policy.canPublishVersions(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canPublishVersions(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canRetireVersions", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canRetireVersions(platformAdminAuth(schoolId))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canRetireVersions(schoolAdminAuth(schoolId))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canRetireVersions(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canRetireVersions(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canViewAllVersions", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canViewAllVersions(platformAdminAuth(schoolId))).toBe(true);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canViewAllVersions(schoolAdminAuth(schoolId))).toBe(false);
    });

    it("denies TEACHER", () => {
      expect(policy.canViewAllVersions(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canViewAllVersions(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canViewReviewHistory", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canViewReviewHistory(platformAdminAuth(schoolId))).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      expect(policy.canViewReviewHistory(schoolAdminAuth(schoolId))).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(policy.canViewReviewHistory(teacherAuth(schoolId))).toBe(false);
    });

    it("denies STUDENT", () => {
      expect(policy.canViewReviewHistory(studentAuth(schoolId))).toBe(false);
    });
  });
});
