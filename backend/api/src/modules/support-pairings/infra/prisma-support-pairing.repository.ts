import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import {
  ConsentStatus,
  PairingStatus,
  RiskLevel,
  TeacherReviewStatus,
  type SupportPairing,
  type SupportSession,
} from "../domain/support-pairing.types.js";
import type {
  ListPairingsOptions,
  PaginatedResult,
  SupportPairingRepositoryPort,
} from "../ports/support-pairing-repository.port.js";

@Injectable()
export class PrismaSupportPairingRepository implements SupportPairingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    pairingId: string,
  ): Promise<SupportPairing | null> {
    const row = await this.prisma.supportPairing.findFirst({
      where: { schoolId, id: pairingId },
    });
    return row ? toPairing(row) : null;
  }

  async findBySchoolId(
    schoolId: string,
    options: ListPairingsOptions,
  ): Promise<PaginatedResult<SupportPairing>> {
    const rows = await this.prisma.supportPairing.findMany({
      where: {
        schoolId,
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map(toPairing),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
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
    const row = await this.prisma.supportPairing.create({
      data: {
        schoolId,
        studentUserId: data.studentUserId,
        volunteerUserId: data.volunteerUserId,
        supervisorTeacherId: data.supervisorTeacherId,
        goal: data.goal,
        consentStatus: ConsentStatus.PENDING,
        status: PairingStatus.PENDING_CONSENT,
      },
    });
    return toPairing(row);
  }

  async updateConsentStatus(
    schoolId: string,
    pairingId: string,
    consentStatus: ConsentStatus,
  ): Promise<SupportPairing> {
    await this.updateScoped(schoolId, pairingId, { consentStatus });
    const row = await this.findById(schoolId, pairingId);
    if (!row) throw new Error("SUPPORT_PAIRING_NOT_FOUND");
    return row;
  }

  async updateStatus(
    schoolId: string,
    pairingId: string,
    status: PairingStatus,
  ): Promise<SupportPairing> {
    await this.updateScoped(schoolId, pairingId, { status });
    const row = await this.findById(schoolId, pairingId);
    if (!row) throw new Error("SUPPORT_PAIRING_NOT_FOUND");
    return row;
  }

  async findSessionById(
    schoolId: string,
    sessionId: string,
  ): Promise<SupportSession | null> {
    const row = await this.prisma.supportSession.findFirst({
      where: { schoolId, id: sessionId },
    });
    return row ? toSession(row) : null;
  }

  async listSessionsByPairing(
    schoolId: string,
    pairingId: string,
  ): Promise<readonly SupportSession[]> {
    const rows = await this.prisma.supportSession.findMany({
      where: { schoolId, pairingId },
      orderBy: { scheduledAt: "asc" },
    });
    return rows.map(toSession);
  }

  async createSession(
    schoolId: string,
    pairingId: string,
    data: Omit<
      SupportSession,
      "id" | "riskLevel" | "teacherReviewStatus" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportSession> {
    const pairing = await this.findById(schoolId, pairingId);
    if (!pairing) throw new Error("SUPPORT_PAIRING_NOT_FOUND");
    const row = await this.prisma.supportSession.create({
      data: {
        schoolId,
        pairingId,
        scheduledAt: data.scheduledAt,
        riskLevel: RiskLevel.LOW,
        teacherReviewStatus: TeacherReviewStatus.PENDING,
        ...(data.summary ? { summary: data.summary } : {}),
        ...(data.nextStep ? { nextStep: data.nextStep } : {}),
      },
    });
    return toSession(row);
  }

  async updateSessionReviewStatus(
    schoolId: string,
    sessionId: string,
    teacherReviewStatus: TeacherReviewStatus,
  ): Promise<SupportSession> {
    const result = await this.prisma.supportSession.updateMany({
      where: { schoolId, id: sessionId },
      data: { teacherReviewStatus },
    });
    if (result.count !== 1) throw new Error("SUPPORT_SESSION_NOT_FOUND");
    const row = await this.findSessionById(schoolId, sessionId);
    if (!row) throw new Error("SUPPORT_SESSION_NOT_FOUND");
    return row;
  }

  private async updateScoped(
    schoolId: string,
    pairingId: string,
    data: { consentStatus?: ConsentStatus; status?: PairingStatus },
  ) {
    const result = await this.prisma.supportPairing.updateMany({
      where: { schoolId, id: pairingId },
      data,
    });
    if (result.count !== 1) throw new Error("SUPPORT_PAIRING_NOT_FOUND");
  }
}

function toPairing(row: Record<string, unknown>): SupportPairing {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    studentUserId: row.studentUserId as string,
    volunteerUserId: row.volunteerUserId as string,
    supervisorTeacherId: row.supervisorTeacherId as string,
    consentStatus: row.consentStatus as ConsentStatus,
    goal: row.goal as string,
    status: row.status as PairingStatus,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

function toSession(row: Record<string, unknown>): SupportSession {
  return {
    id: row.id as string,
    pairingId: row.pairingId as string,
    scheduledAt: row.scheduledAt as Date,
    riskLevel: row.riskLevel as RiskLevel,
    teacherReviewStatus: row.teacherReviewStatus as TeacherReviewStatus,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.summary ? { summary: row.summary as string } : {}),
    ...(row.nextStep ? { nextStep: row.nextStep as string } : {}),
  };
}
