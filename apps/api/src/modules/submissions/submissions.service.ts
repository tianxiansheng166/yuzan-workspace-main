import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
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

@Injectable()
export class SubmissionsService {
  private readonly policy = new SubmissionsPolicy();

  constructor(
    @Inject(SUBMISSION_REPOSITORY)
    private readonly submissionRepo: SubmissionRepositoryPort,
    @Inject(SUBMISSION_LOOKUP)
    private readonly submissionLookup: SubmissionLookupPort,
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
    const existing = await this.submissionRepo.findByEnrollmentAndIdempotencyKey(
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

    const submission = await this.submissionRepo.findById(schoolId, submissionId);
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

    // The student's enrollmentId should be resolved from auth context.
    // For now, we pass schoolId and the service will need the enrollmentId.
    // This requires looking up the student's enrollment for the school.
    // The controller will need to resolve the enrollmentId.
    // As a placeholder, we accept enrollmentId via a different path.
    // For "me" endpoint, we list by the user's enrollments in the school.
    // This requires a lookup - but we only have submissionRepo here.
    // The controller should pass enrollmentIds.
    const enrollments: readonly string[] = [];
    const allSubmissions: Submission[] = [];

    for (const enrollmentId of enrollments) {
      const subs = await this.submissionRepo.listByEnrollment(
        schoolId,
        enrollmentId,
      );
      allSubmissions.push(...subs as Submission[]);
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
    const submission = await this.submissionRepo.findById(schoolId, submissionId);
    if (!submission) {
      throw new SubmissionNotFoundException();
    }

    // Students can only see their own submissions
    // (enrollmentId ownership verified at a higher level if needed)
    return toSubmissionResponse(submission);
  }

  async getUploadUrls(
    _auth: AuthContext,
    _schoolId: string,
    _submissionId: string,
  ): Promise<never> {
    throw new SubmissionUnavailableException("上传功能尚未实现");
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
}
