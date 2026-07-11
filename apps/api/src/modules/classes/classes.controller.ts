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
import { ClassesService } from "./classes.service.js";
import { CreateClassDto } from "./dto/create-class.dto.js";
import { UpdateClassDto } from "./dto/update-class.dto.js";
import { AddEnrollmentDto } from "./dto/add-enrollment.dto.js";
import { ListClassesQueryDto } from "./dto/list-classes-query.dto.js";
import { toEnrollmentResponse } from "./dto/enrollment.response.js";

@Controller("schools/:schoolId/classes")
export class ClassesController {
  constructor(
    @Inject(ClassesService)
    private readonly service: ClassesService,
  ) {}

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListClassesQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/class-repository.port.js").ListClassesOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async createClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateClassDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { ...dto, schoolId },
    );
  }

  @Get(":classId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Post(":classId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async updateClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: UpdateClassDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.grade ? { grade: dto.grade } : {}),
      },
      new Date(dto.expectedUpdatedAt),
    );
  }

  @Delete(":classId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @HttpCode(204)
  async deleteClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    await this.service.deleteClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/members")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listClassMembers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listClassMembers(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get("teachers/me")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listMyTeacherClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("students/me")
  @RequireRoles(MembershipRole.STUDENT)
  async listMyStudentClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":classId/enrollments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listEnrollments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const enrollments = await this.service.listEnrollments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
    return enrollments.map(toEnrollmentResponse);
  }

  @Post(":classId/enrollments")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async addEnrollment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: AddEnrollmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.addEnrollment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      dto.userId,
      dto.role,
    );
  }

  @Delete(":classId/enrollments/:enrollmentId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @HttpCode(204)
  async removeEnrollment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    await this.service.removeEnrollment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      enrollmentId,
    );
  }
}
