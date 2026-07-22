import { Injectable } from "@nestjs/common";
import type {
  ClickAuditEntry,
  IntegrationConfig,
  IntegrationKey,
  MindGraphJob,
  MindGraphJobStatus,
} from "../domain/tool.types.js";
import { IntegrationUnavailableException } from "../domain/tool.errors.js";
import type {
  ListClickAuditsOptions,
  ListJobsOptions,
  PaginatedResult,
  ToolRepositoryPort,
} from "./tool-repository.port.js";

@Injectable()
export class UnavailableToolRepository implements ToolRepositoryPort {
  async findConfigByKey(
    _schoolId: string,
    _key: IntegrationKey,
  ): Promise<IntegrationConfig | null> {
    throw new IntegrationUnavailableException();
  }

  async listConfigs(
    _schoolId: string,
  ): Promise<readonly IntegrationConfig[]> {
    throw new IntegrationUnavailableException();
  }

  async createConfig(
    _config: Omit<
      IntegrationConfig,
      "id" | "createdAt" | "updatedAt"
    >,
  ): Promise<IntegrationConfig> {
    throw new IntegrationUnavailableException();
  }

  async updateConfig(
    _schoolId: string,
    _key: IntegrationKey,
    _patch: Partial<
      Pick<
        IntegrationConfig,
        "enabled" | "mode" | "publicUrl" | "status" | "lastCheckedAt"
      >
    >,
  ): Promise<IntegrationConfig> {
    throw new IntegrationUnavailableException();
  }

  async createMindGraphJob(
    _job: Omit<MindGraphJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<MindGraphJob> {
    throw new IntegrationUnavailableException();
  }

  async findJobById(_jobId: string): Promise<MindGraphJob | null> {
    throw new IntegrationUnavailableException();
  }

  async updateJobStatus(
    _jobId: string,
    _status: MindGraphJobStatus,
    _patch?: Partial<Pick<MindGraphJob, "resultPayload" | "errorCode">>,
  ): Promise<MindGraphJob> {
    throw new IntegrationUnavailableException();
  }

  async listJobsByConfig(
    _schoolId: string,
    _configId: string,
    _options: ListJobsOptions,
  ): Promise<PaginatedResult<MindGraphJob>> {
    throw new IntegrationUnavailableException();
  }

  async createClickAudit(
    _entry: Omit<ClickAuditEntry, "id" | "createdAt">,
  ): Promise<ClickAuditEntry> {
    throw new IntegrationUnavailableException();
  }

  async listClickAudits(
    _schoolId: string,
    _options: ListClickAuditsOptions,
  ): Promise<PaginatedResult<ClickAuditEntry>> {
    throw new IntegrationUnavailableException();
  }
}
