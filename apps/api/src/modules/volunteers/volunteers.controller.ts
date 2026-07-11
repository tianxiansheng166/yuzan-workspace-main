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
import { VolunteersService } from "./volunteers.service.js";
import { ListVolunteersQueryDto, ApplyVolunteerDto, TransitionVolunteerDto, ListServiceTasksQueryDto, AssignServiceTaskDto, CreateIncidentDto, ListIncidentsQueryDto } from "./dto/volunteer.dto.js";

@Controller("schools/:schoolId/volunteers")
export class VolunteersController {
  constructor(
    @Inject(VolunteersService)
    private readonly service: VolunteersService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async apply(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: ApplyVolunteerDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.apply(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { ...dto, userId: principal.userId },
    );
  }

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listVolunteers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListVolunteersQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listVolunteers(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { status: query.status, limit: query.limit, cursor: query.cursor },
    );
  }

  @Get("me")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER)
  async getMyProfile(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getMyProfile(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":volunteerId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getVolunteer(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("volunteerId", ParseUUIDPipe) volunteerId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getVolunteer(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      volunteerId,
    );
  }

  @Post(":volunteerId/transition")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async transitionStatus(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("volunteerId", ParseUUIDPipe) volunteerId: string,
    @Body() dto: TransitionVolunteerDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.transitionStatus(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      volunteerId,
      dto.status,
      1,
      dto.suspendedReason !== undefined ? { suspendedReason: dto.suspendedReason } : undefined,
    );
  }

  @Get(":volunteerId/service-tasks")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listMyServiceTasks(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("volunteerId", ParseUUIDPipe) _volunteerId: string,
    @Query() query: ListServiceTasksQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyServiceTasks(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      query.limit,
      query.cursor,
    );
  }

  @Get("service-tasks")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listServiceTasks(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListServiceTasksQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listServiceTasks(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { status: query.status, limit: query.limit, cursor: query.cursor },
    );
  }

  @Post("service-tasks/:taskId/assign")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async assignServiceTask(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: AssignServiceTaskDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.assignServiceTask(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      taskId,
      dto.volunteerId,
    );
  }

  @Post("incidents")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reportIncident(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reportIncident(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { ...dto, reportedBy: principal.userId },
    );
  }

  @Get("incidents")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listIncidents(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListIncidentsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listIncidents(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        ...(query.severity !== undefined ? { severity: query.severity } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      },
    );
  }

  @Get("incidents/:incidentId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getIncident(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("incidentId", ParseUUIDPipe) incidentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getIncident(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      incidentId,
    );
  }
}
