import type {
  ClickAuditEntry,
  IntegrationConfig,
  IntegrationKey,
  MindGraphJob,
} from "../domain/tool.types.js";

/* ---------- Integration responses ---------- */

export interface IntegrationConfigResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly key: IntegrationKey;
  readonly enabled: boolean;
  readonly mode: string;
  readonly publicUrl: string | null;
  readonly status: string;
  readonly lastCheckedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Maps IntegrationConfig to a safe response.
 * CRITICAL: do NOT include providerKey or sensitive tokens in responses.
 */
export function toIntegrationConfigResponse(
  config: IntegrationConfig,
): IntegrationConfigResponse {
  return {
    id: config.id,
    schoolId: config.schoolId,
    key: config.key,
    enabled: config.enabled,
    mode: config.mode,
    publicUrl: config.publicUrl,
    status: config.status,
    lastCheckedAt: config.lastCheckedAt?.toISOString() ?? null,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

/* ---------- MindGraph job responses ---------- */

export interface MindGraphJobResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly configId: string;
  readonly status: string;
  readonly inputPayload: Record<string, unknown> | null;
  readonly resultPayload: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toMindGraphJobResponse(
  job: MindGraphJob,
): MindGraphJobResponse {
  return {
    id: job.id,
    schoolId: job.schoolId,
    configId: job.configId,
    status: job.status,
    inputPayload: job.inputPayload,
    resultPayload: job.resultPayload,
    errorCode: job.errorCode,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/* ---------- Click audit responses ---------- */

export interface ClickAuditEntryResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly integrationKey: IntegrationKey;
  readonly userId: string;
  readonly action: string;
  readonly targetUrl: string | null;
  readonly createdAt: string;
}

export function toClickAuditEntryResponse(
  entry: ClickAuditEntry,
): ClickAuditEntryResponse {
  return {
    id: entry.id,
    schoolId: entry.schoolId,
    integrationKey: entry.integrationKey,
    userId: entry.userId,
    action: entry.action,
    targetUrl: entry.targetUrl,
    createdAt: entry.createdAt.toISOString(),
  };
}
