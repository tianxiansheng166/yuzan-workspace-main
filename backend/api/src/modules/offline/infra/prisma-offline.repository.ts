import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import type { OfflineContentPackage, SyncBatch, SyncBatchStatus, OfflineDownloadAuthorization } from "../domain/offline.types.js";
import type { OfflineRepositoryPort, CreateOfflinePackageData, CreateSyncBatchData, ListOfflinePackagesOptions, PaginatedResult } from "../ports/offline-repository.port.js";

function toPackageDomain(row: Record<string, unknown>): OfflineContentPackage {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    courseVersionId: row.courseVersionId as string,
    version: row.version as number,
    checksum: row.checksum as string,
    manifest: row.manifest as Record<string, unknown>,
    byteSize: row.byteSize as bigint,
    downloadRequired: row.downloadRequired as boolean,
    expiresAt: row.expiresAt as Date | null,
    revision: row.revision as number,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

function toBatchDomain(row: Record<string, unknown>): SyncBatch {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    deviceId: row.deviceId as string,
    clientBatchId: row.clientBatchId as string,
    status: row.status as SyncBatchStatus,
    operationCount: row.operationCount as number,
    acceptedCount: row.acceptedCount as number,
    duplicateCount: row.duplicateCount as number,
    conflictCount: row.conflictCount as number,
    rejectedCount: row.rejectedCount as number,
    permissionChanged: row.permissionChanged as number,
    summary: row.summary as Record<string, unknown> | null,
    errorCode: row.errorCode as string | null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

@Injectable()
export class PrismaOfflineRepository implements OfflineRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findPackageById(schoolId: string, packageId: string): Promise<OfflineContentPackage | null> {
    const row = await this.prisma.offlineContentPackage.findFirst({ where: { schoolId, id: packageId } });
    return row ? toPackageDomain(row as unknown as Record<string, unknown>) : null;
  }

  async listPackages(schoolId: string, options: ListOfflinePackagesOptions): Promise<PaginatedResult<OfflineContentPackage>> {
    const limit = options.limit ?? 20;
    const where: Record<string, unknown> = { schoolId };
    if (options.courseVersionId) where.courseVersionId = options.courseVersionId;

    const rows = await this.prisma.offlineContentPackage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, -1) : rows;

    return {
      items: items.map((r) => toPackageDomain(r as unknown as Record<string, unknown>)),
      nextCursor: hasMore ? items.at(-1)!.id : null,
      hasMore,
    };
  }

  async createPackage(data: CreateOfflinePackageData): Promise<OfflineContentPackage> {
    const row = await this.prisma.offlineContentPackage.create({
      data: {
        schoolId: data.schoolId,
        courseVersionId: data.courseVersionId,
        checksum: `pending-${Date.now()}`,
        manifest: { status: "building", courseVersionId: data.courseVersionId },
        downloadRequired: data.downloadRequired ?? false,
      },
    });
    return toPackageDomain(row as unknown as Record<string, unknown>);
  }

  async findBatchById(schoolId: string, batchId: string): Promise<SyncBatch | null> {
    const row = await this.prisma.syncBatch.findFirst({ where: { schoolId, id: batchId } });
    return row ? toBatchDomain(row as unknown as Record<string, unknown>) : null;
  }

  async findBatchByClientBatchId(clientBatchId: string): Promise<SyncBatch | null> {
    const row = await this.prisma.syncBatch.findUnique({ where: { clientBatchId } });
    return row ? toBatchDomain(row as unknown as Record<string, unknown>) : null;
  }

  async createBatch(data: CreateSyncBatchData): Promise<SyncBatch> {
    const row = await this.prisma.syncBatch.create({
      data: {
        schoolId: data.schoolId,
        deviceId: data.deviceId,
        clientBatchId: data.clientBatchId,
        operationCount: data.operationCount,
        acceptedCount: data.operationCount,
      },
    });
    return toBatchDomain(row as unknown as Record<string, unknown>);
  }

  async authorizeDownload(schoolId: string, packageId: string, _userId: string): Promise<OfflineDownloadAuthorization> {
    const pkg = await this.findPackageById(schoolId, packageId);
    if (!pkg) return { packageId, authorized: false, authorizedAt: new Date(), downloadUrl: null };

    return {
      packageId,
      authorized: true,
      authorizedAt: new Date(),
      downloadUrl: null,
    };
  }
}
