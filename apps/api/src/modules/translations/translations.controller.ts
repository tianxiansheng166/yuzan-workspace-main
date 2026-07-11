import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { CreateTranslationDto } from "./dto/translation.dto.js";
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
