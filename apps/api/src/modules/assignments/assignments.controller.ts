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
import { AssignmentsService } from "./assignments.service.js";
import { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
import { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto.js";
import { UpdateAssignmentDto } from "./dto/update-assignment.dto.js";

@Controller("schools/:schoolId")
export class AssignmentsController {
  constructor(
    @Inject(AssignmentsService)
    private readonly service: AssignmentsService,
  ) {}

  @Post("assignments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get("assignments/:assignmentId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }

  @Get("classes/:classId/assignments")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listClassAssignments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Query() query: ListAssignmentsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listClassAssignments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      query,
    );
  }

  @Patch("assignments/:assignmentId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      dto,
    );
  }

  @Post("assignments/:assignmentId:publish")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async publishAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.publishAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }

  @Post("assignments/:assignmentId:close")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async closeAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.closeAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }

  @Post("assignments/:assignmentId:archive")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async archiveAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.archiveAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }
}
