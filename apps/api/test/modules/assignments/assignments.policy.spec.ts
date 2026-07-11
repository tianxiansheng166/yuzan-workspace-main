import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import { MembershipRole, MembershipStatus } from "../../../src/common/security/index.js";
import { AssignmentsPolicy } from "../../../src/modules/assignments/assignments.policy.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("AssignmentsPolicy", () => {
  const policy = new AssignmentsPolicy();
  const schoolId = "school-a";

  describe("canCreateAssignment", () => {
    it("allows TEACHER", () => {
      expect(policy.canCreateAssignment(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
    });

    it("allows SCHOOL_ADMIN", () => {
      expect(policy.canCreateAssignment(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(policy.canCreateAssignment(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });

    it("denies cross-school", () => {
      expect(policy.canCreateAssignment(auth("t1", schoolId, [MembershipRole.TEACHER]), "school-b")).toBe(false);
    });
  });

  describe("canReadAssignment", () => {
    it("allows all active members", () => {
      expect(policy.canReadAssignment(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(true);
      expect(policy.canReadAssignment(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
      expect(policy.canReadAssignment(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies cross-school", () => {
      expect(policy.canReadAssignment(auth("s1", schoolId, [MembershipRole.STUDENT]), "school-b")).toBe(false);
    });
  });

  describe("canUpdateAssignment", () => {
    it("allows TEACHER and SCHOOL_ADMIN", () => {
      expect(policy.canUpdateAssignment(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
      expect(policy.canUpdateAssignment(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(policy.canUpdateAssignment(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });
  });

  describe("canTransitionStatus", () => {
    it("allows TEACHER and SCHOOL_ADMIN", () => {
      expect(policy.canTransitionStatus(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(true);
      expect(policy.canTransitionStatus(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(policy.canTransitionStatus(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });
  });

  describe("canDeleteAssignment", () => {
    it("allows only SCHOOL_ADMIN", () => {
      expect(policy.canDeleteAssignment(auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]), schoolId)).toBe(true);
      expect(policy.canDeleteAssignment(auth("t1", schoolId, [MembershipRole.TEACHER]), schoolId)).toBe(false);
      expect(policy.canDeleteAssignment(auth("s1", schoolId, [MembershipRole.STUDENT]), schoolId)).toBe(false);
    });
  });
});
