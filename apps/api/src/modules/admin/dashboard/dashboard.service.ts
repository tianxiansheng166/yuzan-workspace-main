import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import { isPlatformAdmin } from "../../../common/security/index.js";
import { AdminForbiddenException } from "../domain/admin.errors.js";
import type { AdminMetricsPort } from "../ports/admin-metrics.port.js";
import { ADMIN_METRICS_PORT } from "../ports/admin-metrics.port.js";
import { toDashboardMetricsResponse } from "../dto/dashboard-metrics.response.js";

@Injectable()
export class DashboardService {
  constructor(
    @Inject(ADMIN_METRICS_PORT)
    private readonly metricsPort: AdminMetricsPort,
  ) {}

  async getPlatformMetrics(auth: AuthContext) {
    if (!isPlatformAdmin(auth)) {
      throw new AdminForbiddenException();
    }

    const metrics = await this.metricsPort.getPlatformMetrics();
    return toDashboardMetricsResponse(metrics);
  }
}
