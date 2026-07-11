import type {
  ConsentStatus,
  PairingStatus,
  RiskLevel,
  SupportPairing,
  SupportSession,
  TeacherReviewStatus,
} from "../domain/support-pairing.types.js";

/* ---------- Full pairing response (teacher / admin view) ---------- */

export interface SupportPairingResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly studentUserId: string;
  readonly volunteerUserId: string;
  readonly supervisorTeacherId: string;
  readonly consentStatus: ConsentStatus;
  readonly goal: string;
  readonly status: PairingStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSupportPairingResponse(
  pairing: SupportPairing,
): SupportPairingResponse {
  return {
    id: pairing.id,
    schoolId: pairing.schoolId,
    studentUserId: pairing.studentUserId,
    volunteerUserId: pairing.volunteerUserId,
    supervisorTeacherId: pairing.supervisorTeacherId,
    consentStatus: pairing.consentStatus,
    goal: pairing.goal,
    status: pairing.status,
    createdAt: pairing.createdAt.toISOString(),
    updatedAt: pairing.updatedAt.toISOString(),
  };
}

/* ---------- Volunteer-facing pairing response (minimal info, NO psychological / family data) ---------- */

export interface VolunteerPairingResponse {
  readonly id: string;
  readonly studentUserId: string;
  readonly supervisorTeacherId: string;
  readonly goal: string;
  readonly status: PairingStatus;
  readonly nextSessionScheduledAt?: string;
}

export function toVolunteerPairingResponse(
  pairing: SupportPairing,
  nextSessionScheduledAt?: Date,
): VolunteerPairingResponse {
  return {
    id: pairing.id,
    studentUserId: pairing.studentUserId,
    supervisorTeacherId: pairing.supervisorTeacherId,
    goal: pairing.goal,
    status: pairing.status,
    ...(nextSessionScheduledAt
      ? { nextSessionScheduledAt: nextSessionScheduledAt.toISOString() }
      : {}),
  };
}

/* ---------- Session response ---------- */

export interface SupportSessionResponse {
  readonly id: string;
  readonly pairingId: string;
  readonly scheduledAt: string;
  readonly summary: string | undefined;
  readonly nextStep: string | undefined;
  readonly riskLevel: RiskLevel;
  readonly teacherReviewStatus: TeacherReviewStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSupportSessionResponse(
  session: SupportSession,
): SupportSessionResponse {
  return {
    id: session.id,
    pairingId: session.pairingId,
    scheduledAt: session.scheduledAt.toISOString(),
    summary: session.summary,
    nextStep: session.nextStep,
    riskLevel: session.riskLevel,
    teacherReviewStatus: session.teacherReviewStatus,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/* ---------- Volunteer-facing session response (NO summary / nextStep with sensitive details) ---------- */

export interface VolunteerSessionResponse {
  readonly id: string;
  readonly pairingId: string;
  readonly scheduledAt: string;
  readonly riskLevel: RiskLevel;
  readonly teacherReviewStatus: TeacherReviewStatus;
}

export function toVolunteerSessionResponse(
  session: SupportSession,
): VolunteerSessionResponse {
  return {
    id: session.id,
    pairingId: session.pairingId,
    scheduledAt: session.scheduledAt.toISOString(),
    riskLevel: session.riskLevel,
    teacherReviewStatus: session.teacherReviewStatus,
  };
}
