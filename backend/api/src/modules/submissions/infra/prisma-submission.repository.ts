import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import type {
  CreateSubmissionInput,
  Submission,
  SubmissionStatus,
  SubmissionSummary,
} from "../domain/submission.types.js";
import {
  SubmissionConflictException,
  SubmissionUnavailableException,
} from "../domain/submission.errors.js";
import { canTransition } from "../domain/submission.state-machine.js";
import type {
  ListSubmissionsOptions,
  PaginatedResult,
  SubmissionRepositoryPort,
} from "../ports/submission-repository.port.js";

type SubmissionRow = Prisma.SubmissionGetPayload<Record<string, never>>;

@Injectable()
export class PrismaSubmissionRepository implements SubmissionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    submissionId: string,
  ): Promise<Submission | null> {
    try {
      const row = await this.prisma.submission.findFirst({
        where: { id: submissionId, schoolId, deletedAt: null },
      });
      return row ? toSubmission(row) : null;
    } catch {
      throw new SubmissionUnavailableException();
    }
  }

  async findByEnrollmentAndIdempotencyKey(
    enrollmentId: string,
    idempotencyKey: string,
  ): Promise<Submission | null> {
    try {
      const row = await this.prisma.submission.findFirst({
        where: { enrollmentId, idempotencyKey },
      });
      return row ? toSubmission(row) : null;
    } catch {
      throw new SubmissionUnavailableException();
    }
  }

  async listByAssignment(
    schoolId: string,
    assignmentId: string,
    options: ListSubmissionsOptions,
  ): Promise<PaginatedResult<SubmissionSummary>> {
    try {
      const where: Prisma.SubmissionWhereInput = {
        schoolId,
        assignmentId,
        deletedAt: null,
        ...(options.enrollmentIds
          ? { enrollmentId: { in: [...options.enrollmentIds] } }
          : {}),
      };

      if (options.status) {
        where.status = options.status;
      }

      const rows = await this.prisma.submission.findMany({
        where,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: options.limit + 1,
      });

      const hasMore = rows.length > options.limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

      return {
        items: items.map(toSubmissionSummary),
        nextCursor,
        hasMore,
      };
    } catch {
      throw new SubmissionUnavailableException();
    }
  }

  async listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly SubmissionSummary[]> {
    try {
      const rows = await this.prisma.submission.findMany({
        where: { schoolId, enrollmentId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toSubmissionSummary);
    } catch {
      throw new SubmissionUnavailableException();
    }
  }

  async save(input: CreateSubmissionInput): Promise<Submission> {
    try {
      const attemptNo = await this.getNextAttemptNo(
        input.assignmentId,
        input.enrollmentId,
      );

      const row = await this.prisma.submission.create({
        data: {
          schoolId: input.schoolId,
          assignmentId: input.assignmentId,
          enrollmentId: input.enrollmentId,
          attemptNo,
          status: "IN_PROGRESS",
          idempotencyKey: input.idempotencyKey,
          revision: 0,
        },
      });
      return toSubmission(row);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new SubmissionConflictException("提交记录已存在");
      }
      throw new SubmissionUnavailableException();
    }
  }

  async updateStatus(
    schoolId: string,
    submissionId: string,
    status: SubmissionStatus,
    expectedRevision: number,
  ): Promise<Submission> {
    try {
      const current = await this.findById(schoolId, submissionId);
      if (!current) {
        throw new SubmissionConflictException("提交不存在");
      }

      if (current.revision !== expectedRevision) {
        throw new SubmissionConflictException();
      }

      if (!canTransition(current.status, status)) {
        throw new SubmissionConflictException(
          `不允许从 ${current.status} 转换到 ${status}`,
        );
      }

      const data: Prisma.SubmissionUpdateManyMutationInput = {
        status,
        revision: expectedRevision + 1,
      };

      if (status === "SUBMITTED") {
        data.submittedAt = new Date();
      }

      const result = await this.prisma.submission.updateMany({
        where: {
          id: submissionId,
          schoolId,
          revision: expectedRevision,
          deletedAt: null,
        },
        data,
      });

      if (result.count !== 1) {
        throw new SubmissionConflictException();
      }

      return (await this.findById(schoolId, submissionId))!;
    } catch (err) {
      if (
        err instanceof SubmissionConflictException ||
        err instanceof SubmissionUnavailableException
      ) {
        throw err;
      }
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new SubmissionConflictException();
      }
      throw new SubmissionUnavailableException();
    }
  }

  async getNextAttemptNo(
    assignmentId: string,
    enrollmentId: string,
  ): Promise<number> {
    try {
      const result = await this.prisma.submission.aggregate({
        where: { assignmentId, enrollmentId },
        _max: { attemptNo: true },
      });
      return (result._max.attemptNo ?? 0) + 1;
    } catch {
      throw new SubmissionUnavailableException();
    }
  }
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    schoolId: row.schoolId,
    assignmentId: row.assignmentId,
    enrollmentId: row.enrollmentId,
    attemptNo: row.attemptNo,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    ...(row.deviceId ? { deviceId: row.deviceId } : {}),
    revision: row.revision,
    ...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
  };
}

function toSubmissionSummary(row: SubmissionRow): SubmissionSummary {
  return {
    id: row.id,
    schoolId: row.schoolId,
    assignmentId: row.assignmentId,
    enrollmentId: row.enrollmentId,
    attemptNo: row.attemptNo,
    status: row.status,
    revision: row.revision,
    ...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
    createdAt: row.createdAt,
  };
}
