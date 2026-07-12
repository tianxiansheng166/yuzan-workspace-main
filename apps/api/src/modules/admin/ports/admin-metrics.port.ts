import type { PlatformMetrics, SchoolUsageStats } from "../domain/admin.types.js";

export const ADMIN_METRICS_PORT = Symbol("ADMIN_METRICS_PORT");

export interface AdminMetricsPort {
  getPlatformMetrics(): Promise<PlatformMetrics>;
  getSchoolUsageStats(schoolId: string): Promise<SchoolUsageStats>;
}
