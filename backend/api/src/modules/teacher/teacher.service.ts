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
    const teacherEnrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: teacherId,
        schoolId,
        role: "TEACHER",
        status: "ACTIVE",
      },
      select: { classId: true },
    });
    const classIds = [...new Set(teacherEnrollments.map((item) => item.classId))];
    const activeStudents = classIds.length
      ? await this.prisma.enrollment.findMany({
          where: {
            schoolId,
            classId: { in: classIds },
            role: "STUDENT",
            status: "ACTIVE",
          },
          select: { id: true, classId: true },
        })
      : [];
    const studentEnrollmentIds = activeStudents.map((item) => item.id);
    const authorizedTarget =
      classIds.length > 0
        ? {
            targets: {
              some: {
                OR: [
                  { classId: { in: classIds } },
                  ...(studentEnrollmentIds.length
                    ? [{ enrollmentId: { in: studentEnrollmentIds } }]
                    : []),
                ],
              },
            },
          }
        : null;
    const assignmentWhere = authorizedTarget
      ? {
          schoolId,
          deletedAt: null,
          status: "OPEN" as const,
          ...authorizedTarget,
        }
      : null;

    const [user, school, draftCourses, openAssignmentCount, pendingReviews] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: teacherId },
          select: { displayName: true },
        }),
        this.prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true },
        }),
        this.prisma.courseVersion.count({
          where: {
            schoolId,
            status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
            course: { authorUserId: teacherId },
          },
        }),
        assignmentWhere
          ? this.prisma.assignment.count({ where: assignmentWhere })
          : Promise.resolve(0),
        classIds.length
          ? this.prisma.submission.count({
              where: {
                schoolId,
                deletedAt: null,
                status: "NEEDS_REVIEW",
                enrollment: {
                  schoolId,
                  classId: { in: classIds },
                  role: "STUDENT",
                  status: "ACTIVE",
                },
              },
            })
          : Promise.resolve(0),
      ]);

    const greeting: DashboardGreeting = {
      name: user?.displayName ?? "",
      date: new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
      schoolName: school?.name ?? "",
      priorityCount: 0,
    };

    const workflow: DashboardWorkflowItem[] = [
      {
        id: "course",
        tone: "orange",
        icon: "book",
        count: draftCourses,
        title: "待发布课程",
        subtitle: `${draftCourses} 门本人课程等待发布`,
      },
      {
        id: "task",
        tone: "red",
        icon: "clock",
        count: openAssignmentCount,
        title: "进行中任务",
        subtitle: `${openAssignmentCount} 个授权班级任务`,
      },
      {
        id: "review",
        tone: "green",
        icon: "mic",
        count: pendingReviews,
        title: "待复核提交",
        subtitle: `${pendingReviews} 份本人班级提交待复核`,
      },
      {
        id: "student",
        tone: "green",
        icon: "people",
        count: activeStudents.length,
        title: "授权班级学生",
        subtitle: `${activeStudents.length} 个在读学生班级记录`,
      },
    ];

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
    ).map((course) => ({
      id: course.id,
      title: course.title,
      tags: course.gradeBand ? [course.gradeBand] : [],
      updatedAt: course.updatedAt.toISOString(),
    }));

    const [assignmentRows, reviewRows] = await Promise.all([
      assignmentWhere
        ? this.prisma.assignment.findMany({
            where: assignmentWhere,
            orderBy: { dueAt: "asc" },
            take: 5,
            select: {
              id: true,
              title: true,
              dueAt: true,
              targets: {
                select: { targetType: true, classId: true, enrollmentId: true },
              },
            },
          })
        : Promise.resolve([]),
      classIds.length
        ? this.prisma.submission.findMany({
            where: {
              schoolId,
              deletedAt: null,
              status: "NEEDS_REVIEW",
              enrollment: {
                schoolId,
                classId: { in: classIds },
                role: "STUDENT",
                status: "ACTIVE",
              },
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
        : Promise.resolve([]),
    ]);

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const targetIdsByAssignment = new Map<string, Set<string>>();
    for (const assignment of assignmentRows) {
      const targetIds = new Set<string>();
      for (const target of assignment.targets) {
        if (target.targetType === "CLASS" && target.classId) {
          for (const student of activeStudents) {
            if (student.classId === target.classId) targetIds.add(student.id);
          }
        } else if (
          target.targetType === "STUDENT" &&
          target.enrollmentId &&
          studentEnrollmentIds.includes(target.enrollmentId)
        ) {
          targetIds.add(target.enrollmentId);
        }
      }
      targetIdsByAssignment.set(assignment.id, targetIds);
    }

    const targetEnrollmentIds = [
      ...new Set([...targetIdsByAssignment.values()].flatMap((ids) => [...ids])),
    ];
    const submittedRows =
      assignmentIds.length > 0 && targetEnrollmentIds.length > 0
        ? await this.prisma.submission.findMany({
            where: {
              schoolId,
              deletedAt: null,
              assignmentId: { in: assignmentIds },
              enrollmentId: { in: targetEnrollmentIds },
              status: { in: ["SUBMITTED", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"] },
            },
            select: { assignmentId: true, enrollmentId: true },
          })
        : [];
    const submittedByAssignment = new Map<string, Set<string>>();
    for (const submission of submittedRows) {
      const ids = submittedByAssignment.get(submission.assignmentId) ?? new Set<string>();
      ids.add(submission.enrollmentId);
      submittedByAssignment.set(submission.assignmentId, ids);
    }

    const tasks: DashboardTask[] = assignmentRows.map((assignment) => {
      const totalIds = targetIdsByAssignment.get(assignment.id) ?? new Set<string>();
      const doneIds = submittedByAssignment.get(assignment.id) ?? new Set<string>();
      return {
        id: assignment.id,
        title: assignment.title,
        dueAt: assignment.dueAt.toISOString(),
        done: [...doneIds].filter((id) => totalIds.has(id)).length,
        total: totalIds.size,
        tone:
          assignment.dueAt.getTime() < Date.now() + 3 * 86400000
            ? "red"
            : "green",
      };
    });

    let priority: DashboardPriority | null = null;
    const urgentTask = tasks.find(
      (task) => new Date(task.dueAt).getTime() >= Date.now() && task.done < task.total,
    );
    if (urgentTask) {
      const incomplete = urgentTask.total - urgentTask.done;
      priority = {
        assignmentId: urgentTask.id,
        title: urgentTask.title,
        dueAt: urgentTask.dueAt,
        detail: `${incomplete} 位目标学生尚未提交`,
        count: incomplete,
      };
      greeting.priorityCount = incomplete;
    }

    const reviews: DashboardReview[] = reviewRows.map((submission) => ({
      submissionId: submission.id,
      studentName: submission.enrollment.user.displayName,
      taskTitle: submission.assignment.title,
      submittedAt: submission.createdAt.toISOString(),
    }));

    return { greeting, priority, workflow, courses, tasks, reviews };
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
