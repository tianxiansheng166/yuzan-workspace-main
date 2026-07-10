export type DependencyCategory =
  | "database"
  | "object-storage"
  | "message-queue"
  | "ai-service"
  | "cache"
  | "external-api";

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

export interface ReadinessResult {
  status: "ok" | "degraded" | "unavailable";
  timestamp: string;
  dependencies: DependencyCheckResult[];
}

export type StartupState = "starting" | "ready" | "failed";

export interface LivenessResult {
  status: "ok";
  timestamp: string;
  service: string;
  uptimeMs: number;
}
