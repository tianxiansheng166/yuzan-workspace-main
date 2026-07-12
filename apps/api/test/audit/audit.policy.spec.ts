import { describe, expect, it } from "vitest";
import { AuditPolicy } from "../../src/modules/audit/domain/audit.policy.js";
import { platformAdminAuth, schoolAdminAuth, teacherAuth, studentAuth } from "../fixtures/auth.js";

describe("AuditPolicy", () => {
  const policy = new AuditPolicy();
  const schoolId = "school-a";

  describe("canViewAuditLogs", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canViewAuditLogs(platformAdminAuth(schoolId))).toBe(true);
    });
    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canViewAuditLogs(schoolAdminAuth(schoolId))).toBe(false);
    });
    it("denies TEACHER", () => {
      expect(policy.canViewAuditLogs(teacherAuth(schoolId))).toBe(false);
    });
    it("denies STUDENT", () => {
      expect(policy.canViewAuditLogs(studentAuth(schoolId))).toBe(false);
    });
  });

  describe("canSearchAudit", () => {
    it("allows PLATFORM_ADMIN", () => {
      expect(policy.canSearchAudit(platformAdminAuth(schoolId))).toBe(true);
    });
    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canSearchAudit(schoolAdminAuth(schoolId))).toBe(false);
    });
    it("denies TEACHER", () => {
      expect(policy.canSearchAudit(teacherAuth(schoolId))).toBe(false);
    });
    it("denies STUDENT", () => {
      expect(policy.canSearchAudit(studentAuth(schoolId))).toBe(false);
    });
  });
});
