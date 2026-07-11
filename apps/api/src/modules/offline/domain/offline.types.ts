export type SyncBatchStatus = "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "REJECTED" | "PERMISSION_CHANGED";

export interface OfflineContentPackage {
  readonly id: string;
  readonly schoolId: string;
  readonly courseVersionId: string;
  readonly version: number;
  readonly checksum: string;
  readonly manifest: Record<string, unknown>;
  readonly byteSize: bigint;
  readonly downloadRequired: boolean;
  readonly expiresAt: Date | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SyncBatch {
  readonly id: string;
  readonly schoolId: string;
  readonly deviceId: string;
  readonly clientBatchId: string;
  readonly status: SyncBatchStatus;
  readonly operationCount: number;
  readonly acceptedCount: number;
  readonly duplicateCount: number;
  readonly conflictCount: number;
  readonly rejectedCount: number;
  readonly permissionChanged: number;
  readonly summary: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OfflineDownloadAuthorization {
  readonly packageId: string;
  readonly authorized: boolean;
  readonly authorizedAt: Date;
  readonly downloadUrl: string | null;
}
