import { Injectable } from "@nestjs/common";
import type { LivenessData } from "./health.types.js";

@Injectable()
export class LivenessService {
  private readonly startTime = Date.now();

  check(service = "api"): LivenessData {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service,
      uptimeMs: Date.now() - this.startTime,
    };
  }
}
