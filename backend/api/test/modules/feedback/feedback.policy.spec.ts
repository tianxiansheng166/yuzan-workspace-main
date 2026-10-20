import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import { FeedbackPolicy } from "../../../src/modules/feedback/feedback.policy.js";

function auth(
  userId: string,
  schoolId: string,
  roles: MembershipRole[],
  membershipStatus = MembershipStatus.ACTIVE,
) {
  return createAuthContext(
    "req-1",
    { userId, roles, membershipStatus, source: "test" },
    { schoolId },
  );
}

describe("FeedbackPolicy", () => {
  const policy = new FeedbackPolicy();
  const schoolId = "school-a";

  it("allows active same-school teachers and administrators to create", () => {
    expect(
      policy.canCreateFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canCreateFeedback(
        auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
        schoolId,
      ),
    ).toBe(true);
  });

  it("denies students, inactive identities, and cross-school role claims", () => {
    expect(
      policy.canCreateFeedback(
        auth("s1", schoolId, [MembershipRole.STUDENT]),
        schoolId,
      ),
    ).toBe(false);
    expect(
      policy.canCreateFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER], MembershipStatus.LEFT),
        schoolId,
      ),
    ).toBe(false);
    expect(
      policy.canCreateFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        "school-b",
      ),
    ).toBe(false);
    expect(
      policy.canCreateFeedback(
        auth("platform", schoolId, [
          MembershipRole.PLATFORM_ADMIN,
          MembershipRole.TEACHER,
        ]),
        "school-b",
      ),
    ).toBe(false);
  });

  it("allows feedback reads only for active same-school student, teacher, or admin roles", () => {
    expect(
      policy.canReadFeedback(
        auth("s1", schoolId, [MembershipRole.STUDENT]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canReadFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canReadFeedback(
        auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canReadFeedback(
        auth("platform", schoolId, [MembershipRole.PLATFORM_ADMIN]),
        schoolId,
      ),
    ).toBe(false);
  });

  it("keeps student reads limited to their own enrollment user", () => {
    const student = auth("s1", schoolId, [MembershipRole.STUDENT]);
    expect(policy.canReadOwnFeedback(student, schoolId, "s1")).toBe(true);
    expect(policy.canReadOwnFeedback(student, schoolId, "s2")).toBe(false);
    expect(
      policy.canReadOwnFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        schoolId,
        "s1",
      ),
    ).toBe(false);
  });

  it("distinguishes teacher and school-admin read scopes", () => {
    expect(
      policy.canReadAsTeacher(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.isSchoolAdmin(
        auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.isSchoolAdmin(
        auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
        "school-b",
      ),
    ).toBe(false);
  });

  it("allows pending-list requests only to same-school teachers or admins", () => {
    expect(
      policy.canListPendingFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canListPendingFeedback(
        auth("a1", schoolId, [MembershipRole.SCHOOL_ADMIN]),
        schoolId,
      ),
    ).toBe(true);
    expect(
      policy.canListPendingFeedback(
        auth("s1", schoolId, [MembershipRole.STUDENT]),
        schoolId,
      ),
    ).toBe(false);
    expect(
      policy.canListPendingFeedback(
        auth("t1", schoolId, [MembershipRole.TEACHER]),
        "school-b",
      ),
    ).toBe(false);
  });
});
