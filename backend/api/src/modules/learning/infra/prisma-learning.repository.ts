import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import type {
  ActivityProgressRecord,
  UpdateProgressInput,
} from "../domain/learning.types.js";
import {
  LearningUnavailableException,
  ProgressConflictException,
} from "../domain/learning.errors.js";
import type { LearningRepositoryPort } from "../ports/learning-repository.port.js";

@Injectable()
export class PrismaLearningRepository implements LearningRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findProgress(
    activityId: string,
    enrollmentId: string,
  ): Promise<ActivityProgressRecord | null> {
    try {
      const row = await this.prisma.activityProgress.findFirst({
        where: { activityId, enrollmentId },
      });
      return row ? toActivityProgressRecord(row) : null;
    } catch {
      throw new LearningUnavailableException();
    }
  }

  async upsertProgress(
    input: UpdateProgressInput,
  ): Promise<ActivityProgressRecord> {
    try {
      const where = {
        activityId_enrollmentId: {
          activityId: input.activityId,
          enrollmentId: input.enrollmentId,
        },
      };

      if (input.expectedRevision !== undefined) {
        const existing = await this.prisma.activityProgress.findFirst({
          where: {
            activityId: input.activityId,
            enrollmentId: input.enrollmentId,
            revision: input.expectedRevision,
          },
        });

        if (!existing) {
          throw new ProgressConflictException();
        }
      }

      const row = await this.prisma.activityProgress.upsert({
        where,
        create: {
          schoolId: input.schoolId,
          activityId: input.activityId,
          enrollmentId: input.enrollmentId,
          position: input.position,
          completed: input.completed,
          revision: 1,
        },
        update: {
          position: input.position,
          completed: input.completed,
          revision: { increment: 1 },
        },
      });

      return toActivityProgressRecord(row);
    } catch (err) {
      if (err instanceof ProgressConflictException) throw err;
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new ProgressConflictException();
      }
      throw new LearningUnavailableException();
    }
  }

  async listProgressByEnrollment(
    enrollmentId: string,
  ): Promise<readonly ActivityProgressRecord[]> {
    try {
      const rows = await this.prisma.activityProgress.findMany({
        where: { enrollmentId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toActivityProgressRecord);
    } catch {
      throw new LearningUnavailableException();
    }
  }
}

function toActivityProgressRecord(
  row: Prisma.ActivityProgressGetPayload<Record<string, never>>,
): ActivityProgressRecord {
  return {
    id: row.id,
    schoolId: row.schoolId,
    activityId: row.activityId,
    enrollmentId: row.enrollmentId,
    position: row.position,
    completed: row.completed,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}
