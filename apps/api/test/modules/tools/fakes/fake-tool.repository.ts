import type {
  ClickAuditEntry,
  IntegrationConfig,
  IntegrationKey,
  MindGraphJob,
  MindGraphJobStatus,
} from "../../../../src/modules/tools/domain/tool.types.js";
import type {
  ListClickAuditsOptions,
  ListJobsOptions,
  PaginatedResult,
  ToolRepositoryPort,
} from "../../../../src/modules/tools/ports/tool-repository.port.js";

export class FakeToolRepository implements ToolRepositoryPort {
  private configs: Map<string, IntegrationConfig> = new Map();
  private jobs: Map<string, MindGraphJob> = new Map();
  private audits: Map<string, ClickAuditEntry> = new Map();
  private nextId = 1;

  // --- helpers for tests ---

  addConfig(config: IntegrationConfig): void {
    this.configs.set(config.id, config);
  }

  addJob(job: MindGraphJob): void {
    this.jobs.set(job.id, job);
  }

  addAudit(entry: ClickAuditEntry): void {
    this.audits.set(entry.id, entry);
  }

  // --- ToolRepositoryPort implementation ---

  async findConfigByKey(
    schoolId: string,
    key: IntegrationKey,
  ): Promise<IntegrationConfig | null> {
    for (const config of this.configs.values()) {
      if (config.schoolId === schoolId && config.key === key) {
        return config;
      }
    }
    return null;
  }

  async listConfigs(schoolId: string): Promise<readonly IntegrationConfig[]> {
    return [...this.configs.values()].filter(
      (c) => c.schoolId === schoolId,
    );
  }

  async createConfig(
    data: Omit<IntegrationConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<IntegrationConfig> {
    const now = new Date();
    const config: IntegrationConfig = {
      id: `cfg-${this.nextId++}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.configs.set(config.id, config);
    return config;
  }

  async updateConfig(
    schoolId: string,
    key: IntegrationKey,
    patch: Partial<
      Pick<
        IntegrationConfig,
        "enabled" | "mode" | "publicUrl" | "status" | "lastCheckedAt"
      >
    >,
  ): Promise<IntegrationConfig> {
    const config = await this.findConfigByKey(schoolId, key);
    if (!config) {
      throw new Error(`Config not found: ${schoolId}/${key}`);
    }
    const updated: IntegrationConfig = {
      ...config,
      ...patch,
      updatedAt: new Date(),
    };
    this.configs.set(updated.id, updated);
    return updated;
  }

  async createMindGraphJob(
    data: Omit<MindGraphJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<MindGraphJob> {
    const now = new Date();
    const job: MindGraphJob = {
      id: `job-${this.nextId++}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async findJobById(jobId: string): Promise<MindGraphJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async updateJobStatus(
    jobId: string,
    status: MindGraphJobStatus,
    patch?: Partial<Pick<MindGraphJob, "resultPayload" | "errorCode">>,
  ): Promise<MindGraphJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const updated: MindGraphJob = {
      ...job,
      status,
      ...(patch?.resultPayload !== undefined
        ? { resultPayload: patch.resultPayload }
        : {}),
      ...(patch?.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      updatedAt: new Date(),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  async listJobsByConfig(
    schoolId: string,
    configId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<MindGraphJob>> {
    let items = [...this.jobs.values()].filter(
      (j) => j.schoolId === schoolId && j.configId === configId,
    );

    if (options.status) {
      items = items.filter((j) => j.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor:
        hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async createClickAudit(
    data: Omit<ClickAuditEntry, "id" | "createdAt">,
  ): Promise<ClickAuditEntry> {
    const now = new Date();
    const entry: ClickAuditEntry = {
      id: `audit-${this.nextId++}`,
      ...data,
      createdAt: now,
    };
    this.audits.set(entry.id, entry);
    return entry;
  }

  async listClickAudits(
    schoolId: string,
    options: ListClickAuditsOptions,
  ): Promise<PaginatedResult<ClickAuditEntry>> {
    const items = [...this.audits.values()]
      .filter((a) => a.schoolId === schoolId)
      .slice(0, options.limit);
    return { items, nextCursor: null, hasMore: false };
  }
}
