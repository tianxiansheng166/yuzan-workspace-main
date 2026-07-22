import {
  ConsentStatus,
  PairingStatus,
  RiskLevel,
  TeacherReviewStatus,
} from "../../../../src/modules/support-pairings/domain/support-pairing.types.js";
import type {
  SupportPairing,
  SupportSession,
} from "../../../../src/modules/support-pairings/domain/support-pairing.types.js";
import type {
  ListPairingsOptions,
  PaginatedResult,
  SupportPairingRepositoryPort,
} from "../../../../src/modules/support-pairings/ports/support-pairing-repository.port.js";

export class FakeSupportPairingRepository implements SupportPairingRepositoryPort {
  private pairings: Map<string, SupportPairing> = new Map();
  private sessions: Map<string, SupportSession> = new Map();
  private nextPairingId = 1;
  private nextSessionId = 1;

  async findById(
    schoolId: string,
    pairingId: string,
  ): Promise<SupportPairing | null> {
    const p = this.pairings.get(pairingId);
    return p && p.schoolId === schoolId ? p : null;
  }

  async findBySchoolId(
    schoolId: string,
    options: ListPairingsOptions,
  ): Promise<PaginatedResult<SupportPairing>> {
    let items = [...this.pairings.values()].filter(
      (p) => p.schoolId === schoolId,
    );

    if (options.status) {
      items = items.filter((p) => p.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor:
        hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async create(
    schoolId: string,
    data: Omit<
      SupportPairing,
      "id" | "consentStatus" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportPairing> {
    const now = new Date();
    const p: SupportPairing = {
      id: `pairing-${this.nextPairingId++}`,
      schoolId,
      studentUserId: data.studentUserId,
      volunteerUserId: data.volunteerUserId,
      supervisorTeacherId: data.supervisorTeacherId,
      consentStatus: ConsentStatus.PENDING,
      goal: data.goal,
      status: PairingStatus.PENDING_CONSENT,
      createdAt: now,
      updatedAt: now,
    };
    this.pairings.set(p.id, p);
    return p;
  }

  async updateConsentStatus(
    schoolId: string,
    pairingId: string,
    consentStatus: ConsentStatus,
  ): Promise<SupportPairing> {
    const p = this.pairings.get(pairingId);
    if (!p || p.schoolId !== schoolId) throw new Error("not found");
    const updated: SupportPairing = {
      ...p,
      consentStatus,
      updatedAt: new Date(),
    };
    this.pairings.set(pairingId, updated);
    return updated;
  }

  async updateStatus(
    schoolId: string,
    pairingId: string,
    status: PairingStatus,
  ): Promise<SupportPairing> {
    const p = this.pairings.get(pairingId);
    if (!p || p.schoolId !== schoolId) throw new Error("not found");
    const updated: SupportPairing = { ...p, status, updatedAt: new Date() };
    this.pairings.set(pairingId, updated);
    return updated;
  }

  async findSessionById(
    schoolId: string,
    sessionId: string,
  ): Promise<SupportSession | null> {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const pairing = this.pairings.get(s.pairingId);
    return pairing && pairing.schoolId === schoolId ? s : null;
  }

  async listSessionsByPairing(
    schoolId: string,
    pairingId: string,
  ): Promise<readonly SupportSession[]> {
    const pairing = this.pairings.get(pairingId);
    if (!pairing || pairing.schoolId !== schoolId) return [];
    return [...this.sessions.values()].filter(
      (s) => s.pairingId === pairingId,
    );
  }

  async createSession(
    schoolId: string,
    _pairingId: string,
    data: Omit<
      SupportSession,
      "id" | "riskLevel" | "teacherReviewStatus" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportSession> {
    const now = new Date();
    const s: SupportSession = {
      id: `session-${this.nextSessionId++}`,
      pairingId: data.pairingId,
      scheduledAt: data.scheduledAt,
      summary: undefined,
      nextStep: undefined,
      riskLevel: RiskLevel.LOW,
      teacherReviewStatus: TeacherReviewStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(s.id, s);
    return s;
  }

  async updateSessionReviewStatus(
    _schoolId: string,
    sessionId: string,
    teacherReviewStatus: TeacherReviewStatus,
  ): Promise<SupportSession> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("session not found");
    const updated: SupportSession = {
      ...s,
      teacherReviewStatus,
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /** Test helper: seed a pairing directly into the store */
  addPairing(p: SupportPairing): void {
    this.pairings.set(p.id, p);
  }

  /** Test helper: seed a session directly into the store */
  addSession(s: SupportSession): void {
    this.sessions.set(s.id, s);
  }
}
