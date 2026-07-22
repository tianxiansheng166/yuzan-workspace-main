import type { OfflineContentPackage, SyncBatch, OfflineDownloadAuthorization } from "../domain/offline.types.js";

export function toPackageSummaryResponse(pkg: OfflineContentPackage) {
  return {
    id: pkg.id,
    courseVersionId: pkg.courseVersionId,
    version: pkg.version,
    checksum: pkg.checksum,
    byteSize: Number(pkg.byteSize),
    revision: pkg.revision,
  };
}

export function toPackageDetailResponse(pkg: OfflineContentPackage) {
  return {
    ...toPackageSummaryResponse(pkg),
    schoolId: pkg.schoolId,
    manifest: pkg.manifest,
    downloadRequired: pkg.downloadRequired,
    expiresAt: pkg.expiresAt?.toISOString() ?? null,
    createdAt: pkg.createdAt.toISOString(),
  };
}

export function toSyncBatchResponse(batch: SyncBatch) {
  return {
    id: batch.id,
    status: batch.status,
    operationCount: batch.operationCount,
    acceptedCount: batch.acceptedCount,
    duplicateCount: batch.duplicateCount,
    conflictCount: batch.conflictCount,
    rejectedCount: batch.rejectedCount,
    permissionChanged: batch.permissionChanged,
  };
}

export function toDownloadAuthorizationResponse(auth: OfflineDownloadAuthorization) {
  return {
    packageId: auth.packageId,
    authorized: auth.authorized,
    authorizedAt: auth.authorizedAt.toISOString(),
    downloadUrl: auth.downloadUrl,
  };
}
