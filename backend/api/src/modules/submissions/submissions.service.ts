import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../common/security/index.js";
import {
  SubmissionConflictException,
  SubmissionForbiddenException,
  SubmissionNotFoundException,
  SubmissionStatusException,
  SubmissionUnavailableException,
} from "./domain/submission.errors.js";
import { canTransition } from "./domain/submission.state-machine.js";
import type {
  CreateSubmissionInput,
  Submission,
  SubmissionStatus,
} from "./domain/submission.types.js";
import {
  toSubmissionResponse,
  toSubmissionSummaryResponse,
} from "./dto/submission.response.js";
import type {
  ListSubmissionsOptions,
  PaginatedResult,
  SubmissionRepositoryPort,
} from "./ports/submission-repository.port.js";
import { SUBMISSION_REPOSITORY } from "./ports/submission-repository.port.js";
import type { SubmissionLookupPort } from "./ports/submission-lookup.port.js";
import { SUBMISSION_LOOKUP } from "./ports/submission-lookup.port.js";
import { SubmissionsPolicy } from "./submissions.policy.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { StoragePort } from "../../shared/storage/storage.port.js";
import { STORAGE_PORT } from "../../shared/storage/storage.port.js";

@Injectable()
export class SubmissionsService {
  private readonly policy = new SubmissionsPolicy();

