import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import {
  FeedbackForbiddenException,
  SubmissionNotReviewableException,
} from "./domain/feedback.errors.js";
import type { CreateFeedbackInput, Feedback } from "./domain/feedback.types.js";
import { toFeedbackResponse } from "./dto/feedback.response.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "./ports/feedback-repository.port.js";
import { FEEDBACK_REPOSITORY } from "./ports/feedback-repository.port.js";
import type { SubmissionLookupPort } from "../submissions/ports/submission-lookup.port.js";
import { SUBMISSION_LOOKUP } from "../submissions/ports/submission-lookup.port.js";
import { FeedbackPolicy } from "./feedback.policy.js";

@Injectable()
export class FeedbackService {
  private readonly policy = new FeedbackPolicy();

  constructor(
    @Inject(FEEDBACK_REPOSITORY)
    private readonly feedbackRepo: FeedbackRepositoryPort,
    @Inject(SUBMISSION_LOOKUP)
    private readonly submissionLookup: SubmissionLookupPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createFeedback(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
    input: Omit<CreateFeedbackInput, "schoolId" | "submissionId" | "authorUserId">,
  ) {
    if (!this.policy.canCreateFeedback(auth, schoolId)) {
      throw new FeedbackForbiddenException();
    }

    const submission = await this.submissionLookup.findSummaryById(schoolId, submissionId);
    if (!submission) {
      throw new SubmissionNotReviewableException("提交不存在");
    }

    if (submission.schoolId !== schoolId) {
      throw new FeedbackForbiddenException();
    }

    if (submission.status !== "NEEDS_REVIEW") {
      throw new SubmissionNotReviewableException();
    }

    const newStatus = input.decision === "ACCEPT" ? "ACCEPTED" : "RETURNED";

    const feedback = await this.prisma.$transaction(async (tx) => {
      const row = await tx.feedback.create({
        data: {
          schoolId,
          submissionId,
          authorUserId: auth.principal.userId,
          decision: input.decision,
          comment: input.comment,
          score: input.score ?? null,
          revision: 1,
          releasedAt: new Date(),
        },
      });

      await tx.submission.updateMany({
        where: { id: submissionId, schoolId },
        data: { status: newStatus },
      });

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
      } satisfies Feedback;
    });

    return toFeedbackResponse(feedback);
  }

  async getFeedbackBySubmission(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
  ) {
    const submission = await this.submissionLookup.findSummaryById(schoolId, submissionId);
    if (!submission) {
      return [];
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: submission.enrollmentId,
        schoolId,
        status: "ACTIVE",
      },
      select: { userId: true },
    });

    if (
      !this.policy.canReadOwnFeedback(
        auth,
        schoolId,
        enrollment?.userId ?? "",
      )
    ) {
      throw new FeedbackForbiddenException();
    }

    const feedbacks = await this.feedbackRepo.findBySubmissionId(
      schoolId,
      submissionId,
    );
    return feedbacks.map(toFeedbackResponse);
  }

  async listPendingFeedback(
    auth: AuthContext,
    schoolId: string,
    options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<ReturnType<typeof toFeedbackResponse>>> {
    if (!this.policy.canListPendingFeedback(auth, schoolId)) {
      throw new FeedbackForbiddenException();
    }

    const result = await this.feedbackRepo.findPendingBySchool(
      schoolId,
      options,
    );

    return {
      items: result.items.map(toFeedbackResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
