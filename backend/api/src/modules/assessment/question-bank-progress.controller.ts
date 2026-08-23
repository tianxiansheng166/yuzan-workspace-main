import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { QuestionBankProgressService } from "./question-bank-progress.service.js";

@Controller("schools/:schoolId/students/me/question-bank-progress")
export class QuestionBankProgressController {
  constructor(@Inject(QuestionBankProgressService) private readonly service: QuestionBankProgressService) {}

  @Get()
  @RequireRoles(MembershipRole.STUDENT)
  async getProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getForCurrentStudent(createAuthContext("request-id", principal, tenant), schoolId);
  }
}
