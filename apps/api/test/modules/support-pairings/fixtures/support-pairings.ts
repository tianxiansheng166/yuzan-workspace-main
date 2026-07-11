import type { SupportPairing, SupportSession } from "../../../../src/modules/support-pairings/domain/support-pairing.types.js";
import { ConsentStatus, PairingStatus, RiskLevel, TeacherReviewStatus } from "../../../../src/modules/support-pairings/domain/support-pairing.types.js";

let nextPairingId = 1;
function pairingId(): string {
  return `pairing-${nextPairingId++}`;
}

let nextSessionId = 1;
function sessionId(): string {
  return `session-${nextSessionId++}`;
}

export function supportPairing(
  overrides: Partial<SupportPairing> & { schoolId: string },
): SupportPairing {
  const now = new Date();
  return {
    id: pairingId(),
    studentUserId: "student-1",
    volunteerUserId: "volunteer-1",
    supervisorTeacherId: "teacher-1",
    consentStatus: ConsentStatus.PENDING,
    goal: "学业辅导",
    status: PairingStatus.PENDING_CONSENT,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function supportSession(
  overrides: Partial<SupportSession> & { pairingId: string },
): SupportSession {
  const now = new Date();
  return {
    id: sessionId(),
    scheduledAt: new Date(now.getTime() + 86400000),
    summary: undefined,
    nextStep: undefined,
    riskLevel: RiskLevel.LOW,
    teacherReviewStatus: TeacherReviewStatus.PENDING,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
