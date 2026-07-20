import { describe, expect, it, vi } from "vitest";
import { createSchoolSelectionState } from "../../app/features/school-selection/state";
import { routeForMembershipRole } from "../../app/features/school-selection/role-route";
import type { SchoolSelectionGateway } from "../../app/features/school-selection/gateway";
import type {
  MembershipLoadResult,
  SchoolMembership,
  SchoolSelectionResult,
} from "../../app/features/school-selection/types";

const student: SchoolMembership = {
  schoolId: "school-1",
  schoolName: "高原第一学校",
  role: "STUDENT",
};
const teacher: SchoolMembership = {
  schoolId: "school-2",
  schoolName: "河谷中心学校",
  role: "TEACHER",
};
function gateway(
  load: MembershipLoadResult,
  select: SchoolSelectionResult = { status: "failed", message: "failed" },
): SchoolSelectionGateway {
  return {
    loadMemberships: vi.fn(async () => load),
    selectSchool: vi.fn(async () => select),
    clearActiveSchool: vi.fn(),
  };
}
function ready(memberships: SchoolMembership[]): MembershipLoadResult {
  return {
    status: "ready",
    user: { id: "user-1", displayName: "测试用户", memberships },
  };
}

describe("school selection state", () => {
  it("starts in loading and resolves no-school", async () => {
    const state = createSchoolSelectionState(gateway(ready([])), vi.fn());
    expect(state.state.status).toBe("LOADING_MEMBERSHIPS");
    await state.load();
    expect(state.state.status).toBe("NO_SCHOOL");
  });
  it("distinguishes one and multiple schools", async () => {
    const one = createSchoolSelectionState(gateway(ready([student])), vi.fn());
    await one.load();
    expect(one.state.status).toBe("ONE_SCHOOL");
    const many = createSchoolSelectionState(
      gateway(ready([student, teacher])),
      vi.fn(),
    );
    await many.load();
    expect(many.state.status).toBe("MULTIPLE_SCHOOLS");
  });
  it("navigates using the server membership role after success", async () => {
    const navigate = vi.fn();
    const state = createSchoolSelectionState(
      gateway(ready([student]), {
        status: "selected",
        context: {
          schoolId: student.schoolId,
          schoolName: student.schoolName,
          role: "STUDENT",
          selectedAt: "2026-07-11T00:00:00Z",
        },
      }),
      navigate,
    );
    await state.load();
    await state.select(student);
    expect(state.state.status).toBe("SELECTED");
    expect(navigate).toHaveBeenCalledWith("/student/today");
  });
  it.each([
    ["membership-inactive", "MEMBERSHIP_INACTIVE"],
    ["school-inactive", "SCHOOL_INACTIVE"],
    ["session-expired", "SESSION_EXPIRED"],
    ["network-error", "NETWORK_ERROR"],
    ["unknown-role", "UNKNOWN_ROLE"],
    ["failed", "SELECTION_FAILED"],
  ] as const)("maps %s without navigating", async (resultStatus, expected) => {
    const navigate = vi.fn();
    const state = createSchoolSelectionState(
      gateway(ready([student]), {
        status: resultStatus,
        message: "blocked",
      } as SchoolSelectionResult),
      navigate,
    );
    await state.load();
    await state.select(student);
    expect(state.state.status).toBe(expected);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("membership role redirects", () => {
  it("maps every supported role and fails closed by type", () => {
    expect(routeForMembershipRole("STUDENT")).toBe("/student/today");
    expect(routeForMembershipRole("TEACHER")).toBe("/teacher");
    expect(routeForMembershipRole("SCHOOL_ADMIN")).toBe("/admin");
    expect(routeForMembershipRole("PLATFORM_ADMIN")).toBe("/admin");
    expect(routeForMembershipRole("RESEARCHER")).toBe("/research");
  });
});
