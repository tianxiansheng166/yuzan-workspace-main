import type {
  PlatformMetrics,
  SchoolUsageStats,
} from "../../../src/modules/admin/domain/admin.types.js";
import type { AdminMetricsPort } from "../../../src/modules/admin/ports/admin-metrics.port.js";

function defaultPlatformMetrics(): PlatformMetrics {
  return {
    schoolCount: 10,
    activeUserCount: 500,
    publishedCourseCount: 80,
    pendingReviewCount: 5,
    assessmentTaskCount: 200,
    learningCompletionRate: 0.72,
    providerStatuses: [
      { type: "email", healthStatus: "healthy", lastCheckedAt: new Date() },
    ],
    systemErrorCount: 2,
  };
}

function defaultSchoolUsageStats(): SchoolUsageStats {
  return {
    membershipCount: 50,
    classCount: 10,
    courseCount: 20,
    assignmentCount: 100,
    submissionCount: 400,
  };
}

export class FakeAdminMetricsPort implements AdminMetricsPort {
  private _platformMetrics: PlatformMetrics = defaultPlatformMetrics();
  private _schoolUsageStats = new Map<string, SchoolUsageStats>();

  setPlatformMetrics(metrics: PlatformMetrics): void {
    this._platformMetrics = metrics;
  }

  setSchoolUsageStats(schoolId: string, stats: SchoolUsageStats): void {
    this._schoolUsageStats.set(schoolId, stats);
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    return this._platformMetrics;
  }

  async getSchoolUsageStats(schoolId: string): Promise<SchoolUsageStats> {
    return this._schoolUsageStats.get(schoolId) ?? defaultSchoolUsageStats();
  }
}
