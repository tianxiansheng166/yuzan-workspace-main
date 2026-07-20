import type { Report, StudentGrowthProfile, EnrichedStudentGrowthProfile } from "../domain/report.types.js";
import type { LearningPlan } from "../domain/learning-plan.types.js";

export function toReportSummaryResponse(report: Report) {
  return {
    id: report.id,
    type: report.type,
    status: report.status,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    dataCompleteness: report.dataCompleteness,
    revision: report.revision,
    enrollmentId: report.enrollmentId,
    classId: report.classId,
  };
}

export function toReportDetailResponse(report: Report) {
  return {
    ...toReportSummaryResponse(report),
    generatedAt: report.generatedAt?.toISOString() ?? null,
    providerDisclosure: report.providerDisclosure,
    filters: report.filters,
    schoolId: report.schoolId,
    data: report.data,
    createdAt: report.createdAt.toISOString(),
  };
}

export function toStudentGrowthProfileResponse(profile: StudentGrowthProfile) {
  return {
    enrollmentId: profile.enrollmentId,
    periodStart: profile.periodStart.toISOString(),
    periodEnd: profile.periodEnd.toISOString(),
    generatedAt: profile.generatedAt.toISOString(),
    dataCompleteness: profile.dataCompleteness,
    providerDisclosure: profile.providerDisclosure,
    data: profile.data,
  };
}

export function toEnrichedGrowthProfileResponse(profile: EnrichedStudentGrowthProfile) {
  return {
    enrollmentId: profile.enrollmentId,
    schoolId: profile.schoolId,
    className: profile.className,
    grade: profile.grade,
    displayName: profile.displayName,
    learningSummary: {
      totalActivities: profile.learningSummary.totalActivities,
      completedActivities: profile.learningSummary.completedActivities,
      completionRate: profile.learningSummary.completionRate,
      learningStreakDays: profile.learningSummary.learningStreakDays,
    },
    pronunciationSummary: {
      totalRecordings: profile.pronunciationSummary.totalRecordings,
      topErrors: profile.pronunciationSummary.topErrors.map((e) => ({
        type: e.type,
        label: e.label,
        count: e.count,
      })),
    },
    feedbackSummary: {
      totalCount: profile.feedbackSummary.totalCount,
      averageScore: profile.feedbackSummary.averageScore,
      recentFeedbacks: profile.feedbackSummary.recentFeedbacks,
    },
    assessmentSummary: {
      totalSessions: profile.assessmentSummary.totalSessions,
      completedSessions: profile.assessmentSummary.completedSessions,
      latestSessionDate: profile.assessmentSummary.latestSessionDate,
    },
    stages: profile.stages.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      progressPercent: s.progressPercent,
    })),
    recordings: profile.recordings.map((r) => ({
      recordingId: r.recordingId,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      courseTitle: r.courseTitle,
    })),
    dataCompleteness: profile.dataCompleteness,
  };
}

export function toLearningPlanResponse(plan: LearningPlan) {
  return {
    id: plan.id,
    schoolId: plan.schoolId,
    enrollmentId: plan.enrollmentId,
    authorUserId: plan.authorUserId,
    planContent: plan.planContent,
    periodStart: plan.periodStart.toISOString(),
    periodEnd: plan.periodEnd.toISOString(),
    revision: plan.revision,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
