import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthForm } from "../../../app/features/auth/composables/useAuthForm";

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

describe("useAuthForm", () => {
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

  it("starts in idle state with empty fields", () => {
    const form = useAuthForm();

    expect(form.state.value).toBe("idle");
    expect(form.identifier.value).toBe("");
    expect(form.password.value).toBe("");
    expect(form.remember.value).toBe(false);
    expect(form.errorMessage.value).toBe("");
  });

  it("rejects empty identifier or password", async () => {
    const form = useAuthForm();

    form.identifier.value = "   ";
    form.password.value = "   ";

    const ok = await form.login();

    expect(ok).toBe(false);
    expect(form.state.value).toBe("error");
    expect(form.errorMessage.value).toContain("请输入");
  });

  it("rejects passwords shorter than 4 characters", async () => {
    const form = useAuthForm();

    form.identifier.value = "demo@yuzan.example";
    form.password.value = "123";

    const ok = await form.login();

    expect(ok).toBe(false);
    expect(form.state.value).toBe("error");
    expect(form.errorMessage.value).toContain("至少 4 位");
  });

  it("succeeds with valid credentials and stores demo session", async () => {
    const form = useAuthForm();

    form.identifier.value = "teacher@yuzan.example";
    form.password.value = "demo-password";
    form.remember.value = false;

    const promise = form.login();
    await vi.advanceTimersByTimeAsync(500);
    const ok = await promise;

    expect(ok).toBe(true);
    expect(form.state.value).toBe("success");
    expect(form.session.value).not.toBeNull();
    expect(form.session.value?.demo).toBe(true);
    expect(form.session.value?.user.name).toBe("teacher");
  });

  it("stores remember choice in localStorage when checked", async () => {
    const form = useAuthForm();

    form.identifier.value = "teacher@yuzan.example";
    form.password.value = "demo-password";
    form.remember.value = true;

    const promise = form.login();
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    const localRaw = localStorage.getItem("yuzan.demo.auth.demo-session");
    expect(localRaw).not.toBeNull();
    const parsed = JSON.parse(localRaw ?? "{}");
    expect(parsed.demo).toBe(true);
    expect(localStorage.getItem("yuzan.demo.auth.demo-remember")).toBe("true");
  });

  it("does not persist password to storage", async () => {
    const form = useAuthForm();

    form.identifier.value = "teacher@yuzan.example";
    form.password.value = "secret-password";

    const promise = form.login();
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    const allKeys = [
      localStorage.getItem("yuzan.demo.auth.demo-session"),
      sessionStorage.getItem("yuzan.demo.auth.demo-session"),
      localStorage.getItem("yuzan.demo.auth.demo-remember"),
      sessionStorage.getItem("yuzan.demo.auth.demo-remember"),
    ];

    for (const value of allKeys) {
      if (value) {
        expect(value).not.toContain("secret-password");
      }
    }
  });
});
