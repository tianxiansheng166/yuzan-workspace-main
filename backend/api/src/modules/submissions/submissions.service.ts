import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
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
  toSubmissionDetailResponse,
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

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, schoolId, deletedAt: null },
      select: { targets: { select: { targetType: true, classId: true, enrollmentId: true } } },
    });
    if (!assignment) throw new SubmissionNotFoundException("作业不存在");

    const isSchoolAdmin = auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);
    const classIds = new Set<string>();
    const explicitlyTargetedEnrollmentIds = new Set<string>();
    let hasAuthorizedTarget = isSchoolAdmin;
    for (const target of assignment.targets) {
      let classId = target.classId;
      let targetEnrollmentId: string | undefined;
      if (target.targetType === "STUDENT" && target.enrollmentId) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: { id: target.enrollmentId, schoolId, role: "STUDENT", status: "ACTIVE" },
          select: { id: true, classId: true },
        });
        if (!enrollment) continue;
        targetEnrollmentId = enrollment.id;
        classId = enrollment.classId;
      }
      if (!classId) continue;
      if (!isSchoolAdmin) {
        const teacherEnrollment = await this.prisma.enrollment.findFirst({
          where: { schoolId, classId, userId: auth.principal.userId, role: "TEACHER", status: "ACTIVE" },
          select: { id: true },
        });
        if (!teacherEnrollment) continue;
      }
      hasAuthorizedTarget = true;
      if (targetEnrollmentId) explicitlyTargetedEnrollmentIds.add(targetEnrollmentId);
      if (target.targetType === "CLASS") classIds.add(classId);
    }
    if (!hasAuthorizedTarget) throw new SubmissionForbiddenException("无权访问该作业的目标班级");
    const targetEnrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
        OR: [
          ...(classIds.size ? [{ classId: { in: [...classIds] } }] : []),
          ...(explicitlyTargetedEnrollmentIds.size ? [{ id: { in: [...explicitlyTargetedEnrollmentIds] } }] : []),
        ],
      },
      select: { id: true },
    });
    const enrollmentIds = [...new Set(targetEnrollments.map((enrollment) => enrollment.id))];

    const result = await this.submissionRepo.listByAssignment(
      schoolId,
      assignmentId,
      { ...options, enrollmentIds },
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

    const isSchoolAdmin = auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);
    const isTeacher = auth.principal.roles.includes(MembershipRole.TEACHER);
    const isStudent = auth.principal.roles.includes(MembershipRole.STUDENT);
    if (isTeacher || isSchoolAdmin) {
      if (!this.policy.canReadAssignmentSubmissions(auth, schoolId)) {
        throw new SubmissionForbiddenException();
      }
    } else if (!this.policy.canReadOwnSubmissions(auth, schoolId) || !isStudent) {
      throw new SubmissionForbiddenException();
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: submission.enrollmentId,
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { id: true, classId: true, userId: true, user: { select: { displayName: true } } },
    });
    if (!enrollment) throw new SubmissionNotFoundException();

    if (isStudent && !isTeacher && !isSchoolAdmin && enrollment.userId !== auth.principal.userId) {
      throw new SubmissionNotFoundException();
    }

    if (isTeacher && !isSchoolAdmin) {
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
      if (!teacherEnrollment) throw new SubmissionNotFoundException();
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: submission.assignmentId, schoolId, deletedAt: null },
      select: { title: true },
    });
    if (!assignment) throw new SubmissionNotFoundException();

    return toSubmissionDetailResponse(submission, {
      assignmentTitle: assignment.title,
      studentName: enrollment.user.displayName,
    });
  }

  async getUploadUrls(
    auth: AuthContext,
    schoolId: string,
    submissionId: string,
  ) {
    if (!this.policy.canReadOwnSubmissions(auth, schoolId)) {
      throw new SubmissionForbiddenException();
    }

    const submission = await this.submissionRepo.findById(schoolId, submissionId);
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

    if (submission.status !== "IN_PROGRESS" && submission.status !== "PENDING_SYNC") {
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
}
