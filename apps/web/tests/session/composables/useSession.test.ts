import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../../../app/features/session/composables/useSession";

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

describe("useSession", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const local = createMockStorage();
    const session = createMockStorage();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.spyOn(console, "warn").mockImplementation(() => {
      // Composable calls onMounted outside a component instance in unit tests.
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const s = useSession();

    expect(s.state.value).toBe("idle");
    expect(s.session.value).toBeNull();
    expect(s.error.value).toBeNull();
  });

  it("refresh transitions to ready with null when no session", async () => {
    const s = useSession();
    const promise = s.refresh();
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(s.state.value).toBe("ready");
    expect(s.session.value).toBeNull();
    expect(s.error.value).toBeNull();
  });

  it("refresh loads existing demo session", async () => {
    sessionStorage.setItem(
      "yuzan.demo.auth.demo-session",
      JSON.stringify({
        user: { id: "demo-user", name: "Teacher", role: "teacher" },
        token: "yuzan-demo-token-test",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        demo: true,
      }),
    );

    const s = useSession();
    const promise = s.refresh();
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(s.state.value).toBe("ready");
    expect(s.session.value?.user.name).toBe("Teacher");
    expect(s.session.value?.demo).toBe(true);
  });

  it("logout clears session and stays ready", async () => {
    sessionStorage.setItem(
      "yuzan.demo.auth.demo-session",
      JSON.stringify({
        user: { id: "demo-user", name: "Teacher", role: "teacher" },
        token: "yuzan-demo-token-test",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        demo: true,
      }),
    );

    const s = useSession();
    await s.refresh();
    await vi.advanceTimersByTimeAsync(200);

    const logoutPromise = s.logout();
    await vi.advanceTimersByTimeAsync(200);
    await logoutPromise;

    expect(s.state.value).toBe("ready");
    expect(s.session.value).toBeNull();
    expect(sessionStorage.getItem("yuzan.demo.auth.demo-session")).toBeNull();
  });
});
