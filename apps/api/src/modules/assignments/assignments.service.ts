import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import {
  AssignmentForbiddenException,
  AssignmentNotFoundException,
  AssignmentStatusException,
} from "./domain/assignment.errors.js";
import { validateTransition } from "./domain/assignment.state-machine.js";
import type {
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

    const result = await this.assignmentRepo.list(schoolId, options);
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
      return toAssignmentResponse(assignment);
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

    const assignment = await this.assignmentRepo.save(
      { ...input, schoolId },
      auth.principal.userId,
    );

    // Create notifications for target students
    this.createAssignmentNotifications(schoolId, assignment.id, input).catch(() => {
      // Non-blocking: notification creation failure should not block assignment creation
    });

    return toAssignmentResponse(assignment);
  }

  /**
   * Fire-and-forget: create notifications for students targeted by this assignment.
   */
  private async createAssignmentNotifications(
    schoolId: string,
    assignmentId: string,
    input: CreateAssignmentInput,
  ) {
    // Resolve target student userIds from targets
    const targetUserIds: string[] = [];

    for (const target of input.targets) {
      if (target.targetType === "CLASS" && target.classId) {
        // Get all students in the class
        const enrollments = await this.prisma.enrollment.findMany({
          where: { schoolId, classId: target.classId, role: "STUDENT", status: "ACTIVE" },
          select: { userId: true },
        });
        targetUserIds.push(...enrollments.map((e) => e.userId));
      } else if (target.targetType === "STUDENT" && target.enrollmentId) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: { id: target.enrollmentId, schoolId, status: "ACTIVE" },
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
          actionUrl: `/student/today`,
        })),
      });
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

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

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

  async openAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    validateTransition(existing.status, "OPEN");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "OPEN",
      expectedRevision,
    );
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

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

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

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

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

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

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

    const assignment = await this.assignmentRepo.findById(schoolId, assignmentId);
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    // Count target students from assignment targets
    const targets = (assignment as unknown as Record<string, unknown>).targets as Array<{ targetType: string; classId?: string | null; enrollmentId?: string | null }> | undefined;
    const targetClassIds = (targets ?? [])
      .filter((t) => t.targetType === "CLASS" && t.classId)
      .map((t) => t.classId!);

    const targetEnrollmentIds = (targets ?? [])
      .filter((t) => t.targetType === "STUDENT" && t.enrollmentId)
      .map((t) => t.enrollmentId!);

    // Count total target students
    let totalStudents = 0;
    if (targetClassIds.length > 0) {
      const classStudentCount = await this.prisma.enrollment.count({
        where: {
          schoolId,
          classId: { in: targetClassIds },
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
      totalStudents += classStudentCount;
    }
    totalStudents += targetEnrollmentIds.length;

    // Count submissions by status
    const [
      submittedCount,
      reviewedCount,
      needsReviewCount,
    ] = await Promise.all([
      this.prisma.submission.count({
        where: {
          schoolId,
          assignmentId,
          status: { in: ["SUBMITTED", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"] },
          deletedAt: null,
        },
      }),
      this.prisma.submission.count({
        where: {
          schoolId,
          assignmentId,
          status: { in: ["REVIEWED", "ACCEPTED"] },
          deletedAt: null,
        },
      }),
      this.prisma.submission.count({
        where: {
          schoolId,
          assignmentId,
          status: "NEEDS_REVIEW",
          deletedAt: null,
        },
      }),
    ]);

    const notSubmittedCount = Math.max(0, totalStudents - submittedCount);

    return {
      assignmentId,
      totalStudents,
      submittedCount,
      notSubmittedCount,
      reviewedCount,
      needsReviewCount,
      submissionRate: totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0,
    };
  }
}
