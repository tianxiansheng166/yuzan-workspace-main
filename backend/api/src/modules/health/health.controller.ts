import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get("live")
  live(): { status: "ok"; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async ready(@Res({ passthrough: true }) response: Response): Promise<{ status: "ok" | "unavailable"; timestamp: string }> {
    const readiness = await this.health.coreReadiness();
    const ok = Object.values(readiness).every((state) => state === "UP");
    if (!ok) response.status(503);
    return { status: ok ? "ok" : "unavailable", timestamp: new Date().toISOString() };
  }
}
