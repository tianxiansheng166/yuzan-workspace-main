import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import type { Feedback, CreateFeedbackInput } from "../domain/feedback.types.js";
import {
  FeedbackConflictException,
  FeedbackUnavailableException,
} from "../domain/feedback.errors.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "../ports/feedback-repository.port.js";

@Injectable()
export class PrismaFeedbackRepository implements FeedbackRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    feedbackId: string,
  ): Promise<Feedback | null> {
    try {
      const row = await this.prisma.feedback.findFirst({
        where: { id: feedbackId, schoolId, deletedAt: null },
      });
      return row ? toFeedback(row) : null;
    } catch {
      throw new FeedbackUnavailableException();
    }
  }

  async findBySubmissionId(
    schoolId: string,
    submissionId: string,
  ): Promise<readonly Feedback[]> {
    try {
      const rows = await this.prisma.feedback.findMany({
        where: { submissionId, schoolId, deletedAt: null },
        orderBy: { releasedAt: "desc" },
      });
      return rows.map(toFeedback);
    } catch {
      throw new FeedbackUnavailableException();
    }
  }

  async findPendingBySchool(
    schoolId: string,
    options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>> {
    try {
      const where: Prisma.SubmissionWhereInput = {
        schoolId,
        status: "NEEDS_REVIEW",
        deletedAt: null,
      };

      if (options.cursor) {
        where.id = { gt: options.cursor };
      }

      const submissions = await this.prisma.submission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit + 1,
        select: { id: true },
      });

      const hasMore = submissions.length > options.limit;
      const items = hasMore ? submissions.slice(0, -1) : submissions;

      const submissionIds = items.map((s) => s.id);

      if (submissionIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }

      const feedbackRows = await this.prisma.feedback.findMany({
        where: {
          submissionId: { in: submissionIds },
          schoolId,
          deletedAt: null,
        },
        orderBy: { releasedAt: "desc" },
      });

      const nextCursor = hasMore
        ? items[items.length - 1]?.id ?? null
        : null;

      return {
        items: feedbackRows.map(toFeedback),
        nextCursor,
        hasMore,
      };
    } catch {
      throw new FeedbackUnavailableException();
    }
  }

  async save(input: CreateFeedbackInput): Promise<Feedback> {
    try {
      const row = await this.prisma.feedback.create({
        data: {
          schoolId: input.schoolId,
          submissionId: input.submissionId,
          authorUserId: input.authorUserId,
          decision: input.decision,
          comment: input.comment,
          score: input.score ?? null,
          revision: 1,
          releasedAt: new Date(),
        },
      });
      return toFeedback(row);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new FeedbackConflictException();
      }
      throw new FeedbackUnavailableException();
    }
  }
}

function toFeedback(
  row: Prisma.FeedbackGetPayload<Record<string, never>>,
): Feedback {
  return {
    id: row.id,
    schoolId: row.schoolId,
    submissionId: row.submissionId,
    authorUserId: row.authorUserId,
    decision: row.decision as "ACCEPT" | "RETURN",
    comment: row.comment,
    ...(row.score !== null && row.score !== undefined ? { score: row.score } : {}),
    revision: row.revision,
    releasedAt: row.releasedAt,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
  };
}
