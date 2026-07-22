import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { LearningPlan, SaveLearningPlanInput } from "../domain/learning-plan.types.js";
import type { CreateLearningPlanData, LearningPlanRepositoryPort } from "../ports/learning-plan-repository.port.js";

@Injectable()
export class PrismaLearningPlanRepository implements LearningPlanRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEnrollmentId(schoolId: string, enrollmentId: string): Promise<LearningPlan | null> {
    const row = await this.prisma.learningPlan.findFirst({
      where: { schoolId, enrollmentId },
      orderBy: { updatedAt: "desc" },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateLearningPlanData): Promise<LearningPlan> {
    const input: Prisma.LearningPlanCreateInput = {
      school: { connect: { id: data.schoolId } },
      enrollmentId: data.enrollmentId,
      authorUserId: data.authorUserId,
      planContent: data.planContent as unknown as Prisma.InputJsonValue,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    };
    const row = await this.prisma.learningPlan.create({ data: input });
    return this.toDomain(row);
  }

  async updateWithRevision(
    schoolId: string,
    enrollmentId: string,
    data: Omit<SaveLearningPlanInput, "expectedRevision">,
    expectedRevision: number,
  ): Promise<LearningPlan | null> {
    const result = await this.prisma.learningPlan.updateMany({
      where: {
        schoolId,
        enrollmentId,
        revision: expectedRevision,
      },
      data: {
        planContent: data.planContent as unknown as Prisma.InputJsonValue,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        revision: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByEnrollmentId(schoolId, enrollmentId);
  }

  private toDomain(row: Record<string, unknown>): LearningPlan {
    return {
      id: row.id as string,
      schoolId: row.schoolId as string,
      enrollmentId: row.enrollmentId as string,
      authorUserId: row.authorUserId as string,
      planContent: (row.planContent as Record<string, unknown>) ?? {},
      periodStart: row.periodStart as Date,
      periodEnd: row.periodEnd as Date,
      revision: row.revision as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
