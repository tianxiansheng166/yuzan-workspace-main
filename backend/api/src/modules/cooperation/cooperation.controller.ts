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
  Public,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { CooperationService } from "./cooperation.service.js";
import {
  SubmitLeadDto,
  ListLeadsQueryDto,
  UpdateLeadStatusDto,
  SubmitSupportApplicationDto,
  SubmitVolunteerApplicationDto,
  ReviewApplicationDto,
} from "./dto/cooperation.dto.js";

@Controller("schools/:schoolId/cooperation")
export class CooperationController {
  constructor(
    @Inject(CooperationService)
    private readonly service: CooperationService,
  ) {}

  // ---------- School-scoped leads ----------

  @Post("leads")
  @Public()
  async submitLead(@Body() dto: SubmitLeadDto) {
    return this.service.submitLead(dto);
  }

  @Get("leads")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async listLeads(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Query() query: ListLeadsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/cooperation-repository.port.js").ListLeadsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

    return this.service.listLeads(
      createAuthContext("request-id", principal, tenant),
      options,
    );
  }

  @Get("leads/:leadId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getLead(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("leadId", ParseUUIDPipe) leadId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getLead(
      createAuthContext("request-id", principal, tenant),
      leadId,
    );
  }

  @Patch("leads/:leadId/status")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateLeadStatus(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("leadId", ParseUUIDPipe) leadId: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateLeadStatus(
      createAuthContext("request-id", principal, tenant),
      leadId,
      dto.status,
      dto.assignedOperatorId,
    );
  }

  // ---------- Support applications ----------

  @Post("support-applications")
  @Public()
  async submitSupportApplication(@Body() dto: SubmitSupportApplicationDto) {
    return this.service.submitSupportApplication(dto);
  }

  @Get("support-applications")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async listSupportApplications(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Query() query: ListLeadsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/cooperation-repository.port.js").ListSupportApplicationsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status
          ? { status: query.status as unknown as import("./domain/cooperation.types.js").ApplicationStatus }
          : {}),
      };

    return this.service.listSupportApplications(
      createAuthContext("request-id", principal, tenant),
      options,
    );
  }

  @Get("support-applications/:applicationId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getSupportApplication(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getSupportApplication(
      createAuthContext("request-id", principal, tenant),
      applicationId,
    );
  }

  @Patch("support-applications/:applicationId/review")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async reviewSupportApplication(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewSupportApplication(
      createAuthContext("request-id", principal, tenant),
      applicationId,
      dto.action,
      dto.note,
    );
  }

  // ---------- Volunteer applications ----------

  @Post("volunteer-applications")
  @Public()
  async submitVolunteerApplication(
    @Body() dto: SubmitVolunteerApplicationDto,
  ) {
    return this.service.submitVolunteerApplication(dto);
  }

  @Get("volunteer-applications")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async listVolunteerApplications(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Query() query: ListLeadsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/cooperation-repository.port.js").ListVolunteerApplicationsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status
          ? { status: query.status as unknown as import("./domain/cooperation.types.js").VolunteerAppStatus }
          : {}),
      };

    return this.service.listVolunteerApplications(
      createAuthContext("request-id", principal, tenant),
      options,
    );
  }

  @Get("volunteer-applications/:applicationId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getVolunteerApplication(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getVolunteerApplication(
      createAuthContext("request-id", principal, tenant),
      applicationId,
    );
  }

  @Patch("volunteer-applications/:applicationId/review")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async reviewVolunteerApplication(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewVolunteerApplication(
      createAuthContext("request-id", principal, tenant),
      applicationId,
      dto.action,
    );
  }
}
