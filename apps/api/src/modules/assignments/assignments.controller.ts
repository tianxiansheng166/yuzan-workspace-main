import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { AssignmentsService } from "./assignments.service.js";
import { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
import { UpdateAssignmentDto } from "./dto/update-assignment.dto.js";
import { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto.js";

@Controller("schools/:schoolId/assignments")
export class AssignmentsController {
  constructor(
    @Inject(AssignmentsService)
    private readonly service: AssignmentsService,
  ) {}

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listAssignments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListAssignmentsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/assignment-repository.port.js").ListAssignmentsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

    return this.service.listAssignments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Post()
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
      {
        schoolId,
        courseVersionId: dto.courseVersionId,
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        dueAt: new Date(dto.dueAt),
        ...(dto.offlineRequired !== undefined ? { offlineRequired: dto.offlineRequired } : {}),
        targets: dto.targets.map((t) => ({
          targetType: t.targetType,
          ...(t.classId ? { classId: t.classId } : {}),
          ...(t.enrollmentId ? { enrollmentId: t.enrollmentId } : {}),
        })),
      },
    );
  }

  @Get(":assignmentId")
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

  @Post(":assignmentId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
        ...(dto.offlineRequired !== undefined ? { offlineRequired: dto.offlineRequired } : {}),
      },
      dto.expectedRevision,
    );
  }

  @Post(":assignmentId/open")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async openAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() body: { expectedRevision: number },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.openAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      body.expectedRevision,
    );
  }

  @Post(":assignmentId/close")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async closeAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() body: { expectedRevision: number },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.closeAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      body.expectedRevision,
    );
  }

  @Post(":assignmentId/cancel")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async cancelAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() body: { expectedRevision: number },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.cancelAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      body.expectedRevision,
    );
  }

  @Delete(":assignmentId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN)
  @HttpCode(204)
  async deleteAssignment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    await this.service.deleteAssignment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }
}
