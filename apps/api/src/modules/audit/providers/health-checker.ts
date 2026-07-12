import type { SystemProvider } from "../domain/provider.types.js";

export interface HealthCheckResult {
  readonly status: "UNKNOWN" | "HEALTHY" | "DEGRADED" | "DOWN";
  readonly latencyMs?: number;
  readonly error?: string;
}

/**
 * HealthChecker is a utility that can be extended to perform actual
 * health checks against provider endpoints. The default implementation
 * returns UNKNOWN status without making any network calls.
 */
export class HealthChecker {
  async check(_provider: SystemProvider): Promise<HealthCheckResult> {
    return { status: "UNKNOWN" };
  }
}
