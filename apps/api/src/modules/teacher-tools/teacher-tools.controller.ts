import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Inject,
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
import { TeacherToolsService } from "./teacher-tools.service.js";
import { CreateDraftDto } from "./dto/create-draft.dto.js";

@Controller("schools/:schoolId/teacher-tools")
export class TeacherToolsController {
  constructor(
    @Inject(TeacherToolsService)
    private readonly service: TeacherToolsService,
  ) {}

  @Get("state")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getToolsState(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getToolsState(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("drafts")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listDrafts(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("toolSource") toolSource: string | undefined,
    @Query("limit") limit: string = "20",
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listDrafts(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        ...(toolSource ? { toolSource: toolSource as "MINDMATE" | "MINDGRAPH" | "LESSON_PLAN" | "WORKSHEET" } : {}),
        limit: Math.min(parseInt(limit, 10) || 20, 100),
      },
    );
  }

  @Post("drafts")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createDraft(
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
    return this.service.getInviteCode(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post("generate-plan")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async generatePlan(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() body: { goal: string; courseVersionId?: string; gradeBand?: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.generatePlan(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      body,
    );
  }
}
