import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole, hasAnyRole } from "../../common/security/index.js";
import {
  ConsentRequiredException,
  HighRiskEventException,
  SupportPairingForbiddenException,
  SupportPairingNotFoundException,
  SupportSessionNotFoundException,
} from "./domain/support-pairing.errors.js";
import {
  ConsentStatus,
  PairingStatus,
  RiskLevel,
} from "./domain/support-pairing.types.js";
import {
  toSupportPairingResponse,
  toSupportSessionResponse,
  toVolunteerPairingResponse,
  toVolunteerSessionResponse,
} from "./dto/support-pairing.response.js";
import type {
  ListPairingsOptions,
  SupportPairingRepositoryPort,
} from "./ports/support-pairing-repository.port.js";
import { SUPPORT_PAIRING_REPOSITORY } from "./ports/support-pairing-repository.port.js";
import { SupportPairingsPolicy } from "./support-pairings.policy.js";

@Injectable()
export class SupportPairingsService {
  private readonly policy = new SupportPairingsPolicy();

  constructor(
    @Inject(SUPPORT_PAIRING_REPOSITORY)
    private readonly pairingRepo: SupportPairingRepositoryPort,
  ) {}

  async createPairing(
    auth: AuthContext,
    schoolId: string,
    data: {
      studentUserId: string;
      volunteerUserId: string;
      supervisorTeacherId: string;
      goal: string;
    },
  ) {
    if (!this.policy.canCreatePairing(auth, schoolId)) {
      throw new SupportPairingForbiddenException();
    }

    const pairing = await this.pairingRepo.create(schoolId, {
      schoolId,
      studentUserId: data.studentUserId,
      volunteerUserId: data.volunteerUserId,
      supervisorTeacherId: data.supervisorTeacherId,
      goal: data.goal,
    });

    return toSupportPairingResponse(pairing);
  }

  async listPairings(
    auth: AuthContext,
    schoolId: string,
    options: ListPairingsOptions,
  ) {
    if (!this.policy.canListPairings(auth, schoolId)) {
      throw new SupportPairingForbiddenException();
    }

    const result = await this.pairingRepo.findBySchoolId(schoolId, options);
    return {
      items: result.items.map(toSupportPairingResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getPairing(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
  ) {
    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    const isTeacherOrAdmin = hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);

    if (isTeacherOrAdmin) {
      return toSupportPairingResponse(pairing);
    }

    if (this.policy.canViewOwnPairing(auth, schoolId, pairing)) {
      return toVolunteerPairingResponse(pairing);
    }

    throw new SupportPairingForbiddenException();
  }

  async updateConsent(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
    consentStatus: ConsentStatus,
  ) {
    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    if (!this.policy.canUpdateConsent(auth, schoolId, pairing)) {
      throw new SupportPairingForbiddenException();
    }

    const updated = await this.pairingRepo.updateConsentStatus(
      schoolId,
      pairingId,
      consentStatus,
    );
    return toSupportPairingResponse(updated);
  }

  async updatePairingStatus(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
    status: PairingStatus,
  ) {
    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    if (!this.policy.canCreatePairing(auth, schoolId)) {
      throw new SupportPairingForbiddenException();
    }

    if (status === PairingStatus.ACTIVE && pairing.consentStatus !== ConsentStatus.GRANTED) {
      throw new ConsentRequiredException();
    }

    const updated = await this.pairingRepo.updateStatus(
      schoolId,
      pairingId,
      status,
    );
    return toSupportPairingResponse(updated);
  }

  async listMyPairings(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) {
      throw new SupportPairingForbiddenException();
    }

    const result = await this.pairingRepo.findBySchoolId(schoolId, {
      limit: 100,
    });

    const myPairings = result.items.filter(
      (p) => p.volunteerUserId === auth.principal.userId,
    );

    return myPairings.map((p) => toVolunteerPairingResponse(p));
  }

  async createSession(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
    scheduledAt: Date,
  ) {
    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    if (!this.policy.canCreateSession(auth, schoolId, pairing)) {
      throw new SupportPairingForbiddenException();
    }

    if (pairing.status !== PairingStatus.ACTIVE) {
      throw new SupportPairingForbiddenException("配对未激活，无法创建会话");
    }

    const session = await this.pairingRepo.createSession(schoolId, pairingId, {
      pairingId,
      scheduledAt,
    });

    return toSupportSessionResponse(session);
  }

  async listSessions(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
  ) {
    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    const isTeacherOrAdmin = hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);

    if (!isTeacherOrAdmin && !this.policy.canViewOwnPairing(auth, schoolId, pairing)) {
      throw new SupportPairingForbiddenException();
    }

    const sessions = await this.pairingRepo.listSessionsByPairing(
      schoolId,
      pairingId,
    );

    if (isTeacherOrAdmin) {
      return sessions.map(toSupportSessionResponse);
    }

    return sessions.map(toVolunteerSessionResponse);
  }

  async reviewSession(
    auth: AuthContext,
    schoolId: string,
    pairingId: string,
    sessionId: string,
    teacherReviewStatus: import("./domain/support-pairing.types.js").TeacherReviewStatus,
  ) {
    if (!this.policy.canReviewSession(auth, schoolId)) {
      throw new SupportPairingForbiddenException();
    }

    const pairing = await this.pairingRepo.findById(schoolId, pairingId);
    if (!pairing) {
      throw new SupportPairingNotFoundException();
    }

    const session = await this.pairingRepo.findSessionById(schoolId, sessionId);
    if (!session || session.pairingId !== pairingId) {
      throw new SupportSessionNotFoundException();
    }

    if (
      session.riskLevel === RiskLevel.HIGH ||
      session.riskLevel === RiskLevel.CRITICAL
    ) {
      // High-risk sessions should be flagged and reviewed by teacher/admin
      // This is the intended path - teacher/admin reviews high-risk sessions
    }

    const updated = await this.pairingRepo.updateSessionReviewStatus(
      schoolId,
      sessionId,
      teacherReviewStatus,
    );

    return toSupportSessionResponse(updated);
  }
}
