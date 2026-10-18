import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import {
  AssignmentConflictException,
  AssignmentForbiddenException,
  AssignmentNotFoundException,
  AssignmentStatusException,
} from "./domain/assignment.errors.js";
import { validateTransition } from "./domain/assignment.state-machine.js";
import type {
  AssignmentTarget,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "./domain/assignment.types.js";
import {
  toAssignmentResponse,
  toAssignmentSummaryResponse,
} from "./dto/assignment.response.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
} from "./ports/assignment-repository.port.js";
import { ASSIGNMENT_REPOSITORY } from "./ports/assignment-repository.port.js";
import { AssignmentsPolicy } from "./assignments.policy.js";

@Injectable()
export class AssignmentsService {
  private readonly policy = new AssignmentsPolicy();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepositoryPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listAssignments(
    auth: AuthContext,
    schoolId: string,
    options: ListAssignmentsOptions,
  ) {
    if (!this.policy.canReadAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const isStudent = auth.principal.roles.includes(MembershipRole.STUDENT);
    const isTeacherOrAdmin =
      auth.principal.roles.includes(MembershipRole.TEACHER) ||
      auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isStudent && !isTeacherOrAdmin) {
      // Students see assignments targeted at their enrollments
      const studentOptions: ListAssignmentsOptions = {
        ...options,
        studentUserId: auth.principal.userId,
      };
      const result = await this.assignmentRepo.list(schoolId, studentOptions);
      return {
        items: result.items.map(toAssignmentSummaryResponse),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    }

    const result = await this.assignmentRepo.list(schoolId, {
      ...options,
      ...(!auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN)
        ? { teacherUserId: auth.principal.userId }
        : {}),
    });
    return {
      items: result.items.map(toAssignmentSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canReadAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    const isStudent = auth.principal.roles.includes(MembershipRole.STUDENT);
    const isTeacherOrAdmin =
      auth.principal.roles.includes(MembershipRole.TEACHER) ||
      auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isTeacherOrAdmin) {
      const visibleTargets = await this.visibleTargets(auth, schoolId, assignment.targets);
      if (visibleTargets.length === 0) throw new AssignmentForbiddenException();
      return toAssignmentResponse({ ...assignment, targets: visibleTargets });
    }

    if (isStudent) {
      const studentAssignments = await this.assignmentRepo.list(schoolId, {
        studentUserId: auth.principal.userId,
        limit: 1000,
      });
      if (studentAssignments.items.some((s) => s.id === assignmentId)) {
        return toAssignmentResponse(assignment);
      }
    }

    throw new AssignmentNotFoundException();
  }

  async createAssignment(
    auth: AuthContext,
    schoolId: string,
    input: CreateAssignmentInput,
  ) {
    if (!this.policy.canCreateAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    await this.validatePublishInput(auth, schoolId, input);

    const assignment = await this.assignmentRepo.save(
      { ...input, schoolId },
      auth.principal.userId,
    );

    return toAssignmentResponse(assignment);
  }

  /**
   * Best-effort notification fan-out after the OPEN revision has committed.
   */
  private async createAssignmentNotifications(
    schoolId: string,
    assignmentId: string,
    input: Pick<CreateAssignmentInput, "targets">,
  ) {
    // Resolve target student userIds from targets
    const targetUserIds: string[] = [];

    for (const target of input.targets) {
      if (target.targetType === "CLASS" && target.classId) {
        // Get all students in the class
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            schoolId,
            classId: target.classId,
            role: "STUDENT",
            status: "ACTIVE",
          },
          select: { userId: true },
        });
        targetUserIds.push(...enrollments.map((e) => e.userId));
      } else if (target.targetType === "STUDENT" && target.enrollmentId) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: {
            id: target.enrollmentId,
            schoolId,
            role: "STUDENT",
            status: "ACTIVE",
          },
          select: { userId: true },
        });
        if (enrollment) targetUserIds.push(enrollment.userId);
      }
    }

    // Deduplicate
    const uniqueUserIds = [...new Set(targetUserIds)];

    // Batch create notifications
    if (uniqueUserIds.length > 0) {
      await this.prisma.notification.createMany({
        data: uniqueUserIds.map((userId) => ({
          schoolId,
          recipientUserId: userId,
          type: "TASK_DEADLINE",
          priority: "NORMAL",
          title: "新任务已发布",
          body: `您有一项新的学习任务，请及时完成`,
          actionUrl: `/student/today/?assignmentId=${assignmentId}`,
        })),
      });
    }
  }

  private assertRevision(actual: number, expected: number) {
    if (actual !== expected) throw new AssignmentConflictException();
  }

  private async validatePublishInput(
    auth: AuthContext,
    schoolId: string,
    input: Pick<
      CreateAssignmentInput,
      "courseVersionId" | "startsAt" | "dueAt" | "targets"
    >,
  ) {
    if (
      !Number.isFinite(input.startsAt.getTime()) ||
      !Number.isFinite(input.dueAt.getTime()) ||
      input.startsAt >= input.dueAt ||
      input.dueAt <= new Date()
    ) {
      throw new BadRequestException({
        code: "ASSIGNMENT_TIME_INVALID",
        message: "开始时间必须早于截止时间，截止时间必须在未来",
      });
    }
    const course = await this.prisma.courseVersion.findFirst({
      where: { id: input.courseVersionId, schoolId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!course) throw new AssignmentNotFoundException("已发布课程版本不存在");
    await this.validateTargets(auth, schoolId, input.targets);
  }

  private async validateTargets(
    auth: AuthContext,
    schoolId: string,
    targets: CreateAssignmentInput["targets"],
  ) {
    if (!targets.length)
      throw new BadRequestException({
        code: "ASSIGNMENT_TARGET_INVALID",
        message: "至少选择一个目标",
      });
    for (const target of targets) {
      let classId = target.classId;
      if (target.targetType === "CLASS" && classId && !target.enrollmentId) {
        if (
          !(await this.prisma.class.findFirst({
            where: { id: classId, schoolId },
            select: { id: true },
          }))
        )
          throw new AssignmentNotFoundException("班级不存在");
      } else if (
        target.targetType === "STUDENT" &&
        target.enrollmentId &&
        !classId
      ) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: {
            id: target.enrollmentId,
            schoolId,
            role: "STUDENT",
            status: "ACTIVE",
          },
          select: { classId: true },
        });
        if (!enrollment) throw new AssignmentNotFoundException("学生不存在");
        classId = enrollment.classId;
      } else
        throw new BadRequestException({
          code: "ASSIGNMENT_TARGET_INVALID",
          message: "目标类型与标识不匹配",
        });
      if (
        !auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN) &&
        !(await this.prisma.enrollment.findFirst({
          where: {
            schoolId,
            classId,
            userId: auth.principal.userId,
            role: "TEACHER",
            status: "ACTIVE",
          },
          select: { id: true },
        }))
      )
        throw new AssignmentForbiddenException("无权操作目标班级");
    }
  }

  async updateAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
    expectedRevision: number,
  ) {
    if (!this.policy.canUpdateAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validatePublishInput(auth, schoolId, { ...existing, ...data });
    this.assertRevision(existing.revision, expectedRevision);

    if (existing.status !== "DRAFT") {
      throw new AssignmentStatusException("只能修改草稿状态的作业");
    }

    const updated = await this.assignmentRepo.update(
      schoolId,
      assignmentId,
      data,
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async scheduleAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validatePublishInput(auth, schoolId, existing);
    this.assertRevision(existing.revision, expectedRevision);
    validateTransition(existing.status, "SCHEDULED");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "SCHEDULED",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async openAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validatePublishInput(auth, schoolId, existing);
    this.assertRevision(existing.revision, expectedRevision);
    validateTransition(existing.status, "OPEN");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "OPEN",
      expectedRevision,
    );
    await this.createAssignmentNotifications(
      schoolId,
      assignmentId,
      updated,
    ).catch(() => {});
    return toAssignmentResponse(updated);
  }

  async closeAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validateTargets(auth, schoolId, existing.targets);
    this.assertRevision(existing.revision, expectedRevision);
    validateTransition(existing.status, "CLOSED");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "CLOSED",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async cancelAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validateTargets(auth, schoolId, existing.targets);
    this.assertRevision(existing.revision, expectedRevision);
    validateTransition(existing.status, "CANCELLED");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "CANCELLED",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async deleteAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canDeleteAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.validateTargets(auth, schoolId, existing.targets);
    await this.assignmentRepo.softDelete(schoolId, assignmentId);
  }

  /**
   * Get submission statistics for an assignment.
   * Returns total target students, submitted count, and reviewed count.
   */
  async getAssignmentStats(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canReadAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    const targets = await this.visibleTargets(auth, schoolId, assignment.targets);
    if (targets.length === 0) throw new AssignmentForbiddenException();

    // Count target students from assignment targets
    const targetClassIds = [...new Set(targets
      .filter((t) => t.targetType === "CLASS" && t.classId)
      .map((t) => t.classId!))];

    const explicitlyTargetedEnrollmentIds = [...new Set(targets
      .filter((t) => t.targetType === "STUDENT" && t.enrollmentId)
      .map((t) => t.enrollmentId!))];

    const targetEnrollmentRows = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
        OR: [
          ...(targetClassIds.length ? [{ classId: { in: targetClassIds } }] : []),
          ...(explicitlyTargetedEnrollmentIds.length ? [{ id: { in: explicitlyTargetedEnrollmentIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const targetEnrollmentIds = [...new Set(targetEnrollmentRows.map((row) => row.id))];
    const totalStudents = targetEnrollmentIds.length;

    const latestSubmissionByEnrollment = new Map<string, string>();
    if (targetEnrollmentIds.length > 0) {
      const submissions = await this.prisma.submission.findMany({
        where: {
          schoolId,
          assignmentId,
          enrollmentId: { in: targetEnrollmentIds },
          deletedAt: null,
        },
        select: { enrollmentId: true, status: true },
        orderBy: [{ enrollmentId: "asc" }, { attemptNo: "desc" }],
      });
      for (const submission of submissions) {
        if (!latestSubmissionByEnrollment.has(submission.enrollmentId)) {
          latestSubmissionByEnrollment.set(submission.enrollmentId, submission.status);
        }
      }
    }
    const submittedStatuses = new Set([
      "SUBMITTED", "PROCESSING", "NEEDS_REVIEW", "REVIEWED", "RETURNED", "ACCEPTED",
    ]);
    const reviewedStatuses = new Set(["REVIEWED", "ACCEPTED"]);
    const submittedCount = [...latestSubmissionByEnrollment.values()].filter((status) => submittedStatuses.has(status)).length;
    const reviewedCount = [...latestSubmissionByEnrollment.values()].filter((status) => reviewedStatuses.has(status)).length;
    const needsReviewCount = [...latestSubmissionByEnrollment.values()].filter((status) => status === "NEEDS_REVIEW").length;

    const notSubmittedCount = Math.max(0, totalStudents - submittedCount);

    return {
      assignmentId,
      totalStudents,
      submittedCount,
      notSubmittedCount,
      reviewedCount,
      needsReviewCount,
      submissionRate:
        totalStudents > 0
          ? Math.round((submittedCount / totalStudents) * 100)
          : 0,
    };
  }

  private async visibleTargets(
    auth: AuthContext,
    schoolId: string,
    targets: readonly AssignmentTarget[],
  ): Promise<readonly AssignmentTarget[]> {
    if (auth.principal.roles.some((role) => [MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role))) {
      return targets;
    }
    const teacherClasses = await this.prisma.enrollment.findMany({
      where: { schoolId, userId: auth.principal.userId, role: "TEACHER", status: "ACTIVE" },
      select: { classId: true },
    });
    const authorizedClassIds = new Set(teacherClasses.map((enrollment) => enrollment.classId));
    const individualEnrollmentIds = targets
      .filter((target) => target.targetType === "STUDENT" && target.enrollmentId)
      .map((target) => target.enrollmentId!);
    const individualEnrollments = individualEnrollmentIds.length
      ? await this.prisma.enrollment.findMany({
          where: { schoolId, id: { in: individualEnrollmentIds }, role: "STUDENT", status: "ACTIVE" },
          select: { id: true, classId: true },
        })
      : [];
    const individualClassByEnrollment = new Map(individualEnrollments.map((enrollment) => [enrollment.id, enrollment.classId]));
    return targets.filter((target) => {
      if (target.targetType === "CLASS") return Boolean(target.classId && authorizedClassIds.has(target.classId));
      const classId = target.enrollmentId ? individualClassByEnrollment.get(target.enrollmentId) : undefined;
      return Boolean(classId && authorizedClassIds.has(classId));
    });
  }
}
