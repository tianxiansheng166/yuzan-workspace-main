import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { CreateSyncBatchDto, ListSyncBatchesQueryDto, UpdateSyncBatchDto } from "./dto/sync.dto.js";

/** The allowed values for SyncBatch.status as defined in the Prisma enum. */
type SyncBatchStatusValue = "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "REJECTED" | "PERMISSION_CHANGED";

/** The allowed values for SyncCursor.entityType as defined in the Prisma enum. */
type SyncCursorEntityTypeValue = "ASSIGNMENT" | "SUBMISSION" | "PROGRESS" | "CONTENT_PACKAGE" | "FEEDBACK" | "REPORT";

@Injectable()
export class SyncService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Accept a sync batch from an offline device.
   * Processes each operation: de-duplicates, checks permissions, then creates a SyncJob.
   */
  async createBatch(
    schoolId: string,
    dto: CreateSyncBatchDto,
  ) {
    // Check for duplicate clientBatchId
    const existing = await this.prisma.syncBatch.findUnique({
      where: { clientBatchId: dto.clientBatchId },
      select: { id: true, status: true },
    });
    if (existing) {
      return {
        id: existing.id,
        status: "DUPLICATE" as const,
        message: "Batch with this clientBatchId already processed",
      };
    }

    // Verify device belongs to this school
    const device = await this.prisma.device.findFirst({
      where: { id: dto.deviceId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!device) {
      return {
        id: null,
        status: "REJECTED" as const,
        message: "Device not found or not belonging to this school",
      };
    }

    // Create the batch with counts derived from operations
    const totalOps = dto.operations.length;
    const batch = await this.prisma.syncBatch.create({
      data: {
        schoolId,
        deviceId: dto.deviceId,
        clientBatchId: dto.clientBatchId,
        status: "ACCEPTED" as SyncBatchStatusValue,
        operationCount: totalOps,
        acceptedCount: totalOps,
        duplicateCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        permissionChanged: 0,
        summary: {
          operations: dto.operations.map((op) => ({
            entityType: op.entityType,
            entityId: op.entityId,
            operation: op.operation,
          })),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Create individual SyncJob entries for each operation
    for (const op of dto.operations) {
      await this.prisma.syncJob.create({
        data: {
          schoolId,
          deviceId: dto.deviceId,
          clientOperationId: `${dto.clientBatchId}-${op.entityType}-${op.entityId}`,
          status: "QUEUED",
        },
      });
    }

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        schoolId,
        actorUserId: null,
        action: "SYNC_BATCH_ACCEPTED",
        resourceType: "SyncBatch",
        resourceId: batch.id,
        requestId: `sync-${Date.now()}`,
        afterSummary: {
          clientBatchId: dto.clientBatchId,
          operationCount: totalOps,
          deviceId: dto.deviceId,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: batch.id,
      status: batch.status,
      operationCount: batch.operationCount,
      acceptedCount: batch.acceptedCount,
      createdAt: batch.createdAt,
    };
  }

  /**
   * List sync batches for a school, with optional filtering.
   */
  async listBatches(
    schoolId: string,
    query: ListSyncBatchesQueryDto,
  ) {
    const where: Prisma.SyncBatchWhereInput = {
      schoolId,
      ...(query.deviceId ? { deviceId: query.deviceId } : {}),
      ...(query.status ? { status: query.status as SyncBatchStatusValue } : {}),
    };

    const rows = await this.prisma.syncBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        schoolId: true,
        deviceId: true,
        clientBatchId: true,
        status: true,
        operationCount: true,
        acceptedCount: true,
        duplicateCount: true,
        conflictCount: true,
        rejectedCount: true,
        permissionChanged: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);

    return {
      items,
      page: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  /**
   * Get a single sync batch by ID.
   */
  async getBatch(schoolId: string, batchId: string) {
    const row = await this.prisma.syncBatch.findFirst({
      where: { id: batchId, schoolId },
      select: {
        id: true,
        schoolId: true,
        deviceId: true,
        clientBatchId: true,
        status: true,
        operationCount: true,
        acceptedCount: true,
        duplicateCount: true,
        conflictCount: true,
        rejectedCount: true,
        permissionChanged: true,
        summary: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row;
  }

  /**
   * Update a sync batch status (e.g., mark as CONFLICT or PERMISSION_CHANGED).
   */
  async updateBatch(
    schoolId: string,
    batchId: string,
    dto: UpdateSyncBatchDto,
  ) {
    const existing = await this.prisma.syncBatch.findFirst({
      where: { id: batchId, schoolId },
      select: { id: true },
    });
    if (!existing) return null;

    const row = await this.prisma.syncBatch.update({
      where: { id: batchId },
      data: {
        status: dto.status as SyncBatchStatusValue,
        ...(dto.summary ? { summary: dto.summary as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.errorCode ? { errorCode: dto.errorCode } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        deviceId: true,
        clientBatchId: true,
        status: true,
        operationCount: true,
        acceptedCount: true,
        duplicateCount: true,
        conflictCount: true,
        rejectedCount: true,
        permissionChanged: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return row;
  }

  /**
   * Get sync cursors for a device — indicates the last sync point per entity type.
   */
  async getCursors(schoolId: string, deviceId: string) {
    const rows = await this.prisma.syncCursor.findMany({
      where: { schoolId, deviceId },
      select: {
        id: true,
        entityType: true,
        lastSyncedAt: true,
        lastEntityId: true,
        updatedAt: true,
      },
    });
    return rows;
  }

  /**
   * Upsert a sync cursor for a device + entity type combination.
   */
  async upsertCursor(
    schoolId: string,
    deviceId: string,
    entityType: string,
    lastSyncedAt: Date,
    lastEntityId?: string,
  ) {
    const row = await this.prisma.syncCursor.upsert({
      where: {
        deviceId_entityType: { deviceId, entityType: entityType as SyncCursorEntityTypeValue },
      },
      create: {
        schoolId,
        deviceId,
        entityType: entityType as SyncCursorEntityTypeValue,
        lastSyncedAt,
        ...(lastEntityId ? { lastEntityId } : {}),
      },
      update: {
        lastSyncedAt,
        ...(lastEntityId ? { lastEntityId } : {}),
      },
      select: {
        id: true,
        entityType: true,
        lastSyncedAt: true,
        lastEntityId: true,
        updatedAt: true,
      },
    });
    return row;
  }
}
