import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { Prisma } from "@yuzan/database";
import {
  ClassConflictException,
  ClassForbiddenException,
  ClassNotFoundException,
} from "./domain/class.errors.js";
import {
  AssessmentHasNoItemsException,
  PracticeContentEmptyException,
} from "../assessment/domain/assessment.errors.js";
import type {
  ClassEnrollment,
  CreateClassInput,
  UpdateClassInput,
} from "./domain/class.types.js";
import type { ClassDetail, ClassGrowthStage, PronunciationClusterItem, ClassPendingStats, ClassDashboard, StudentSummary, AssignmentSummary, AssessmentSummary } from "./domain/class-detail.types.js";
import {
  toClassMemberResponse,
  toClassResponse,
  toClassSummaryResponse,
} from "./dto/class.response.js";
import { toClassDetailResponse } from "./dto/class-detail.response.js";
import { toEnrollmentResponse } from "./dto/enrollment.response.js";
import type {
  ClassRepositoryPort,
  ListClassesOptions,
} from "./ports/class-repository.port.js";
import { CLASS_REPOSITORY } from "./ports/class-repository.port.js";
import { ClassesPolicy } from "./classes.policy.js";
import { AssessmentService } from "../assessment/assessment.service.js";

@Injectable()
export class ClassesService {
  private readonly policy = new ClassesPolicy();

  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: ClassRepositoryPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AssessmentService)
    private readonly assessmentService: AssessmentService,
  ) {}

  async listClasses(
    auth: AuthContext,
    schoolId: string,
    options: ListClassesOptions,
  ) {
    if (!this.policy.canReadClassList(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const listOptions: ListClassesOptions = {
      limit: options.limit,
      ...(options.cursor ? { cursor: options.cursor } : {}),
      ...(auth.principal.roles.includes(MembershipRole.STUDENT)
        ? { studentUserId: auth.principal.userId }
        : {}),
      ...(auth.principal.roles.includes(MembershipRole.TEACHER) &&
      !auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN)
        ? { teacherUserId: auth.principal.userId }
        : {}),
    };

    const result = await this.classRepo.list(schoolId, listOptions);
    return {
      items: result.items.map(toClassSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getClass(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canReadClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    const isSchoolAdmin = auth.principal.roles.includes(
      MembershipRole.SCHOOL_ADMIN,
    );
    const isResponsibleTeacher =
      auth.principal.roles.includes(MembershipRole.TEACHER) &&
      classItem.teacherUserIds.includes(auth.principal.userId);
    const isEnrolledStudent =
      auth.principal.roles.includes(MembershipRole.STUDENT) &&
      !auth.principal.roles.includes(MembershipRole.TEACHER) &&
      !auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isSchoolAdmin || isResponsibleTeacher) {
      return toClassResponse(classItem);
    }

    if (isEnrolledStudent) {
      const enrollments = await this.classRepo.listEnrollmentsByUser(
        schoolId,
        auth.principal.userId,
      );
      if (
        enrollments.some(
          (e) =>
            e.classId === classId && e.roleInClass === MembershipRole.STUDENT,
        )
      ) {
        return toClassResponse(classItem);
      }
    }

    throw new ClassNotFoundException();
  }

  async listClassMembers(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.findVisibleClassById({
      schoolId,
      classId,
      actor: {
        userId: auth.principal.userId,
        roles: auth.principal.roles,
      },
    });
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    const members = await this.classRepo.listMembers(schoolId, classId);
    return members.map(toClassMemberResponse);
  }

  async listMyClasses(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) {
      throw new ClassForbiddenException();
    }

    const options: ListClassesOptions = {
      limit: 100,
      ...(auth.principal.roles.includes(MembershipRole.STUDENT)
        ? { studentUserId: auth.principal.userId }
        : {}),
      ...(auth.principal.roles.includes(MembershipRole.TEACHER)
        ? { teacherUserId: auth.principal.userId }
        : {}),
    };

    const result = await this.classRepo.list(schoolId, options);
    return result.items.map(toClassSummaryResponse);
  }

  async createClass(auth: AuthContext, schoolId: string, input: CreateClassInput) {
    if (!this.policy.canCreateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.save({
      ...input,
      schoolId,
    });
    return toClassResponse(classItem);
  }

  async updateClass(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    data: UpdateClassInput,
    expectedUpdatedAt: Date,
  ) {
    if (!this.policy.canUpdateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const updated = await this.classRepo.update(
      schoolId,
      classId,
      data,
      expectedUpdatedAt,
    );
    return toClassResponse(updated);
  }

  async deleteClass(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canDeleteClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    await this.classRepo.softDelete(schoolId, classId);
  }

  async addEnrollment(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    userId: string,
    role: MembershipRole,
  ) {
    if (!this.policy.canManageEnrollment(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const enrollment = await this.classRepo.addEnrollment(
      schoolId,
      classId,
      userId,
      role,
    );
    return toEnrollmentResponse(enrollment);
  }

  async removeEnrollment(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    enrollmentId: string,
  ) {
    if (!this.policy.canManageEnrollment(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    await this.classRepo.removeEnrollment(schoolId, classId, enrollmentId);
  }

  /**
   * Batch import students into a class.
   * For each student item:
   * - If a user with matching phone exists, reuse them
   * - Otherwise create a new user
   * - Then create an enrollment if not already enrolled
   */
  async importStudents(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    students: { name: string; phone?: string; externalId?: string }[],
  ) {
    if (!this.policy.canManageEnrollment(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    // Verify class exists
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    const results: { name: string; status: "created" | "skipped" | "error"; enrollmentId?: string; error?: string }[] = [];

    // Get existing enrollments for this class to check for duplicates
    const existingEnrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingEnrollments.map((e) => e.userId));

    for (const student of students) {
      try {
        // Try to find existing user by phone or name
        let userId: string | null = null;

        if (student.phone) {
          const existingUser = await this.prisma.user.findFirst({
            where: { loginIdentifier: student.phone },
            select: { id: true },
          });
          if (existingUser) {
            userId = existingUser.id;
          }
        }

        // If not found by phone, check if user with same name in this school exists
        if (!userId) {
          const schoolMembership = await this.prisma.membership.findFirst({
            where: {
              schoolId,
              user: { displayName: student.name },
              role: "STUDENT",
            },
            select: { userId: true },
          });
          if (schoolMembership) {
            userId = schoolMembership.userId;
          }
        }

        // If still not found, create a new user
        if (!userId) {
          const newUser = await this.prisma.user.create({
            data: {
              loginIdentifier: student.phone ?? `student-${schoolId}-${randomUUID()}`,
              passwordHash: `pending-invite-${randomUUID()}`,
              displayName: student.name,
            },
          });
          userId = newUser.id;

          // Create membership for the school
          await this.prisma.membership.create({
            data: {
              userId,
              schoolId,
              role: "STUDENT",
              status: "ACTIVE",
            },
          });
        } else {
          // Check if user has membership in this school
          const existingMembership = await this.prisma.membership.findFirst({
            where: { userId, schoolId },
          });
          if (!existingMembership) {
            await this.prisma.membership.create({
              data: {
                userId,
                schoolId,
                role: "STUDENT",
                status: "ACTIVE",
              },
            });
          }
        }

        // Check if already enrolled in this class
        if (existingUserIds.has(userId)) {
          results.push({ name: student.name, status: "skipped" });
          continue;
        }

        // Create enrollment
        const enrollment = await this.prisma.enrollment.create({
          data: {
            schoolId,
            classId,
            userId,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });

        existingUserIds.add(userId);
        results.push({ name: student.name, status: "created", enrollmentId: enrollment.id });
      } catch (error) {
        results.push({
          name: student.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        actorUserId: auth.principal.userId,
        schoolId,
        action: "STUDENTS_IMPORTED",
        resourceType: "Class",
        resourceId: classId,
        requestId: `import-${Date.now()}`,
        afterSummary: {
          totalAttempted: students.length,
          created: results.filter((r) => r.status === "created").length,
          skipped: results.filter((r) => r.status === "skipped").length,
          errors: results.filter((r) => r.status === "error").length,
        } as object,
      },
    });

    return {
      totalAttempted: students.length,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    };
  }

  async listEnrollments(
    auth: AuthContext,
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassEnrollment[]> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const enrollments = await this.classRepo.listEnrollmentsByClass(
      schoolId,
      classId,
    );
    return enrollments;
  }

  async getClassDetail(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    // Verify class exists and user has access
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    // Parallel data aggregation
    const [
      enrollments,
      assignments,
      pendingSubmissions,
      activityProgressRows,
      speechJobs,
    ] = await Promise.all([
      // Students in class
      this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
        select: { id: true, userId: true },
      }),
      // Assignments for this class
      this.prisma.assignment.findMany({
        where: {
          schoolId,
          targets: { some: { classId } },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          courseVersionId: true,
          courseVersion: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Pending review submissions
      this.prisma.submission.count({
        where: {
          schoolId,
          status: { in: ["SUBMITTED", "NEEDS_REVIEW"] },
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          deletedAt: null,
        },
      }),
      // Activity progress for class students
      this.prisma.activityProgress.findMany({
        where: {
          schoolId,
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
        },
        select: { enrollmentId: true, completed: true },
      }),
      // Speech jobs for pronunciation analysis (include enrollmentId for proper dedup)
      this.prisma.speechJob.findMany({
        where: {
          status: { in: ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"] },
          result: { not: Prisma.AnyNull },
          submission: {
            schoolId,
            enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          },
        },
        select: { result: true, submission: { select: { enrollmentId: true } } },
      }),
    ]);

    const studentCount = enrollments.length;
    const currentCourse = assignments.length > 0 && assignments[0]?.courseVersion
      ? { id: assignments[0].courseVersion!.id, title: assignments[0].courseVersion!.title }
      : null;

    // Calculate overall progress
    const enrollmentIds = new Set(enrollments.map((e) => e.id));
    const relevantProgress = activityProgressRows.filter((p) => enrollmentIds.has(p.enrollmentId));
    const totalProgress = relevantProgress.length;
    const completedProgress = relevantProgress.filter((p) => p.completed).length;
    const overallProgress = totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0;

    // Build 4 growth stages
    const submittedEnrollmentIds = new Set(
      await this.prisma.submission.findMany({
        where: {
          schoolId,
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          status: { in: ["SUBMITTED", "REVIEWED", "ACCEPTED"] },
          deletedAt: null,
        },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );

    const hasRecordingEnrollmentIds = new Set(
      await this.prisma.recording.findMany({
        where: {
          schoolId,
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          status: { in: ["COMPLETE", "READY"] },
        },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );

    const hasAssessmentEnrollmentIds = new Set(
      await this.prisma.assessmentSession.findMany({
        where: {
          schoolId,
          classId,
          status: "COMPLETED",
        },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );

    const stages: ClassGrowthStage[] = [
      {
        id: "course-learning",
        title: "课程学习",
        completionRate: overallProgress,
        participantCount: relevantProgress.length > 0 ? new Set(relevantProgress.map((p) => p.enrollmentId)).size : 0,
        totalCount: studentCount,
      },
      {
        id: "practice",
        title: "课后练习",
        completionRate: studentCount > 0 ? Math.round((submittedEnrollmentIds.size / studentCount) * 100) : 0,
        participantCount: submittedEnrollmentIds.size,
        totalCount: studentCount,
      },
      {
        id: "assessment",
        title: "阶段测评",
        completionRate: studentCount > 0 ? Math.round((hasAssessmentEnrollmentIds.size / studentCount) * 100) : 0,
        participantCount: hasAssessmentEnrollmentIds.size,
        totalCount: studentCount,
      },
      {
        id: "review",
        title: "复习巩固",
        completionRate: studentCount > 0 ? Math.round((hasRecordingEnrollmentIds.size / studentCount) * 100) : 0,
        participantCount: hasRecordingEnrollmentIds.size,
        totalCount: studentCount,
      },
    ];

    // Pronunciation clusters
    const ERROR_TYPE_LABEL_MAP: Record<string, string> = {
      nasal_confusion: "前后鼻音混淆",
      retroflex: "平翘舌音混淆",
      tone: "声调起伏不足",
      pause: "多音节停顿不当",
      retroflex_curled: "卷舌音不到位",
      vowel: "元音发音不准",
      aspiration: "送气音混淆",
    };

    // Section IX: Deduplicate pronunciation errors by enrollmentId
    // errorCounts maps error type → { affectedEnrollmentIds, occurrenceCount }
    const errorCounts = new Map<string, { enrollmentIds: Set<string>; occurrences: number }>();
    for (const job of speechJobs) {
      const result = job.result as Record<string, unknown> | null;
      if (!result) continue;
      const errors = (result as { pronunciationErrors?: { type: string }[] }).pronunciationErrors ?? [];
      const enrollmentId = (job as { submission?: { enrollmentId?: string } }).submission?.enrollmentId ?? '';
      for (const err of errors) {
        if (!errorCounts.has(err.type)) {
          errorCounts.set(err.type, { enrollmentIds: new Set<string>(), occurrences: 0 });
        }
        const entry = errorCounts.get(err.type)!;
        entry.occurrences += 1;
        if (enrollmentId) entry.enrollmentIds.add(enrollmentId);
      }
    }

    const pronunciationClusters: PronunciationClusterItem[] = Array.from(errorCounts.entries())
      .map(([type, entry]) => ({
        type,
        label: ERROR_TYPE_LABEL_MAP[type] ?? type,
        affectedCount: entry.enrollmentIds.size, // affected STUDENT count, not occurrence count
        percentage: enrollments.length > 0 ? Math.round((entry.enrollmentIds.size / enrollments.length) * 100) : 0,
      }))
      .sort((a, b) => b.affectedCount - a.affectedCount)
      .slice(0, 5);

    const detail: ClassDetail = {
      classId,
      className: classItem.name,
      grade: classItem.grade,
      termName: "", // Class doesn't directly have term name
      studentCount,
      currentCourse,
      overallProgress,
      pendingReviewCount: pendingSubmissions,
      stages,
      pronunciationClusters,
    };

    return toClassDetailResponse(detail);
  }

  async getClassPendingStats(auth: AuthContext, schoolId: string, classId: string): Promise<ClassPendingStats> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    // Verify class exists
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    // Parallel queries for 4 stats
    const [
      pendingReviewCount,
      openAssignments,
      activeEnrollments,
      pendingAssessmentsCount,
    ] = await Promise.all([
      // Pending review submissions from class students
      this.prisma.submission.count({
        where: {
          schoolId,
          status: { in: ["SUBMITTED", "NEEDS_REVIEW"] },
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          deletedAt: null,
        },
      }),
      // Open assignments targeting this class
      this.prisma.assignment.findMany({
        where: {
          schoolId,
          targets: { some: { classId } },
          status: "OPEN",
          deletedAt: null,
        },
        select: { id: true },
      }),
      // Active student enrollments
      this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
        select: { id: true, userId: true },
      }),
      // Pending assessment sessions for this class
      this.prisma.assessmentSession.count({
        where: { schoolId, classId, status: { in: ["CREATED", "IN_PROGRESS"] } },
      }),
    ]);

    // Count at-risk students: students with no activity progress in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const enrollmentIds = activeEnrollments.map((e) => e.id);

    let atRiskStudentCount = 0;
    if (enrollmentIds.length > 0) {
      const activeEnrollmentIds = await this.prisma.activityProgress.findMany({
        where: {
          schoolId,
          enrollmentId: { in: enrollmentIds },
          updatedAt: { gte: sevenDaysAgo },
        },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      });
      const activeSet = new Set(activeEnrollmentIds.map((p) => p.enrollmentId));
      atRiskStudentCount = enrollmentIds.filter((id) => !activeSet.has(id)).length;
    }

    // Count unsubmitted assignments: OPEN assignments that have zero submissions from this class
    const assignmentIds = openAssignments.map((a) => a.id);
    let unsubmittedAssignmentsCount = assignmentIds.length;
    if (assignmentIds.length > 0) {
      const submittedAssignmentIds = await this.prisma.submission.findMany({
        where: {
          schoolId,
          assignmentId: { in: assignmentIds },
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          deletedAt: null,
        },
        select: { assignmentId: true },
        distinct: ["assignmentId"],
      });
      const submittedSet = new Set(submittedAssignmentIds.map((s) => s.assignmentId));
      unsubmittedAssignmentsCount = assignmentIds.filter((id) => !submittedSet.has(id)).length;
    }

    return {
      pendingReviewCount,
      unsubmittedAssignmentsCount,
      atRiskStudentCount,
      pendingAssessmentsCount,
    };
  }

  async exportClassData(auth: AuthContext, schoolId: string, classId: string, format: string) {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    // Verify class exists
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    // Parallel data aggregation for export
    const [enrollments, classDetail, recentSubmissions] = await Promise.all([
      // Student list (desensitized: displayName only)
      this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
        select: {
          id: true,
          user: { select: { displayName: true } },
        },
      }),
      // Reuse class detail logic for stages + pronunciation clusters
      this.getClassDetail(auth, schoolId, classId),
      // Recent submissions
      this.prisma.submission.findMany({
        where: {
          schoolId,
          enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" },
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          assignment: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        actorUserId: auth.principal.userId,
        schoolId,
        action: "CLASS_DATA_EXPORTED",
        resourceType: "Class",
        resourceId: classId,
        requestId: `export-${Date.now()}`,
        afterSummary: { format, classId, studentCount: enrollments.length },
      },
    });

    // Build export data
    const students = enrollments.map((e) => ({
      enrollmentId: e.id,
      displayName: e.user?.displayName ?? null,
    }));

    return {
      classInfo: {
        classId,
        className: classItem.name,
        grade: classItem.grade,
      },
      students,
      stages: classDetail.stages,
      pronunciationClusters: classDetail.pronunciationClusters,
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        status: s.status,
        assignmentTitle: s.assignment?.title ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: auth.principal.userId,
    };
  }

  async createSupplementaryPractice(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    dto: { title: string; description?: string; courseVersionId?: string; dueAt?: string; targetEnrollmentIds?: string[] },
  ) {
    if (!this.policy.canUpdateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    // Verify class exists
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    // Need a courseVersionId — if not provided, find one from existing assignments targeting this class
    let courseVersionId = dto.courseVersionId;
    if (!courseVersionId) {
      const existingAssignment = await this.prisma.assignment.findFirst({
        where: {
          schoolId,
          targets: { some: { classId } },
          deletedAt: null,
        },
        select: { courseVersionId: true },
        orderBy: { createdAt: "desc" },
      });
      if (!existingAssignment?.courseVersionId) {
        throw new ClassConflictException("无法创建补充练习：班级没有关联课程版本，请指定 courseVersionId");
      }
      courseVersionId = existingAssignment.courseVersionId;
    }
    const resolvedCourseVersionId = courseVersionId;
    if (!resolvedCourseVersionId) {
      throw new ClassConflictException("无法创建补充练习：缺少课程版本");
    }

    // Build assignment targets
    const targets: { targetType: "CLASS" | "STUDENT"; classId?: string; enrollmentId?: string }[] = [];

    if (dto.targetEnrollmentIds && dto.targetEnrollmentIds.length > 0) {
      // Target specific students
      for (const enrollmentId of dto.targetEnrollmentIds) {
        targets.push({ targetType: "STUDENT", classId, enrollmentId });
      }
    } else {
      // Target entire class
      targets.push({ targetType: "CLASS", classId });
    }

    // Create the supplementary practice as an Assignment
    const now = new Date();
    const dueDate = dto.dueAt ? new Date(dto.dueAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const title = dto.title.startsWith("【补充练习】") ? dto.title : `【补充练习】${dto.title}`;

    const assignment = await this.prisma.assignment.create({
      data: {
        schoolId,
        title,
        courseVersionId: resolvedCourseVersionId,
        startsAt: now,
        dueAt: dueDate,
        status: "OPEN",
        createdByUserId: auth.principal.userId,
        targets: {
          create: targets.map((t) => ({
            schoolId,
            targetType: t.targetType,
            classId: t.classId ?? null,
            enrollmentId: t.enrollmentId ?? null,
          })),
        },
      },
      include: {
        targets: true,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        actorUserId: auth.principal.userId,
        schoolId,
        action: "SUPPLEMENTARY_PRACTICE_CREATED",
        resourceType: "Assignment",
        resourceId: assignment.id,
        requestId: `supp-${Date.now()}`,
        afterSummary: { classId, title: assignment.title, targetCount: targets.length },
      },
    });

    return {
      id: assignment.id,
      title: assignment.title,
      status: assignment.status,
      startsAt: assignment.startsAt.toISOString(),
      dueAt: assignment.dueAt.toISOString(),
      targetCount: targets.length,
    };
  }

  async createClassAssessment(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    dto: { type: string; title?: string; targetEnrollmentIds?: string[]; questionIds?: string[] },
  ) {
    if (!this.policy.canUpdateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) throw new ClassNotFoundException();

    // Determine target enrollment IDs: use provided list or all active students in class
    let enrollmentIds: string[];
    if (dto.targetEnrollmentIds && dto.targetEnrollmentIds.length > 0) {
      enrollmentIds = [...new Set(dto.targetEnrollmentIds)];
    } else {
      const allEnrollments = await this.prisma.enrollment.findMany({
        where: { schoolId, classId, role: "STUDENT", status: "ACTIVE" },
        select: { id: true },
      });
      enrollmentIds = allEnrollments.map((e) => e.id);
    }

    if (enrollmentIds.length === 0) {
      throw new ClassConflictException("班级中没有活跃学生，无法发起评估");
    }

    // Verify enrollments belong to this class
    const validEnrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, classId, id: { in: enrollmentIds }, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (validEnrollments.length !== enrollmentIds.length) {
      throw new ClassForbiddenException("存在不属于当前班级或已失效的学生");
    }

    // Determine assessment type
    const assessmentType = dto.type === "COMPREHENSIVE" ? "MIXED" : (dto.type as "READING" | "WRITTEN" | "MIXED");

    // P0-CONTRACT-CONVERGENCE-001: Resolve questionIds with schoolId scoping.
    // 1. If questionIds provided → validate they belong to this school (via
    //    courseVersion.schoolId). Cross-school question IDs are rejected.
    // 2. If questionIds omitted/empty → resolve default questions from the class's
    //    latest assignment's courseVersion. If no courseVersion or no questions →
    //    fail with PRACTICE_CONTENT_EMPTY (do NOT create 0-item sessions).
    // 3. After resolution, questions.length must be > 0 → else ASSESSMENT_HAS_NO_ITEMS.
    const providedQuestionIds = (dto.questionIds ?? []).filter((id) => id);
    let questions: Array<{ id: string; prompt: unknown; kind: string }> = [];
    if (providedQuestionIds.length > 0) {
      const dbQuestions = await this.prisma.question.findMany({
        where: {
          id: { in: providedQuestionIds },
          // P0: prevent cross-school question injection.
          // Question → activity → lesson → unit → courseVersion → schoolId
          activity: {
            lesson: { unit: { courseVersion: { schoolId } } },
          },
        },
        select: { id: true, prompt: true, kind: true },
      });
      if (dbQuestions.length !== providedQuestionIds.length) {
        const foundIds = new Set(dbQuestions.map((q) => q.id));
        const missing = providedQuestionIds.filter((id) => !foundIds.has(id));
        throw new ClassConflictException(
          `部分题目ID无效或不存在: ${missing.join(", ")}`,
        );
      }
      questions = dbQuestions as Array<{ id: string; prompt: unknown; kind: string }>;
    } else {
      // Resolve default questions from the class's current course version.
      const latestAssignment = await this.prisma.assignment.findFirst({
        where: {
          schoolId,
          targets: { some: { classId } },
          deletedAt: null,
        },
        select: { courseVersionId: true },
        orderBy: { createdAt: "desc" },
      });
      if (!latestAssignment?.courseVersionId) {
        throw new PracticeContentEmptyException(
          "班级当前没有关联课程，无法解析默认题目，请显式传入 questionIds",
        );
      }
      const defaultQuestions = await this.prisma.question.findMany({
        where: {
          // Question has no direct courseVersionId; scope through the
          // activity → lesson → unit → courseVersion relation chain.
          // This also enforces schoolId via courseVersion.schoolId.
          activity: {
            lesson: {
              unit: {
                courseVersionId: latestAssignment.courseVersionId,
                courseVersion: { schoolId },
              },
            },
          },
        },
        select: { id: true, prompt: true, kind: true },
        orderBy: { sortOrder: "asc" },
        take: 20,
      });
      if (defaultQuestions.length === 0) {
        throw new PracticeContentEmptyException(
          "班级当前课程没有可用题目，请先在课程管理中添加题目",
        );
      }
      questions = defaultQuestions as Array<{ id: string; prompt: unknown; kind: string }>;
    }

    if (questions.length === 0) {
      // Defensive: should be unreachable due to the branches above, but
      // guarantees no 0-item session is ever created.
      throw new AssessmentHasNoItemsException();
    }

    // Create sessions for each student using AssessmentService.
    // P0-CONTRACT-CONVERGENCE-001: questions.length > 0 is guaranteed above,
    // so every session will receive at least one AssessmentItem. The previous
    // `if (questions.length > 0)` guard is removed because it allowed 0-item
    // sessions to be created when questionIds were missing.
    // NOTE: Per-student session+items atomicity via $transaction is a future
    // improvement (requires repo-level tx support); current behavior may leave
    // an orphan session if item creation fails mid-loop. Listed in未解决问题.
    const sessions = [];
    for (const enrollmentId of enrollmentIds) {
      const session = await this.assessmentService.createSession(auth, schoolId, {
        enrollmentId,
        classId,
        type: assessmentType,
      });
      sessions.push(session);

      const itemData = questions.map((q, index) => ({
        sessionId: session.id,
        schoolId,
        questionId: q.id,
        prompt: (q.prompt ?? {}) as Prisma.InputJsonValue,
        itemType: q.kind ?? (assessmentType === "READING" ? "READING" : "WRITTEN"),
        sortOrder: index + 1,
        status: "PENDING" as const,
      }));
      await this.prisma.assessmentItem.createMany({ data: itemData });
    }

    // Create notifications for each student
    const userIds = await this.prisma.enrollment.findMany({
      where: { schoolId, classId, id: { in: enrollmentIds }, role: "STUDENT", status: "ACTIVE" },
      select: { userId: true },
    });
    await this.prisma.notification.createMany({
      data: userIds.map((e) => ({
        schoolId,
        recipientUserId: e.userId,
        type: "ASSESSMENT_ASSIGNED",
        title: dto.title ?? "新测评任务",
        body: `您有一份新的${dto.type === "READING" ? "朗读" : dto.type === "WRITTEN" ? "书面" : "综合"}测评需要完成`,
        priority: "HIGH",
      })),
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        actorUserId: auth.principal.userId,
        schoolId,
        action: "CLASS_ASSESSMENT_CREATED",
        resourceType: "AssessmentSession",
        resourceId: sessions[0]?.id ?? classId,
        requestId: `class-assess-${Date.now()}`,
        afterSummary: { classId, sessionCount: sessions.length, type: assessmentType, questionCount: questions.length } as object,
      },
    });

    return {
      classId,
      createdCount: sessions.length,
      questionCount: questions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        enrollmentId: s.enrollmentId,
        status: s.status,
      })),
    };
  }

  // ─── Section VIII: Dashboard Aggregation Endpoints ───

  async getClassDashboard(auth: AuthContext, schoolId: string, classId: string): Promise<ClassDashboard> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) throw new ClassNotFoundException();

    const [
      enrollments,
      assignments,
      pendingSubmissions,
      activityProgressRows,
      speechJobs,
      submissionCount,
      assessmentSessionCount,
      lastActivityRow,
    ] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
        select: { id: true, userId: true },
      }),
      this.prisma.assignment.findMany({
        where: { schoolId, targets: { some: { classId } }, deletedAt: null },
        select: { id: true, title: true, status: true, courseVersionId: true, courseVersion: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.submission.count({
        where: { schoolId, status: { in: ["SUBMITTED", "NEEDS_REVIEW"] }, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" }, deletedAt: null },
      }),
      this.prisma.activityProgress.findMany({
        where: { schoolId, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" } },
        select: { enrollmentId: true, completed: true },
      }),
      this.prisma.speechJob.findMany({
        where: { status: { in: ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"] }, result: { not: Prisma.AnyNull }, submission: { schoolId, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" } } },
        select: { result: true, submission: { select: { enrollmentId: true } } },
      }),
      // Total submitted/Reviewed/Accepted submissions (for submissionRate)
      this.prisma.submission.count({
        where: { schoolId, status: { in: ["SUBMITTED", "REVIEWED", "ACCEPTED"] }, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" }, deletedAt: null },
      }),
      // Completed assessment sessions (for assessmentParticipationRate)
      this.prisma.assessmentSession.count({
        where: { schoolId, classId, status: "COMPLETED" },
      }),
      // Last activity time across the class
      this.prisma.activityProgress.findFirst({
        where: { schoolId, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" } },
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const studentCount = enrollments.length;
    const currentCourse = assignments.length > 0 && assignments[0]?.courseVersion
      ? { id: assignments[0].courseVersion!.id, title: assignments[0].courseVersion!.title }
      : null;

    // Completion rate
    const enrollmentIds = new Set(enrollments.map((e) => e.id));
    const relevantProgress = activityProgressRows.filter((p) => enrollmentIds.has(p.enrollmentId));
    const completedProgress = relevantProgress.filter((p) => p.completed).length;
    const completionRate = relevantProgress.length > 0 ? Math.round((completedProgress / relevantProgress.length) * 100) : 0;

    // Submission rate: students who submitted at least once / total students
    const submittedEnrollmentIds = new Set(
      await this.prisma.submission.findMany({
        where: { schoolId, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" }, status: { in: ["SUBMITTED", "REVIEWED", "ACCEPTED"] }, deletedAt: null },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );
    const submissionRate = studentCount > 0 ? Math.round((submittedEnrollmentIds.size / studentCount) * 100) : 0;

    // Assessment participation rate
    const assessedEnrollmentIds = new Set(
      await this.prisma.assessmentSession.findMany({
        where: { schoolId, classId, status: "COMPLETED" },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );
    const assessmentParticipationRate = studentCount > 0 ? Math.round((assessedEnrollmentIds.size / studentCount) * 100) : 0;

    // At-risk students: no activity in 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let atRiskStudentCount = 0;
    if (enrollmentIds.size > 0) {
      const activeRecently = await this.prisma.activityProgress.findMany({
        where: { schoolId, enrollmentId: { in: [...enrollmentIds] }, updatedAt: { gte: sevenDaysAgo } },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      });
      const activeSet = new Set(activeRecently.map((p) => p.enrollmentId));
      atRiskStudentCount = [...enrollmentIds].filter((id) => !activeSet.has(id)).length;
    }

    // Growth stages (reuse same logic as getClassDetail)
    const hasRecordingEnrollmentIds = new Set(
      await this.prisma.recording.findMany({
        where: { schoolId, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" }, status: { in: ["COMPLETE", "READY"] } },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      }).then((rows) => rows.map((r) => r.enrollmentId)),
    );
    const stages: ClassGrowthStage[] = [
      { id: "course-learning", title: "课程学习", completionRate, participantCount: relevantProgress.length > 0 ? new Set(relevantProgress.map((p) => p.enrollmentId)).size : 0, totalCount: studentCount },
      { id: "practice", title: "课后练习", completionRate: submissionRate, participantCount: submittedEnrollmentIds.size, totalCount: studentCount },
      { id: "assessment", title: "阶段测评", completionRate: assessmentParticipationRate, participantCount: assessedEnrollmentIds.size, totalCount: studentCount },
      { id: "review", title: "复习巩固", completionRate: studentCount > 0 ? Math.round((hasRecordingEnrollmentIds.size / studentCount) * 100) : 0, participantCount: hasRecordingEnrollmentIds.size, totalCount: studentCount },
    ];

    // Pronunciation clusters (reuse dedup logic)
    const ERROR_TYPE_LABEL_MAP: Record<string, string> = { nasal_confusion: "前后鼻音混淆", retroflex: "平翘舌音混淆", tone: "声调起伏不足", pause: "多音节停顿不当", retroflex_curled: "卷舌音不到位", vowel: "元音发音不准", aspiration: "送气音混淆" };
    const errorCounts = new Map<string, { enrollmentIds: Set<string>; occurrences: number }>();
    for (const job of speechJobs) {
      const result = job.result as Record<string, unknown> | null;
      if (!result) continue;
      const errors = (result as { pronunciationErrors?: { type: string }[] }).pronunciationErrors ?? [];
      const enrollmentId = (job as { submission?: { enrollmentId?: string } }).submission?.enrollmentId ?? '';
      for (const err of errors) {
        if (!errorCounts.has(err.type)) errorCounts.set(err.type, { enrollmentIds: new Set<string>(), occurrences: 0 });
        const entry = errorCounts.get(err.type)!;
        entry.occurrences += 1;
        if (enrollmentId) entry.enrollmentIds.add(enrollmentId);
      }
    }
    const pronunciationClusters: PronunciationClusterItem[] = Array.from(errorCounts.entries())
      .map(([type, entry]) => ({ type, label: ERROR_TYPE_LABEL_MAP[type] ?? type, affectedCount: entry.enrollmentIds.size, percentage: enrollments.length > 0 ? Math.round((entry.enrollmentIds.size / enrollments.length) * 100) : 0 }))
      .sort((a, b) => b.affectedCount - a.affectedCount)
      .slice(0, 5);

    return {
      classId,
      className: classItem.name,
      grade: classItem.grade,
      studentCount,
      currentCourse,
      completionRate,
      submissionRate,
      assessmentParticipationRate,
      pendingReviewCount: pendingSubmissions,
      atRiskStudentCount,
      lastActivityAt: lastActivityRow?.updatedAt?.toISOString() ?? null,
      stages,
      pronunciationClusters,
    };
  }

  async getStudentSummaries(auth: AuthContext, schoolId: string, classId: string): Promise<readonly StudentSummary[]> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) throw new ClassForbiddenException();
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) throw new ClassNotFoundException();

    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
      select: { id: true, userId: true, user: { select: { displayName: true } } },
    });
    if (enrollments.length === 0) return [];

    const enrollmentIds = enrollments.map((e) => e.id);

    // Batch queries in parallel
    const [progressRows, submissionRows, assessmentRows, recordingRows, speechJobs, activityRows] = await Promise.all([
      // Activity progress per enrollment
      this.prisma.activityProgress.findMany({
        where: { schoolId, enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, completed: true },
      }),
      // Submissions per enrollment
      this.prisma.submission.findMany({
        where: { schoolId, enrollmentId: { in: enrollmentIds }, deletedAt: null },
        select: { enrollmentId: true, assignmentId: true, status: true },
      }),
      // Latest assessment session per enrollment (score computed from items)
      this.prisma.assessmentSession.findMany({
        where: { schoolId, classId, enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, status: true, createdAt: true, items: { select: { scoredScore: true, maxScore: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Recording count per enrollment
      this.prisma.recording.findMany({
        where: { schoolId, enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true },
      }),
      // Speech jobs for top issue detection
      this.prisma.speechJob.findMany({
        where: { status: { in: ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"] }, result: { not: Prisma.AnyNull }, submission: { schoolId, enrollmentId: { in: enrollmentIds } } },
        select: { result: true, submission: { select: { enrollmentId: true } } },
      }),
      // Last activity per enrollment
      this.prisma.activityProgress.findMany({
        where: { schoolId, enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Build per-enrollment maps
    const progressMap = new Map<string, { total: number; completed: number }>();
    for (const p of progressRows) {
      const entry = progressMap.get(p.enrollmentId) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (p.completed) entry.completed += 1;
      progressMap.set(p.enrollmentId, entry);
    }

    const submissionMap = new Map<string, { submitted: number; assignmentIds: Set<string> }>();
    for (const s of submissionRows) {
      const entry = submissionMap.get(s.enrollmentId) ?? { submitted: 0, assignmentIds: new Set<string>() };
      entry.assignmentIds.add(s.assignmentId);
      if (["SUBMITTED", "REVIEWED", "ACCEPTED"].includes(s.status)) entry.submitted += 1;
      submissionMap.set(s.enrollmentId, entry);
    }

    // Total assignments targeting this class
    const totalAssignments = await this.prisma.assignment.findMany({
      where: { schoolId, targets: { some: { classId } }, deletedAt: null },
      select: { id: true },
    });
    const totalAssignmentIds = new Set(totalAssignments.map((a) => a.id));

    // Latest assessment per enrollment (score computed from AssessmentItem.scoredScore)
    const latestAssessmentMap = new Map<string, { status: string; score: number | null }>();
    for (const a of assessmentRows) {
      if (!latestAssessmentMap.has(a.enrollmentId)) {
        const scored = a.items.filter((i) => i.scoredScore !== null);
        const avgScore = scored.length > 0 ? Math.round((scored.reduce((sum, i) => sum + (i.scoredScore ?? 0), 0) / scored.length) * 10) / 10 : null;
        latestAssessmentMap.set(a.enrollmentId, { status: a.status, score: avgScore });
      }
    }

    const recordingCountMap = new Map<string, number>();
    for (const r of recordingRows) {
      recordingCountMap.set(r.enrollmentId, (recordingCountMap.get(r.enrollmentId) ?? 0) + 1);
    }

    // Top issue per enrollment from speech jobs
    const issueMap = new Map<string, string>();
    const ERROR_LABELS: Record<string, string> = { nasal_confusion: "前后鼻音", retroflex: "平翘舌音", tone: "声调", pause: "停顿", retroflex_curled: "卷舌音", vowel: "元音", aspiration: "送气音" };
    for (const job of speechJobs) {
      const result = job.result as Record<string, unknown> | null;
      if (!result) continue;
      const errors = (result as { pronunciationErrors?: { type: string }[] }).pronunciationErrors ?? [];
      const eid = (job as { submission?: { enrollmentId?: string } }).submission?.enrollmentId ?? '';
      if (!eid || errors.length === 0) continue;
      if (!issueMap.has(eid) && errors[0]) {
        issueMap.set(eid, ERROR_LABELS[errors[0].type] ?? errors[0].type);
      }
    }

    const lastActivityMap = new Map<string, Date>();
    for (const a of activityRows) {
      if (!lastActivityMap.has(a.enrollmentId)) {
        lastActivityMap.set(a.enrollmentId, a.updatedAt);
      }
    }

    // At-risk: no activity in 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    return enrollments.map((e) => {
      const progress = progressMap.get(e.id);
      const courseProgress = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      const sub = submissionMap.get(e.id);
      const submittedCount = sub?.submitted ?? 0;
      const submittedAssignmentIds = sub?.assignmentIds ?? new Set<string>();
      const missingCount = [...totalAssignmentIds].filter((aid) => !submittedAssignmentIds.has(aid)).length;
      const latestAssessment = latestAssessmentMap.get(e.id);
      const lastActive = lastActivityMap.get(e.id);

      let riskStatus: StudentSummary["riskStatus"] = "OK";
      if (!lastActive || lastActive < fourteenDaysAgo) riskStatus = "INACTIVE";
      else if (lastActive < sevenDaysAgo) riskStatus = "AT_RISK";

      return {
        enrollmentId: e.id,
        userId: e.userId,
        displayName: e.user?.displayName ?? "",
        courseProgress,
        submittedAssignmentCount: submittedCount,
        missingAssignmentCount: missingCount,
        latestAssessmentStatus: latestAssessment?.status ?? null,
        latestAssessmentScore: latestAssessment?.score ?? null,
        recordingCount: recordingCountMap.get(e.id) ?? 0,
        topIssue: issueMap.get(e.id) ?? null,
        lastActiveAt: lastActive?.toISOString() ?? null,
        riskStatus,
      };
    });
  }

  async getAssignmentSummaries(auth: AuthContext, schoolId: string, classId: string): Promise<readonly AssignmentSummary[]> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) throw new ClassForbiddenException();
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) throw new ClassNotFoundException();

    const assignments = await this.prisma.assignment.findMany({
      where: { schoolId, targets: { some: { classId } }, deletedAt: null },
      select: {
        id: true, title: true, status: true, dueAt: true,
        courseVersion: { select: { title: true } },
        targets: { where: { classId }, select: { targetType: true, enrollmentId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (assignments.length === 0) return [];

    const assignmentIds = assignments.map((a) => a.id);

    // Batch submission stats per assignment
    const submissionRows = await this.prisma.submission.findMany({
      where: { schoolId, assignmentId: { in: assignmentIds }, enrollment: { classId, schoolId, role: "STUDENT", status: "ACTIVE" }, deletedAt: null },
      select: { assignmentId: true, status: true },
    });

    const subMap = new Map<string, { total: number; pendingReview: number }>();
    for (const s of submissionRows) {
      const entry = subMap.get(s.assignmentId) ?? { total: 0, pendingReview: 0 };
      entry.total += 1;
      if (["SUBMITTED", "NEEDS_REVIEW"].includes(s.status)) entry.pendingReview += 1;
      subMap.set(s.assignmentId, entry);
    }

    return assignments.map((a) => {
      const sub = subMap.get(a.id) ?? { total: 0, pendingReview: 0 };
      // Total target count: CLASS target → all class students; STUDENT targets → count of individual targets
      const studentTargets = a.targets.filter((t) => t.enrollmentId);
      const totalTargetCount = studentTargets.length > 0 ? studentTargets.length : 0; // 0 means "whole class"

      return {
        assignmentId: a.id,
        title: a.title,
        status: a.status,
        dueAt: a.dueAt?.toISOString() ?? null,
        submissionCount: sub.total,
        pendingReviewCount: sub.pendingReview,
        totalTargetCount,
        courseTitle: a.courseVersion?.title ?? null,
      };
    });
  }

  async getAssessmentSummaries(auth: AuthContext, schoolId: string, classId: string): Promise<readonly AssessmentSummary[]> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) throw new ClassForbiddenException();
    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) throw new ClassNotFoundException();

    const sessions = await this.prisma.assessmentSession.findMany({
      where: { schoolId, classId },
      select: { id: true, type: true, status: true, createdAt: true, enrollmentId: true, items: { select: { scoredScore: true, maxScore: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (sessions.length === 0) return [];

    // Group by type+createdAt proximity to identify "same assessment event"
    // For simplicity, each session is its own entry; teacher sees individual student sessions
    // But for class-level view, we aggregate by type
    const activeEnrollmentCount = await this.prisma.enrollment.count({
      where: { schoolId, classId, status: "ACTIVE", role: "STUDENT" },
    });

    // Group sessions by type for class-level summary (score computed from items)
    const typeGroups = new Map<string, { sessions: typeof sessions; scores: number[] }>();
    for (const s of sessions) {
      const key = s.type;
      if (!typeGroups.has(key)) typeGroups.set(key, { sessions: [], scores: [] });
      const group = typeGroups.get(key)!;
      group.sessions.push(s);
      // Compute per-session average score from items
      const scoredItems = s.items.filter((i) => i.scoredScore !== null);
      if (scoredItems.length > 0) {
        const avg = scoredItems.reduce((sum, i) => sum + (i.scoredScore ?? 0), 0) / scoredItems.length;
        group.scores.push(Math.round(avg * 10) / 10);
      }
    }

    return Array.from(typeGroups.entries()).map(([type, group]) => {
      const completedCount = group.sessions.filter((s) => s.status === "COMPLETED").length;
      const scores = group.scores.sort((a, b) => a - b);
      const averageScore = scores.length > 0 ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : null;
      const midIdx = Math.floor(scores.length / 2);
      const medianScore = scores.length > 0 && scores[midIdx] !== undefined ? Math.round(scores[midIdx] * 10) / 10 : null;
      const latestSession = group.sessions[0];

      return {
        sessionId: latestSession?.id ?? "",
        title: null,
        type,
        status: completedCount > 0 ? "COMPLETED" : (latestSession?.status ?? "UNKNOWN"),
        completedCount,
        averageScore,
        medianScore,
        totalTargetCount: activeEnrollmentCount,
        createdAt: latestSession?.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }
}
