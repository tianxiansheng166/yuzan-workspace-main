import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import { CurriculumPolicy } from "../../src/modules/curriculum/domain/curriculum.policy.js";
import { courseVersion } from "./fixtures/course-versions.js";
import {
  schoolAdminPrincipal,
  studentPrincipal,
  teacherPrincipal,
} from "./fixtures/users.js";

describe("CurriculumPolicy", () => {
  const policy = new CurriculumPolicy();
  const schoolId = "school-a";
  const otherSchoolId = "school-b";

  it("allows school admin to manage any course in their school", () => {
    const principal = schoolAdminPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({ schoolId, authorUserId: "someone-else" });

    expect(policy.canManage(auth, version)).toBe(true);
    expect(policy.canPublish(auth, version)).toBe(true);
  });

  it("allows teacher to manage only their own course", () => {
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const ownVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
    });
    const otherVersion = courseVersion({
      schoolId,
      authorUserId: "someone-else",
    });

    expect(policy.canManage(auth, ownVersion)).toBe(true);
    expect(policy.canManage(auth, otherVersion)).toBe(false);
  });

  it("denies cross-school access for school admin", () => {
    const principal = schoolAdminPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({ schoolId: otherSchoolId });

    expect(policy.canManage(auth, version)).toBe(false);
  });

  it("denies cross-school access for teacher", () => {
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({
      schoolId: otherSchoolId,
      authorUserId: principal.userId,
    });

    expect(policy.canManage(auth, version)).toBe(false);
  });

  it("allows students to read only published versions in their school", () => {
    const principal = studentPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const published = courseVersion({ schoolId, status: "PUBLISHED" });
    const draft = courseVersion({ schoolId, status: "DRAFT" });
    const otherSchoolPublished = courseVersion({
      schoolId: otherSchoolId,
      status: "PUBLISHED",
    });

    expect(policy.canReadAsStudent(auth, published)).toBe(true);
    expect(policy.canReadAsStudent(auth, draft)).toBe(false);
    expect(policy.canReadAsStudent(auth, otherSchoolPublished)).toBe(false);
  });

  it("denies students from managing courses", () => {
    const principal = studentPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({ schoolId, status: "PUBLISHED" });

    expect(policy.canManage(auth, version)).toBe(false);
    expect(policy.canPublish(auth, version)).toBe(false);
    expect(policy.canCreateDraft(auth, schoolId)).toBe(false);
  });
});
