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
import {
  ConsentStatus,
  PairingStatus,
  TeacherReviewStatus,
} from "./domain/support-pairing.types.js";
import { CreatePairingDto, CreateSessionDto, ListPairingsQueryDto, ReviewSessionDto, UpdateConsentDto, UpdatePairingStatusDto, UpdateSessionDto } from "./dto/support-pairing.dto.js";
import type {
  ListPairingsOptions,
} from "./ports/support-pairing-repository.port.js";
import { SupportPairingsService } from "./support-pairings.service.js";

@Controller("schools/:schoolId/support-pairings")
export class SupportPairingsController {
  constructor(
    @Inject(SupportPairingsService)
    private readonly service: SupportPairingsService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createPairing(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreatePairingDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createPairing(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        studentUserId: dto.studentUserId,
        volunteerUserId: dto.volunteerUserId,
        supervisorTeacherId: dto.supervisorTeacherId,
        goal: dto.goal,
      },
    );
  }

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listPairings(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListPairingsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: ListPairingsOptions = {
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    return this.service.listPairings(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get("me/pairings")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.STUDENT,
  )
  async listMyPairings(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyPairings(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":pairingId")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.STUDENT,
  )
  async getPairing(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPairing(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
    );
  }

  @Patch(":pairingId/consent")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async updateConsent(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @Body() dto: UpdateConsentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateConsent(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
      dto.consentStatus as ConsentStatus,
    );
  }

  @Patch(":pairingId/status")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateStatus(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @Body() dto: UpdatePairingStatusDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updatePairingStatus(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
      dto.status as PairingStatus,
    );
  }

  @Post(":pairingId/sessions")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.STUDENT,
  )
  async createSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @Body() dto: CreateSessionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
      new Date(dto.scheduledAt),
    );
  }

  @Get(":pairingId/sessions")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.STUDENT,
  )
  async listSessions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listSessions(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
    );
  }

  @Patch(":pairingId/sessions/:sessionId/review")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reviewSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("pairingId", ParseUUIDPipe) pairingId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: ReviewSessionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      pairingId,
      sessionId,
      dto.teacherReviewStatus as TeacherReviewStatus,
    );
  }
}
