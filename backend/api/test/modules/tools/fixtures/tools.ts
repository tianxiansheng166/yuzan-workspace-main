import type {
  IntegrationConfig,
  MindGraphJob,
  ClickAuditEntry,
} from "../../../../src/modules/tools/domain/tool.types.js";
import {
  IntegrationKey,
  IntegrationMode,
  IntegrationStatus,
  MindGraphJobStatus,
} from "../../../../src/modules/tools/domain/tool.types.js";

let configCounter = 1;
function configId(): string {
  return `cfg-${configCounter++}`;
}

let jobCounter = 1;
function jobId(): string {
  return `job-${jobCounter++}`;
}

let auditCounter = 1;
function auditId(): string {
  return `audit-${auditCounter++}`;
}

export function integrationConfig(
  overrides: Partial<IntegrationConfig> & { schoolId: string },
): IntegrationConfig {
  const now = new Date();
  return {
    id: configId(),
    schoolId: overrides.schoolId,
    key: IntegrationKey.MINDGRAPH,
    enabled: true,
    mode: IntegrationMode.INFO_PAGE,
    publicUrl: null,
    providerKey: "provider-1",
    status: IntegrationStatus.OPERATIONAL,
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mindGraphJob(
  overrides: Partial<MindGraphJob> & { schoolId: string; configId: string },
): MindGraphJob {
  const now = new Date();
  return {
    id: jobId(),
    schoolId: overrides.schoolId,
    configId: overrides.configId,
    status: MindGraphJobStatus.CREATED,
    inputPayload: null,
    resultPayload: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function clickAuditEntry(
  overrides: Partial<ClickAuditEntry> & {
    schoolId: string;
    integrationKey: IntegrationKey;
    userId: string;
  },
): ClickAuditEntry {
  const now = new Date();
  return {
    id: auditId(),
    schoolId: overrides.schoolId,
    integrationKey: overrides.integrationKey,
    userId: overrides.userId,
    action: "click",
    targetUrl: null,
    createdAt: now,
    ...overrides,
  };
}
