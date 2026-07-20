export interface OfflineWriteOptions {
  accountId?: string;
  classification?: "public" | "non-sensitive";
}

export interface OfflineStorageRecord<T> {
  key: string;
  namespace: string;
  value: T;
  updatedAt: string;
}

export interface OfflineStoragePort {
  get<T>(
    key: string,
    accountId?: string,
  ): Promise<OfflineStorageRecord<T> | null>;
  set<T>(
    key: string,
    value: T,
    options?: OfflineWriteOptions,
  ): Promise<OfflineStorageRecord<T>>;
  remove(key: string, accountId?: string): Promise<void>;
  list(accountId?: string): Promise<Array<OfflineStorageRecord<unknown>>>;
  clearNamespace(accountId?: string): Promise<void>;
  clearForAccountSwitch(nextAccountId?: string): Promise<void>;
}
