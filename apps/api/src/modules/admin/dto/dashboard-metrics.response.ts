import type { PlatformMetrics } from "../domain/admin.types.js";

export interface DashboardMetricsResponse {
  readonly schoolCount: number;
  readonly activeUserCount: number;
  readonly publishedCourseCount: number;
  readonly pendingReviewCount: number;
  readonly assessmentTaskCount: number;
  readonly learningCompletionRate: number;
  readonly systemErrorCount: number;
  readonly providerHealthyCount: number;
  readonly providerDegradedCount: number;
  readonly providerStatuses: readonly {
    readonly type: string;
    readonly healthStatus: string;
    readonly lastCheckedAt: string;
  }[];
}

export function toDashboardMetricsResponse(
  metrics: PlatformMetrics,
): DashboardMetricsResponse {
  const providerHealthyCount = metrics.providerStatuses.filter(
    (p) => p.healthStatus === "healthy",
  ).length;
  const providerDegradedCount = metrics.providerStatuses.filter(
    (p) => p.healthStatus === "degraded",
  ).length;

  return {
    schoolCount: metrics.schoolCount,
    activeUserCount: metrics.activeUserCount,
    publishedCourseCount: metrics.publishedCourseCount,
    pendingReviewCount: metrics.pendingReviewCount,
    assessmentTaskCount: metrics.assessmentTaskCount,
    learningCompletionRate: metrics.learningCompletionRate,
    systemErrorCount: metrics.systemErrorCount,
    providerHealthyCount,
    providerDegradedCount,
    providerStatuses: metrics.providerStatuses.map((p) => ({
      type: p.type,
      healthStatus: p.healthStatus,
      lastCheckedAt: p.lastCheckedAt.toISOString(),
    })),
  };
}
