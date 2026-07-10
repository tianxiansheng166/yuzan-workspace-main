export type DependencyCategory =
  "database" | "object-storage" | "message-queue" | "ai-service";

export type DependencyStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "timeout"
  | "unknown"
  | "not-configured";

export interface DependencyCheckResult {
  name: string;
  category: DependencyCategory;
  status: DependencyStatus;
  responseTimeMs?: number;
  errorCode?: string;
  optional?: boolean;
}

export interface ReadinessData {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies?: DependencyCheckResult[];
}

export interface LivenessData {
  status: "ok";
  timestamp: string;
  service: string;
  uptimeMs: number;
}

export interface HealthEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

export type StartupState = "starting" | "ready" | "failed";
