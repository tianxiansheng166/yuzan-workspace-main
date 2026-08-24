import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { StudentDashboardPolicy } from "./student-dashboard.policy.js";
import { StudentDashboardForbiddenException } from "./domain/student-dashboard.errors.js";
import type { FeedbackRepositoryPort, PaginatedResult } from "../feedback/ports/feedback-repository.port.js";
import { FEEDBACK_REPOSITORY } from "../feedback/ports/feedback-repository.port.js";
import type { Feedback } from "../feedback/domain/feedback.types.js";
import type {
  CourseDashboardItem,
  TeacherAdviceItem,
  StudentProfileData,
} from "./domain/student-dashboard.types.js";
import {
  buildStudentTodayDecision,
  type StudentTodayAttempt,
  type StudentTodayLegacyTask,
} from "./student-today-decision.js";
import {
  isQuestionBankDiagnosis,
  questionBankFamilyDisplayName,
} from "../assessment/question-bank-diagnosis.js";

@Injectable()
export class StudentDashboardService {
  private readonly policy = new StudentDashboardPolicy();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FEEDBACK_REPOSITORY)
    private readonly feedbackRepo: FeedbackRepositoryPort,
  ) {}

  async getCoursesDashboard(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccessDashboard(auth, schoolId)) {
      throw new StudentDashboardForbiddenException();
    }

    // 1. Get student enrollments
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: auth.principal.userId, schoolId, status: "ACTIVE", role: "STUDENT" },
      select: { id: true, classId: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    const classIds = enrollments.map((e) => e.classId);

    if (enrollmentIds.length === 0) {
      return { courses: [] };
    }

    // 2. Find assignments targeted at these enrollments or classes
    const targets = await this.prisma.assignmentTarget.findMany({
      where: {
        schoolId,
        OR: [
          { classId: { in: classIds } },
          { enrollmentId: { in: enrollmentIds } },
        ],
      },
      select: { assignmentId: true },
    });
    const assignmentIds = [...new Set(targets.map((t) => t.assignmentId))];

    if (assignmentIds.length === 0) {
      return { courses: [] };
    }

    // 3. Get assignments with course version info
    const assignments = await this.prisma.assignment.findMany({
      where: { id: { in: assignmentIds }, schoolId, deletedAt: null },
      select: {
        id: true,
        courseVersionId: true,
        courseVersion: { select: { id: true, title: true, gradeBand: true } },
      },
    });

    // 4. Group by courseVersionId and calculate progress
    const courseVersionIds = [...new Set(assignments.map((a) => a.courseVersionId))];
    const courses: CourseDashboardItem[] = [];

    for (const cvId of courseVersionIds) {
      const assignment = assignments.find((a) => a.courseVersionId === cvId);
      if (!assignment?.courseVersion) continue;

      // Count activities and completed progress
      const [totalProgress, completedProgress] = await Promise.all([
        this.prisma.activityProgress.count({
          where: { enrollmentId: { in: enrollmentIds }, activity: { lesson: { unit: { courseVersionId: cvId } } } },
        }),
        this.prisma.activityProgress.count({
          where: { enrollmentId: { in: enrollmentIds }, completed: true, activity: { lesson: { unit: { courseVersionId: cvId } } } },
        }),
      ]);

      // Check for offline packages
      const offlineCount = await this.prisma.offlineContentPackage.count({
        where: { schoolId, courseVersionId: cvId },
      });

      // Check for latest feedback
      const latestFeedback = await this.prisma.feedback.findFirst({
        where: { schoolId, submission: { enrollmentId: { in: enrollmentIds }, assignment: { courseVersionId: cvId } }, deletedAt: null },
        orderBy: { releasedAt: "desc" },
        select: { releasedAt: true },
      });

      courses.push({
        courseVersionId: cvId,
        courseTitle: assignment.courseVersion.title,
        gradeBand: assignment.courseVersion.gradeBand,
        progressPercent: totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0,
        latestFeedbackAt: latestFeedback?.releasedAt?.toISOString() ?? null,
        hasOfflinePackage: offlineCount > 0,
      });
    }

    return { courses };
  }

  async getRecommendations(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccessDashboard(auth, schoolId)) {
      throw new StudentDashboardForbiddenException();
    }

    // AI recommendation engine is not yet implemented
    return { items: [] };
  }

  async getTeacherAdvice(
    auth: AuthContext,
    schoolId: string,
    options: { limit?: number; cursor?: string },
  ) {
    if (!this.policy.canAccessDashboard(auth, schoolId)) {
      throw new StudentDashboardForbiddenException();
    }

    // 1. Get student enrollments
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: auth.principal.userId, schoolId, status: "ACTIVE", role: "STUDENT" },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    if (enrollmentIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    // 2. Get feedback via the repository method
    const feedbackResult = await this.feedbackRepo.findByStudentEnrollments(
      schoolId,
      enrollmentIds,
      options,
    );

    // 3. Enrich with assignment/course info
    const items: TeacherAdviceItem[] = [];

    for (const fb of feedbackResult.items) {
      const submission = await this.prisma.submission.findFirst({
        where: { id: fb.submissionId, schoolId },
        select: {
          assignmentId: true,
          assignment: {
            select: {
              title: true,
              courseVersion: { select: { title: true } },
            },
          },
        },
      });

      items.push({
        feedbackId: fb.id,
        comment: fb.comment,
        decision: fb.decision,
        score: fb.score ?? null,
        courseTitle: submission?.assignment?.courseVersion?.title ?? "",
        assignmentTitle: submission?.assignment?.title ?? "",
        releasedAt: fb.releasedAt.toISOString(),
      });
    }

    return {
      items,
      nextCursor: feedbackResult.nextCursor,
      hasMore: feedbackResult.hasMore,
    };
  }

  async getTodayTasks(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccessDashboard(auth, schoolId)) {
      throw new StudentDashboardForbiddenException();
    }

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: auth.principal.userId, schoolId, status: "ACTIVE", role: "STUDENT" },
      select: { id: true, classId: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    const classIds = enrollments.map((e) => e.classId);
    const enrollmentId = enrollmentIds[0];

    if (!enrollmentId) {
      return buildStudentTodayDecision({
        teacherActionable: [],
        teacherWaiting: [],
        selfActionable: [],
        standardActionable: [],
        latestFormal: null,
        baselinePractice: null,
        legacyTasks: [],
      });
    }

    const [sessions, assignments, baselineDeliveries] = await Promise.all([
      this.prisma.assessmentSession.findMany({
        where: {
          schoolId,
          enrollmentId,
          purpose: { in: ["STANDARD", "REMEDIATION"] },
          status: {
            in: [
              "CREATED",
              "IN_PROGRESS",
              "SUBMITTED",
              "PROCESSING",
              "COMPLETED",
            ],
          },
        },
        select: {
          id: true,
          purpose: true,
          remediationOrigin: true,
          remediationFocus: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          practiceDefinitionId: true,
          report: { select: { overallScore: true, summary: true } },
          items: { select: { id: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.prisma.assignment.findMany({
        where: {
          schoolId,
          status: "OPEN",
          deletedAt: null,
          dueAt: { gte: now, lte: threeDaysLater },
          targets: {
            some: {
              OR: [
                { classId: { in: classIds } },
                { enrollmentId: { in: enrollmentIds } },
              ],
            },
          },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          status: true,
          courseVersionId: true,
          courseVersion: { select: { title: true } },
        },
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.practiceDelivery.findMany({
        where: {
          schoolId,
          status: "OPEN",
          OR: [
            { studentId: auth.principal.userId },
            { studentId: null, classId: enrollments[0]!.classId },
          ],
          AND: [{ OR: [{ deadline: null }, { deadline: { gte: now } }] }],
          practiceVersion: {
            status: "PUBLISHED",
            definition: {
              status: "PUBLISHED",
              difficulty: "水平一级",
              OR: [{ schoolId }, { schoolId: null }],
            },
          },
        },
        select: {
          createdAt: true,
          practiceVersion: {
            select: {
              definitionId: true,
              definition: { select: { title: true } },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
      }),
    ]);

    const definitionIds = [
      ...new Set(
        sessions
          .map((session) => session.practiceDefinitionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const definitions = definitionIds.length
      ? await this.prisma.practiceDefinition.findMany({
          where: {
            id: { in: definitionIds },
            status: "PUBLISHED",
            OR: [{ schoolId }, { schoolId: null }],
          },
          select: { id: true, title: true, difficulty: true },
        })
      : [];
    const definitionById = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    const activeStatuses = new Set([
      "CREATED",
      "IN_PROGRESS",
      "SUBMITTED",
      "PROCESSING",
    ]);
    const activeRemediations = sessions.filter(
      (session) =>
        session.purpose === "REMEDIATION" && activeStatuses.has(session.status),
    );
    const activeStandards = sessions.filter(
      (session) =>
        session.purpose === "STANDARD" &&
        (session.status === "CREATED" || session.status === "IN_PROGRESS"),
    );
    const asAttempt = (
      session: (typeof sessions)[number],
    ): StudentTodayAttempt => ({
      id: session.id,
      status: session.status as StudentTodayAttempt["status"],
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      itemCount: session.items.length,
      practiceTitle: session.practiceDefinitionId
        ? (definitionById.get(session.practiceDefinitionId)?.title ?? null)
        : null,
      focusDisplayName: this.studentTodayFocusName(session.remediationFocus),
    });

    const formalSessions = sessions
      .filter(
        (session) =>
          session.purpose === "STANDARD" &&
          session.status === "COMPLETED" &&
          session.completedAt &&
          session.practiceDefinitionId,
      )
      .flatMap((session) => {
        const diagnosis =
          session.report?.summary &&
          typeof session.report.summary === "object" &&
          !Array.isArray(session.report.summary)
            ? (session.report.summary as Record<string, unknown>).diagnosis
            : null;
        if (!isQuestionBankDiagnosis(diagnosis)) return [];
        const retryCandidates = diagnosis.retryCandidates.filter(
          (candidate) =>
            typeof candidate?.assessmentItemId === "string" &&
            typeof candidate?.questionVersionId === "string" &&
            typeof candidate?.displayName === "string",
        );
        const priority = diagnosis.priorities[0];
        return [
          {
            sessionId: session.id,
            completedAt: session.completedAt!.toISOString(),
            level:
              definitionById.get(session.practiceDefinitionId!)?.difficulty ??
              null,
            score:
              typeof session.report?.overallScore === "number" &&
              Number.isFinite(session.report.overallScore)
                ? session.report.overallScore
                : null,
            priorityDisplayName:
              typeof priority?.displayName === "string"
                ? priority.displayName
                : null,
            retryCandidateCount: retryCandidates.length,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.completedAt.localeCompare(left.completedAt) ||
          right.sessionId.localeCompare(left.sessionId),
      );

    const legacyTasks: StudentTodayLegacyTask[] = [];
    for (const assignment of assignments) {
      const [totalProgress, completedProgress] = await Promise.all([
        this.prisma.activityProgress.count({ where: { enrollmentId: { in: enrollmentIds }, activity: { lesson: { unit: { courseVersionId: assignment.courseVersionId } } } } }),
        this.prisma.activityProgress.count({ where: { enrollmentId: { in: enrollmentIds }, completed: true, activity: { lesson: { unit: { courseVersionId: assignment.courseVersionId } } } } }),
      ]);
      const offlineCount = await this.prisma.offlineContentPackage.count({
        where: { schoolId, courseVersionId: assignment.courseVersionId ?? "" },
      });
      legacyTasks.push({
        assignmentId: assignment.id,
        title: assignment.title,
        courseTitle: assignment.courseVersion?.title ?? "",
        dueAt: assignment.dueAt.toISOString(),
        status: assignment.status,
        progressPercent: totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0,
        hasOfflinePackage: offlineCount > 0,
      });
    }

    return buildStudentTodayDecision({
      teacherActionable: activeRemediations
        .filter(
          (session) =>
            session.remediationOrigin === "TEACHER_ASSIGNED" &&
            (session.status === "CREATED" || session.status === "IN_PROGRESS"),
        )
        .map(asAttempt),
      teacherWaiting: activeRemediations
        .filter(
          (session) =>
            session.remediationOrigin === "TEACHER_ASSIGNED" &&
            (session.status === "SUBMITTED" || session.status === "PROCESSING"),
        )
        .map(asAttempt),
      selfActionable: activeRemediations
        .filter(
          (session) =>
            (session.remediationOrigin === "SELF_INITIATED" ||
              session.remediationOrigin === null) &&
            (session.status === "CREATED" || session.status === "IN_PROGRESS"),
        )
        .map(asAttempt),
      standardActionable: activeStandards.map(asAttempt),
      latestFormal: formalSessions[0] ?? null,
      baselinePractice: baselineDeliveries[0]
        ? {
            practiceDefinitionId:
              baselineDeliveries[0].practiceVersion.definitionId,
            title: baselineDeliveries[0].practiceVersion.definition.title,
          }
        : null,
      legacyTasks,
    });
  }

  private studentTodayFocusName(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const record = value as Record<string, unknown>;
    return record.mode === "FAMILY"
      ? questionBankFamilyDisplayName(record.family)
      : "全部待巩固题目";
  }

  async getProfile(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccessDashboard(auth, schoolId)) {
      throw new StudentDashboardForbiddenException();
    }

    const userId = auth.principal.userId;

    // 1. Get user info
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    if (!user) {
      throw new StudentDashboardForbiddenException();
    }

    // 2. Get school membership
    const membership = await this.prisma.membership.findFirst({
      where: { userId, schoolId, status: "ACTIVE" },
      select: { school: { select: { name: true } } },
    });

    // 3. Get enrollments with class info
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, schoolId, status: "ACTIVE", role: "STUDENT" },
      include: { class: { select: { name: true, grade: true } } },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    // 4. Aggregate learning stats
    const [totalActivities, completedActivities] = await Promise.all([
      this.prisma.activityProgress.count({
        where: { enrollmentId: { in: enrollmentIds } },
      }),
      this.prisma.activityProgress.count({
        where: { enrollmentId: { in: enrollmentIds }, completed: true },
      }),
    ]);

    // 5. Count offline packages
    const offlinePackageCount = await this.prisma.offlineContentPackage.count({
      where: { schoolId },
    });

    const profile: StudentProfileData = {
      userId: user.id,
      displayName: user.displayName,
      schoolName: membership?.school?.name ?? "",
      gradeBand: enrollments[0]?.class?.grade ?? null,
      className: enrollments[0]?.class?.name ?? null,
      totalActivities,
      completedActivities,
      learningStreakDays: 0, // Requires daily tracking, placeholder
      offlinePackageCount,
    };

    return { profile };
  }
}
