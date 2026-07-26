import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import {
  ApproveTranslationDto,
  CreateTranslationDto,
  RejectTranslationDto,
  ReviseTranslationDto,
  UpdateJobResultDto,
} from "./dto/translation.dto.js";
import { ListJobsQueryDto } from "./dto/list-jobs-query.dto.js";
import { TranslationsService } from "./translations.service.js";

@Controller("schools/:schoolId/translations")
export class TranslationsController {
  constructor(
    @Inject(TranslationsService)
    private readonly service: TranslationsService,
  ) {}

  @Post("jobs")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async createTranslation(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateTranslationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createTranslation(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto.sourceLanguage,
      dto.targetLanguage,
      dto.sourceText,
    );
  }

  @Get("jobs/me")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listMyJobs(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListJobsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/translation-repository.port.js").ListJobsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

    return this.service.listMyJobs(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get("jobs")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listJobs(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListJobsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/translation-repository.port.js").ListJobsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

    return this.service.listJobs(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get("jobs/:jobId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getJobStatus(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getJobStatus(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
    );
  }

  @Patch("jobs/:jobId/revise")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reviseJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: ReviseTranslationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviseJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
      dto.revisedResult,
      dto.expectedRevision,
    );
  }

  @Patch("jobs/:jobId/approve")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async approveJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: ApproveTranslationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.approveJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
      dto.expectedRevision,
    );
  }

  @Patch("jobs/:jobId/reject")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async rejectJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: RejectTranslationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.rejectJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
      dto.expectedRevision,
    );
  }

  @Get("glossary")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getGlossary(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getGlossary(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}

/**
 * Internal controller for worker-to-API communication.
 * Protected by X-Internal-Key header validation.
 */
@Controller("internal/translation-jobs")
export class InternalTranslationsController {
  constructor(
    @Inject(TranslationsService)
    private readonly service: TranslationsService,
  ) {}

  @Put(":jobId/result")
  @HttpCode(200)
  async updateJobResult(
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: UpdateJobResultDto,
    @Headers("x-internal-key") internalKey: string,
  ) {
    // Validate internal key
    const expectedKey = process.env.API_INTERNAL_KEY ?? "";
    if (!expectedKey || internalKey !== expectedKey) {
      throw new UnauthorizedException("Invalid internal key");
    }

    return this.service.updateJobResultFromWorker(jobId, dto);
  }
}
