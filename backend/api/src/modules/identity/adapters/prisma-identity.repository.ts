import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { IdentityException } from "../identity.errors.js";
import type {
  UserIdentity,
  UserMembership,
  UserSession,
} from "../identity.types.js";
import type {
  MembershipRepository,
  SessionRepository,
  UserIdentityRepository,
} from "../ports/index.js";

type Row = Record<string, unknown>;
type PrismaLike = {
  user: { findUnique(args: unknown): Promise<Row | null> };
  membership: {
    findMany(args: unknown): Promise<Row[]>;
    findFirst(args: unknown): Promise<Row | null>;
  };
  session: {
    findUnique(args: unknown): Promise<Row | null>;
  };
  sessionPair: {
    create(args: unknown): Promise<Row>;
    findUnique(args: unknown): Promise<Row | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction<T>(
    fn: (tx: PrismaLike) => Promise<T>,
    options?: unknown,
  ): Promise<T>;
};

const ACCESS_TYPE = "ACCESS";
const REFRESH_TYPE = "REFRESH";

@Injectable()
export class PrismaIdentityRepository
  implements
    UserIdentityRepository,
    MembershipRepository,
    SessionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private async closed<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof IdentityException) throw error;
      throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
    }
  }

  async findByIdentifier(identifier: string): Promise<UserIdentity | null> {
    return this.closed(async () =>
      this.mapUser(
        await this.prisma.user.findUnique({
          where: { loginIdentifier: identifier },
        }),
      ),
    );
  }

  async findById(userId: string): Promise<UserIdentity | null> {
    return this.closed(async () =>
      this.mapUser(
        await this.prisma.user.findUnique({ where: { id: userId } }),
      ),
    );
  }

  async findActiveMembershipsByUser(
    userId: string,
  ): Promise<readonly UserMembership[]> {
    return this.closed(async () =>
      (
        await this.prisma.membership.findMany({
          where: {
            userId,
            status: "ACTIVE",
            school: { isActive: true, deletedAt: null },
          },
          include: { school: true },
        })
      ).map((row) => this.mapMembership(row)),
    );
  }

  async findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<UserMembership | null> {
    return this.closed(async () => {
      const row = await this.prisma.membership.findFirst({
        where: {
          userId,
          schoolId,
          status: "ACTIVE",
          school: { isActive: true, deletedAt: null },
        },
        include: { school: true },
      });
      return row ? this.mapMembership(row) : null;
    });
  }

  async create(
    params: Parameters<SessionRepository["create"]>[0],
  ): Promise<UserSession> {
    return this.closed(() =>
      this.prisma.$transaction(async (tx) => {
        const pairId = randomUUID();
        const pair = await tx.sessionPair.create({
          data: {
            id: pairId,
            userId: params.userId,
            familyId: pairId,
            activeSchoolId: params.activeSchoolId,
            refreshExpiresAt: params.refreshExpiresAt,
            sessions: {
              create: [
                {
                  type: ACCESS_TYPE,
                  tokenHash: params.accessTokenHash,
                  expiresAt: params.accessExpiresAt,
                },
                {
                  type: REFRESH_TYPE,
                  tokenHash: params.refreshTokenHash,
                  expiresAt: params.refreshExpiresAt,
                },
              ],
            },
          },
          include: { sessions: true },
        });
        return this.mapPairWithSessions(pair);
      }),
    );
  }

  async findByAccessTokenHash(hash: string): Promise<UserSession | null> {
    return this.findPairSession(hash, ACCESS_TYPE);
  }

  async findByRefreshTokenHash(hash: string): Promise<UserSession | null> {
    return this.findPairSession(hash, REFRESH_TYPE);
  }

  private async findPairSession(
    tokenHash: string,
    expectedType: string,
  ): Promise<UserSession | null> {
    return this.closed(async () => {
      const row = await this.prisma.session.findUnique({
        where: { tokenHash },
        include: { pair: { include: { sessions: true } } },
      });
      if (!row || String(row.type) !== expectedType) return null;
      return this.mapPairWithSessions(row.pair as Row);
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.closed(async () => {
      await this.prisma.sessionPair.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async compareAndRotateRefreshSession(
    params: Parameters<SessionRepository["compareAndRotateRefreshSession"]>[0],
  ): Promise<UserSession | null> {
    return this.closed(() =>
      this.prisma.$transaction(async (tx) => {
        // Atomic claim: only one concurrent request can update this refresh pair.
        const claimed = await tx.sessionPair.updateMany({
          where: {
            id: params.sessionId,
            revokedAt: null,
            refreshExpiresAt: { gt: params.now },
            sessions: {
              some: {
                type: REFRESH_TYPE,
                tokenHash: params.expectedRefreshTokenHash,
              },
            },
          },
          data: { revokedAt: params.now, lastUsedAt: params.now },
        });
        if (claimed.count !== 1) return null;

        const predecessor = await tx.sessionPair.findUnique({
          where: { id: params.sessionId },
        });
        if (!predecessor) return null;

        const successorPairId = randomUUID();
        const successor = await tx.sessionPair.create({
          data: {
            id: successorPairId,
            userId: String(predecessor.userId),
            familyId: String(predecessor.familyId),
            predecessorPairId: params.sessionId,
            activeSchoolId: params.successor.activeSchoolId,
            refreshExpiresAt: params.successor.refreshExpiresAt,
            lastUsedAt: params.now,
            sessions: {
              create: [
                {
                  type: ACCESS_TYPE,
                  tokenHash: params.successor.accessTokenHash,
                  expiresAt: params.successor.accessExpiresAt,
                },
                {
                  type: REFRESH_TYPE,
                  tokenHash: params.successor.refreshTokenHash,
                  expiresAt: params.successor.refreshExpiresAt,
                },
              ],
            },
          },
          include: { sessions: true },
        });
        return this.mapPairWithSessions(successor);
      }),
    );
  }

  private mapPairWithSessions(row: Row): UserSession {
    const pair = row as Row;
    const sessions = (pair.sessions as Row[]) ?? [];
    const access = sessions.find((s) => String(s.type) === ACCESS_TYPE);
    const refresh = sessions.find((s) => String(s.type) === REFRESH_TYPE);
    if (!access || !refresh) {
      throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
    }
    return {
      id: String(pair.id),
      userId: String(pair.userId),
      activeSchoolId: (pair.activeSchoolId as string | null) ?? null,
      accessTokenHash: String(access.tokenHash),
      refreshTokenHash: String(refresh.tokenHash),
      accessExpiresAt: access.expiresAt as Date,
      refreshExpiresAt: pair.refreshExpiresAt as Date,
      revokedAt: (pair.revokedAt as Date | null) ?? null,
      createdAt: pair.createdAt as Date,
      lastUsedAt: pair.lastUsedAt as Date,
    };
  }

  private mapUser(row: Row | null): UserIdentity | null {
    if (!row) return null;
    return {
      id: String(row.id),
      loginIdentifier: String(row.loginIdentifier),
      displayName: String(row.displayName),
      preferredLocale: String(row.preferredLocale),
      status: String(row.status) as UserIdentity["status"],
      passwordHash: String(row.passwordHash),
    };
  }

  private mapMembership(row: Row): UserMembership {
    const school = row.school as Row;
    return {
      id: String(row.id),
      schoolId: String(row.schoolId),
      schoolName: String(school.name),
      role: String(row.role) as UserMembership["role"],
      status: String(row.status) as UserMembership["status"],
    };
  }
}
