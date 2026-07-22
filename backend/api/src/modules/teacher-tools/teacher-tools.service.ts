import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";

@Injectable()
export class TeacherToolsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the overall state of the teacher tools center:
   * - Available tools with their status
   * - Recent drafts
   * - Invite code
   * - External service configs (stub)
   */
  async getToolsState(auth: AuthContext, schoolId: string) {
    const teacherId = auth.principal.userId;

    // Verify teacher/admin access
    const hasAccess = auth.principal.roles.some(
      (r) => r === MembershipRole.TEACHER || r === MembershipRole.SCHOOL_ADMIN,
    );
    if (!hasAccess) {
      throw new Error("无权访问教师工具中心");
    }

    // Parallel queries
    const [recentDrafts, activeInviteCode, toolUsageCounts] = await Promise.all([
      // Recent drafts by this teacher
      this.prisma.teacherDraft.findMany({
        where: { schoolId, authorUserId: teacherId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          toolSource: true,
          title: true,
          revision: true,
          updatedAt: true,
        },
      }),
      // Active invite code
      this.prisma.inviteCode.findFirst({
        where: {
          schoolId,
          createdByUserId: teacherId,
          expiresAt: { gt: new Date() },
          revokedAt: null,
          usedCount: { lt: 10 }, // maxUses default
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          maxUses: true,
          usedCount: true,
          expiresAt: true,
        },
      }),
      // Tool usage counts
      this.prisma.teacherDraft.groupBy({
        by: ["toolSource"],
        where: { schoolId, authorUserId: teacherId },
        _count: { id: true },
      }),
    ]);

    // Build tools list
    const tools = [
      {
        id: "mindmate",
        name: "MindMate 备课助手",
        description: "AI 辅助生成备课路径与教学方案",
        icon: "brain",
        enabled: true,
        draftCount: toolUsageCounts.find((g) => g.toolSource === "MINDMATE")?._count.id ?? 0,
      },
      {
        id: "mindgraph",
        name: "MindGraph 知识图谱",
        description: "构建课程知识结构与关联",
        icon: "graph",
        enabled: true,
        draftCount: toolUsageCounts.find((g) => g.toolSource === "MINDGRAPH")?._count.id ?? 0,
      },
      {
        id: "lesson-plan",
        name: "教案生成器",
        description: "根据教学目标生成结构化教案",
        icon: "file-text",
        enabled: true,
        draftCount: toolUsageCounts.find((g) => g.toolSource === "LESSON_PLAN")?._count.id ?? 0,
      },
      {
        id: "worksheet",
        name: "练习册生成器",
        description: "根据知识点生成配套练习题",
        icon: "pencil",
        enabled: true,
        draftCount: toolUsageCounts.find((g) => g.toolSource === "WORKSHEET")?._count.id ?? 0,
      },
    ];

    // External services (stub — no ExternalServiceConfig model yet)
    const externalServices = {
      mindmate: { status: "AVAILABLE", configured: true },
      mindgraph: { status: "PROVIDER_NOT_CONFIGURED", configured: false },
      translation: { status: "PROVIDER_NOT_CONFIGURED", configured: false },
    };

    return {
      tools,
      recentDrafts: recentDrafts.map((d) => ({
        id: d.id,
        toolSource: d.toolSource,
        title: d.title,
        revision: d.revision,
        updatedAt: d.updatedAt.toISOString(),
      })),
      inviteCode: activeInviteCode
        ? {
            id: activeInviteCode.id,
            code: activeInviteCode.code,
            maxUses: activeInviteCode.maxUses,
            usedCount: activeInviteCode.usedCount,
            expiresAt: activeInviteCode.expiresAt.toISOString(),
          }
        : null,
      externalServices,
    };
  }

  /**
   * List drafts by the current teacher, optionally filtered by toolSource.
   */
  async listDrafts(
    auth: AuthContext,
    schoolId: string,
    options: { toolSource?: "MINDMATE" | "MINDGRAPH" | "LESSON_PLAN" | "WORKSHEET"; limit: number },
  ) {
    const teacherId = auth.principal.userId;

    const drafts = await this.prisma.teacherDraft.findMany({
      where: {
        schoolId,
        authorUserId: teacherId,
        ...(options.toolSource ? { toolSource: options.toolSource } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit,
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

    return drafts.map((d) => ({
      id: d.id,
      toolSource: d.toolSource,
      title: d.title,
      content: d.content,
      revision: d.revision,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  /**
   * Create a new draft for the teacher.
   */
  async createDraft(
    auth: AuthContext,
    schoolId: string,
    dto: { toolSource: string; title: string; content: Record<string, unknown> },
  ) {
    const teacherId = auth.principal.userId;

    const draft = await this.prisma.teacherDraft.create({
      data: {
        schoolId,
        authorUserId: teacherId,
        toolSource: dto.toolSource as "MINDMATE" | "MINDGRAPH" | "LESSON_PLAN" | "WORKSHEET",
        title: dto.title,
        content: dto.content as unknown as import("@yuzan/database").Prisma.InputJsonValue,
      },
    });

    return {
      id: draft.id,
      toolSource: draft.toolSource,
      title: draft.title,
      content: draft.content,
      revision: draft.revision,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  /**
   * Get or create an active invite code for the teacher.
   */
  async getInviteCode(auth: AuthContext, schoolId: string) {
    const teacherId = auth.principal.userId;

    // Find active invite code
    const existing = await this.prisma.inviteCode.findFirst({
      where: {
        schoolId,
        createdByUserId: teacherId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return {
        id: existing.id,
        code: existing.code,
        maxUses: existing.maxUses,
        usedCount: existing.usedCount,
        expiresAt: existing.expiresAt.toISOString(),
      };
    }

    // Generate a new invite code
    const code = this.generateInviteCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        schoolId,
        code,
        createdByUserId: teacherId,
        maxUses: 10,
        usedCount: 0,
        expiresAt,
      },
    });

    return {
      id: inviteCode.id,
      code: inviteCode.code,
      maxUses: inviteCode.maxUses,
      usedCount: inviteCode.usedCount,
      expiresAt: inviteCode.expiresAt.toISOString(),
    };
  }

  /**
   * Generate a teaching plan using AI (stub — returns PROVIDER_NOT_CONFIGURED until AI provider is integrated).
   */
  async generatePlan(
    auth: AuthContext,
    schoolId: string,
    input: { goal: string; courseVersionId?: string; gradeBand?: string },
  ) {
    // P2 rule: AI provider not configured yet
    // Return a structured placeholder that the frontend can use
    const placeholderPlan = {
      goal: input.goal,
      courseVersionId: input.courseVersionId ?? null,
      gradeBand: input.gradeBand ?? null,
      stages: [
        {
          id: "stage-1",
          title: "学情诊断",
          description: "了解学生现有水平和薄弱环节",
          tools: ["mindmate"],
          duration: "1课时",
        },
        {
          id: "stage-2",
          title: "目标设定",
          description: "根据诊断结果设定教学目标",
          tools: ["lesson-plan"],
          duration: "1课时",
        },
        {
          id: "stage-3",
          title: "教学实施",
          description: "按计划实施教学活动",
          tools: ["mindgraph", "worksheet"],
          duration: "3课时",
        },
        {
          id: "stage-4",
          title: "评估反馈",
          description: "检测学习效果并调整策略",
          tools: ["mindmate"],
          duration: "1课时",
        },
      ],
      _meta: {
        generatedBy: "placeholder",
        providerStatus: "PROVIDER_NOT_CONFIGURED",
        message: "AI 服务尚未配置，当前为默认备课路径模板。接入 AI 服务后将生成个性化备课建议。",
      },
    };

    // Auto-save as draft
    const teacherId = auth.principal.userId;
    await this.prisma.teacherDraft.create({
      data: {
        schoolId,
        authorUserId: teacherId,
        toolSource: "LESSON_PLAN",
        title: `备课路径：${input.goal.slice(0, 50)}`,
        content: placeholderPlan as unknown as import("@yuzan/database").Prisma.InputJsonValue,
      },
    });

    return placeholderPlan;
  }

  private generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "YZ-";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
