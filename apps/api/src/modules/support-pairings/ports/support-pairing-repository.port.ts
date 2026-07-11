import type {
  ConsentStatus,
  PairingStatus,
  SupportPairing,
  SupportSession,
  TeacherReviewStatus,
} from "../domain/support-pairing.types.js";

export const SUPPORT_PAIRING_REPOSITORY = Symbol("SUPPORT_PAIRING_REPOSITORY");

export interface ListPairingsOptions {
  readonly status?: PairingStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface SupportPairingRepositoryPort {
  findById(schoolId: string, pairingId: string): Promise<SupportPairing | null>;
  findBySchoolId(
    schoolId: string,
    options: ListPairingsOptions,
  ): Promise<PaginatedResult<SupportPairing>>;
  create(
    schoolId: string,
    data: Omit<
      SupportPairing,
      "id" | "consentStatus" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportPairing>;
  updateConsentStatus(
    schoolId: string,
    pairingId: string,
    consentStatus: ConsentStatus,
  ): Promise<SupportPairing>;
  updateStatus(
    schoolId: string,
    pairingId: string,
    status: PairingStatus,
  ): Promise<SupportPairing>;

  findSessionById(
    schoolId: string,
    sessionId: string,
  ): Promise<SupportSession | null>;
  listSessionsByPairing(
    schoolId: string,
    pairingId: string,
  ): Promise<readonly SupportSession[]>;
  createSession(
    schoolId: string,
    pairingId: string,
    data: Omit<
      SupportSession,
      "id" | "riskLevel" | "teacherReviewStatus" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportSession>;
  updateSessionReviewStatus(
    schoolId: string,
    sessionId: string,
    teacherReviewStatus: TeacherReviewStatus,
  ): Promise<SupportSession>;
}
