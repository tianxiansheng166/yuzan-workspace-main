import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { AuditUnavailableException } from "../domain/audit.errors.js";
import type {
  AuditLogEntry,
  AuditSearchParams,
  AuditSearchResult,
} from "../domain/audit.types.js";
import type { AuditRepositoryPort } from "../ports/audit-repository.port.js";

@Injectable()
export class PrismaAuditRepository implements AuditRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: AuditSearchParams): Promise<AuditSearchResult> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (params.schoolId) {
        where.schoolId = params.schoolId;
      }
      if (params.actorUserId) {
        where.actorUserId = params.actorUserId;
      }
      if (params.resourceType) {
        where.resourceType = params.resourceType;
      }
      if (params.resourceId) {
        where.resourceId = params.resourceId;
      }
      if (params.from || params.to) {
        where.createdAt = {};
        if (params.from) {
          where.createdAt.gte = params.from;
        }
        if (params.to) {
          where.createdAt.lte = params.to;
        }
      }

      const take = params.limit;
      const skip = params.cursor ? 1 : 0;
      const cursor = params.cursor
        ? ({ id: params.cursor } satisfies Prisma.AuditLogWhereUniqueInput)
        : undefined;

      const rows = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        skip,
        ...(cursor ? { cursor } : {}),
      });

      const hasMore = rows.length > take;
      const items = rows.slice(0, take).map(toAuditLogEntry);
      const lastItem = items[items.length - 1];

      return {
        items,
        nextCursor: hasMore ? (lastItem?.id ?? null) : null,
        hasMore,
      };
    } catch (err) {
      if (err instanceof AuditUnavailableException) throw err;
      throw new AuditUnavailableException();
    }
  }

  async findById(
    _schoolId: string | null,
    id: string,
  ): Promise<AuditLogEntry | null> {
    try {
      const row = await this.prisma.auditLog.findUnique({ where: { id } });
      return row ? toAuditLogEntry(row) : null;
    } catch (err) {
      if (err instanceof AuditUnavailableException) throw err;
      throw new AuditUnavailableException();
    }
  }
}

function toAuditLogEntry(row: Prisma.AuditLogGetPayload<Record<string, never>>): AuditLogEntry {
  return {
    id: row.id,
    schoolId: row.schoolId,
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    requestId: row.requestId,
    beforeSummary: row.beforeSummary as unknown,
    afterSummary: row.afterSummary as unknown,
    createdAt: row.createdAt,
  };
}
