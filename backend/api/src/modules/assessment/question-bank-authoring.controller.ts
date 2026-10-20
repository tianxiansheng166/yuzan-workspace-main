import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { QuestionBankAuthoringService } from "./question-bank-authoring.service.js";
import {
  QuestionBankDraftInputDto,
  UpdateQuestionBankDraftDto,
} from "./dto/question-bank-draft.dto.js";

@Controller("schools/:schoolId/teacher/question-bank/items")
export class QuestionBankAuthoringController {
  constructor(
    @Inject(QuestionBankAuthoringService)
    private readonly service: QuestionBankAuthoringService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.TEACHER)
  listDrafts(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listDrafts(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.TEACHER)
  createDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: QuestionBankDraftInputDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get("versions/:versionId")
  @RequireRoles(MembershipRole.TEACHER)
  getDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      versionId,
    );
  }

  @Put("versions/:versionId")
  @RequireRoles(MembershipRole.TEACHER)
  updateDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateQuestionBankDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      versionId,
      dto,
    );
  }
}
