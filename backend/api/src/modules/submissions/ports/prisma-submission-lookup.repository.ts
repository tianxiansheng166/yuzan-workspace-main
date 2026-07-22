import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import { SubmissionConflictException, SubmissionUnavailableException } from "../domain/submission.errors.js";
import type { SubmissionStatus, SubmissionSummary } from "../domain/submission.types.js";
import type { SubmissionLookupPort } from "./submission-lookup.port.js";

@Injectable()
export class PrismaSubmissionLookupRepository implements SubmissionLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async findSummaryById(
    schoolId: string,
    submissionId: string,
  ): Promise<SubmissionSummary | null> {
    try {
      const row = await this.prisma.submission.findFirst({
        where: { id: submissionId, schoolId, deletedAt: null },
      });
      return row ? toSubmissionSummary(row) : null;
    } catch {
      throw new SubmissionUnavailableException();
    }
  }

  async transitionStatus(
    schoolId: string,
    submissionId: string,
    to: SubmissionStatus,
    expectedRevision: number,
  ): Promise<SubmissionSummary> {
    try {
      const result = await this.prisma.submission.updateMany({
        where: { id: submissionId, schoolId, revision: expectedRevision, deletedAt: null },
        data: {
          status: to,
          revision: { increment: 1 },
          ...(to === "SUBMITTED" ? { submittedAt: new Date() } : {}),
        },
      });

      if (result.count !== 1) {
        throw new SubmissionConflictException();
      }

      const updated = await this.prisma.submission.findFirst({
        where: { id: submissionId, schoolId },
      });
      if (!updated) {
        throw new SubmissionUnavailableException();
      }
      return toSubmissionSummary(updated);
    } catch (err) {
      if (err instanceof SubmissionConflictException) throw err;
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new SubmissionConflictException();
      }
      throw new SubmissionUnavailableException();
    }
  }
}

function toSubmissionSummary(
  row: Prisma.SubmissionGetPayload<Record<string, never>>,
): SubmissionSummary {
  return {
    id: row.id,
    schoolId: row.schoolId,
    assignmentId: row.assignmentId,
    enrollmentId: row.enrollmentId,
    attemptNo: row.attemptNo,
    status: row.status as SubmissionStatus,
    revision: row.revision,
    ...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
    createdAt: row.createdAt,
  };
}
