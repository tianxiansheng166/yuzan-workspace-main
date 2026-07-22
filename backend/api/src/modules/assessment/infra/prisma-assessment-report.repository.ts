import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { AssessmentReport } from "../domain/assessment.types.js";
import type { AssessmentReportRepositoryPort, CreateAssessmentReportData } from "../ports/assessment-report-repository.port.js";

@Injectable()
export class PrismaAssessmentReportRepository implements AssessmentReportRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySessionId(sessionId: string): Promise<AssessmentReport | null> {
    const row = await this.prisma.assessmentReport.findUnique({ where: { sessionId } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateAssessmentReportData): Promise<AssessmentReport> {
    const input: Prisma.AssessmentReportCreateInput = {
      session: { connect: { id: data.sessionId } },
      school: { connect: { id: data.schoolId } },
      ...(data.overallScore != null ? { overallScore: data.overallScore } : {}),
      ...(data.readingScore != null ? { readingScore: data.readingScore } : {}),
      ...(data.writtenScore != null ? { writtenScore: data.writtenScore } : {}),
      ...(data.summary != null ? { summary: data.summary as unknown as Prisma.InputJsonValue } : {}),
      ...(data.recommendations != null ? { recommendations: data.recommendations as unknown as Prisma.InputJsonValue } : {}),
      ...(data.dataCompleteness != null ? { dataCompleteness: data.dataCompleteness } : {}),
      ...(data.generatedByUserId != null ? { generatedByUserId: data.generatedByUserId } : {}),
      generatedAt: new Date(),
    };
    const row = await this.prisma.assessmentReport.create({ data: input });
    return this.toDomain(row);
  }

  private toDomain(row: Record<string, unknown>): AssessmentReport {
    return {
      id: row.id as string,
      sessionId: row.sessionId as string,
      schoolId: row.schoolId as string,
      overallScore: (row.overallScore as number) ?? null,
      readingScore: (row.readingScore as number) ?? null,
      writtenScore: (row.writtenScore as number) ?? null,
      summary: (row.summary as Record<string, unknown>) ?? null,
      recommendations: (row.recommendations as Record<string, unknown>) ?? null,
      dataCompleteness: row.dataCompleteness as number,
      generatedAt: (row.generatedAt as Date) ?? null,
      generatedByUserId: (row.generatedByUserId as string) ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
