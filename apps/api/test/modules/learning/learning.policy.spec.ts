import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import { MembershipRole, MembershipStatus } from "../../../src/common/security/index.js";
import { LearningPolicy } from "../../../src/modules/learning/learning.policy.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("LearningPolicy", () => {
  const policy = new LearningPolicy();
  const schoolId = "school-a";

  describe("canViewTasks", () => {
    it("allows STUDENT", () => {
      expect(policy.canViewTasks(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(policy.canViewTasks(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(false);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(policy.canViewTasks(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(false);
    });

    it("denies cross-school STUDENT", () => {
      expect(policy.canViewTasks(auth("s1", schoolId, [MembershipRole.STUDENT]), "school-b")).toBe(false);
    });
  });

  describe("canUpdateProgress", () => {
    it("allows STUDENT", () => {
      expect(policy.canUpdateProgress(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(policy.canUpdateProgress(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(false);
    });

    it("denies cross-school STUDENT", () => {
      expect(policy.canUpdateProgress(auth("s1", schoolId, [MembershipRole.STUDENT]), "school-b")).toBe(false);
    });
  });
});
