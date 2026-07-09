import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDemoSession,
  DemoSessionGateway,
} from "../../app/features/session/gateway";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

describe("DemoSessionGateway", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const local = createMockStorage();
    const session = createMockStorage();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns null when no session exists", async () => {
    const gateway = new DemoSessionGateway();
    const promise = gateway.getSession();
    await vi.advanceTimersByTimeAsync(200);
    const session = await promise;

    expect(session).toBeNull();
  });

  it("creates a demo session on successful login", async () => {
    const gateway = new DemoSessionGateway();
    const promise = gateway.login({
      identifier: "teacher@yuzan.example",
      password: "demo-password",
      remember: false,
    });
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.session.demo).toBe(true);
      expect(result.session.user.role).toBe("teacher");
      expect(result.session.token).toMatch(/^yuzan-demo-token-/);
    }
  });

  it("uses sessionStorage by default and localStorage when remember is true", async () => {
    const sessionGateway = new DemoSessionGateway();
    const localGateway = new DemoSessionGateway();

    const sessionPromise = sessionGateway.login({
      identifier: "a@b.com",
      password: "demo-password",
      remember: false,
    });
    await vi.advanceTimersByTimeAsync(500);
    await sessionPromise;

    const localPromise = localGateway.login({
      identifier: "c@d.com",
      password: "demo-password",
      remember: true,
    });
    await vi.advanceTimersByTimeAsync(500);
    await localPromise;

    expect(
      sessionStorage.getItem("yuzan.demo.auth.demo-session"),
    ).not.toBeNull();
    expect(localStorage.getItem("yuzan.demo.auth.demo-session")).not.toBeNull();
    expect(sessionStorage.getItem("yuzan.demo.auth.demo-remember")).toBe(
      "false",
    );
    expect(localStorage.getItem("yuzan.demo.auth.demo-remember")).toBe("true");
  });

  it("rejects non-demo sessions", async () => {
    localStorage.setItem(
      "yuzan.demo.auth.demo-session",
      JSON.stringify({
        user: { id: "x", name: "x", role: "x" },
        token: "real-looking-token",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        demo: false,
      }),
    );

    const gateway = new DemoSessionGateway();
    const promise = gateway.getSession();
    await vi.advanceTimersByTimeAsync(200);
    const session = await promise;

    expect(session).toBeNull();
  });

  it("rejects expired sessions", async () => {
    localStorage.setItem(
      "yuzan.demo.auth.demo-session",
      JSON.stringify({
        user: { id: "demo-user", name: "Demo", role: "teacher" },
        token: "yuzan-demo-token-expired",
        createdAt: Date.now() - 120_000,
        expiresAt: Date.now() - 10_000,
        demo: true,
      }),
    );

    const gateway = new DemoSessionGateway();
    const promise = gateway.getSession();
    await vi.advanceTimersByTimeAsync(200);
    const session = await promise;

    expect(session).toBeNull();
  });

  it("clears session and remember keys on logout", async () => {
    const gateway = new DemoSessionGateway();
    const loginPromise = gateway.login({
      identifier: "teacher@yuzan.example",
      password: "demo-password",
      remember: true,
    });
    await vi.advanceTimersByTimeAsync(500);
    await loginPromise;

    const logoutPromise = gateway.logout();
    await vi.advanceTimersByTimeAsync(200);
    await logoutPromise;

    expect(localStorage.getItem("yuzan.demo.auth.demo-session")).toBeNull();
    expect(localStorage.getItem("yuzan.demo.auth.demo-remember")).toBeNull();
    expect(sessionStorage.getItem("yuzan.demo.auth.demo-session")).toBeNull();
    expect(sessionStorage.getItem("yuzan.demo.auth.demo-remember")).toBeNull();
  });

  it("checkDemoSession helper returns null when no session exists", async () => {
    const promise = checkDemoSession();
    await vi.advanceTimersByTimeAsync(200);
    const session = await promise;

    expect(session).toBeNull();
  });
});
