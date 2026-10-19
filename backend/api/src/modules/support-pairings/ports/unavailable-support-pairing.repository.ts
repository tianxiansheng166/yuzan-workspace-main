import { Injectable } from "@nestjs/common";
import type {
  ConsentStatus,
  PairingStatus,
  SupportPairing,
  SupportSession,
  TeacherReviewStatus,
} from "../domain/support-pairing.types.js";
import { SupportPairingUnavailableException } from "../domain/support-pairing.errors.js";
import type {
  ListPairingsOptions,
  PaginatedResult,
  SupportPairingRepositoryPort,
} from "./support-pairing-repository.port.js";

@Injectable()
export class UnavailableSupportPairingRepository implements SupportPairingRepositoryPort {
  findById(
    _schoolId: string,
    _pairingId: string,
  ): Promise<SupportPairing | null> {
    void _schoolId;
    void _pairingId;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  findBySchoolId(
    _schoolId: string,
    _options: ListPairingsOptions,
  ): Promise<PaginatedResult<SupportPairing>> {
    void _schoolId;
    void _options;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  create(
    _schoolId: string,
    _data: Omit<
      SupportPairing,
      "id" | "consentStatus" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportPairing> {
    void _schoolId;
    void _data;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  updateConsentStatus(
    _schoolId: string,
    _pairingId: string,
    _consentStatus: ConsentStatus,
  ): Promise<SupportPairing> {
    void _schoolId;
    void _pairingId;
    void _consentStatus;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  updateStatus(
    _schoolId: string,
    _pairingId: string,
    _status: PairingStatus,
  ): Promise<SupportPairing> {
    void _schoolId;
    void _pairingId;
    void _status;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  findSessionById(
    _schoolId: string,
    _sessionId: string,
  ): Promise<SupportSession | null> {
    void _schoolId;
    void _sessionId;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  listSessionsByPairing(
    _schoolId: string,
    _pairingId: string,
  ): Promise<readonly SupportSession[]> {
    void _schoolId;
    void _pairingId;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  createSession(
    _schoolId: string,
    _pairingId: string,
    _data: Omit<
      SupportSession,
      "id" | "riskLevel" | "teacherReviewStatus" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportSession> {
    void _schoolId;
    void _pairingId;
    void _data;
    return Promise.reject(new SupportPairingUnavailableException());
  }

  updateSessionReviewStatus(
    _schoolId: string,
    _sessionId: string,
    _teacherReviewStatus: TeacherReviewStatus,
  ): Promise<SupportSession> {
    void _schoolId;
    void _sessionId;
    void _teacherReviewStatus;
    return Promise.reject(new SupportPairingUnavailableException());
  }
}
