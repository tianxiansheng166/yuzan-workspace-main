import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { Prisma } from "@yuzan/database";
import { TeacherPolicy } from "./teacher.policy.js";
import {
  TeacherForbiddenException,
  NotificationNotFoundException,
} from "./domain/teacher.errors.js";
import type {
  AtRiskStudent,
  PronunciationCluster,
  DashboardGreeting,
  DashboardPriority,
  DashboardWorkflowItem,
  DashboardCourse,
  DashboardTask,
  DashboardReview,
  DashboardStudent,
} from "./domain/teacher.types.js";

@Injectable()
export class TeacherService {
  private readonly policy = new TeacherPolicy();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccess(auth, schoolId)) {
      throw new TeacherForbiddenException();
    }

    const teacherId = auth.principal.userId;

    // Get teacher's classes
    const teacherEnrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: teacherId,
        schoolId,
        role: "TEACHER",
        status: "ACTIVE",
      },
      include: { class: true },
    });

    const classIds = teacherEnrollments.map((e) => e.classId);

    // Greeting
    const user = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { displayName: true },
    });
    const greeting: DashboardGreeting = {
      name: user?.displayName ?? "老师",
      date: new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
      priorityCount: 0,
    };

    // Workflow counts
    const [
      draftCourses,
      openAssignments,
      pendingReviews,
      atRiskCount,
      readyReports,
    ] = await Promise.all([
      this.prisma.courseVersion.count({
        where: {
          schoolId,
          status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
        },
      }),
      this.prisma.assignment.count({
        where: {
          schoolId,
          status: "OPEN",
          targets: { some: { classId: { in: classIds } } },
        },
      }),
      this.prisma.submission.count({
        where: {
          schoolId,
          status: "NEEDS_REVIEW",
          enrollment: { classId: { in: classIds } },
        },
      }),
      this.prisma.enrollment.count({
        where: {
          schoolId,
          classId: { in: classIds },
          role: "STUDENT",
          status: "ACTIVE",
          progress: {
            some: { completed: false },
          },
        },
      }),
      this.prisma.report.count({
        where: { schoolId, status: "READY" },
      }),
    ]);

    const workflow: DashboardWorkflowItem[] = [
      {
        id: "course",
        tone: "orange",
        icon: "book",
        count: draftCourses,
        title: "待发布课程",
        subtitle: `${draftCourses} 门课程等待发布`,
      },
      {
        id: "task",
        tone: "red",
        icon: "clock",
        count: openAssignments,
        title: "即将截止任务",
        subtitle: `${openAssignments} 个任务进行中`,
      },
      {
        id: "review",
        tone: "green",
        icon: "mic",
        count: pendingReviews,
        title: "待复核朗读",
        subtitle: `${pendingReviews} 份朗读待复核`,
      },
      {
        id: "student",
        tone: "red",
        icon: "alert",
        count: atRiskCount,
        title: "需关注学生",
        subtitle: `${atRiskCount} 名学生需要关注`,
      },
      {
        id: "report",
        tone: "green",
        icon: "chart",
        count: readyReports,
        title: "学习报告",
        subtitle: `${readyReports} 份报告已就绪`,
      },
    ];

    // Priority: nearest due assignment with incomplete submissions
    const urgentAssignment = await this.prisma.assignment.findFirst({
      where: {
        schoolId,
        status: "OPEN",
        targets: { some: { classId: { in: classIds } } },
        dueAt: { gte: new Date() },
      },
      orderBy: { dueAt: "asc" },
    });

    let priority: DashboardPriority | null = null;
    if (urgentAssignment) {
      const totalStudents = await this.prisma.enrollment.count({
        where: {
          classId: { in: classIds },
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
      const submittedCount = await this.prisma.submission.count({
        where: {
          assignmentId: urgentAssignment.id,
          schoolId,
          status: {
            in: ["SUBMITTED", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"],
          },
        },
      });
      const incomplete = totalStudents - submittedCount;
      priority = {
        title: urgentAssignment.title,
        detail: `${incomplete} 位学生未完成`,
        count: incomplete,
      };
      greeting.priorityCount = incomplete;
    }

    // Courses (drafts by this teacher)
    const courses: DashboardCourse[] = (
      await this.prisma.courseVersion.findMany({
        where: {
          schoolId,
          status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
          course: { authorUserId: teacherId },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, gradeBand: true, updatedAt: true },
      })
    ).map((c) => ({
      id: c.id,
      title: c.title,
      tags: c.gradeBand ? [c.gradeBand] : [],
      updatedAt: c.updatedAt.toISOString(),
    }));

    // Tasks (open assignments in teacher's classes)
    const tasks: DashboardTask[] = (
      await this.prisma.assignment.findMany({
        where: {
          schoolId,
          status: "OPEN",
          targets: { some: { classId: { in: classIds } } },
        },
        orderBy: { dueAt: "asc" },
        take: 3,
        select: { id: true, title: true, dueAt: true },
      })
    ).map((a) => ({
      id: a.id,
      title: a.title,
      dueAt: a.dueAt.toISOString(),
      done: 0,
      total: 0,
      tone:
        new Date(a.dueAt) < new Date(Date.now() + 3 * 86400000)
          ? "red"
          : "green",
    }));

    // Reviews (pending submissions)
    const reviews: DashboardReview[] = (
      await this.prisma.submission.findMany({
        where: {
          schoolId,
          status: "NEEDS_REVIEW",
          enrollment: { classId: { in: classIds } },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          createdAt: true,
          assignment: { select: { title: true } },
          enrollment: {
            select: { user: { select: { displayName: true } } },
          },
        },
      })
    ).map((s) => ({
      submissionId: s.id,
      studentName: s.enrollment.user.displayName,
      taskTitle: s.assignment.title,
      submittedAt: s.createdAt.toISOString(),
    }));

    // At-risk students (simplified)
    const students: DashboardStudent[] = (
      await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          classId: { in: classIds },
          role: "STUDENT",
          status: "ACTIVE",
        },
        include: { user: { select: { displayName: true } } },
        take: 5,
      })
    )
      .filter((e) => e.user)
      .map((e) => ({
        enrollmentId: e.id,
        name: e.user.displayName,
        issue: "学习进度滞后",
        trend: "→ 0%",
      }));

    return {
      greeting,
      priority,
      workflow,
      courses,
      tasks,
      reviews,
      students,
    };
  }

  async getAtRiskStudents(
    auth: AuthContext,
    schoolId: string,
  ): Promise<AtRiskStudent[]> {
    if (!this.policy.canAccess(auth, schoolId)) {
      throw new TeacherForbiddenException();
    }

    const teacherId = auth.principal.userId;
    const teacherEnrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: teacherId,
        schoolId,
        role: "TEACHER",
        status: "ACTIVE",
      },
      select: { classId: true },
    });
    const classIds = teacherEnrollments.map((e) => e.classId);

    // Find students with low completion rates
    const studentEnrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        classId: { in: classIds },
        role: "STUDENT",
        status: "ACTIVE",
      },
      include: {
        user: { select: { displayName: true } },
        class: { select: { name: true } },
        progress: { select: { completed: true } },
      },
    });

    const results: AtRiskStudent[] = studentEnrollments
      .map((e) => {
        const total = e.progress.length;
        const completed = e.progress.filter((p) => p.completed).length;
        const completionRate = total > 0 ? completed / total : 1;
        const riskScore = Math.round((1 - completionRate) * 100);

        return {
          enrollmentId: e.id,
          studentName: e.user.displayName,
          className: e.class.name,
          issue:
            completionRate < 0.3
              ? "学习进度严重滞后"
              : completionRate < 0.5
                ? "学习进度滞后"
                : "需要关注",
          trend: completionRate < 0.5 ? "↓" : "→",
          riskScore,
          lastActiveAt: null as Date | null,
        };
      })
      .filter((s) => s.riskScore > 30)
      .sort((a, b) => b.riskScore - a.riskScore);

    return results;
  }

  async getPronunciationClusters(
    auth: AuthContext,
    schoolId: string,
    classId?: string,
  ): Promise<{ clusters: PronunciationCluster[] }> {
    if (!this.policy.canAccess(auth, schoolId)) {
      throw new TeacherForbiddenException();
    }

    // Get class IDs
    let classIds: string[];
    if (classId) {
      classIds = [classId];
    } else {
      const teacherEnrollments = await this.prisma.enrollment.findMany({
        where: {
          userId: auth.principal.userId,
          schoolId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { classId: true },
      });
      classIds = teacherEnrollments.map((e) => e.classId);
    }

    if (classIds.length === 0) {
      return { clusters: [] };
    }

    // Get speech jobs for students in these classes
    const studentEnrollmentIds = (
      await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          classId: { in: classIds },
          role: "STUDENT",
          status: "ACTIVE",
        },
        select: { id: true },
      })
    ).map((e) => e.id);

    if (studentEnrollmentIds.length === 0) {
      return { clusters: [] };
    }

    const totalStudents = studentEnrollmentIds.length;

    // Query speech jobs with results
    const speechJobs = await this.prisma.speechJob.findMany({
      where: {
        status: { in: ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"] },
        result: { not: Prisma.AnyNull },
        submissionId: {
          in: (
            await this.prisma.submission.findMany({
              where: {
                schoolId,
                enrollmentId: { in: studentEnrollmentIds },
              },
              select: { id: true },
            })
          ).map((s) => s.id),
        },
      },
      select: {
        result: true,
        submissionId: true,
      },
    });

    // Aggregate pronunciation errors from speech job results
    const errorCounts = new Map<string, Set<string>>();
    for (const job of speechJobs) {
      const result = job.result as Record<string, unknown> | null;
      if (!result) continue;

      const errors =
        (
          result as {
            pronunciationErrors?: { type: string }[];
          }
        ).pronunciationErrors ?? [];
      // Use submissionId as a proxy for enrollment grouping
      const eid = job.submissionId;

      for (const err of errors) {
        const label = this.translateErrorType(err.type);
        if (!errorCounts.has(label)) {
          errorCounts.set(label, new Set());
        }
        if (eid) errorCounts.get(label)!.add(eid);
      }
    }

    const clusters: PronunciationCluster[] = Array.from(errorCounts.entries())
      .map(([label, studentSet]) => ({
        label,
        count: studentSet.size,
        percentage: Math.round((studentSet.size / totalStudents) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { clusters };
  }

  private translateErrorType(type: string): string {
    const map: Record<string, string> = {
      nasal_confusion: "前后鼻音混淆",
      retroflex: "平翘舌音混淆",
      tone: "声调起伏不足",
      pause: "多音节停顿不当",
      retroflex_curled: "卷舌音不到位",
      vowel: "元音发音不准",
      aspiration: "送气音混淆",
    };
    return map[type] ?? type;
  }

  async listNotifications(
    auth: AuthContext,
    schoolId: string,
    options: {
      type?: string;
      limit?: number;
      cursor?: string;
      unreadOnly?: boolean;
    },
  ) {
    // Allow students to access their own notifications too
    const isStudent = hasRole(auth, MembershipRole.STUDENT);
    if (!this.policy.canAccess(auth, schoolId) && !isStudent) {
      throw new TeacherForbiddenException();
    }

    const where: Record<string, unknown> = {
      schoolId,
      recipientUserId: auth.principal.userId,
      ...(options.type ? { type: options.type } : {}),
      ...(options.unreadOnly ? { readAt: null } : {}),
    };

    const limit = options.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(options.cursor
          ? { cursor: { id: options.cursor }, skip: 1 }
          : {}),
        select: {
          id: true,
          type: true,
          priority: true,
          title: true,
          body: true,
          readAt: true,
          actionUrl: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;

    return {
      items: trimmed.map((n) => ({
        id: n.id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt.toISOString(),
        expiresAt: n.expiresAt?.toISOString() ?? null,
      })),
      nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
      hasMore,
      total,
    };
  }

  async markNotificationRead(
    auth: AuthContext,
    schoolId: string,
    notificationId: string,
  ) {
    // Allow students to mark their own notifications as read
    const isStudent = hasRole(auth, MembershipRole.STUDENT);
    if (!this.policy.canAccess(auth, schoolId) && !isStudent) {
      throw new TeacherForbiddenException();
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        schoolId,
        recipientUserId: auth.principal.userId,
      },
    });

    if (!notification) {
      throw new NotificationNotFoundException();
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { id: notificationId, readAt: new Date().toISOString() };
  }
}
