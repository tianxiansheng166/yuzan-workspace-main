import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";

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
    input: Omit<
      CreateFeedbackInput,
      "schoolId" | "submissionId" | "authorUserId"
    >,
  ) {
    if (!this.policy.canCreateFeedback(auth, schoolId)) {
      throw new FeedbackForbiddenException();
    }

    const submission = await this.submissionLookup.findSummaryById(
      schoolId,
      submissionId,
    );
    if (!submission) {
      throw new SubmissionNotReviewableException("提交不存在");
    }

    if (submission.schoolId !== schoolId) {
      throw new FeedbackForbiddenException();
    }

    const studentEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: submission.enrollmentId,
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { classId: true, userId: true },
    });
    if (!studentEnrollment?.classId || !studentEnrollment.userId) {
      throw new FeedbackForbiddenException();
    }

    if (!this.policy.isSchoolAdmin(auth, schoolId)) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          schoolId,
          classId: studentEnrollment.classId,
          userId: auth.principal.userId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!teacherEnrollment) {
        throw new FeedbackForbiddenException();
      }
    }

    if (submission.status !== "NEEDS_REVIEW") {
      throw new SubmissionNotReviewableException();
    }

    const newStatus = input.decision === "ACCEPT" ? "ACCEPTED" : "RETURNED";

    const feedback = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.submission.updateMany({
        where: {
          id: submissionId,
          schoolId,
          deletedAt: null,
          status: "NEEDS_REVIEW",
          revision: submission.revision,
        },
        data: {
          status: newStatus,
          revision: { increment: 1 },
        },
      });
      if (transition.count !== 1) {
        throw new SubmissionNotReviewableException(
          "提交审核状态或版本已变化，请刷新后重试",
        );
      }

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

      return {
        id: row.id,
        schoolId: row.schoolId,
        submissionId: row.submissionId,
        authorUserId: row.authorUserId,
        decision: row.decision,
        comment: row.comment,
        ...(row.score !== null && row.score !== undefined
          ? { score: row.score }
          : {}),
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
    if (!this.policy.canReadFeedback(auth, schoolId)) {
      throw new FeedbackForbiddenException();
    }

    const submission = await this.submissionLookup.findSummaryById(
      schoolId,
      submissionId,
    );
    if (!submission) {
      return [];
    }
    if (submission.schoolId !== schoolId) {
      return [];
    }

    if (this.policy.isSchoolAdmin(auth, schoolId)) {
      const feedbacks = await this.feedbackRepo.findBySubmissionId(
        schoolId,
        submissionId,
      );
      return feedbacks.map(toFeedbackResponse);
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: submission.enrollmentId,
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { userId: true, classId: true },
    });
    if (!enrollment?.userId || !enrollment.classId) {
      return [];
    }

    const canReadOwnFeedback = this.policy.canReadOwnFeedback(
      auth,
      schoolId,
      enrollment.userId,
    );
    if (!canReadOwnFeedback && !this.policy.canReadAsTeacher(auth, schoolId)) {
      throw new FeedbackForbiddenException();
    }

    if (!canReadOwnFeedback) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          schoolId,
          classId: enrollment.classId,
          userId: auth.principal.userId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!teacherEnrollment) {
        throw new FeedbackForbiddenException();
      }
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

    let authorizedClassIds: readonly string[] | undefined;
    if (!this.policy.isSchoolAdmin(auth, schoolId)) {
      const teacherEnrollments = await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          userId: auth.principal.userId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { classId: true },
      });
      authorizedClassIds = [
        ...new Set(teacherEnrollments.map((row) => row.classId)),
      ];
      if (authorizedClassIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }
    }

    const result = await this.feedbackRepo.findPendingBySchool(
      schoolId,
      authorizedClassIds === undefined
        ? options
        : { ...options, authorizedClassIds },
    );

    return {
      items: result.items.map(toFeedbackResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
