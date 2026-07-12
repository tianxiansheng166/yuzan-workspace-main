import { Injectable } from "@nestjs/common";
import type { PlatformMetrics, SchoolUsageStats } from "../domain/admin.types.js";
import { AdminUnavailableException } from "../domain/admin.errors.js";
import type { AdminMetricsPort } from "./admin-metrics.port.js";

@Injectable()
export class UnavailableAdminMetrics implements AdminMetricsPort {
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    throw new AdminUnavailableException();
  }

  async getSchoolUsageStats(_schoolId: string): Promise<SchoolUsageStats> {
    throw new AdminUnavailableException();
  }
}
