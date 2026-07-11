import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Report, ReportType, ReportStatus, StudentGrowthProfile } from "../domain/report.types.js";
import type { CreateReportParams, ListReportsOptions, ListReportsResult, ReportRepositoryPort } from "../ports/report-repository.port.js";

@Injectable()
export class PrismaReportRepository implements ReportRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(schoolId: string, options: ListReportsOptions): Promise<ListReportsResult> {
    const limit = Math.min(options.limit ?? 20, 100);
    const where: Record<string, unknown> = { schoolId, deletedAt: null };

    if (options.type) where.type = options.type;
    if (options.status) where.status = options.status;

    if (options.cursor) {
      const cursorReport = await this.prisma.report.findUnique({ where: { id: options.cursor } });
      if (cursorReport) {
        where.createdAt = { lt: cursorReport.createdAt };
      }
    }

    const items = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;

    return {
      items: trimmed.map((r) => this.toDomain(r)),
      nextCursor: hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null,
      hasMore,
    };
  }

  async findById(schoolId: string, reportId: string): Promise<Report | null> {
    const row = await this.prisma.report.findFirst({
      where: { id: reportId, schoolId },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(params: CreateReportParams): Promise<Report> {
    const row = await this.prisma.report.create({
      data: {
        schoolId: params.schoolId,
        type: params.type,
        status: "PENDING",
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        filters: params.filters ?? undefined,
        enrollmentId: params.enrollmentId,
        classId: params.classId,
        generatedByUserId: params.generatedByUserId,
        dataCompleteness: 0,
        providerDisclosure: "",
      },
    });
    return this.toDomain(row);
  }

  async updateStatus(
    schoolId: string,
    reportId: string,
    status: ReportStatus,
    data?: Record<string, unknown>,
    dataCompleteness?: number,
  ): Promise<Report> {
    const row = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        ...(status === "GENERATING" ? { generatedAt: new Date() } : {}),
        ...(data !== undefined ? { data } : {}),
        ...(dataCompleteness !== undefined ? { dataCompleteness } : {}),
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: Record<string, unknown>): Report {
    return {
      id: row.id as string,
      schoolId: row.schoolId as string,
      type: row.type as ReportType,
      status: row.status as ReportStatus,
      periodStart: row.periodStart as Date,
      periodEnd: row.periodEnd as Date,
      filters: (row.filters as Record<string, unknown>) ?? null,
      dataCompleteness: row.dataCompleteness as number,
      providerDisclosure: row.providerDisclosure as string,
      generatedAt: (row.generatedAt as Date) ?? null,
      generatedByUserId: (row.generatedByUserId as string) ?? null,
      enrollmentId: (row.enrollmentId as string) ?? null,
      classId: (row.classId as string) ?? null,
      data: (row.data as Record<string, unknown>) ?? null,
      revision: row.revision as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
