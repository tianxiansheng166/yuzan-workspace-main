import { describe, expect, it, vi } from "vitest";
import { createBrowserSchoolSelectionGateway } from "../../app/features/school-selection/browser-gateway";
import { createProductApiClient, type ApiTransport } from "../../app/lib/api/client";
import type { AuthSessionResponse, CurrentUserResponse } from "../../app/lib/api/types";

const schoolId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "测试教师",
  preferredLocale: "zh-CN",
  activeSchoolId: schoolId,
  memberships: [{ schoolId, schoolName: "测试学校", role: "TEACHER" as const }],
};
const me: CurrentUserResponse = {
  data: user,
  meta: { requestId: "request-me" },
};
const selected: AuthSessionResponse = {
  data: {
    accessToken: "rotated",
    activeSchoolId: schoolId,
    expiresIn: 900,
    user,
  },
  meta: { requestId: "request-select" },
};

describe("live school-selection gateway", () => {
  it("selects only a membership returned by GET /me and verifies the new tenant", async () => {
    const calls: string[] = [];
    const transport: ApiTransport = async (path) => {
      calls.push(path);
      return path === "/auth/select-school"
        ? { status: 200, data: selected }
        : { status: 200, data: me };
    };
    const gateway = createBrowserSchoolSelectionGateway(
      createProductApiClient(transport),
    );

    await expect(gateway.selectSchool(schoolId)).resolves.toMatchObject({
      status: "selected",
      context: { schoolId, role: "TEACHER" },
    });
    expect(calls).toEqual(["/me", "/auth/select-school", "/me"]);
  });

  it("rejects an out-of-membership school before sending select-school", async () => {
    const transport = vi.fn<ApiTransport>(async () => ({ status: 200, data: me }));
    const gateway = createBrowserSchoolSelectionGateway(
      createProductApiClient(transport),
    );

    await expect(
      gateway.selectSchool("33333333-3333-4333-8333-333333333333"),
    ).resolves.toMatchObject({ status: "failed" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});