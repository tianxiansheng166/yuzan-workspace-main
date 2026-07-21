import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Inject,
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
import { AiLessonPlanningService } from "./ai-lesson-planning.service.js";
import type { CreateLessonPlanJobDto } from "./dto/create-lesson-plan-job.dto.js";
import type { UpdateDraftDto } from "./dto/update-draft.dto.js";

/**
 * AI Lesson Planning Controller
 *
 * Endpoints under /schools/:schoolId/ai/ for teachers to create
 * AI lesson-plan generation jobs, manage drafts, and check workflow status.
 */
@Controller("schools/:schoolId/ai")
export class AiLessonPlanningController {
  constructor(
    @Inject(AiLessonPlanningService)
    private readonly service: AiLessonPlanningService,
  ) {}

  // ─── Job endpoints ────────────────────────────────────

  @Post("lesson-plan-jobs")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateLessonPlanJobDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get("lesson-plan-jobs/:jobId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
    );
  }

  @Post("lesson-plan-jobs/:jobId/cancel")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async cancelJob(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.cancelJob(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      jobId,
    );
  }

  // ─── Draft endpoints ──────────────────────────────────

  @Get("lesson-plan-drafts")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listDrafts(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("limit") limit: string = "20",
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listDrafts(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { limit: Math.min(parseInt(limit, 10) || 20, 100) },
    );
  }

  @Get("lesson-plan-drafts/:draftId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      draftId,
    );
  }

  @Put("lesson-plan-drafts/:draftId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async replaceDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @Body() dto: UpdateDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      draftId,
      dto,
    );
  }

  @Patch("lesson-plan-drafts/:draftId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @Body() dto: UpdateDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      draftId,
      dto,
    );
  }

  @Post("lesson-plan-drafts/:draftId/approve")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async approveDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.approveDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      draftId,
    );
  }

  // ─── Workflow status ──────────────────────────────────

  @Get("workflows/lesson-planner/status")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getWorkflowStatus(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getWorkflowStatus(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}
