export type SystemStatus = "ok" | "degraded" | "down";

export interface OperationsStatus {
  readonly status: SystemStatus;
  readonly timestamp: Date;
  readonly version: string;
  readonly database: "connected" | "disconnected";
  readonly activeSchools: number;
}
