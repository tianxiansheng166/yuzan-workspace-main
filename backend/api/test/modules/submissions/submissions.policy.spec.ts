import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import { SubmissionsPolicy } from "../../../src/modules/submissions/submissions.policy.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext(
    "req-1",
    {
      userId,
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    },
    { schoolId },
  );
}

describe("SubmissionsPolicy", () => {
  const policy = new SubmissionsPolicy();
  const schoolId = "school-a";

  describe("canCreateSubmission", () => {
    it("allows STUDENT", () => {
      expect(
        policy.canCreateSubmission(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(
        policy.canCreateSubmission(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(false);
    });

    it("denies SCHOOL_ADMIN", () => {
      expect(
        policy.canCreateSubmission(
          auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
          schoolId,
        ),
      ).toBe(false);
    });

    it("denies cross-school", () => {
      expect(
        policy.canCreateSubmission(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          "school-b",
        ),
      ).toBe(false);
    });
  });

  describe("canReadOwnSubmissions", () => {
    it("allows STUDENT", () => {
      expect(
        policy.canReadOwnSubmissions(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(
        policy.canReadOwnSubmissions(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(false);
    });
  });

  describe("canReadSubmission", () => {
    it("allows student, teacher, and school admin in the school", () => {
      expect(
        policy.canReadSubmission(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(true);
      expect(
        policy.canReadSubmission(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(true);
      expect(
        policy.canReadSubmission(
          auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies cross-school reads", () => {
      expect(
        policy.canReadSubmission(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          "school-b",
        ),
      ).toBe(false);
    });
  });

  describe("canReadAssignmentSubmissions", () => {
    it("allows TEACHER and SCHOOL_ADMIN", () => {
      expect(
        policy.canReadAssignmentSubmissions(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(true);
      expect(
        policy.canReadAssignmentSubmissions(
          auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies STUDENT", () => {
      expect(
        policy.canReadAssignmentSubmissions(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(false);
    });
  });

  describe("canSubmit", () => {
    it("allows STUDENT", () => {
      expect(
        policy.canSubmit(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies TEACHER", () => {
      expect(
        policy.canSubmit(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(false);
    });
  });

  describe("canTransitionStatus", () => {
    it("allows STUDENT, TEACHER, SCHOOL_ADMIN", () => {
      expect(
        policy.canTransitionStatus(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          schoolId,
        ),
      ).toBe(true);
      expect(
        policy.canTransitionStatus(
          auth("t1", schoolId, [MembershipRole.TEACHER]),
          schoolId,
        ),
      ).toBe(true);
      expect(
        policy.canTransitionStatus(
          auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
          schoolId,
        ),
      ).toBe(true);
    });

    it("denies cross-school", () => {
      expect(
        policy.canTransitionStatus(
          auth("s1", schoolId, [MembershipRole.STUDENT]),
          "school-b",
        ),
      ).toBe(false);
    });
  });
});
