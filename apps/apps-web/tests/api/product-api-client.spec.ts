import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createFetchTransport,
  createProductApiClient,
  type ApiTransport,
} from "../../app/lib/api/client";
import type {
  AuthSessionResponse,
  CurrentUserResponse,
} from "../../app/lib/api/types";

const session = (token: string): AuthSessionResponse => ({
  data: {
    accessToken: token,
    activeSchoolId: "22222222-2222-4222-8222-222222222222",
    expiresIn: 900,
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "测试教师",
      preferredLocale: "zh-CN",
      activeSchoolId: "22222222-2222-4222-8222-222222222222",
      memberships: [{
        schoolId: "22222222-2222-4222-8222-222222222222",
        schoolName: "测试学校",
        role: "TEACHER",
      }],
    },
  },
  meta: { requestId: "request-auth" },
});

const currentUser: CurrentUserResponse = {
  data: session("unused").data.user,
  meta: { requestId: "request-me" },
};

describe("product API client session behavior", () => {
  it("keeps the access token in memory and sends it as a bearer token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(session("memory-token")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUser), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    let client: ReturnType<typeof createProductApiClient>;
    client = createProductApiClient(createFetchTransport("http://api.test/api/v1", {
      getAccessToken: () => client.getAccessToken(),
    }));

    await client.login("teacher@example.invalid", "not-a-real-password");
    await client.currentUser();

    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(secondInit.headers).get("authorization")).toBe(
      "Bearer memory-token",
    );
    expect(client.getAccessToken()).toBe("memory-token");
    vi.unstubAllGlobals();
  });

  it("refreshes once on 401 and retries with the rotated session", async () => {
    const calls: string[] = [];
    let meCalls = 0;
    const transport: ApiTransport = async (path) => {
      calls.push(path);
      if (path === "/me" && meCalls++ === 0) {
        return { status: 401 };
      }
      if (path === "/auth/refresh") {
        return { status: 200, data: session("rotated-token") };
      }
      return { status: 200, data: currentUser };
    };
    const client = createProductApiClient(transport);

    await expect(client.currentUser()).resolves.toEqual(currentUser);

    expect(calls).toEqual(["/me", "/auth/refresh", "/me"]);
    expect(client.getAccessToken()).toBe("rotated-token");
  });

  it("does not enter an infinite refresh loop when refresh is unauthorized", async () => {
    const calls: string[] = [];
    const transport: ApiTransport = async (path) => {
      calls.push(path);
      return path === "/me"
        ? { status: 401 }
        : { status: 401, data: { error: { message: "expired" } } };
    };
    const client = createProductApiClient(transport);

    await expect(client.currentUser()).rejects.toMatchObject<ApiError>({
      status: 401,
    });
    expect(calls).toEqual(["/me", "/auth/refresh"]);
    expect(client.getAccessToken()).toBeUndefined();
  });
});