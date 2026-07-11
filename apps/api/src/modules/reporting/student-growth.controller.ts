import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { ReportingService } from "./reporting.service.js";

@Controller("schools/:schoolId/student-growth")
export class StudentGrowthController {
  constructor(
    @Inject(ReportingService)
    private readonly service: ReportingService,
  ) {}

  @Get(":enrollmentId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getStudentGrowthProfile(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const auth = createAuthContext("request-id", principal, tenant);
    const profile = await this.service.getStudentGrowthProfile(auth, schoolId, enrollmentId);
    return {
      enrollmentId: profile.enrollmentId,
      periodStart: profile.periodStart.toISOString(),
      periodEnd: profile.periodEnd.toISOString(),
      generatedAt: profile.generatedAt.toISOString(),
      dataCompleteness: profile.dataCompleteness,
      providerDisclosure: profile.providerDisclosure,
      data: profile.data,
    };
  }
}
