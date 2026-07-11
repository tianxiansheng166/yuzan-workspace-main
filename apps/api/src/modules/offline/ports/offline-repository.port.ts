import type { OfflineContentPackage, SyncBatch, SyncBatchStatus, OfflineDownloadAuthorization } from "../domain/offline.types.js";

export interface ListOfflinePackagesOptions {
  limit?: number;
  cursor?: string;
  courseVersionId?: string;
}

export interface CreateOfflinePackageData {
  schoolId: string;
  courseVersionId: string;
  downloadRequired?: boolean;
}

export interface CreateSyncBatchData {
  schoolId: string;
  deviceId: string;
  clientBatchId: string;
  operationCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const OFFLINE_REPOSITORY = Symbol("OFFLINE_REPOSITORY");

export interface OfflineRepositoryPort {
  findPackageById(schoolId: string, packageId: string): Promise<OfflineContentPackage | null>;
  listPackages(schoolId: string, options: ListOfflinePackagesOptions): Promise<PaginatedResult<OfflineContentPackage>>;
  createPackage(data: CreateOfflinePackageData): Promise<OfflineContentPackage>;
  findBatchById(schoolId: string, batchId: string): Promise<SyncBatch | null>;
  findBatchByClientBatchId(clientBatchId: string): Promise<SyncBatch | null>;
  createBatch(data: CreateSyncBatchData): Promise<SyncBatch>;
  authorizeDownload(schoolId: string, packageId: string, userId: string): Promise<OfflineDownloadAuthorization>;
}
