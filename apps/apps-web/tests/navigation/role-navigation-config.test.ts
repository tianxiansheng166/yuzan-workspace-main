import { describe, expect, it } from "vitest";
import {
  defaultRouteForMembershipRole,
  findProductRoute,
  navigationRoutesForRole,
  roleCanAccessRoute,
} from "../../app/routing/product-route-registry";

describe("product route registry role navigation", () => {
  it("defines the fixed role entries", () => {
    expect(defaultRouteForMembershipRole("STUDENT")).toBe("/student/today");
    expect(defaultRouteForMembershipRole("TEACHER")).toBe("/teacher");
    expect(defaultRouteForMembershipRole("VOLUNTEER")).toBe("/volunteer");
    expect(defaultRouteForMembershipRole("SCHOOL_ADMIN")).toBe("/admin");
    expect(defaultRouteForMembershipRole("PLATFORM_ADMIN")).toBe("/admin");
    expect(defaultRouteForMembershipRole("RESEARCHER")).toBe("/research");
  });

  it("does not leak navigation across role ports", () => {
    const studentPaths = navigationRoutesForRole("STUDENT").map(
      (entry) => entry.path,
    );
    const volunteerPaths = navigationRoutesForRole("VOLUNTEER").map(
      (entry) => entry.path,
    );
    expect(studentPaths).toContain("/student/today");
    expect(studentPaths).not.toContain("/teacher");
    expect(studentPaths).not.toContain("/volunteer");
    expect(volunteerPaths).toContain("/training/volunteer");
    expect(volunteerPaths).not.toContain("/teacher-tools");
    expect(volunteerPaths).not.toContain("/admin");
  });

  it("matches dynamic pages and enforces role access", () => {
    expect(findProductRoute("/teacher/review/submission-1/feedback")?.id).toBe(
      "teacher-review-feedback",
    );
    expect(roleCanAccessRoute("TEACHER", "/reports/report-1")).toBe(true);
    expect(roleCanAccessRoute("STUDENT", "/reports/report-1")).toBe(false);
  });

  it("keeps development routes out of user navigation", () => {
    expect(findProductRoute("/design/icons")?.developmentOnly).toBe(true);
    expect(
      navigationRoutesForRole("PLATFORM_ADMIN").some(
        (entry) => entry.developmentOnly,
      ),
    ).toBe(false);
  });
});
