import { describe, expect, it, vi } from "vitest";
import { createLoginPageState } from "../../app/features/auth/state/login-page-state";
import { sanitizeInternalRedirect } from "../../app/features/auth/utils/redirect";
import { createSafeStorage } from "../../app/features/auth/utils/storage";
import type { AuthGateway } from "../../app/features/auth/ports/auth-gateway";
import type { SessionGateway } from "../../app/features/auth/ports/session-gateway";
import type {
  AuthResult,
  SessionSnapshot,
} from "../../app/features/auth/models";

function createAuthGateway(result: AuthResult): AuthGateway {
  return {
    async signIn() {
      return result;
    },
  };
}

function createSessionGateway(snapshot: SessionSnapshot): SessionGateway {
  return {
    async restore() {
      return snapshot;
    },
    persist: vi.fn(),
    clear: vi.fn(),
  };
}

describe("sanitizeInternalRedirect", () => {
  it("allows in-site redirects", () => {
    expect(sanitizeInternalRedirect("/teacher?tab=queue")).toBe(
      "/teacher?tab=queue",
    );
  });

  it("rejects external redirect variants", () => {
    expect(sanitizeInternalRedirect("https://example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("http://example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("//example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("/javascript:alert(1)")).toBeUndefined();
  });
});

describe("createLoginPageState.initialize", () => {
  it("supports unauthenticated state", async () => {
    const sessionGateway = createSessionGateway({
      status: "unauthenticated",
      serviceMode: "demo",
      message: "请先登录。",
    });

    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "unavailable",
        serviceMode: "unavailable",
        message: "not used",
      }),
      sessionGateway,
      navigate: vi.fn(),
    });

    await loginState.initialize();

    expect(loginState.state.status).toBe("unauthenticated");
    expect(loginState.state.message).toBe("请先登录。");
  });

  it("supports expired state", async () => {
    const sessionGateway = createSessionGateway({
      status: "authenticated",
      role: "student",
      serviceMode: "live",
    });

    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "unavailable",
        serviceMode: "unavailable",
        message: "not used",
      }),
      sessionGateway,
      navigate: vi.fn(),
      expired: true,
    });

    await loginState.initialize();

    expect(loginState.state.status).toBe("expired");
    expect(loginState.state.message).toContain("过期");
  });

  it("supports unavailable state", async () => {
    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "unavailable",
        serviceMode: "unavailable",
        message: "not used",
      }),
      sessionGateway: createSessionGateway({
        status: "unavailable",
        serviceMode: "demo",
        message: "当前服务不可用。",
      }),
      navigate: vi.fn(),
    });

    await loginState.initialize();

    expect(loginState.state.status).toBe("unavailable");
  });

  it("redirects authenticated users to the original in-site route", async () => {
    const navigate = vi.fn();
    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "unavailable",
        serviceMode: "unavailable",
        message: "not used",
      }),
      sessionGateway: createSessionGateway({
        status: "authenticated",
        role: "teacher",
        serviceMode: "live",
      }),
      navigate,
      redirectTo: "/teacher?tab=queue",
    });

    await loginState.initialize();

    expect(loginState.state.status).toBe("authenticated");
    expect(navigate).toHaveBeenCalledWith("/teacher?tab=queue");
  });
});

describe("createLoginPageState.submit", () => {
  it("supports loading and duplicate submit protection", async () => {
    let resolver: ((value: AuthResult) => void) | undefined;
    const authGateway: AuthGateway = {
      signIn: vi.fn(
        () =>
          new Promise<AuthResult>((resolve) => {
            resolver = resolve;
          }),
      ),
    };
    const sessionGateway = createSessionGateway({
      status: "unauthenticated",
      serviceMode: "demo",
    });
    const loginState = createLoginPageState({
      authGateway,
      sessionGateway,
      navigate: vi.fn(),
    });

    loginState.state.identifier = "teacher-01";
    loginState.state.password = "secret";

    const firstSubmit = loginState.submit();
    const secondSubmit = loginState.submit();

    expect(loginState.state.status).toBe("loading");
    expect(authGateway.signIn).toHaveBeenCalledTimes(1);

    resolver?.({
      status: "unavailable",
      serviceMode: "unavailable",
      message: "等待接入",
    });

    await Promise.all([firstSubmit, secondSubmit]);

    expect(loginState.state.status).toBe("unavailable");
  });

  it("supports error state", async () => {
    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "error",
        serviceMode: "demo",
        message: "登录失败。",
      }),
      sessionGateway: createSessionGateway({
        status: "unauthenticated",
        serviceMode: "demo",
      }),
      navigate: vi.fn(),
    });

    await loginState.submit();

    expect(loginState.state.status).toBe("error");
    expect(loginState.state.message).toBe("登录失败。");
  });

  it("does not grant privileges to unknown roles", async () => {
    const sessionGateway = createSessionGateway({
      status: "unauthenticated",
      serviceMode: "demo",
    });
    const navigate = vi.fn();
    const loginState = createLoginPageState({
      authGateway: createAuthGateway({
        status: "authenticated",
        role: "observer",
        serviceMode: "live",
      }),
      sessionGateway,
      navigate,
      redirectTo: "/teacher",
    });

    await loginState.submit();

    expect(loginState.state.status).toBe("error");
    expect(loginState.state.role).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("createSafeStorage", () => {
  it("never stores password values in session persistence", () => {
    const backing = new Map<string, string>();
    const storage = createSafeStorage({
      getItem(key) {
        return backing.get(key) ?? null;
      },
      setItem(key, value) {
        backing.set(key, value);
      },
      removeItem(key) {
        backing.delete(key);
      },
    });

    storage.setItem("session", JSON.stringify({ role: "student" }));

    expect(backing.get("session")).not.toContain("password");
  });

  it("is safe during SSR without browser globals", () => {
    const storage = createSafeStorage();

    expect(() => storage.getItem("missing")).not.toThrow();
    expect(() => storage.setItem("missing", "value")).not.toThrow();
    expect(() => storage.removeItem("missing")).not.toThrow();
  });
});
