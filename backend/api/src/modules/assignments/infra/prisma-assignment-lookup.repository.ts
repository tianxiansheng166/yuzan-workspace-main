import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import type { AssignmentSummary } from "../domain/assignment.types.js";
import type { AssignmentStatus } from "../domain/assignment.types.js";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";
import type { AssignmentLookupPort } from "../ports/assignment-lookup.port.js";

@Injectable()
export class PrismaAssignmentLookupRepository implements AssignmentLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async findSummaryById(
    schoolId: string,
    assignmentId: string,
  ): Promise<AssignmentSummary | null> {
    try {
      const row = await this.prisma.assignment.findFirst({
        where: { id: assignmentId, schoolId, deletedAt: null },
        include: { targets: true },
      });
      return row ? toAssignmentSummary(row) : null;
    } catch {
      throw new AssignmentUnavailableException();
    }
  }

  async isOpen(schoolId: string, assignmentId: string): Promise<boolean> {
    try {
      const row = await this.prisma.assignment.findFirst({
        where: { id: assignmentId, schoolId, deletedAt: null },
        select: { status: true },
      });
      return row?.status === "OPEN";
    } catch {
      return false;
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
        include: { targets: true },
      });
      return rows.map(toAssignmentSummary);
    } catch {
      throw new AssignmentUnavailableException();
    }
  }
}

function toAssignmentSummary(
  row: Prisma.AssignmentGetPayload<{ include: { targets: true } }>,
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
    targets: row.targets.map((t) => ({
      id: t.id,
      schoolId: t.schoolId,
      assignmentId: t.assignmentId,
      targetType: t.targetType as "CLASS" | "STUDENT",
      ...(t.classId ? { classId: t.classId } : {}),
      ...(t.enrollmentId ? { enrollmentId: t.enrollmentId } : {}),
    })),
  };
}
