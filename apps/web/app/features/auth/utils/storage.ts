interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) {
    return storage;
  }

  if (!import.meta.client) {
    return undefined;
  }

  return window.sessionStorage;
}

export function createSafeStorage(storage?: StorageLike): SafeStorage {
  return {
    getItem(key) {
      try {
        return resolveStorage(storage)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        resolveStorage(storage)?.setItem(key, value);
      } catch {
        // Ignore blocked storage access in private browsing or SSR.
      }
    },
    removeItem(key) {
      try {
        resolveStorage(storage)?.removeItem(key);
      } catch {
        // Ignore blocked storage access in private browsing or SSR.
      }
    },
  };
}
