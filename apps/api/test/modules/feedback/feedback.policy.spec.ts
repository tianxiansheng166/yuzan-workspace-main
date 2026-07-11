import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import { MembershipRole, MembershipStatus } from "../../../src/common/security/index.js";
import { FeedbackPolicy } from "../../../src/modules/feedback/feedback.policy.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("FeedbackPolicy", () => {
  const policy = new FeedbackPolicy();
  const schoolId = "school-a";

  describe("canCreateFeedback", () => {
    it("allows TEACHER", () => {
      expect(policy.canCreateFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      expect(policy.canCreateFeedback(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(policy.canCreateFeedback(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });

    it("denies cross-school", () => {
      expect(policy.canCreateFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), "school-b")).toBe(false);
    });
  });

  describe("canReadFeedback", () => {
    it("allows all members", () => {
      expect(policy.canReadFeedback(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(true);
      expect(policy.canReadFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
    });
  });

  describe("canReadOwnFeedback", () => {
    it("allows TEACHER to read any student's feedback", () => {
      expect(policy.canReadOwnFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId, "student-1")).toBe(true);
    });

    it("allows SCHOOL_ADMIN to read any feedback", () => {
      expect(policy.canReadOwnFeedback(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId, "student-1")).toBe(true);
    });

    it("allows STUDENT to read own feedback", () => {
      expect(policy.canReadOwnFeedback(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId, "s1")).toBe(true);
    });

    it("denies STUDENT from reading other student's feedback", () => {
      expect(policy.canReadOwnFeedback(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId, "s2")).toBe(false);
    });
  });

  describe("canListPendingFeedback", () => {
    it("allows TEACHER and SCHOOL_ADMIN", () => {
      expect(policy.canListPendingFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
      expect(policy.canListPendingFeedback(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(policy.canListPendingFeedback(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });

    it("denies cross-school", () => {
      expect(policy.canListPendingFeedback(auth("t1", schoolId, [MembershipRole.TEACHER]), "school-b")).toBe(false);
    });
  });
});
