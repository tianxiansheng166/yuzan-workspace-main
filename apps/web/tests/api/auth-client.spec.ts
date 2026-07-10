import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiUnavailableError,
  createAuthApiClient,
  createFetchTransport,
  type ApiTransport,
} from "../../app/lib/api/client";

const session = {
  data: {
    accessToken: "server-only-token",
    expiresIn: 300,
    user: {
      id: "user-1",
      displayName: "Teacher",
      preferredLocale: "zh-CN",
      memberships: [],
    },
  },
  meta: { requestId: "request-1" },
};

describe("auth API client", () => {
  it("submits login credentials only in the JSON request body", async () => {
    const transport: ApiTransport = vi.fn(async () => ({
      status: 200,
      data: session,
    }));
    const client = createAuthApiClient(transport);
    await client.login("teacher@example.edu", "secret-password");
    expect(transport).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: "teacher@example.edu",
        password: "secret-password",
      }),
    });
    expect(
      JSON.stringify(
        (transport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0],
      ),
    ).not.toContain("secret-password");
  });

  it("maps a wrong-password 401 without inventing success", async () => {
    const transport: ApiTransport = vi.fn(async () => ({
      status: 401,
      data: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    }));
    await expect(
      createAuthApiClient(transport).login("user", "wrong"),
    ).rejects.toBeInstanceOf(ApiError);
    expect(transport).toHaveBeenCalledOnce();
  });

  it("uses one refresh for concurrent 401 responses", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const transport: ApiTransport = async (path) => {
      if (path === "/auth/refresh") {
        refreshCalls += 1;
        await Promise.resolve();
        return { status: 200, data: session };
      }
      protectedCalls += 1;
      return protectedCalls <= 2
        ? { status: 401 }
        : { status: 200, data: { ok: true } };
    };
    const client = createAuthApiClient(transport);
    await Promise.all([client.request("/one"), client.request("/two")]);
    expect(refreshCalls).toBe(1);
  });

  it("clears local session when refresh fails", async () => {
    const clear = vi.fn();
    const transport: ApiTransport = async (path) => ({
      status: path === "/auth/refresh" ? 401 : 401,
    });
    await expect(
      createAuthApiClient(transport, clear).request("/me"),
    ).rejects.toBeInstanceOf(ApiError);
    expect(clear).toHaveBeenCalledOnce();
  });

  it("reports network failures and always includes cookies", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      createFetchTransport("http://api.test")("/me", { method: "GET" }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://api.test/me",
      expect.objectContaining({ credentials: "include" }),
    );
    globalThis.fetch = originalFetch;
  });

  it("forwards the incoming cookie during SSR without putting tokens in URLs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await createFetchTransport(
      "http://api.test/api/v1",
      "access_token=http-only-value",
    )("/me", { method: "GET" });
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(url).toBe("http://api.test/api/v1/me");
    expect(new Headers(init.headers).get("cookie")).toContain("access_token=");
    expect(String(url)).not.toContain("http-only-value");
    globalThis.fetch = originalFetch;
  });

  it("logout accepts a server-cleared 204 response", async () => {
    const transport: ApiTransport = vi.fn(async () => ({ status: 204 }));
    await expect(
      createAuthApiClient(transport).logout(),
    ).resolves.toBeUndefined();
  });
});
