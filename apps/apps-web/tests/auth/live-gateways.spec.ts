import { describe, expect, it } from "vitest";
import { createLiveAuthGateway } from "../../app/features/auth/adapters/live-auth-gateway";
import { createLiveSessionGateway } from "../../app/features/auth/adapters/live-session-gateway";
import { ApiError, createProductApiClient, type ApiTransport } from "../../app/lib/api/client";
import type { AuthSessionResponse, CurrentUserResponse } from "../../app/lib/api/types";

const schoolId = "22222222-2222-4222-8222-222222222222";
const authResponse: AuthSessionResponse = {
  data: {
    accessToken: "token",
    activeSchoolId: schoolId,
    expiresIn: 600,
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "测试用户",
      preferredLocale: "zh-CN",
      activeSchoolId: schoolId,
      memberships: [{ schoolId, schoolName: "测试学校", role: "TEACHER" }],
    },
  },
  meta: { requestId: "auth-request" },
};
const meResponse: CurrentUserResponse = {
  data: authResponse.data.user,
  meta: { requestId: "me-request" },
};

describe("live auth gateways", () => {
  it("routes a successful login through school selection", async () => {
    const transport: ApiTransport = async () => ({ status: 200, data: authResponse });
    const result = await createLiveAuthGateway(
      createProductApiClient(transport),
    ).signIn({ identifier: "teacher@example.invalid", password: "secret" });

    expect(result).toMatchObject({
      status: "authenticated",
      role: "teacher",
      serviceMode: "live",
      nextRoute: "/select-school",
    });
  });

  it("maps an invalid login to unauthenticated without granting a role", async () => {
    const transport: ApiTransport = async () => ({
      status: 401,
      data: { error: { code: "HTTP_401", message: "unauthorized" } },
    });
    const result = await createLiveAuthGateway(
      createProductApiClient(transport),
    ).signIn({ identifier: "wrong", password: "wrong" });

    expect(result.status).toBe("unauthenticated");
    expect("role" in result).toBe(false);
  });

  it("fails closed when GET /me is forbidden", async () => {
    const api = createProductApiClient(async () => {
      throw new ApiError(403, "forbidden", "HTTP_403", "request-forbidden");
    });
    const result = await createLiveSessionGateway(api).restore();

    expect(result).toEqual({
      status: "error",
      serviceMode: "live",
      message: "当前会话没有读取账号信息的权限。",
    });
  });

  it("restores an authenticated role from the active school only", async () => {
    const transport: ApiTransport = async () => ({ status: 200, data: meResponse });
    const result = await createLiveSessionGateway(
      createProductApiClient(transport),
    ).restore();

    expect(result).toMatchObject({
      status: "authenticated",
      role: "teacher",
      serviceMode: "live",
    });
  });
});