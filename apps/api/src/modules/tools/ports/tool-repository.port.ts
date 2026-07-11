import type {
  ClickAuditEntry,
  IntegrationConfig,
  IntegrationKey,
  MindGraphJob,
  MindGraphJobStatus,
} from "../domain/tool.types.js";

export const TOOL_REPOSITORY = Symbol("TOOL_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListJobsOptions {
  readonly status?: MindGraphJobStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListClickAuditsOptions {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ToolRepositoryPort {
  // Integration config
  findConfigByKey(
    schoolId: string,
    key: IntegrationKey,
  ): Promise<IntegrationConfig | null>;
  listConfigs(schoolId: string): Promise<readonly IntegrationConfig[]>;
  createConfig(
    config: Omit<
      IntegrationConfig,
      "id" | "createdAt" | "updatedAt"
    >,
  ): Promise<IntegrationConfig>;
  updateConfig(
    schoolId: string,
    key: IntegrationKey,
    patch: Partial<Pick<IntegrationConfig, "enabled" | "mode" | "publicUrl" | "status" | "lastCheckedAt">>,
  ): Promise<IntegrationConfig>;

  // MindGraph jobs
  createMindGraphJob(
    job: Omit<MindGraphJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<MindGraphJob>;
  findJobById(jobId: string): Promise<MindGraphJob | null>;
  updateJobStatus(
    jobId: string,
    status: MindGraphJobStatus,
    patch?: Partial<Pick<MindGraphJob, "resultPayload" | "errorCode">>,
  ): Promise<MindGraphJob>;
  listJobsByConfig(
    schoolId: string,
    configId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<MindGraphJob>>;

  // Click audit
  createClickAudit(
    entry: Omit<ClickAuditEntry, "id" | "createdAt">,
  ): Promise<ClickAuditEntry>;
  listClickAudits(
    schoolId: string,
    options: ListClickAuditsOptions,
  ): Promise<PaginatedResult<ClickAuditEntry>>;
}
