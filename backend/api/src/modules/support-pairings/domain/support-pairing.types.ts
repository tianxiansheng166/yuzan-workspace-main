export enum ConsentStatus {
  PENDING = "PENDING",
  GRANTED = "GRANTED",
  DENIED = "DENIED",
  REVOKED = "REVOKED",
}

export enum PairingStatus {
  PENDING_CONSENT = "PENDING_CONSENT",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ENDED = "ENDED",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum TeacherReviewStatus {
  PENDING = "PENDING",
  REVIEWED = "REVIEWED",
  FLAGGED = "FLAGGED",
}

export interface SupportPairing {
  readonly id: string;
  readonly schoolId: string;
  readonly studentUserId: string;
  readonly volunteerUserId: string;
  readonly supervisorTeacherId: string;
  readonly consentStatus: ConsentStatus;
  readonly goal: string;
  readonly status: PairingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SupportSession {
  readonly id: string;
  readonly pairingId: string;
  readonly scheduledAt: Date;
  readonly summary?: string;
  readonly nextStep?: string;
  readonly riskLevel: RiskLevel;
  readonly teacherReviewStatus: TeacherReviewStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
