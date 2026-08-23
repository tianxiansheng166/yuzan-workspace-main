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
import { TeacherQuestionBankDiagnosticService } from "./teacher-question-bank-diagnostic.service.js";

@Controller("schools/:schoolId/teacher/question-bank-diagnostics")
export class TeacherQuestionBankDiagnosticController {
  constructor(
    @Inject(TeacherQuestionBankDiagnosticService)
    private readonly service: TeacherQuestionBankDiagnosticService,
  ) {}

  @Get()
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.PLATFORM_ADMIN,
  )
  getCatalog(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getCatalog(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("classes/:classId/students/:enrollmentId")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.PLATFORM_ADMIN,
  )
  getStudentDetail(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @Query("practiceDefinitionId", ParseUUIDPipe) practiceDefinitionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getStudentDetail(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      enrollmentId,
      practiceDefinitionId,
    );
  }

  @Get("classes/:classId")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.PLATFORM_ADMIN,
  )
  getDashboard(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Query("practiceDefinitionId", ParseUUIDPipe) practiceDefinitionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDashboard(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      practiceDefinitionId,
    );
  }
}
