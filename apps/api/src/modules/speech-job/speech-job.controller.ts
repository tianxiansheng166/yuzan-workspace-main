import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { SpeechJobService } from "./speech-job.service.js";
import { CreateSpeechJobDto } from "./dto/create-speech-job.dto.js";
import {
  SpeechJobNotFoundException,
  SpeechJobForbiddenException,
  SpeechJobCallbackUnauthorizedException,
} from "./domain/speech-job.errors.js";

/**
 * P0-CONTRACT-CONVERGENCE-001: 鉴权收敛.
 *
 * 修复要点：
 * 1. `updateSpeechJobResult` 是 worker 内部回写接口，必须 fail closed。
 *    之前无任何鉴权装饰器，任何客户端都能篡改评分结果。
 *    现要求 `X-Internal-API-Key` header 匹配 `INTERNAL_WORKER_API_KEY` 环境变量；
 *    环境变量未配置时一律拒绝（不降级为开放）。
 * 2. `getSpeechJob` 中 STUDENT 鉴权之前 `throw new Error(...)`，会被全局过滤器
 *    转成 500 INTERNAL_ERROR。改用 `SpeechJobNotFoundException`（404, 稳定码）。
 * 3. `listSpeechJobsByItem` 之前未校验 schoolId 和教师任课班级，跨学校可查。
 *    现通过 assessmentItem → session → classId 链路校验教师任课关系。
 */
@Controller("schools/:schoolId/speech-jobs")
export class SpeechJobController {
  constructor(
    @Inject(SpeechJobService)
    private readonly service: SpeechJobService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /schools/:schoolId/speech-jobs
   * Create a new SpeechJob. Requires TEACHER or SCHOOL_ADMIN role.
   */
  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createSpeechJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateSpeechJobDto,
    @CurrentTenant() _tenant: TenantContext,
    @CurrentPrincipal() _principal: Principal,
  ) {
    return this.service.triggerSpeechProcessing(
      dto.recordingId,
      dto.assessmentItemId,
      dto.targetText,
      schoolId,
      {
        ...(dto.scorerVersion ? { scorerVersion: dto.scorerVersion } : {}),
        ...(dto.provider ? { provider: dto.provider } : {}),
      },
    );
  }

  /**
   * GET /schools/:schoolId/speech-jobs/:jobId
   * Query a SpeechJob by ID. STUDENT can only view their own jobs (via recording ownership).
   */
  @Get(":jobId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getSpeechJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @CurrentTenant() _tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const job = await this.service.getSpeechJob(jobId);

    // Cross-school access: job must belong to the requested school scope.
    if (job.schoolId !== schoolId) {
      throw new SpeechJobNotFoundException();
    }

    // STUDENT can only view their own jobs (verify via recording ownership).
    // Recording has no direct userId; ownership is verified through the
    // enrollment relation (Recording.enrollmentId → Enrollment.userId).
    // SpeechJob.recordingId is nullable, so null → not found.
    if (principal.roles.includes(MembershipRole.STUDENT)) {
      if (!job.recordingId) {
        throw new SpeechJobNotFoundException();
      }
      const recording = await this.prisma.recording.findFirst({
        where: {
          id: job.recordingId,
          schoolId,
          enrollment: { userId: principal.userId },
        },
        select: { id: true },
      });
      if (!recording) {
        throw new SpeechJobNotFoundException();
      }
    }

    return job;
  }

  /**
   * GET /schools/:schoolId/speech-jobs/by-item/:assessmentItemId
   * List all SpeechJobs for a given assessment item.
   * Teacher must be assigned to the class that owns the assessment session.
   */
  @Get("by-item/:assessmentItemId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listSpeechJobsByItem(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assessmentItemId", ParseUUIDPipe) assessmentItemId: string,
    @CurrentTenant() _tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    // Verify the assessmentItem belongs to a session in this school.
    const item = await this.prisma.assessmentItem.findFirst({
      where: { id: assessmentItemId, session: { schoolId } },
      select: { session: { select: { classId: true } } },
    });
    if (!item) {
      throw new SpeechJobNotFoundException("测评题目不存在或不属于当前学校");
    }

    // Teacher must be assigned to the class (admin bypasses).
    const isAdmin = principal.roles.some(
      (r) => r === MembershipRole.SCHOOL_ADMIN || r === MembershipRole.PLATFORM_ADMIN,
    );
    if (!isAdmin) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          userId: principal.userId,
          schoolId,
          classId: item.session.classId,
          role: "TEACHER",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!teacherEnrollment) {
        throw new SpeechJobForbiddenException("您不是该测评所属班级的任课教师");
      }
    }

    return this.service.listSpeechJobsByItem(assessmentItemId);
  }

  /**
   * PUT /schools/:schoolId/speech-jobs/:jobId/result
   * Worker callback to update a SpeechJob result.
   *
   * P0-CONTRACT-CONVERGENCE-001: This is an INTERNAL endpoint. Callers must
   * provide a valid `X-Internal-API-Key` header matching the
   * `INTERNAL_WORKER_API_KEY` environment variable. If the env var is not
   * configured, the endpoint fails closed (rejects all calls) to prevent
   * arbitrary clients from tampering with speech evaluation results.
   */
  @Put(":jobId/result")
  async updateSpeechJobResult(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Headers("x-internal-api-key") apiKey: string | undefined,
    @Body()
    body: {
      result: Record<string, unknown>;
      confidence?: number;
      processingMs?: number;
      providerModel?: string;
    },
  ) {
    const expectedKey = this.config.get<string>("INTERNAL_WORKER_API_KEY");
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new SpeechJobCallbackUnauthorizedException();
    }

    // Verify job belongs to this school before updating.
    const existingJob = await this.prisma.speechJob.findFirst({
      where: { id: jobId, schoolId },
      select: { id: true },
    });
    if (!existingJob) {
      throw new SpeechJobNotFoundException();
    }

    return this.service.updateSpeechJobResult(jobId, body.result, {
      ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
      ...(body.processingMs !== undefined ? { processingMs: body.processingMs } : {}),
      ...(body.providerModel !== undefined ? { providerModel: body.providerModel } : {}),
    });
  }
}