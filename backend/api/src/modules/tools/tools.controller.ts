import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ClickAuditDto } from "./dto/click-audit.dto.js";
import { CreateMindGraphJobDto } from "./dto/tool.dto.js";
import { ListJobsQueryDto } from "./dto/list-jobs-query.dto.js";
import { UpdateIntegrationConfigDto } from "./dto/tool.dto.js";
import type { IntegrationKey } from "./domain/tool.types.js";
import { ToolsService } from "./tools.service.js";

@Controller("schools/:schoolId/tools")
export class ToolsController {
  constructor(
    @Inject(ToolsService)
    private readonly service: ToolsService,
  ) {}

  @Get("integrations")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listIntegrations(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listIntegrations(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("integrations/:key")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getIntegration(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("key") key: IntegrationKey,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getIntegration(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      key,
    );
  }

  @Patch("integrations/:key")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateIntegration(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("key") key: IntegrationKey,
    @Body() dto: UpdateIntegrationConfigDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateIntegration(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      key,
      {
        ...dto,
      },
    );
  }

  @Post("mindgraph/jobs")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createMindGraphJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateMindGraphJobDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createMindGraphJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto.inputPayload,
    );
  }

  @Get("mindgraph/jobs")
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
    const options: import("./ports/tool-repository.port.js").ListJobsOptions = {
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

  @Get("mindgraph/jobs/:jobId")
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

  @Post("click-audit")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async auditClick(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: ClickAuditDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.auditClick(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto.integrationKey,
      dto.action,
      dto.targetUrl,
    );
  }
}
