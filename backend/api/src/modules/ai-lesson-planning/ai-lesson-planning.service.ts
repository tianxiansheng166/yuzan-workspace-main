import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type {
  CreateLessonPlanJobDto,
} from "./dto/create-lesson-plan-job.dto.js";
import type {
  UpdateDraftDto,
} from "./dto/update-draft.dto.js";
import type {
  LessonPlanJobResponse,
  LessonPlanDraftResponse,
  WorkflowStatusResponse,
} from "./dto/lesson-plan-job.response.js";
import type { AiJobStatus } from "@yuzan/database";

const AI_GENERATION_QUEUE = "ai-generation-jobs";
const LESSON_PLANNER_WORKFLOW_KEY = "lesson-planner";

/** Terminal states — a job in any of these cannot transition further. */
const TERMINAL_STATES: ReadonlySet<string> = new Set([
  "SUCCEEDED",
  "FAILED",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_UNAVAILABLE",
  "OUTPUT_SCHEMA_INVALID",
  "TIMEOUT",
  "CANCELLED",
]);

@Injectable()
export class AiLessonPlanningService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject("BULLMQ_AI_GENERATION")
    private readonly aiQueue: Queue | null,
    private readonly config: ConfigService,
  ) {}

  // ─── Job lifecycle ────────────────────────────────────

  /**
   * Create an idempotent AI lesson-plan generation job.
   * If idempotencyKey matches an existing job, return it instead.
   */
  async createJob(
    auth: AuthContext,
    schoolId: string,
    dto: CreateLessonPlanJobDto,
  ): Promise<LessonPlanJobResponse> {
    const teacherId = auth.principal.userId;

    // Check if provider is configured
    const providerConfigured = this.isProviderConfigured();
    if (!providerConfigured) {
      // Create a job that immediately fails with PROVIDER_NOT_CONFIGURED
      const job = await this.prisma.aiGenerationJob.create({
        data: {
          schoolId,
          teacherId,
          workflowDefinitionId: await this.getOrCreateWorkflowDefinitionId(),
          idempotencyKey: dto.idempotencyKey ?? crypto.randomUUID(),
          status: "PROVIDER_NOT_CONFIGURED" as AiJobStatus,
          inputSnapshot: dto as any,
          errorCode: "PROVIDER_NOT_CONFIGURED",
        },
      });
      return this.toJobResponse(job, null);
    }

    // Idempotency: if key provided, check for existing job
    if (dto.idempotencyKey) {
      const existing = await this.prisma.aiGenerationJob.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, schoolId },
      });
      if (existing) {
        const draft = await this.prisma.lessonPlanDraft.findUnique({
          where: { generationJobId: existing.id },
          select: { id: true },
        });
        return this.toJobResponse(existing, draft?.id ?? null);
      }
    }

    const workflowDefinitionId = await this.getOrCreateWorkflowDefinitionId();

    // Gap 5 fix: Fetch the workflow definition to get externalFlowId for the payload
    const workflowDef = await this.prisma.aiWorkflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
    });
    const externalFlowId = workflowDef?.externalFlowId ?? null;

    // Enrich inputSnapshot with real course data if courseVersionId provided
    const enrichedInput = await this.enrichInputWithCourseData(dto, schoolId);

    // Create job in QUEUED state
    const job = await this.prisma.aiGenerationJob.create({
      data: {
        schoolId,
        teacherId,
        workflowDefinitionId,
        idempotencyKey: dto.idempotencyKey ?? crypto.randomUUID(),
        status: "QUEUED" as AiJobStatus,
        inputSnapshot: enrichedInput as any,
      },
    });

    // Enqueue to BullMQ — send full payload so Worker has all fields
    // Gap 5: Include externalFlowId from DB as single source of truth
    if (this.aiQueue) {
      await this.aiQueue.add(
        "generate-lesson-plan",
        {
          jobId: job.id,
          schoolId,
          teacherId,
          goal: enrichedInput.goal,
          courseVersionId: enrichedInput.courseVersionId ?? null,
          unitId: enrichedInput.unitId ?? null,
          lessonId: enrichedInput.lessonId ?? null,
          gradeBand: enrichedInput.gradeBand ?? null,
          subject: enrichedInput.subject ?? null,
          durationMinutes: enrichedInput.durationMinutes ?? 40,
          keyRequirements: enrichedInput.keyRequirements ?? null,
          outputModules: enrichedInput.outputModules ?? null,
          locale: enrichedInput.locale ?? "zh-CN",
          courseTitle: enrichedInput.courseTitle ?? null,
          courseSummary: enrichedInput.courseSummary ?? null,
          lessonTitle: enrichedInput.lessonTitle ?? null,
          lessonContentSummary: enrichedInput.lessonContentSummary ?? null,
          classAggregateSummary: enrichedInput.classAggregateSummary ?? null,
          externalFlowId,
        },
        {
          jobId: job.id,
          attempts: 2,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    }

    return this.toJobResponse(job, null);
  }

  /**
   * Get a single job by ID. Only the owning teacher or school admin can view it.
   */
  async getJob(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
  ): Promise<LessonPlanJobResponse> {
    const job = await this.prisma.aiGenerationJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!job) {
      throw Object.assign(new Error("Job not found"), { code: "NOT_FOUND" });
    }
    // Access control: only the teacher who created it or school admin
    this.assertJobAccess(auth, job.teacherId);

    const draft = await this.prisma.lessonPlanDraft.findUnique({
      where: { generationJobId: job.id },
      select: { id: true },
    });
    return this.toJobResponse(job, draft?.id ?? null);
  }

  /**
   * Cancel a job. Only QUEUED or RUNNING jobs can be cancelled.
   */
  async cancelJob(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
  ): Promise<LessonPlanJobResponse> {
    const job = await this.prisma.aiGenerationJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!job) {
      throw Object.assign(new Error("Job not found"), { code: "NOT_FOUND" });
    }
    this.assertJobAccess(auth, job.teacherId);

    if (job.status !== "QUEUED" && job.status !== "RUNNING") {
      throw Object.assign(
        new Error(`Cannot cancel job in status ${job.status}`),
        { code: "INVALID_STATE" },
      );
    }

    const updated = await this.prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED" as AiJobStatus,
        completedAt: new Date(),
      },
    });

    // Try to remove from BullMQ if still queued
    if (this.aiQueue) {
      try {
        const bullJob = await this.aiQueue.getJob(jobId);
        if (bullJob) {
          await bullJob.remove();
        }
      } catch {
        // Best effort — job may have already been picked up
      }
    }

    return this.toJobResponse(updated, null);
  }

  // ─── Draft lifecycle ──────────────────────────────────

  /**
   * List drafts for the current teacher.
   */
  async listDrafts(
    auth: AuthContext,
    schoolId: string,
    options: { limit?: number } = {},
  ): Promise<LessonPlanDraftResponse[]> {
    const teacherId = auth.principal.userId;
    const limit = Math.min(options.limit ?? 20, 100);

    const drafts = await this.prisma.lessonPlanDraft.findMany({
      where: { schoolId, teacherId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return drafts.map((d: any) => this.toDraftResponse(d));
  }

  /**
   * Get a single draft by ID.
   */
  async getDraft(
    auth: AuthContext,
    schoolId: string,
    draftId: string,
  ): Promise<LessonPlanDraftResponse> {
    const draft = await this.prisma.lessonPlanDraft.findFirst({
      where: { id: draftId, schoolId },
    });
    if (!draft) {
      throw Object.assign(new Error("Draft not found"), { code: "NOT_FOUND" });
    }
    this.assertDraftAccess(auth, draft.teacherId);
    return this.toDraftResponse(draft);
  }

  /**
   * Update a draft with optimistic concurrency control.
   * Creates a new revision on each successful update.
   */
  async updateDraft(
    auth: AuthContext,
    schoolId: string,
    draftId: string,
    dto: UpdateDraftDto,
  ): Promise<LessonPlanDraftResponse> {
    const draft = await this.prisma.lessonPlanDraft.findFirst({
      where: { id: draftId, schoolId },
    });
    if (!draft) {
      throw Object.assign(new Error("Draft not found"), { code: "NOT_FOUND" });
    }
    this.assertDraftAccess(auth, draft.teacherId);

    if (draft.status === "APPROVED") {
      throw Object.assign(
        new Error("Cannot edit an approved draft"),
        { code: "INVALID_STATE" },
      );
    }

    // Optimistic concurrency check
    if (dto.expectedRevision !== draft.revision) {
      throw Object.assign(
        new Error(
          `Revision conflict: expected ${dto.expectedRevision} but current is ${draft.revision}`,
        ),
        { code: "REVISION_CONFLICT" },
      );
    }

    const nextRevision = draft.revision + 1;

    // Create revision record
    await this.prisma.lessonPlanRevision.create({
      data: {
        draftId,
        revision: nextRevision,
        content: dto.content as any,
        source: "TEACHER_EDIT",
        editorUserId: auth.principal.userId,
      },
    });

    // Update draft
    const updated = await this.prisma.lessonPlanDraft.update({
      where: { id: draftId },
      data: {
        title: dto.title ?? draft.title,
        content: dto.content as any,
        revision: nextRevision,
      },
    });

    return this.toDraftResponse(updated);
  }

  /**
   * Approve a draft — marks it as teacher-confirmed.
   */
  async approveDraft(
    auth: AuthContext,
    schoolId: string,
    draftId: string,
  ): Promise<LessonPlanDraftResponse> {
    const draft = await this.prisma.lessonPlanDraft.findFirst({
      where: { id: draftId, schoolId },
    });
    if (!draft) {
      throw Object.assign(new Error("Draft not found"), { code: "NOT_FOUND" });
    }
    this.assertDraftAccess(auth, draft.teacherId);

    if (draft.status === "APPROVED") {
      return this.toDraftResponse(draft); // Already approved — idempotent
    }

    const nextRevision = draft.revision + 1;

    // Create approval revision
    await this.prisma.lessonPlanRevision.create({
      data: {
        draftId,
        revision: nextRevision,
        content: draft.content as any,
        source: "TEACHER_APPROVE",
        editorUserId: auth.principal.userId,
      },
    });

    const updated = await this.prisma.lessonPlanDraft.update({
      where: { id: draftId },
      data: {
        status: "APPROVED",
        revision: nextRevision,
        approvedAt: new Date(),
      },
    });

    return this.toDraftResponse(updated);
  }

  // ─── Workflow status ──────────────────────────────────

  /**
   * Check the status of the lesson-planner workflow and provider availability.
   * Reports each component separately for frontend diagnostics.
   */
  async getWorkflowStatus(
    _auth: AuthContext,
    _schoolId: string,
  ): Promise<WorkflowStatusResponse> {
    const workflow = await this.prisma.aiWorkflowDefinition.findUnique({
      where: { workflowKey: LESSON_PLANNER_WORKFLOW_KEY },
    });

    const providerConfigured = this.isProviderConfigured();
    const workflowAvailable = !!(workflow?.externalFlowId);
    const flowiseAvailable = await this.isFlowiseReachable();
    const workerAvailable = !!this.aiQueue;

    // Derive overall status
    let status = "DISABLED";
    let message: string | null = null;

    if (!providerConfigured) {
      status = "PROVIDER_NOT_CONFIGURED";
      message = "AI 服务尚未配置。请在 runtime-local/secrets/ai-provider.env 中设置 API 密钥。";
    } else if (!flowiseAvailable) {
      status = "PROVIDER_UNAVAILABLE";
      message = "Flowise 服务不可达。请确认 Docker 容器已启动。";
    } else if (!workflowAvailable) {
      status = "PROVIDER_NOT_CONFIGURED";
      message = "工作流尚未导入。请运行 bootstrap-flow.ps1 导入教案生成流程。";
    } else if (!workerAvailable) {
      status = "PROVIDER_UNAVAILABLE";
      message = "Worker 未连接 Redis 队列，无法处理生成任务。";
    } else {
      status = workflow?.status ?? "ACTIVE";
    }

    return {
      workflowKey: LESSON_PLANNER_WORKFLOW_KEY,
      status,
      version: workflow?.version ?? 0,
      provider: workflow?.provider ?? "flowise",
      externalFlowId: workflow?.externalFlowId ?? null,
      flowiseAvailable,
      workflowAvailable,
      providerConfigured,
      workerAvailable,
      message,
    };
  }

  // ─── Internal: Update job result (called by Worker via InternalController) ──

  /**
   * Called by the worker to update a job's result.
   * Guards against overwriting a CANCELLED job.
   */
  async updateJobResult(
    jobId: string,
    data: {
      status: string;
      outputSnapshot?: Record<string, unknown>;
      errorCode?: string;
      tokenUsage?: Record<string, unknown>;
      latencyMs?: number;
      providerRequestId?: string;
    },
  ): Promise<void> {
    // Guard: do not overwrite a CANCELLED job
    const current = await this.prisma.aiGenerationJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (!current) return;
    if (current.status === "CANCELLED") {
      // Job was cancelled while worker was processing — discard result
      return;
    }

    const now = new Date();
    const isTerminal = TERMINAL_STATES.has(data.status);

    await this.prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: {
        status: data.status as AiJobStatus,
        ...(data.outputSnapshot !== undefined
          ? { outputSnapshot: data.outputSnapshot as any }
          : {}),
        ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
        ...(data.tokenUsage !== undefined
          ? { tokenUsage: data.tokenUsage as any }
          : {}),
        ...(data.latencyMs !== undefined ? { latencyMs: data.latencyMs } : {}),
        ...(data.providerRequestId !== undefined
          ? { providerRequestId: data.providerRequestId }
          : {}),
        ...(data.status === "RUNNING" ? { startedAt: now } : {}),
        ...(isTerminal ? { completedAt: now } : {}),
      },
    });

    // On success, create the lesson plan draft
    if (data.status === "SUCCEEDED" && data.outputSnapshot) {
      const job = await this.prisma.aiGenerationJob.findUnique({
        where: { id: jobId },
      });
      if (!job) return;

      // Check if draft already exists (idempotency for worker retries)
      const existingDraft = await this.prisma.lessonPlanDraft.findUnique({
        where: { generationJobId: jobId },
      });
      if (existingDraft) return;

      const input = job.inputSnapshot as Record<string, unknown>;
      const goal = (input.goal as string) ?? "未命名教案";
      const title = `教案：${goal.slice(0, 80)}`;

      // Create draft + initial revision in a transaction
      await this.prisma.$transaction(async (tx) => {
        const draft = await tx.lessonPlanDraft.create({
          data: {
            schoolId: job.schoolId,
            teacherId: job.teacherId,
            courseVersionId: (input.courseVersionId as string) ?? null,
            lessonId: (input.lessonId as string) ?? null,
            generationJobId: jobId,
            title,
            content: data.outputSnapshot as any,
          },
        });

        await tx.lessonPlanRevision.create({
          data: {
            draftId: draft.id,
            revision: 1,
            content: data.outputSnapshot as any,
            source: "AI_GENERATION",
          },
        });
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  private isProviderConfigured(): boolean {
    const baseUrl = this.config.get<string>("AI_BASE_URL");
    const apiKey = this.config.get<string>("AI_API_KEY");
    const model = this.config.get<string>("AI_MODEL");
    return !!(baseUrl && apiKey && model);
  }

  /**
   * Check if Flowise is reachable by actually making a health check request.
   * Gap 6 fix: Do NOT just return true because URL is configured — that
   * misreports availability. Must verify runtime connectivity.
   */
  private async isFlowiseReachable(): Promise<boolean> {
    const flowiseUrl = this.config.get<string>("FLOWISE_BASE_URL");
    if (!flowiseUrl) return false;

    try {
      const response = await fetch(`${flowiseUrl}/api/v1/ping`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get or create the workflow definition for the lesson planner.
   * New definitions start as DISABLED with null externalFlowId
   * until a real flow is imported via bootstrap-flow.ps1.
   */
  private async getOrCreateWorkflowDefinitionId(): Promise<string> {
    let workflow = await this.prisma.aiWorkflowDefinition.findUnique({
      where: { workflowKey: LESSON_PLANNER_WORKFLOW_KEY },
    });
    if (!workflow) {
      workflow = await this.prisma.aiWorkflowDefinition.create({
        data: {
          provider: "flowise",
          externalFlowId: null,
          workflowKey: LESSON_PLANNER_WORKFLOW_KEY,
          version: 0,
          status: "DISABLED",
          inputSchemaVersion: "v0",
          outputSchemaVersion: "v0",
        },
      });
    }
    return workflow.id;
  }

  /**
   * Enrich the DTO input with real course data from the database.
   * If courseVersionId is provided, fetch CourseVersion, Unit, and Lesson
   * titles and summaries to include in the inputSnapshot for the Worker.
   *
   * Gap 8 fix: All queries include schoolId scope to prevent cross-school
   * data leaks. Errors are logged, not silently swallowed.
   */
  private async enrichInputWithCourseData(
    dto: CreateLessonPlanJobDto,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const input: Record<string, unknown> = {
      goal: dto.goal,
      gradeBand: dto.gradeBand ?? null,
      subject: dto.subject ?? null,
      durationMinutes: dto.durationMinutes ?? 40,
      keyRequirements: dto.keyRequirements ?? null,
      courseVersionId: dto.courseVersionId ?? null,
      unitId: dto.unitId ?? null,
      lessonId: dto.lessonId ?? null,
      outputModules: dto.outputModules ?? null,
      locale: dto.locale ?? "zh-CN",
      // Will be filled from DB below
      courseTitle: null as string | null,
      courseSummary: null as string | null,
      lessonTitle: null as string | null,
      lessonContentSummary: null as string | null,
      classAggregateSummary: null as string | null,
    };

    if (dto.courseVersionId) {
      try {
        const cv = await this.prisma.courseVersion.findUnique({
          where: { id: dto.courseVersionId },
          select: { title: true, description: true, schoolId: true },
        });
        if (cv) {
          // Gap 8: Verify schoolId scope — reject cross-school access
          if (cv.schoolId !== schoolId) {
            throw Object.assign(
              new Error("CourseVersion does not belong to this school"),
              { code: "FORBIDDEN" },
            );
          }
          input.courseTitle = cv.title;
          input.courseSummary = cv.description;
        }
      } catch (err: unknown) {
        // Rethrow explicit FORBIDDEN — not a "best effort" case
        if (err instanceof Error && (err as any).code === "FORBIDDEN") throw err;
        // Other errors (e.g. table not queryable) — log but don't fail job creation
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[AiLessonPlanning] CourseVersion lookup failed:", dto.courseVersionId, msg);
      }
    }

    if (dto.lessonId) {
      try {
        // Lesson has no schoolId — verify via Unit → CourseVersion chain
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: dto.lessonId },
          select: {
            title: true,
            unit: { select: { courseVersion: { select: { schoolId: true } } } },
          },
        });
        if (lesson) {
          // Gap 8: Verify schoolId scope through Unit → CourseVersion
          const lessonSchoolId = lesson.unit?.courseVersion?.schoolId;
          if (lessonSchoolId && lessonSchoolId !== schoolId) {
            throw Object.assign(
              new Error("Lesson does not belong to this school"),
              { code: "FORBIDDEN" },
            );
          }
          input.lessonTitle = lesson.title;
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err as any).code === "FORBIDDEN") throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[AiLessonPlanning] Lesson lookup failed:", dto.lessonId, msg);
      }
    }

    return input;
  }

  private assertJobAccess(auth: AuthContext, teacherId: string): void {
    const isAdmin = auth.principal.roles.some(
      (r) => r === MembershipRole.SCHOOL_ADMIN,
    );
    if (auth.principal.userId !== teacherId && !isAdmin) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }
  }

  private assertDraftAccess(auth: AuthContext, teacherId: string): void {
    const isAdmin = auth.principal.roles.some(
      (r) => r === MembershipRole.SCHOOL_ADMIN,
    );
    if (auth.principal.userId !== teacherId && !isAdmin) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }
  }

  private toJobResponse(
    job: any,
    draftId: string | null,
  ): LessonPlanJobResponse {
    return {
      id: job.id,
      jobId: job.id,
      schoolId: job.schoolId,
      teacherId: job.teacherId,
      status: job.status,
      idempotencyKey: job.idempotencyKey,
      inputSnapshot: job.inputSnapshot as Record<string, unknown>,
      outputSnapshot: job.outputSnapshot as Record<string, unknown> | null,
      errorCode: job.errorCode,
      latencyMs: job.latencyMs,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      draftId,
    };
  }

  private toDraftResponse(
    draft: any,
  ): LessonPlanDraftResponse {
    return {
      id: draft.id,
      schoolId: draft.schoolId,
      teacherId: draft.teacherId,
      courseVersionId: draft.courseVersionId,
      lessonId: draft.lessonId,
      generationJobId: draft.generationJobId,
      title: draft.title,
      content: draft.content as Record<string, unknown>,
      revision: draft.revision,
      status: draft.status,
      approvedAt: draft.approvedAt?.toISOString() ?? null,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
