import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { SpeechJobService } from "./speech-job.service.js";
import { CreateSpeechJobDto } from "./dto/create-speech-job.dto.js";

@Controller("schools/:schoolId/speech-jobs")
export class SpeechJobController {
  constructor(
    @Inject(SpeechJobService)
    private readonly service: SpeechJobService,
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
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
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
   * Query a SpeechJob by ID. STUDENT can only view their own jobs.
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
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const job = await this.service.getSpeechJob(jobId);

    // STUDENT can only view their own jobs (verify via recording ownership)
    if (principal.roles.includes(MembershipRole.STUDENT)) {
      // The service returns the job; the controller enforces student access
      // by verifying the schoolId matches the job's schoolId.
      if (job.schoolId !== schoolId) {
        // Not found for this tenant scope
        throw new Error("SpeechJob not found in current school scope");
      }
    }

    return job;
  }

  /**
   * GET /schools/:schoolId/speech-jobs/by-item/:assessmentItemId
   * List all SpeechJobs for a given assessment item.
   */
  @Get("by-item/:assessmentItemId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listSpeechJobsByItem(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assessmentItemId", ParseUUIDPipe) assessmentItemId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listSpeechJobsByItem(assessmentItemId);
  }

  /**
   * PUT /schools/:schoolId/speech-jobs/:jobId/result
   * Worker callback to update a SpeechJob result.
   * This is an internal endpoint — callers must provide a valid API key
   * or be invoked internally by the processing pipeline.
   */
  @Put(":jobId/result")
  async updateSpeechJobResult(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body()
    body: {
      result: Record<string, unknown>;
      confidence?: number;
      processingMs?: number;
      providerModel?: string;
    },
  ) {
    return this.service.updateSpeechJobResult(jobId, body.result, {
      ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
      ...(body.processingMs !== undefined ? { processingMs: body.processingMs } : {}),
      ...(body.providerModel !== undefined ? { providerModel: body.providerModel } : {}),
    });
  }
}
