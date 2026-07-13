import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import type {
  Assignment,
  AssignmentSummary,
  AssignmentTarget,
  AssignmentStatus,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "../domain/assignment.types.js";
import {
  AssignmentConflictException,
  AssignmentUnavailableException,
} from "../domain/assignment.errors.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
  PaginatedResult,
} from "../ports/assignment-repository.port.js";

type AssignmentRow = Prisma.AssignmentGetPayload<{
  include: { targets: true };
}>;

@Injectable()
export class PrismaAssignmentRepository
  implements AssignmentRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    assignmentId: string,
  ): Promise<Assignment | null> {
    try {
      const row = await this.prisma.assignment.findFirst({
        where: { id: assignmentId, schoolId, deletedAt: null },
        include: { targets: true },
      });
      return row ? toAssignment(row) : null;
    } catch {
      throw new AssignmentUnavailableException();
    }
  }

  async list(
    schoolId: string,
    options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>> {
    try {
      const where: Prisma.AssignmentWhereInput = {
        schoolId,
        deletedAt: null,
      };

      if (options.status) {
        where.status = options.status;
      }

      if (options.studentUserId) {
        where.targets = {
          some: {
            enrollment: {
              userId: options.studentUserId,
              status: "ACTIVE",
            },
          },
        };
      }

      if (options.cursor) {
        where.id = { gt: options.cursor };
      }

      const rows = await this.prisma.assignment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit + 1,
      });

      const hasMore = rows.length > options.limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor = hasMore
        ? items[items.length - 1]?.id ?? null
        : null;

      return {
        items: items.map(toAssignmentSummary),
        nextCursor,
        hasMore,
      };
    } catch {
      throw new AssignmentUnavailableException();
    }
  }

  async listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]> {
    try {
      const rows = await this.prisma.assignment.findMany({
        where: {
          schoolId,
          deletedAt: null,
          targets: { some: { enrollmentId } },
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toAssignmentSummary);
    } catch {
      throw new AssignmentUnavailableException();
    }
  }

  async save(
    input: CreateAssignmentInput,
    createdByUserId: string,
  ): Promise<Assignment> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.assignment.create({
          data: {
            schoolId: input.schoolId,
            courseVersionId: input.courseVersionId,
            createdByUserId,
            title: input.title,
            status: "DRAFT",
            startsAt: input.startsAt,
            dueAt: input.dueAt,
            offlineRequired: input.offlineRequired ?? false,
            ...(input.completionRule !== undefined && input.completionRule !== null
              ? { completionRule: input.completionRule as Prisma.InputJsonValue }
              : {}),
            revision: 1,
          },
        });

        if (input.targets.length > 0) {
          await tx.assignmentTarget.createMany({
            data: input.targets.map((target) => ({
              schoolId: input.schoolId,
              assignmentId: created.id,
              targetType: target.targetType,
              classId: target.classId ?? null,
              enrollmentId: target.enrollmentId ?? null,
            })),
          });
        }

        return tx.assignment.findUniqueOrThrow({
          where: { id: created.id },
          include: { targets: true },
        });
      });
      return toAssignment(row as AssignmentRow);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new AssignmentConflictException("作业数据冲突");
      }
      throw new AssignmentUnavailableException();
    }
  }

  async update(
    schoolId: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
    expectedRevision: number,
  ): Promise<Assignment> {
    try {
      const result = await this.prisma.assignment.updateMany({
        where: {
          id: assignmentId,
          schoolId,
          revision: expectedRevision,
          deletedAt: null,
        },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
          ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
          ...(data.offlineRequired !== undefined
            ? { offlineRequired: data.offlineRequired }
            : {}),
          ...(data.completionRule !== undefined && data.completionRule !== null
            ? { completionRule: data.completionRule as Prisma.InputJsonValue }
            : {}),
          revision: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        throw new AssignmentConflictException();
      }

      return (await this.findById(schoolId, assignmentId))!;
    } catch (err) {
      if (err instanceof AssignmentConflictException) throw err;
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new AssignmentConflictException("作业数据冲突");
      }
      throw new AssignmentUnavailableException();
    }
  }

  async updateStatus(
    schoolId: string,
    assignmentId: string,
    status: AssignmentStatus,
    expectedRevision: number,
  ): Promise<Assignment> {
    try {
      const statusData: Record<string, unknown> = {
        status,
        revision: { increment: 1 },
      };

      if (status === "OPEN") {
        statusData.openedAt = new Date();
      }
      if (status === "CLOSED") {
        statusData.closedAt = new Date();
      }

      const result = await this.prisma.assignment.updateMany({
        where: {
          id: assignmentId,
          schoolId,
          revision: expectedRevision,
          deletedAt: null,
        },
        data: statusData,
      });

      if (result.count !== 1) {
        throw new AssignmentConflictException();
      }

      return (await this.findById(schoolId, assignmentId))!;
    } catch (err) {
      if (err instanceof AssignmentConflictException) throw err;
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new AssignmentConflictException("作业数据冲突");
      }
      throw new AssignmentUnavailableException();
    }
  }

  async softDelete(
    schoolId: string,
    assignmentId: string,
  ): Promise<void> {
    try {
      await this.prisma.assignment.updateMany({
        where: { id: assignmentId, schoolId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } catch {
      throw new AssignmentUnavailableException();
    }
  }

}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    schoolId: row.schoolId,
    courseVersionId: row.courseVersionId,
    createdByUserId: row.createdByUserId,
    title: row.title,
    status: row.status as AssignmentStatus,
    startsAt: row.startsAt,
    dueAt: row.dueAt,
    offlineRequired: row.offlineRequired,
    ...(row.completionRule !== undefined && row.completionRule !== null ? { completionRule: row.completionRule } : {}),
    revision: row.revision,
    ...(row.openedAt ? { openedAt: row.openedAt } : {}),
    ...(row.closedAt ? { closedAt: row.closedAt } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
    targets: row.targets.map(toAssignmentTarget),
  };
}

function toAssignmentSummary(
  row: Prisma.AssignmentGetPayload<Record<string, never>>,
): AssignmentSummary {
  return {
    id: row.id,
    schoolId: row.schoolId,
    title: row.title,
    status: row.status as AssignmentStatus,
    startsAt: row.startsAt,
    dueAt: row.dueAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssignmentTarget(
  row: Prisma.AssignmentTargetGetPayload<Record<string, never>>,
): AssignmentTarget {
  return {
    id: row.id,
    schoolId: row.schoolId,
    assignmentId: row.assignmentId,
    targetType: row.targetType as "CLASS" | "STUDENT",
    ...(row.classId ? { classId: row.classId } : {}),
    ...(row.enrollmentId ? { enrollmentId: row.enrollmentId } : {}),
  };
}
