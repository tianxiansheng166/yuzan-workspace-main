import { describe, expect, it } from "vitest";
import { ProviderPolicy } from "../../src/modules/audit/domain/provider.policy.js";
import { platformAdminAuth, schoolAdminAuth, teacherAuth, studentAuth } from "../fixtures/auth.js";

describe("ProviderPolicy", () => {
  const policy = new ProviderPolicy();
  const schoolId = "school-a";

  describe("canManageProviders", () => {
    it("allows PLATFORM_ADMIN", () => expect(policy.canManageProviders(platformAdminAuth(schoolId))).toBe(true));
    it("denies SCHOOL_ADMIN", () => expect(policy.canManageProviders(schoolAdminAuth(schoolId))).toBe(false));
    it("denies TEACHER", () => expect(policy.canManageProviders(teacherAuth(schoolId))).toBe(false));
    it("denies STUDENT", () => expect(policy.canManageProviders(studentAuth(schoolId))).toBe(false));
  });

  describe("canViewProviders", () => {
    it("allows PLATFORM_ADMIN", () => expect(policy.canViewProviders(platformAdminAuth(schoolId))).toBe(true));
    it("allows SCHOOL_ADMIN", () => expect(policy.canViewProviders(schoolAdminAuth(schoolId))).toBe(true));
    it("denies TEACHER", () => expect(policy.canViewProviders(teacherAuth(schoolId))).toBe(false));
    it("denies STUDENT", () => expect(policy.canViewProviders(studentAuth(schoolId))).toBe(false));
  });

  describe("canCheckHealth", () => {
    it("allows PLATFORM_ADMIN", () => expect(policy.canCheckHealth(platformAdminAuth(schoolId))).toBe(true));
    it("denies SCHOOL_ADMIN", () => expect(policy.canCheckHealth(schoolAdminAuth(schoolId))).toBe(false));
    it("denies TEACHER", () => expect(policy.canCheckHealth(teacherAuth(schoolId))).toBe(false));
    it("denies STUDENT", () => expect(policy.canCheckHealth(studentAuth(schoolId))).toBe(false));
  });
});
