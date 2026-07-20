import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { Prisma } from "@yuzan/database";
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
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
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

  // ---------- Teacher AI Tools Center methods ----------

  async getTeacherToolsState(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const userId = auth.principal.userId;

    // Get integrations
    const configs = await this.toolRepo.listConfigs(schoolId);
    const tools = configs.map((c) => ({
      key: c.key,
      label: this.toolKeyToLabel(c.key),
      description: this.toolKeyToDescription(c.key),
      enabled: c.enabled,
      status: c.status,
    }));

    // Get recent usage from click audits (simplified)
    const recentUsage: { toolKey: string; lastUsedAt: string; action: string }[] = [];

    // Get drafts
    const drafts = await this.prisma.teacherDraft.findMany({
      where: { schoolId, authorUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, toolSource: true, title: true, updatedAt: true },
    });

    // Get invite code
    const inviteCode = await this.prisma.inviteCode.findFirst({
      where: {
        schoolId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
        usedCount: { lt: 10 },
      },
      orderBy: { createdAt: "desc" },
    });

    // External services from integrations
    const externalServices = configs.map((c) => ({
      key: c.key,
      label: this.toolKeyToLabel(c.key),
      status: c.status,
      enabled: c.enabled,
    }));

    return {
      tools,
      recentUsage,
      drafts: drafts.map((d) => ({
        id: d.id,
        toolSource: d.toolSource,
        title: d.title,
        updatedAt: d.updatedAt.toISOString(),
      })),
      externalServices,
      inviteCode: inviteCode
        ? {
            code: inviteCode.code,
            expiresAt: inviteCode.expiresAt.toISOString(),
            remainingUses: inviteCode.maxUses - inviteCode.usedCount,
          }
        : null,
    };
  }

  async generatePlan(
    auth: AuthContext,
    schoolId: string,
    dto: { goal: string; courseVersionId?: string; gradeBand?: string },
  ) {
    if (!this.policy.canTriggerMindGraph(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    // Check if MINDMATE integration is available
    const config = await this.toolRepo.findConfigByKey(
      schoolId,
      "MINDMATE" as IntegrationKey,
    );

    if (!config || !config.enabled) {
      return {
        status: "PROVIDER_NOT_CONFIGURED" as const,
        jobId: null,
        plan: null,
      };
    }

    if (config.status === "PROVIDER_UNAVAILABLE" || config.status === "OFFLINE") {
      return {
        status: "PROVIDER_NOT_CONFIGURED" as const,
        jobId: null,
        plan: null,
      };
    }

    // Create a MindGraph job with the teaching plan request
    const job = await this.toolRepo.createMindGraphJob({
      schoolId,
      configId: config.id,
      status: "CREATED" as MindGraphJobStatus,
      inputPayload: {
        goal: dto.goal,
        courseVersionId: dto.courseVersionId,
        gradeBand: dto.gradeBand,
      },
      resultPayload: null,
      errorCode: null,
    });

    return {
      status: "PENDING" as const,
      jobId: job.id,
      plan: null,
    };
  }

  async listDrafts(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewOwnJobs(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const drafts = await this.prisma.teacherDraft.findMany({
      where: { schoolId, authorUserId: auth.principal.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        toolSource: true,
        title: true,
        content: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      items: drafts.map((d) => ({
        id: d.id,
        toolSource: d.toolSource,
        title: d.title,
        content: d.content,
        revision: d.revision,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  }

  async saveDraft(
    auth: AuthContext,
    schoolId: string,
    dto: { toolSource: string; title: string; content: Record<string, unknown> },
  ) {
    if (!this.policy.canManageIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const draft = await this.prisma.teacherDraft.create({
      data: {
        schoolId,
        authorUserId: auth.principal.userId,
        toolSource: dto.toolSource as "MINDMATE" | "MINDGRAPH" | "LESSON_PLAN" | "WORKSHEET",
        title: dto.title,
        content: JSON.parse(JSON.stringify(dto.content)),
      },
    });

    return {
      id: draft.id,
      toolSource: draft.toolSource,
      title: draft.title,
      revision: draft.revision,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async listExternalServices(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    const configs = await this.toolRepo.listConfigs(schoolId);

    return {
      items: configs.map((c) => ({
        key: c.key,
        label: this.toolKeyToLabel(c.key),
        status: c.status,
        enabled: c.enabled,
        providerDisclosure: this.getProviderDisclosure(c.key),
      })),
    };
  }

  async getOrCreateInviteCode(auth: AuthContext, schoolId: string) {
    if (!this.policy.canManageIntegrations(auth, schoolId)) {
      throw new IntegrationForbiddenException();
    }

    // Find existing valid code
    const existing = await this.prisma.inviteCode.findFirst({
      where: {
        schoolId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
        usedCount: { lt: 10 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return {
        code: existing.code,
        expiresAt: existing.expiresAt.toISOString(),
        remainingUses: existing.maxUses - existing.usedCount,
      };
    }

    // Generate new code
    const crypto = await import("node:crypto");
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const newCode = await this.prisma.inviteCode.create({
      data: {
        schoolId,
        code,
        createdByUserId: auth.principal.userId,
        maxUses: 10,
        usedCount: 0,
        expiresAt,
      },
    });

    return {
      code: newCode.code,
      expiresAt: newCode.expiresAt.toISOString(),
      remainingUses: newCode.maxUses - newCode.usedCount,
    };
  }

  private toolKeyToLabel(key: string): string {
    const map: Record<string, string> = {
      MINDMATE: "MindMate 智能助手",
      MINDGRAPH: "MindGraph 思维导图",
      TIBETAN_TRANSLATION: "藏汉翻译工具",
    };
    return map[key] ?? key;
  }

  private toolKeyToDescription(key: string): string {
    const map: Record<string, string> = {
      MINDMATE: "AI驱动的备课和教学辅助工具",
      MINDGRAPH: "可视化思维导图生成工具",
      TIBETAN_TRANSLATION: "藏语与汉语之间的互译工具",
    };
    return map[key] ?? "";
  }

  private getProviderDisclosure(key: string): string {
    const map: Record<string, string> = {
      MINDMATE: "教学目标和课程信息将发送至AI服务生成建议",
      MINDGRAPH: "课程结构和关键词将发送至思维导图服务",
      TIBETAN_TRANSLATION: "翻译文本将发送至翻译服务处理",
    };
    return map[key] ?? "";
  }
}