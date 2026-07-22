import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { AssessmentSession, AssessmentSessionStatus, AssessmentType } from "../domain/assessment.types.js";
import type { AssessmentSessionRepositoryPort, CreateAssessmentSessionData, ListSessionsOptions, PaginatedResult } from "../ports/assessment-session-repository.port.js";

@Injectable()
export class PrismaAssessmentSessionRepository implements AssessmentSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(sessionId: string): Promise<AssessmentSession | null> {
    const row = await this.prisma.assessmentSession.findUnique({ where: { id: sessionId } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndSchool(sessionId: string, schoolId: string): Promise<AssessmentSession | null> {
    const row = await this.prisma.assessmentSession.findFirst({ where: { id: sessionId, schoolId } });
    return row ? this.toDomain(row) : null;
  }

  async list(schoolId: string, options: ListSessionsOptions): Promise<PaginatedResult<AssessmentSession>> {
    const limit = Math.min(options.limit, 100);
    const where: Prisma.AssessmentSessionWhereInput = { schoolId };
    if (options.enrollmentId) where.enrollmentId = options.enrollmentId;
    if (options.classId) where.classId = options.classId;
    if (options.status) where.status = options.status;

    if (options.cursor) {
      const cursorSession = await this.prisma.assessmentSession.findUnique({ where: { id: options.cursor } });
      if (cursorSession) {
        where.createdAt = { lt: cursorSession.createdAt };
      }
    }

    const items = await this.prisma.assessmentSession.findMany({
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

  async create(data: CreateAssessmentSessionData): Promise<AssessmentSession> {
    const input: Prisma.AssessmentSessionCreateInput = {
      school: { connect: { id: data.schoolId } },
      enrollment: { connect: { schoolId: data.schoolId, id: data.enrollmentId } },
      classId: data.classId,
      initiatorUserId: data.initiatorUserId,
      type: data.type as AssessmentType,
      status: "CREATED",
      ...(data.retestOfSessionId ? { retestOfSessionId: data.retestOfSessionId } : {}),
    };
    const row = await this.prisma.assessmentSession.create({ data: input });
    return this.toDomain(row);
  }

  async updateStatus(sessionId: string, status: AssessmentSessionStatus, extra?: Partial<AssessmentSession>): Promise<AssessmentSession> {
    const data: Prisma.AssessmentSessionUpdateInput = { status };
    if (status === "IN_PROGRESS" && extra?.startedAt) {
      data.startedAt = extra.startedAt;
    }
    if (status === "SUBMITTED" && extra?.submittedAt) {
      data.submittedAt = extra.submittedAt;
    }
    if (status === "COMPLETED" && extra?.completedAt) {
      data.completedAt = extra.completedAt;
    }
    const row = await this.prisma.assessmentSession.update({ where: { id: sessionId }, data });
    return this.toDomain(row);
  }

  private toDomain(row: Record<string, unknown>): AssessmentSession {
    return {
      id: row.id as string,
      schoolId: row.schoolId as string,
      enrollmentId: row.enrollmentId as string,
      classId: row.classId as string,
      initiatorUserId: row.initiatorUserId as string,
      type: row.type as AssessmentType,
      status: row.status as AssessmentSessionStatus,
      startedAt: (row.startedAt as Date) ?? null,
      submittedAt: (row.submittedAt as Date) ?? null,
      completedAt: (row.completedAt as Date) ?? null,
      retestOfSessionId: (row.retestOfSessionId as string) ?? null,
      revision: row.revision as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
