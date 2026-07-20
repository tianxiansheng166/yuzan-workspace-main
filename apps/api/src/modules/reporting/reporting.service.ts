import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type { CreateReportData, ListReportsOptions, ReportRepositoryPort } from "./ports/report-repository.port.js";
import { REPORT_REPOSITORY } from "./ports/report-repository.port.js";
import type { LearningPlanRepositoryPort, CreateLearningPlanData } from "./ports/learning-plan-repository.port.js";
import { LEARNING_PLAN_REPOSITORY } from "./ports/learning-plan-repository.port.js";
import { ReportForbiddenException, ReportNotFoundException } from "./domain/report.errors.js";
import { ReportingPolicy } from "./reporting.policy.js";
import { toReportDetailResponse, toReportSummaryResponse, toStudentGrowthProfileResponse, toEnrichedGrowthProfileResponse, toLearningPlanResponse } from "./dto/report-response.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { Prisma } from "@yuzan/database";
import type {
  EnrichedStudentGrowthProfile,
  LearningSummary,
  PronunciationSummary,
  PronunciationErrorItem,
  FeedbackSummary,
  FeedbackSummaryItem,
  AssessmentSummary,
  GrowthStage,
  RecordingEvidenceItem,
} from "./domain/report.types.js";
import type { SaveLearningPlanInput } from "./domain/learning-plan.types.js";

const ERROR_TYPE_LABEL_MAP: Record<string, string> = {
  nasal_confusion: "前后鼻音混淆",
  retroflex: "平翘舌音混淆",
  tone: "声调起伏不足",
  pause: "多音节停顿不当",
  retroflex_curled: "卷舌音不到位",
  vowel: "元音发音不准",
  aspiration: "送气音混淆",
};

