import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
import { ListClassesQueryDto } from "./dto/list-classes-query.dto.js";

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
}
