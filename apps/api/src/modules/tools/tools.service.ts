import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type {
  IntegrationConfig,
  IntegrationKey,
  MindGraphJobStatus,
} from "./domain/tool.types.js";
import { IntegrationMode } from "./domain/tool.types.js";
import {
  IntegrationForbiddenException,
  IntegrationNotFoundException,
  MindGraphJobNotFoundException,
  MindGraphProviderUnavailableException,
} from "./domain/tool.errors.js";
import {
  toClickAuditEntryResponse,
  toIntegrationConfigResponse,
  toMindGraphJobResponse,
} from "./dto/tool.response.js";
import type {
  ListJobsOptions,
  ToolRepositoryPort,
} from "./ports/tool-repository.port.js";
import { TOOL_REPOSITORY } from "./ports/tool-repository.port.js";
import { ToolsPolicy } from "./tools.policy.js";

@Injectable()
export class ToolsService {
  private readonly policy = new ToolsPolicy();

  constructor(
    @Inject(TOOL_REPOSITORY)
    private readonly toolRepo: ToolRepositoryPort,
  ) {}

  async listIntegrations(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const configs = await this.toolRepo.listConfigs(schoolId);
    return configs.map(toIntegrationConfigResponse);
  }

  async getIntegration(
    auth: AuthContext,
    schoolId: string,
    key: IntegrationKey,
  ) {
    if (!this.policy.canViewIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const config = await this.toolRepo.findConfigByKey(schoolId, key);
    if (!config) {
      throw new IntegrationNotFoundException();
    }

    return toIntegrationConfigResponse(config);
  }

  async updateIntegration(
    auth: AuthContext,
    schoolId: string,
    key: IntegrationKey,
    patch: { enabled?: boolean; mode?: string; publicUrl?: string },
  ) {
    if (!this.policy.canManageIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const existing = await this.toolRepo.findConfigByKey(schoolId, key);
    if (!existing) {
      throw new IntegrationNotFoundException();
    }

    const updated = await this.toolRepo.updateConfig(schoolId, key, {
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.mode !== undefined ? { mode: patch.mode as IntegrationMode } : {}),
      ...(patch.publicUrl !== undefined ? { publicUrl: patch.publicUrl } : {}),
    });
    return toIntegrationConfigResponse(updated);
  }

  async createMindGraphJob(
    auth: AuthContext,
    schoolId: string,
    inputPayload?: Record<string, unknown>,
  ) {
    if (!this.policy.canTriggerMindGraph(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const config = await this.toolRepo.findConfigByKey(
      schoolId,
      "MINDGRAPH" as IntegrationKey,
    );
    if (!config || !config.enabled) {
      throw new MindGraphProviderUnavailableException();
    }

    // When provider is NOT connected, MUST NOT fake "AI has generated" results
    if (
      config.status === "PROVIDER_UNAVAILABLE" ||
      config.status === "OFFLINE"
    ) {
      throw new MindGraphProviderUnavailableException();
    }

    const job = await this.toolRepo.createMindGraphJob({
      schoolId,
      configId: config.id,
      status: "CREATED" as MindGraphJobStatus,
      inputPayload: inputPayload ?? null,
      resultPayload: null,
      errorCode: null,
    });

    return toMindGraphJobResponse(job);
  }

  async getJobStatus(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
  ) {
    const job = await this.toolRepo.findJobById(jobId);
    if (!job) {
      throw new MindGraphJobNotFoundException();
    }

    if (job.schoolId !== schoolId) {
      throw new MindGraphJobNotFoundException();
    }

    if (!this.policy.canViewOwnJobs(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    // Return real status when AI/provider is unavailable
    return toMindGraphJobResponse(job);
  }

  async listMyJobs(
    auth: AuthContext,
    schoolId: string,
    options: ListJobsOptions,
  ) {
    if (!this.policy.canViewOwnJobs(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const config = await this.toolRepo.findConfigByKey(
      schoolId,
      "MINDGRAPH" as IntegrationKey,
    );
    if (!config) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const result = await this.toolRepo.listJobsByConfig(
      schoolId,
      config.id,
      options,
    );
    return {
      items: result.items.map(toMindGraphJobResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async auditClick(
    auth: AuthContext,
    schoolId: string,
    integrationKey: IntegrationKey,
    action: string,
    targetUrl?: string,
  ) {
    if (!this.policy.canViewIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const entry = await this.toolRepo.createClickAudit({
      schoolId,
      integrationKey,
      userId: auth.principal.userId,
      action,
      targetUrl: targetUrl ?? null,
    });

    return toClickAuditEntryResponse(entry);
  }
}
