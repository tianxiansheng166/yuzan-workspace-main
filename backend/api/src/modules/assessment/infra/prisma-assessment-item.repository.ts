import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { AssessmentItem, AssessmentItemStatus } from "../domain/assessment.types.js";
import type { AssessmentItemRepositoryPort, CreateAssessmentItemData } from "../ports/assessment-item-repository.port.js";

@Injectable()
export class PrismaAssessmentItemRepository implements AssessmentItemRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySessionId(sessionId: string): Promise<AssessmentItem[]> {
    const rows = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(itemId: string): Promise<AssessmentItem | null> {
    const row = await this.prisma.assessmentItem.findUnique({ where: { id: itemId } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndSession(itemId: string, sessionId: string): Promise<AssessmentItem | null> {
    const row = await this.prisma.assessmentItem.findFirst({ where: { id: itemId, sessionId } });
    return row ? this.toDomain(row) : null;
  }

  async createMany(items: CreateAssessmentItemData[]): Promise<AssessmentItem[]> {
    const results: AssessmentItem[] = [];
    for (const item of items) {
      const input: Prisma.AssessmentItemCreateInput = {
        session: { connect: { id: item.sessionId } },
        prompt: item.prompt as unknown as Prisma.InputJsonValue,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        status: "PENDING",
        ...(item.questionId ? { question: { connect: { id: item.questionId } } } : {}),
        ...(item.maxScore != null ? { maxScore: item.maxScore } : {}),
      };
      const row = await this.prisma.assessmentItem.create({ data: input });
      results.push(this.toDomain(row));
    }
    return results;
  }

  async updateRecordingId(itemId: string, recordingId: string): Promise<AssessmentItem> {
    const row = await this.prisma.assessmentItem.update({
      where: { id: itemId },
      data: { recording: { connect: { id: recordingId } } },
    });
    return this.toDomain(row);
  }

  async updateStatus(itemId: string, status: AssessmentItemStatus): Promise<AssessmentItem> {
    const row = await this.prisma.assessmentItem.update({
      where: { id: itemId },
      data: { status },
    });
    return this.toDomain(row);
  }

  async updateScore(itemId: string, scoredScore: number, autoResult?: Record<string, unknown>): Promise<AssessmentItem> {
    const data: Prisma.AssessmentItemUpdateInput = { scoredScore };
    if (autoResult) {
      data.autoResult = autoResult as unknown as Prisma.InputJsonValue;
    }
    const row = await this.prisma.assessmentItem.update({ where: { id: itemId }, data });
    return this.toDomain(row);
  }

  private toDomain(row: Record<string, unknown>): AssessmentItem {
    return {
      id: row.id as string,
      sessionId: row.sessionId as string,
      questionId: (row.questionId as string) ?? null,
      recordingId: (row.recordingId as string) ?? null,
      prompt: (row.prompt as Record<string, unknown>) ?? {},
      itemType: row.itemType as string,
      status: row.status as AssessmentItemStatus,
      sortOrder: row.sortOrder as number,
      maxScore: (row.maxScore as number) ?? null,
      scoredScore: (row.scoredScore as number) ?? null,
      autoResult: (row.autoResult as Record<string, unknown>) ?? null,
      reviewerUserId: (row.reviewerUserId as string) ?? null,
      reviewerComment: (row.reviewerComment as string) ?? null,
      reviewedAt: (row.reviewedAt as Date) ?? null,
      revision: row.revision as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