  constructor(
    @Inject(SUBMISSION_REPOSITORY)
    private readonly submissionRepo: SubmissionRepositoryPort,
    @Inject(SUBMISSION_LOOKUP)
    private readonly submissionLookup: SubmissionLookupPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async createSubmission(
    auth: AuthContext,
    schoolId: string,
    input: CreateSubmissionInput,
  ) {
    if (!this.policy.canCreateSubmission(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    // Idempotent: if a submission with this idempotencyKey already exists,
    // return the existing one.
    const existing =
      await this.submissionRepo.findByEnrollmentAndIdempotencyKey(
        input.enrollmentId,
        input.idempotencyKey,
      );
    if (existing) {
      return toSubmissionResponse(existing);
    }

    const submission = await this.submissionRepo.save({
      ...input,
      schoolId,
    });
    return toSubmissionResponse(submission);
  }

  async submitSubmission(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canSubmit(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const submission = await this.submissionRepo.findById(
      schoolId,
      submissionId,
    );
    if (!submission) {
      throw new SubmissionNotFoundException();
    }

    // Students can only submit their own submissions
    // (enrollmentId check would be done at a higher level if needed)

    if (!canTransition(submission.status, "SUBMITTED")) {
      throw new SubmissionStatusException(
        `当前状态 ${submission.status} 不允许提交`,
      );
    }

    const updated = await this.submissionRepo.updateStatus(
      schoolId,
      submissionId,
      "SUBMITTED",
      expectedRevision,
    );
    return toSubmissionResponse(updated);
  }

  async listMySubmissions(auth: AuthContext, schoolId: string) {
    if (!this.policy.canReadOwnSubmissions(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    // Resolve the student's active enrollments in this school
    const enrollmentRows = await this.prisma.enrollment.findMany({
      where: {
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
      select: { id: true },
    });
    const enrollments = enrollmentRows.map((e) => e.id);

    const allSubmissions: Submission[] = [];

    for (const enrollmentId of enrollments) {
      const subs = await this.submissionRepo.listByEnrollment(
        schoolId,
        enrollmentId,
      );
      allSubmissions.push(...(subs as Submission[]));
    }

    return allSubmissions.map(toSubmissionSummaryResponse);
  }

  async listMySubmissionsByEnrollment(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
  ) {
    if (!this.policy.canReadOwnSubmissions(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const submissions = await this.submissionRepo.listByEnrollment(
      schoolId,
      enrollmentId,
    );
    return submissions.map(toSubmissionSummaryResponse);
  }

  async listAssignmentSubmissions(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    options: ListSubmissionsOptions,
  ) {
    if (!this.policy.canReadAssignmentSubmissions(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const result = await this.submissionRepo.listByAssignment(
      schoolId,
      assignmentId,
      options,
    );
    return {
      items: result.items.map(toSubmissionSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getSubmission(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
  ) {
    if (!this.policy.canReadSubmission(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const submission = await this.submissionRepo.findById(
      schoolId,
      submissionId,
    );
    if (!submission) {
      throw new SubmissionNotFoundException();
    }

    await this.assertSubmissionAccess(auth, schoolId, submission.enrollmentId);

    const [attempts, practiceSessions, directRecordings, latestFeedback] =
      await Promise.all([
        this.prisma.activityAttempt.findMany({
          where: { schoolId, submissionId },
          orderBy: { createdAt: "asc" },
          select: { value: true },
        }),
        this.prisma.assessmentSession.findMany({
          where: { schoolId, courseSubmissionId: submissionId },
          orderBy: { createdAt: "asc" },
          select: {
            items: {
              orderBy: { sortOrder: "asc" },
              select: {
                writtenAnswer: {
                  select: { content: true, finalSubmittedAt: true },
                },
                recording: {
                  select: {
                    id: true,
                    status: true,
                    objectKey: true,
                    durationMs: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.recording.findMany({
          where: {
            schoolId,
            submissionId,
            status: { in: ["COMPLETE", "PROCESSING", "READY"] },
            objectKey: { not: null },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            objectKey: true,
            durationMs: true,
          },
        }),
        this.prisma.feedback.findFirst({
          where: { schoolId, submissionId, deletedAt: null },
          orderBy: { releasedAt: "desc" },
          select: {
            id: true,
            decision: true,
            comment: true,
            score: true,
            revision: true,
            releasedAt: true,
          },
        }),
      ]);

    const writtenAnswer =
      attempts
        .map((attempt) => extractWrittenText(attempt.value))
        .find(Boolean) ??
      practiceSessions
        .flatMap((session) => session.items)
        .map((item) =>
          item.writtenAnswer?.finalSubmittedAt
            ? extractWrittenText(item.writtenAnswer.content)
            : undefined,
        )
        .find(Boolean);

    const practiceRecordings = practiceSessions
      .flatMap((session) => session.items)
      .flatMap((item) => (item.recording ? [item.recording] : []));
    const recording = [...directRecordings, ...practiceRecordings].find(
      (item) =>
        item.objectKey &&
        ["COMPLETE", "PROCESSING", "READY"].includes(item.status),
    );
    const download = recording?.objectKey
      ? await this.storage.generateDownloadUrl(recording.objectKey)
      : null;

    return {
      ...toSubmissionResponse(submission),
      ...(writtenAnswer ? { writtenAnswer } : {}),
      ...(recording && download
        ? {
            recordingId: recording.id,
            recordingUrl: download.url,
            ...(recording.durationMs != null
              ? { recordingDuration: Math.round(recording.durationMs / 1000) }
              : {}),
          }
        : {}),
      ...(latestFeedback
        ? {
            feedback: {
              id: latestFeedback.id,
              submissionId,
              decision: latestFeedback.decision,
              comment: latestFeedback.comment,
              ...(latestFeedback.score != null
                ? { score: latestFeedback.score }
                : {}),
              revision: latestFeedback.revision,
              releasedAt: latestFeedback.releasedAt.toISOString(),
            },
          }
        : {}),
    };
  }

  async getUploadUrls(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
  ) {
    if (!this.policy.canReadOwnSubmissions(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const submission = await this.submissionRepo.findById(
      schoolId,
      submissionId,
    );
    if (!submission) {
      throw new SubmissionNotFoundException();
    }

    // Verify the submission belongs to the current student
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: submission.enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
    });

    if (!enrollment) {
      throw new SubmissionForbiddenException();
    }

    if (
      submission.status !== "IN_PROGRESS" &&
      submission.status !== "PENDING_SYNC"
    ) {
      throw new SubmissionStatusException("当前状态不允许上传");
    }

    // Use STORAGE_PORT to generate presigned upload URLs
    const objectKey = `submissions/${submissionId}/${crypto.randomUUID()}`;
    const urls = await this.storage.generateUploadUrl(objectKey, "audio/webm");

    return {
      submissionId,
      uploadUrl: urls.url,
      objectKey: urls.objectKey,
      expiresInSeconds: urls.expiresInSeconds,
    };
  }

  async transitionSubmissionStatus(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
    to: SubmissionStatus,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const summary = await this.submissionLookup.transitionStatus(
      schoolId,
      submissionId,
      to,
      expectedRevision,
    );
    return toSubmissionSummaryResponse(summary);
  }

  private async assertSubmissionAccess(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
  ): Promise<void> {
    if (
      hasRole(auth, MembershipRole.SCHOOL_ADMIN) ||
      hasRole(auth, MembershipRole.PLATFORM_ADMIN)
    ) {
      return;
    }

    const ownerEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { userId: true, classId: true },
    });
    if (!ownerEnrollment) {
      throw new SubmissionForbiddenException();
    }

    if (
      hasRole(auth, MembershipRole.STUDENT) &&
      ownerEnrollment.userId === auth.principal.userId
    ) {
      return;
    }

    if (hasRole(auth, MembershipRole.TEACHER)) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          schoolId,
          classId: ownerEnrollment.classId,
          userId: auth.principal.userId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (teacherEnrollment) {
        return;
      }
    }

    throw new SubmissionForbiddenException();
  }
}

function extractWrittenText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    return text || undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["answer", "text", "content", "value"]) {
    if (typeof record[key] === "string") {
      const text = record[key].trim();
      if (text) {
        return text;
      }
    }
  }
  return undefined;
}
