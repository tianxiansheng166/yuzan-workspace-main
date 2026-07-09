import { describe, expect, it, vi } from "vitest";
import {
  OFFLINE_STORAGE_PREFIX,
  createOfflineNamespace,
} from "../../app/features/offline/constants";
import { assertOfflineValueIsNonSensitive } from "../../app/features/offline/storage/record-safety";
import { createIndexedDbOfflineStoragePort } from "../../app/features/offline/storage/indexeddb-offline-storage";
import { ensureOfflineGlobalStatus } from "../../app/features/offline/runtime/global-status";
import { registerOfflineServiceWorker } from "../../app/features/offline/runtime/service-worker";

describe("createOfflineNamespace", () => {
  it("uses a versioned shared namespace by default", () => {
    expect(createOfflineNamespace()).toBe(
      `${OFFLINE_STORAGE_PREFIX}:v1:shared`,
    );
  });

  it("scopes data by account when an account id is provided", () => {
    expect(createOfflineNamespace("teacher-01")).toBe(
      `${OFFLINE_STORAGE_PREFIX}:v1:account:teacher-01`,
    );
  });
});

describe("assertOfflineValueIsNonSensitive", () => {
  it("allows non-sensitive offline drafts", () => {
    expect(() =>
      assertOfflineValueIsNonSensitive({
        draftId: "lesson-1",
        status: "pending",
      }),
    ).not.toThrow();
  });

  it("rejects sensitive fields", () => {
    expect(() =>
      assertOfflineValueIsNonSensitive({
        password: "secret",
      }),
    ).toThrow(/Sensitive data/);
  });
});

describe("createIndexedDbOfflineStoragePort", () => {
  it("is SSR-safe when indexedDB is unavailable", async () => {
    const port = createIndexedDbOfflineStoragePort({});

    await expect(port.get("draft")).resolves.toBeNull();
    await expect(
      port.set("draft", { status: "pending" }),
    ).resolves.toMatchObject({
      key: "draft",
      namespace: `${OFFLINE_STORAGE_PREFIX}:v1:shared`,
    });
  });

  it("clears both shared and next-account namespaces on account switch", async () => {
    const clearNamespace = vi.fn();
    const port = createIndexedDbOfflineStoragePort({});
    port.clearNamespace = clearNamespace;

    await port.clearForAccountSwitch("student-02");

    expect(clearNamespace).toHaveBeenNthCalledWith(1);
    expect(clearNamespace).toHaveBeenNthCalledWith(2, "student-02");
  });
});

describe("ensureOfflineGlobalStatus", () => {
  it("creates a deterministic global status shape", () => {
    const windowRef = {
      navigator: { onLine: true },
    } as Window;

    const status = ensureOfflineGlobalStatus(windowRef);

    expect(status).toEqual({
      registration: "idle",
      network: "online",
    });
  });
});

describe("registerOfflineServiceWorker", () => {
  it("reports unsupported when service workers are missing", async () => {
    const result = await registerOfflineServiceWorker({
      navigator: {},
    });

    expect(result).toBe("unsupported");
  });

  it("updates the global registration state when registration succeeds", async () => {
    const windowRef = {
      navigator: { onLine: true },
    } as Window;

    const result = await registerOfflineServiceWorker({
      navigator: {
        serviceWorker: {
          register: vi.fn(
            async () => ({ scope: "/" }) as ServiceWorkerRegistration,
          ),
        },
      },
      window: windowRef,
    });

    expect(result).toBe("registered");
    expect(windowRef.__YUZAN_OFFLINE__).toMatchObject({
      registration: "registered",
      serviceWorkerScope: "/",
    });
  });

  it("captures registration failures", async () => {
    const result = await registerOfflineServiceWorker({
      navigator: {
        serviceWorker: {
          register: vi.fn(async () => {
            throw new Error("registration failed");
          }),
        },
      },
      window: {
        navigator: { onLine: false },
      } as Window,
    });

    expect(result).toBe("failed");
  });
});
