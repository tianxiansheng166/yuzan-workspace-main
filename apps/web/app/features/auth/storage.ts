/**
 * SSR 安全的浏览器存储适配器。
 *
 * - 服务端不访问 window/localStorage，避免 hydration mismatch。
 * - 捕获 storage 异常，防止隐私模式/禁用 storage 时页面崩溃。
 * - 使用 `yuzan.demo.auth.` 命名空间，避免污染其他 key。
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NAMESPACE = "yuzan.demo.auth.";

function safeStorage(storage: Storage | undefined): StorageAdapter {
  return {
    getItem(key: string): string | null {
      try {
        if (typeof window === "undefined" || !storage) {
          return null;
        }
        return storage.getItem(NAMESPACE + key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window === "undefined" || !storage) {
          return;
        }
        storage.setItem(NAMESPACE + key, value);
      } catch {
        // 隐私模式或 storage 满时静默失败，避免阻塞登录流程。
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof window === "undefined" || !storage) {
          return;
        }
        storage.removeItem(NAMESPACE + key);
      } catch {
        // ignore
      }
    },
  };
}

export function createSessionStorageAdapter(): StorageAdapter {
  return safeStorage(
    typeof sessionStorage !== "undefined" ? sessionStorage : undefined,
  );
}

export function createLocalStorageAdapter(): StorageAdapter {
  return safeStorage(
    typeof localStorage !== "undefined" ? localStorage : undefined,
  );
}

/**
 * 组合适配器：优先读取 sessionStorage，再读 localStorage。
 * 写入操作不会同时写入两份，避免 remember-me 逻辑被 localStorage 覆盖。
 */
export function createReadOnlyCombinedStorageAdapter(): StorageAdapter {
  const session = createSessionStorageAdapter();
  const local = createLocalStorageAdapter();

  return {
    getItem(key: string): string | null {
      return session.getItem(key) ?? local.getItem(key);
    },
    setItem(): void {
      // 只读：读取时用于兼容两种 storage，写入由具体场景选择。
    },
    removeItem(key: string): void {
      session.removeItem(key);
      local.removeItem(key);
    },
  };
}

export const SESSION_KEY = "demo-session";
export const REMEMBER_KEY = "demo-remember";
