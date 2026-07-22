import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
import { GeneratePlanDto } from "./dto/generate-plan.dto.js";
import { SaveDraftDto } from "./dto/save-draft.dto.js";
import { ToolsService } from "./tools.service.js";

@Controller("schools/:schoolId/tools")
export class TeacherToolsController {
  constructor(
    @Inject(ToolsService)
    private readonly service: ToolsService,
  ) {}

  @Get("state")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getTeacherToolsState(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getTeacherToolsState(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post("generate-plan")
  @HttpCode(HttpStatus.OK)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async generatePlan(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: GeneratePlanDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.generatePlan(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get("drafts")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listDrafts(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listDrafts(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post("drafts")
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async saveDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: SaveDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.saveDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get("invite-code")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getInviteCode(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getOrCreateInviteCode(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}

@Controller("schools/:schoolId/external-services")
export class ExternalServicesController {
  constructor(
    @Inject(ToolsService)
    private readonly service: ToolsService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listExternalServices(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listExternalServices(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}
