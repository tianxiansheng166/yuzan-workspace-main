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
  findConfigByKey(
    _schoolId: string,
    _key: IntegrationKey,
  ): Promise<IntegrationConfig | null> {
    void _schoolId;
    void _key;
    return Promise.reject(new IntegrationUnavailableException());
  }

  listConfigs(_schoolId: string): Promise<readonly IntegrationConfig[]> {
    void _schoolId;
    return Promise.reject(new IntegrationUnavailableException());
  }

  createConfig(
    _config: Omit<IntegrationConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<IntegrationConfig> {
    void _config;
    return Promise.reject(new IntegrationUnavailableException());
  }

  updateConfig(
    _schoolId: string,
    _key: IntegrationKey,
    _patch: Partial<
      Pick<
        IntegrationConfig,
        "enabled" | "mode" | "publicUrl" | "status" | "lastCheckedAt"
      >
    >,
  ): Promise<IntegrationConfig> {
    void _schoolId;
    void _key;
    void _patch;
    return Promise.reject(new IntegrationUnavailableException());
  }

  createMindGraphJob(
    _job: Omit<MindGraphJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<MindGraphJob> {
    void _job;
    return Promise.reject(new IntegrationUnavailableException());
  }

  findJobById(_jobId: string): Promise<MindGraphJob | null> {
    void _jobId;
    return Promise.reject(new IntegrationUnavailableException());
  }

  updateJobStatus(
    _jobId: string,
    _status: MindGraphJobStatus,
    _patch?: Partial<Pick<MindGraphJob, "resultPayload" | "errorCode">>,
  ): Promise<MindGraphJob> {
    void _jobId;
    void _status;
    void _patch;
    return Promise.reject(new IntegrationUnavailableException());
  }

  listJobsByConfig(
    _schoolId: string,
    _configId: string,
    _options: ListJobsOptions,
  ): Promise<PaginatedResult<MindGraphJob>> {
    void _schoolId;
    void _configId;
    void _options;
    return Promise.reject(new IntegrationUnavailableException());
  }

  createClickAudit(
    _entry: Omit<ClickAuditEntry, "id" | "createdAt">,
  ): Promise<ClickAuditEntry> {
    void _entry;
    return Promise.reject(new IntegrationUnavailableException());
  }

  listClickAudits(
    _schoolId: string,
    _options: ListClickAuditsOptions,
  ): Promise<PaginatedResult<ClickAuditEntry>> {
    void _schoolId;
    void _options;
    return Promise.reject(new IntegrationUnavailableException());
  }
}
