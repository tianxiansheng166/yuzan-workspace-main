export enum IntegrationKey {
  MINDMATE = "MINDMATE",
  MINDGRAPH = "MINDGRAPH",
  TIBETAN_TRANSLATION = "TIBETAN_TRANSLATION",
}

export enum IntegrationMode {
  DISABLED = "DISABLED",
  INFO_PAGE = "INFO_PAGE",
  EXTERNAL_LINK = "EXTERNAL_LINK",
}

export enum IntegrationStatus {
  OPERATIONAL = "OPERATIONAL",
  DEGRADED = "DEGRADED",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  OFFLINE = "OFFLINE",
}

export enum MindGraphJobStatus {
  CREATED = "CREATED",
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  READY = "READY",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface IntegrationConfig {
  readonly id: string;
  readonly schoolId: string;
  readonly key: IntegrationKey;
  readonly enabled: boolean;
  readonly mode: IntegrationMode;
  readonly publicUrl: string | null;
  readonly providerKey: string | null;
  readonly status: IntegrationStatus;
  readonly lastCheckedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MindGraphJob {
  readonly id: string;
  readonly schoolId: string;
  readonly configId: string;
  readonly status: MindGraphJobStatus;
  readonly inputPayload: Record<string, unknown> | null;
  readonly resultPayload: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ClickAuditEntry {
  readonly id: string;
  readonly schoolId: string;
  readonly integrationKey: IntegrationKey;
  readonly userId: string;
  readonly action: string;
  readonly targetUrl: string | null;
  readonly createdAt: Date;
}
