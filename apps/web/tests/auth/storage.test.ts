import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalStorageAdapter,
  createReadOnlyCombinedStorageAdapter,
  createSessionStorageAdapter,
  REMEMBER_KEY,
  SESSION_KEY,
} from "../../app/features/auth/storage";

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

describe("storage adapters", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    const local = createMockStorage();
    const session = createMockStorage();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
  });

  it("returns null when window is undefined (SSR safety)", () => {
    vi.stubGlobal("window", undefined);

    const local = createLocalStorageAdapter();
    const session = createSessionStorageAdapter();

    expect(local.getItem(SESSION_KEY)).toBeNull();
    expect(session.getItem(SESSION_KEY)).toBeNull();
  });

  it("uses namespace for keys", () => {
    const mockLocal = createMockStorage();
    vi.stubGlobal("localStorage", mockLocal);

    const adapter = createLocalStorageAdapter();
    adapter.setItem(SESSION_KEY, "value");

    expect(mockLocal.getItem("yuzan.demo.auth.demo-session")).toBe("value");
    expect(adapter.getItem(SESSION_KEY)).toBe("value");
  });

  it("does not leak values across adapters", () => {
    const mockLocal = createMockStorage();
    const mockSession = createMockStorage();
    vi.stubGlobal("localStorage", mockLocal);
    vi.stubGlobal("sessionStorage", mockSession);

    createLocalStorageAdapter().setItem(SESSION_KEY, "local-value");
    createSessionStorageAdapter().setItem(SESSION_KEY, "session-value");

    expect(createLocalStorageAdapter().getItem(SESSION_KEY)).toBe("local-value");
    expect(createSessionStorageAdapter().getItem(SESSION_KEY)).toBe(
      "session-value",
    );
  });

  it("silently ignores storage exceptions", () => {
    const throwingStorage: Storage = {
      ...createMockStorage(),
      getItem(): string | null {
        throw new Error("Storage disabled");
      },
      setItem(): void {
        throw new Error("Quota exceeded");
      },
      removeItem(): void {
        throw new Error("Storage disabled");
      },
    };
    vi.stubGlobal("localStorage", throwingStorage);

    const adapter = createLocalStorageAdapter();

    expect(() => adapter.setItem(SESSION_KEY, "x")).not.toThrow();
    expect(() => adapter.removeItem(SESSION_KEY)).not.toThrow();
    expect(adapter.getItem(SESSION_KEY)).toBeNull();
  });

  it("combined adapter reads from sessionStorage first, then localStorage", () => {
    const mockLocal = createMockStorage();
    const mockSession = createMockStorage();
    vi.stubGlobal("localStorage", mockLocal);
    vi.stubGlobal("sessionStorage", mockSession);

    mockLocal.setItem("yuzan.demo.auth.demo-session", "local-session");
    mockSession.setItem("yuzan.demo.auth.demo-session", "session-session");

    const combined = createReadOnlyCombinedStorageAdapter();
    expect(combined.getItem(SESSION_KEY)).toBe("session-session");
  });

  it("combined adapter removes items from both storages", () => {
    const mockLocal = createMockStorage();
    const mockSession = createMockStorage();
    vi.stubGlobal("localStorage", mockLocal);
    vi.stubGlobal("sessionStorage", mockSession);

    mockLocal.setItem("yuzan.demo.auth.demo-session", "x");
    mockSession.setItem("yuzan.demo.auth.demo-session", "y");

    const combined = createReadOnlyCombinedStorageAdapter();
    combined.removeItem(SESSION_KEY);

    expect(mockLocal.getItem("yuzan.demo.auth.demo-session")).toBeNull();
    expect(mockSession.getItem("yuzan.demo.auth.demo-session")).toBeNull();
  });

  it("combined adapter does not write values", () => {
    const mockLocal = createMockStorage();
    const mockSession = createMockStorage();
    vi.stubGlobal("localStorage", mockLocal);
    vi.stubGlobal("sessionStorage", mockSession);

    const combined = createReadOnlyCombinedStorageAdapter();
    combined.setItem(SESSION_KEY, "value");

    expect(mockLocal.getItem("yuzan.demo.auth.demo-session")).toBeNull();
    expect(mockSession.getItem("yuzan.demo.auth.demo-session")).toBeNull();
  });
});

describe("storage keys", () => {
  it("uses demo-prefixed session key", () => {
    expect(SESSION_KEY).toContain("demo");
  });

  it("uses demo-prefixed remember key", () => {
    expect(REMEMBER_KEY).toContain("demo");
  });
});
