import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { LivenessService } from "./liveness.service.js";
import { ReadinessService } from "./readiness.service.js";
import { StartupService } from "./startup.service.js";
import {
  type HealthEnvelope,
  type LivenessData,
  type ReadinessData,
} from "./health.types.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly liveness: LivenessService,
    private readonly readiness: ReadinessService,
    private readonly startup: StartupService,
  ) {}

  @Get("live")
  live(
    @Res({ passthrough: true }) response: Response,
  ): HealthEnvelope<LivenessData> {
    const requestId = String(response.getHeader("x-request-id") ?? "unknown");
    return {
      data: this.liveness.check(),
      meta: { requestId },
    };
  }

  @Get("ready")
  async ready(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthEnvelope<ReadinessData> | { error: unknown }> {
    const requestId = String(response.getHeader("x-request-id") ?? "unknown");
    const report = await this.readiness.check();

    if (!report.ready) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Required dependency unavailable",
          details: report.data.dependencies,
          requestId,
        },
      };
    }

    return {
      data: report.data,
      meta: { requestId },
    };
  }
}