@Injectable()
export class ReportingService {
  private readonly policy = new ReportingPolicy();

  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly reportRepo: ReportRepositoryPort,
    @Inject(LEARNING_PLAN_REPOSITORY)
    private readonly learningPlanRepo: LearningPlanRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async listReports(auth: AuthContext, schoolId: string, options: ListReportsOptions) {
    if (!this.policy.canListReports(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const result = await this.reportRepo.list(schoolId, options);
    return {
      items: result.items.map(toReportSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async createReport(auth: AuthContext, schoolId: string, data: Omit<CreateReportData, "schoolId" | "generatedByUserId">) {
    if (!this.policy.canCreateReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const report = await this.reportRepo.create({
      ...data,
      schoolId,
      generatedByUserId: auth.principal.userId,
    });
    return toReportSummaryResponse(report);
  }

  async getReport(auth: AuthContext, schoolId: string, reportId: string) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const report = await this.reportRepo.findById(schoolId, reportId);
    if (!report) {
      throw new ReportNotFoundException();
    }
    return toReportDetailResponse(report);
  }

  async getStudentGrowthProfile(auth: AuthContext, schoolId: string, enrollmentId: string) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }

    // 1. Verify enrollment exists and user has access
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId, status: "ACTIVE" },
      include: {
        user: { select: { displayName: true } },
        class: { select: { name: true, grade: true } },
      },
    });

    if (!enrollment) {
      throw new ReportNotFoundException("学生注册记录不存在");
    }

    // Access control: student sees own, teacher sees their class students
    const userId = auth.principal.userId;
    const isStudent = enrollment.userId === userId;
    let isTeacherOfClass = false;
    if (!isStudent) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          userId,
          schoolId,
          classId: enrollment.classId,
          role: "TEACHER",
          status: "ACTIVE",
        },
      });
      isTeacherOfClass = !!teacherEnrollment;
    }
    const isAdmin = auth.principal.roles.some(
      (r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN",
    );
    if (!isStudent && !isTeacherOfClass && !isAdmin) {
      throw new ReportForbiddenException("无权查看该学生的成长档案");
    }

    // 2. Parallel data aggregation
    const [
      activityProgressRows,
      submissions,
      feedbackRows,
      recordings,
      speechJobs,
    ] = await Promise.all([
      // Activity progress
      this.prisma.activityProgress.findMany({
        where: { enrollmentId },
        select: { completed: true, updatedAt: true },
      }),
      // Submissions
      this.prisma.submission.findMany({
        where: { enrollmentId, schoolId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assignmentId: true,
          assignment: { select: { title: true, courseVersion: { select: { title: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Feedback
      this.prisma.feedback.findMany({
        where: {
          schoolId,
          deletedAt: null,
          submission: { enrollmentId },
        },
        select: {
          id: true,
          comment: true,
          decision: true,
          score: true,
          releasedAt: true,
          submission: {
            select: {
              assignment: {
                select: { title: true, courseVersion: { select: { title: true } } },
              },
            },
          },
        },
        orderBy: { releasedAt: "desc" },
        take: 10,
      }),
      // Recordings (completed)
      this.prisma.recording.findMany({
        where: { enrollmentId, schoolId, status: { in: ["COMPLETE", "READY"] } },
        select: {
          id: true,
          durationMs: true,
          createdAt: true,
          submissionId: true,
          submission: {
            select: { assignment: { select: { courseVersion: { select: { title: true } } } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Speech jobs for pronunciation analysis
      this.prisma.speechJob.findMany({
        where: {
          status: { in: ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"] },
          result: { not: Prisma.AnyNull },
          submission: { enrollmentId, schoolId },
        },
        select: { result: true },
      }),
    ]);

    // 3. Build learning summary
    const totalActivities = activityProgressRows.length;
    const completedActivities = activityProgressRows.filter((p) => p.completed).length;
    const completionRate = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

    // Learning streak: count distinct days with activity in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentProgressDates = activityProgressRows
      .filter((p) => p.updatedAt >= thirtyDaysAgo)
      .map((p) => p.updatedAt.toISOString().split("T")[0]);
    const uniqueDays = new Set(recentProgressDates).size;

    const learningSummary: LearningSummary = {
      totalActivities,
      completedActivities,
      completionRate,
      learningStreakDays: uniqueDays,
    };

    // 4. Build pronunciation summary
    const errorCounts = new Map<string, number>();
    for (const job of speechJobs) {
      const result = job.result as Record<string, unknown> | null;
      if (!result) continue;
      const errors = (result as { pronunciationErrors?: { type: string }[] }).pronunciationErrors ?? [];
      for (const err of errors) {
        const count = errorCounts.get(err.type) ?? 0;
        errorCounts.set(err.type, count + 1);
      }
    }
    const topErrors: PronunciationErrorItem[] = Array.from(errorCounts.entries())
      .map(([type, count]) => ({
        type,
        label: ERROR_TYPE_LABEL_MAP[type] ?? type,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const pronunciationSummary: PronunciationSummary = {
      totalRecordings: recordings.length,
      topErrors,
    };

    // 5. Build feedback summary
    const allFeedbackScores = feedbackRows
      .map((f) => f.score)
      .filter((s): s is number => s !== null);
    const averageScore = allFeedbackScores.length > 0
      ? Math.round((allFeedbackScores.reduce((a, b) => a + b, 0) / allFeedbackScores.length) * 10) / 10
      : null;

    const recentFeedbacks: FeedbackSummaryItem[] = feedbackRows.map((f) => ({
      feedbackId: f.id,
      comment: f.comment,
      decision: f.decision,
      score: f.score,
      courseTitle: f.submission?.assignment?.courseVersion?.title ?? "",
      assignmentTitle: f.submission?.assignment?.title ?? "",
      releasedAt: f.releasedAt.toISOString(),
    }));

    const feedbackSummary: FeedbackSummary = {
      totalCount: feedbackRows.length,
      averageScore,
      recentFeedbacks,
    };

    // 6. Build assessment summary (from AssessmentSession)
    const assessmentSessions = await this.prisma.assessmentSession.findMany({
      where: { enrollmentId, schoolId },
      select: { status: true, completedAt: true },
    });
    const totalSessions = assessmentSessions.length;
    const completedSessions = assessmentSessions.filter((s) => s.status === "COMPLETED").length;
    const latestCompleted = assessmentSessions
      .filter((s) => s.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];

    const assessmentSummary: AssessmentSummary = {
      totalSessions,
      completedSessions,
      latestSessionDate: latestCompleted?.completedAt?.toISOString() ?? null,
    };

    // 7. Build growth stages
    const hasSubmissions = submissions.length > 0;
    const hasRecordings = recordings.length > 0;
    const hasFeedback = feedbackRows.length > 0;

    const stages: GrowthStage[] = [
      {
        id: "course-learning",
        title: "课程学习",
        status: completionRate > 0 ? (completionRate >= 100 ? "COMPLETED" : "IN_PROGRESS") : "NOT_STARTED",
        progressPercent: completionRate,
      },
      {
        id: "practice",
        title: "课后练习",
        status: hasSubmissions ? "IN_PROGRESS" : "NOT_STARTED",
        progressPercent: submissions.length > 0
          ? Math.round((submissions.filter((s) => ["SUBMITTED", "REVIEWED", "ACCEPTED"].includes(s.status)).length / Math.max(submissions.length, 1)) * 100)
          : 0,
      },
      {
        id: "reading-aloud",
        title: "朗读作品",
        status: hasRecordings ? (recordings.length >= 3 ? "COMPLETED" : "IN_PROGRESS") : "NOT_STARTED",
        progressPercent: recordings.length > 0 ? Math.min(Math.round((recordings.length / 3) * 100), 100) : 0,
      },
      {
        id: "teacher-feedback",
        title: "教师反馈",
        status: hasFeedback ? "COMPLETED" : "NOT_STARTED",
        progressPercent: hasFeedback ? 100 : 0,
      },
      {
        id: "reassessment",
        title: "复测巩固",
        status: "NOT_STARTED",
        progressPercent: 0,
      },
    ];

    // 8. Build recording evidence list
    const recordingEvidence: RecordingEvidenceItem[] = recordings.map((r) => ({
      recordingId: r.id,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
      courseTitle: r.submission?.assignment?.courseVersion?.title ?? null,
    }));

    // 9. Calculate data completeness
    const dataPoints = [
      totalActivities > 0,
      hasSubmissions,
      hasRecordings,
      hasFeedback,
    ].filter(Boolean).length;
    const dataCompleteness = Math.round((dataPoints / 4) * 100);

    // 10. Build enriched profile
    const profile: EnrichedStudentGrowthProfile = {
      enrollmentId,
      schoolId,
      className: enrollment.class?.name ?? null,
      grade: enrollment.class?.grade ?? null,
      displayName: enrollment.user?.displayName ?? null,
      learningSummary,
      pronunciationSummary,
      feedbackSummary,
      assessmentSummary,
      stages,
      recordings: recordingEvidence,
      dataCompleteness,
    };

    return toEnrichedGrowthProfileResponse(profile);
  }

  async getLearningPlan(auth: AuthContext, schoolId: string, enrollmentId: string) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }

    // Verify enrollment access
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw new ReportNotFoundException("学生注册记录不存在");
    }

    const userId = auth.principal.userId;
    const isStudent = enrollment.userId === userId;
    const isAdmin = auth.principal.roles.some(
      (r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN",
    );
    if (!isStudent && !isAdmin) {
      // Check if teacher of this class
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: { userId, schoolId, classId: enrollment.classId, role: "TEACHER", status: "ACTIVE" },
      });
      if (!teacherEnrollment) {
        throw new ReportForbiddenException("无权查看该学生的学习计划");
      }
    }

    const plan = await this.learningPlanRepo.findByEnrollmentId(schoolId, enrollmentId);
    if (!plan) {
      return null;
    }
    return toLearningPlanResponse(plan);
  }

  async saveLearningPlan(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
    input: SaveLearningPlanInput,
  ) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }

    // Verify enrollment access — student can only save their own plan
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw new ReportNotFoundException("学生注册记录不存在");
    }

    const userId = auth.principal.userId;
    const isStudent = enrollment.userId === userId;
    const isAdmin = auth.principal.roles.some(
      (r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN",
    );
    if (!isStudent && !isAdmin) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: { userId, schoolId, classId: enrollment.classId, role: "TEACHER", status: "ACTIVE" },
      });
      if (!teacherEnrollment) {
        throw new ReportForbiddenException("无权修改该学生的学习计划");
      }
    }

    const existing = await this.learningPlanRepo.findByEnrollmentId(schoolId, enrollmentId);

    if (existing) {
      // Optimistic concurrency update
      const expectedRevision = input.expectedRevision ?? existing.revision;
      const updated = await this.learningPlanRepo.updateWithRevision(
        schoolId,
        enrollmentId,
        {
          planContent: input.planContent,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
        expectedRevision,
      );
      if (!updated) {
        throw new ReportForbiddenException("学习计划已被修改，请刷新后重试");
      }
      return toLearningPlanResponse(updated);
    }

    // Create new plan
    const data: CreateLearningPlanData = {
      schoolId,
      enrollmentId,
      authorUserId: userId,
      planContent: input.planContent,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    };
    const plan = await this.learningPlanRepo.create(data);
    return toLearningPlanResponse(plan);
  }
}
