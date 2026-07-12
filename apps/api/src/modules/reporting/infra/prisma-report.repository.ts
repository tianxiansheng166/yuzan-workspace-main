import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { Report, ReportStatus, ReportType } from "../domain/report.types.js";
import type { CreateReportData, ListReportsOptions, PaginatedResult, ReportRepositoryPort } from "../ports/report-repository.port.js";

@Injectable()
export class PrismaReportRepository implements ReportRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(schoolId: string, options: ListReportsOptions): Promise<PaginatedResult<Report>> {
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
      nextCursor: hasMore && trimmed.length > 0 ? trimmed.at(-1)!.id : null,
      hasMore,
    };
  }

  async findById(schoolId: string, reportId: string): Promise<Report | null> {
    const row = await this.prisma.report.findFirst({
      where: { id: reportId, schoolId },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(params: CreateReportData): Promise<Report> {
    const data: Prisma.ReportCreateInput = {
      school: { connect: { id: params.schoolId } },
      type: params.type,
      status: "PENDING",
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      generatedByUserId: params.generatedByUserId,
      dataCompleteness: 0,
      providerDisclosure: "",
    };
    if (params.filters != null) {
      data.filters = params.filters as unknown as Prisma.InputJsonValue;
    }
    if (params.enrollmentId != null) {
      data.enrollmentId = params.enrollmentId;
    }
    if (params.classId != null) {
      data.classId = params.classId;
    }
    const row = await this.prisma.report.create({ data });
    return this.toDomain(row);
  }

  async updateStatus(
    schoolId: string,
    reportId: string,
    status: ReportStatus,
    data?: Partial<Report>,
  ): Promise<Report> {
    const updateData: Prisma.ReportUpdateInput = { status };
    if (status === "GENERATING") {
      updateData.generatedAt = new Date();
    }
    if (data?.data !== undefined) {
      updateData.data = data.data as unknown as Prisma.InputJsonValue;
    }
    if (data?.dataCompleteness !== undefined) {
      updateData.dataCompleteness = data.dataCompleteness;
    }
    const row = await this.prisma.report.update({ where: { id: reportId }, data: updateData });
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
