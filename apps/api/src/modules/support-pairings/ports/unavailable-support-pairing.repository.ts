import { Injectable } from "@nestjs/common";
import type { ConsentStatus, PairingStatus, SupportPairing, SupportSession, TeacherReviewStatus } from "../domain/support-pairing.types.js";
import { SupportPairingUnavailableException } from "../domain/support-pairing.errors.js";
import type {
  ListPairingsOptions,
  PaginatedResult,
  SupportPairingRepositoryPort,
} from "./support-pairing-repository.port.js";

@Injectable()
export class UnavailableSupportPairingRepository
  implements SupportPairingRepositoryPort
{
  async findById(
    _schoolId: string,
    _pairingId: string,
  ): Promise<SupportPairing | null> {
    throw new SupportPairingUnavailableException();
  }

  async findBySchoolId(
    _schoolId: string,
    _options: ListPairingsOptions,
  ): Promise<PaginatedResult<SupportPairing>> {
    throw new SupportPairingUnavailableException();
  }

  async create(
    _schoolId: string,
    _data: Omit<
      SupportPairing,
      "id" | "consentStatus" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportPairing> {
    throw new SupportPairingUnavailableException();
  }

  async updateConsentStatus(
    _schoolId: string,
    _pairingId: string,
    _consentStatus: ConsentStatus,
  ): Promise<SupportPairing> {
    throw new SupportPairingUnavailableException();
  }

  async updateStatus(
    _schoolId: string,
    _pairingId: string,
    _status: PairingStatus,
  ): Promise<SupportPairing> {
    throw new SupportPairingUnavailableException();
  }

  async findSessionById(
    _schoolId: string,
    _sessionId: string,
  ): Promise<SupportSession | null> {
    throw new SupportPairingUnavailableException();
  }

  async listSessionsByPairing(
    _schoolId: string,
    _pairingId: string,
  ): Promise<readonly SupportSession[]> {
    throw new SupportPairingUnavailableException();
  }

  async createSession(
    _schoolId: string,
    _pairingId: string,
    _data: Omit<
      SupportSession,
      "id" | "riskLevel" | "teacherReviewStatus" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportSession> {
    throw new SupportPairingUnavailableException();
  }

  async updateSessionReviewStatus(
    _schoolId: string,
    _sessionId: string,
    _teacherReviewStatus: TeacherReviewStatus,
  ): Promise<SupportSession> {
    throw new SupportPairingUnavailableException();
  }
}
