import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_OBJECT_STORE,
  createOfflineNamespace,
} from "../constants";
import type {
  OfflineStoragePort,
  OfflineStorageRecord,
  OfflineWriteOptions,
} from "../ports/offline-storage-port";
import { assertOfflineValueIsNonSensitive } from "./record-safety";

interface StoredRow<T = unknown> extends OfflineStorageRecord<T> {
  id: string;
}

interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenDBRequest;
  deleteDatabase(name: string): IDBOpenDBRequest;
}

interface StorageEnvironment {
  indexedDB?: IDBFactoryLike;
}

function getEnvironment(environment?: StorageEnvironment): StorageEnvironment {
  if (environment) {
    return environment;
  }

  if (!import.meta.client) {
    return {};
  }

  return {
    indexedDB: window.indexedDB,
  };
}

function createRowId(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

function openDatabase(indexedDB: IDBFactoryLike): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OFFLINE_OBJECT_STORE)) {
        database.createObjectStore(OFFLINE_OBJECT_STORE, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Failed to open offline storage database."),
      );
  });
}

function withStore<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_OBJECT_STORE, mode);
    const store = transaction.objectStore(OFFLINE_OBJECT_STORE);

    let output: T;

    transaction.oncomplete = () => resolve(output);
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Offline storage transaction failed."),
      );

    run(
      new Proxy(store, {
        get(target, property, receiver) {
          if (property === "__setOutput") {
            return (value: T) => {
              output = value;
            };
          }

          return Reflect.get(target, property, receiver);
        },
      }) as IDBObjectStore,
    );
  });
}

function isOfflineStorageRecord<T>(
  value: StoredRow<T> | undefined,
): value is StoredRow<T> {
  return Boolean(
    value && typeof value.id === "string" && value.namespace && value.key,
  );
}

export function createIndexedDbOfflineStoragePort(
  environment?: StorageEnvironment,
): OfflineStoragePort {
  const env = getEnvironment(environment);

  async function getDatabase() {
    if (!env.indexedDB) {
      return undefined;
    }

    return openDatabase(env.indexedDB);
  }

  async function getNamespaceRows(accountId?: string) {
    const database = await getDatabase();
    const namespace = createOfflineNamespace(accountId);

    if (!database) {
      return [] as StoredRow[];
    }

    return withStore<Array<StoredRow>>(database, "readonly", (store) => {
      const request = store.getAll();

      request.onsuccess = () => {
        (
          store as IDBObjectStore & {
            __setOutput(value: Array<StoredRow>): void;
          }
        ).__setOutput(
          (request.result as Array<StoredRow>).filter(
            (row) => row.namespace === namespace,
          ),
        );
      };
    });
  }

  async function getRecord<T>(
    key: string,
    accountId?: string,
  ): Promise<OfflineStorageRecord<T> | null> {
    const database = await getDatabase();
    const namespace = createOfflineNamespace(accountId);

    if (!database) {
      return null;
    }

    return withStore<OfflineStorageRecord<T> | null>(
      database,
      "readonly",
      (store) => {
        const request = store.get(createRowId(namespace, key));

        request.onsuccess = () => {
          const record = request.result as StoredRow<T> | undefined;

          (
            store as IDBObjectStore & {
              __setOutput(value: OfflineStorageRecord<T> | null): void;
            }
          ).__setOutput(
            isOfflineStorageRecord(record)
              ? {
                  key: record.key,
                  namespace: record.namespace,
                  value: record.value,
                  updatedAt: record.updatedAt,
                }
              : null,
          );
        };
      },
    );
  }

  async function setRecord<T>(
    key: string,
    value: T,
    options?: OfflineWriteOptions,
  ): Promise<OfflineStorageRecord<T>> {
    assertOfflineValueIsNonSensitive(value);

    const database = await getDatabase();
    const namespace = createOfflineNamespace(options?.accountId);
    const record: StoredRow<T> = {
      id: createRowId(namespace, key),
      key,
      namespace,
      value,
      updatedAt: new Date().toISOString(),
    };

    if (!database) {
      return record;
    }

    return withStore<OfflineStorageRecord<T>>(
      database,
      "readwrite",
      (store) => {
        store.put(record);
        (
          store as IDBObjectStore & {
            __setOutput(value: OfflineStorageRecord<T>): void;
          }
        ).__setOutput({
          key: record.key,
          namespace: record.namespace,
          value: record.value,
          updatedAt: record.updatedAt,
        });
      },
    );
  }

  async function clearNamespace(accountId?: string) {
    const database = await getDatabase();
    const namespace = createOfflineNamespace(accountId);

    if (!database) {
      return;
    }

    const rows = await getNamespaceRows(accountId);

    await withStore<void>(database, "readwrite", (store) => {
      rows.forEach((row) => {
        store.delete(createRowId(namespace, row.key));
      });
      (
        store as IDBObjectStore & { __setOutput(value: void): void }
      ).__setOutput(undefined);
    });
  }

  const port: OfflineStoragePort = {
    get: getRecord,
    set: setRecord,
    async remove(key, accountId) {
      const database = await getDatabase();
      const namespace = createOfflineNamespace(accountId);

      if (!database) {
        return;
      }

      await withStore<void>(database, "readwrite", (store) => {
        store.delete(createRowId(namespace, key));
        (
          store as IDBObjectStore & { __setOutput(value: void): void }
        ).__setOutput(undefined);
      });
    },
    async list(accountId) {
      const rows = await getNamespaceRows(accountId);

      return rows.map(({ key, namespace, value, updatedAt }) => ({
        key,
        namespace,
        value,
        updatedAt,
      }));
    },
    clearNamespace,
    async clearForAccountSwitch(nextAccountId) {
      await port.clearNamespace();

      if (nextAccountId) {
        await port.clearNamespace(nextAccountId);
      }
    },
  };

  return port;
}
