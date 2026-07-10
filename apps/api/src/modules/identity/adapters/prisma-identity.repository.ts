import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
    create(args: unknown): Promise<Row>;
    createMany(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<Row | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction<T>(
    fn: (tx: PrismaLike) => Promise<T>,
    options?: unknown,
  ): Promise<T>;
  $disconnect(): Promise<void>;
};

const ACCESS_PREFIX = "access:";
const REFRESH_PREFIX = "refresh:";

function clientModulePath(): string {
  for (const root of [process.cwd(), resolve(process.cwd(), "../..")]) {
    for (const relative of [
      "infra/database/dist/generated/client/client.js",
      "infra/database/generated/client/client.js",
    ]) {
      const candidate = join(root, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("Generated Prisma client is unavailable");
}

function pairedId(id: string): string {
  const last = Number.parseInt(id.at(-1)!, 16) ^ 1;
  return `${id.slice(0, -1)}${last.toString(16)}`;
}

function logicalSession(row: Row, access: Row, refresh: Row): UserSession {
  return {
    id: String(refresh.id),
    userId: String(row.userId),
    activeSchoolId: (row.activeSchoolId as string | null) ?? null,
    accessTokenHash: String(access.refreshHash).slice(ACCESS_PREFIX.length),
    refreshTokenHash: String(refresh.refreshHash).slice(REFRESH_PREFIX.length),
    accessExpiresAt: access.expiresAt as Date,
    refreshExpiresAt: refresh.expiresAt as Date,
    revokedAt: (refresh.revokedAt as Date | null) ?? null,
    createdAt: refresh.createdAt as Date,
    lastUsedAt: refresh.lastUsedAt as Date,
  };
}

@Injectable()
export class PrismaIdentityRepository
  implements
    UserIdentityRepository,
    MembershipRepository,
    SessionRepository,
    OnModuleDestroy
{
  private readonly prisma: PrismaLike;

  constructor() {
    try {
      const modulePath = clientModulePath();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require(modulePath) as {
        PrismaClient: new (options: unknown) => PrismaLike;
      };
      // Prisma 7's query-compiler client requires a PostgreSQL driver adapter.
      // Keep this dynamic so a missing approved dependency fails closed rather
      // than preventing API compilation.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaPg } = require("@prisma/adapter-pg") as {
        PrismaPg: new (options: { connectionString: string }) => unknown;
      };
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("DATABASE_URL is unavailable");
      this.prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
      });
    } catch {
      throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

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
        const refreshId = randomUUID();
        const accessId = pairedId(refreshId);
        await tx.session.createMany({
          data: [
            {
              id: accessId,
              userId: params.userId,
              activeSchoolId: params.activeSchoolId,
              refreshHash: ACCESS_PREFIX + params.accessTokenHash,
              expiresAt: params.accessExpiresAt,
            },
            {
              id: refreshId,
              userId: params.userId,
              activeSchoolId: params.activeSchoolId,
              refreshHash: REFRESH_PREFIX + params.refreshTokenHash,
              expiresAt: params.refreshExpiresAt,
            },
          ],
        });
        return logicalSession(
          { userId: params.userId, activeSchoolId: params.activeSchoolId },
          {
            id: accessId,
            refreshHash: ACCESS_PREFIX + params.accessTokenHash,
            expiresAt: params.accessExpiresAt,
          },
          {
            id: refreshId,
            refreshHash: REFRESH_PREFIX + params.refreshTokenHash,
            expiresAt: params.refreshExpiresAt,
            revokedAt: null,
            createdAt: new Date(),
            lastUsedAt: new Date(),
          },
        );
      }),
    );
  }

  async findByAccessTokenHash(hash: string): Promise<UserSession | null> {
    return this.findPair(ACCESS_PREFIX + hash, true);
  }
  async findByRefreshTokenHash(hash: string): Promise<UserSession | null> {
    return this.findPair(REFRESH_PREFIX + hash, false);
  }

  private async findPair(
    storedHash: string,
    foundAccess: boolean,
  ): Promise<UserSession | null> {
    return this.closed(async () => {
      const found = await this.prisma.session.findUnique({
        where: { refreshHash: storedHash },
      });
      if (!found) return null;
      const pair = await this.prisma.session.findUnique({
        where: { id: pairedId(String(found.id)) },
      });
      if (!pair) return null;
      return foundAccess
        ? logicalSession(found, found, pair)
        : logicalSession(found, pair, found);
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.closed(async () => {
      await this.prisma.session.updateMany({
        where: {
          id: { in: [sessionId, pairedId(sessionId)] },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });
  }

  async compareAndRotateRefreshSession(
    params: Parameters<SessionRepository["compareAndRotateRefreshSession"]>[0],
  ): Promise<UserSession | null> {
    return this.closed(() =>
      this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.session.updateMany({
            where: {
              id: params.sessionId,
              refreshHash: REFRESH_PREFIX + params.expectedRefreshTokenHash,
              revokedAt: null,
              expiresAt: { gt: params.now },
            },
            data: { revokedAt: params.now, lastUsedAt: params.now },
          });
          if (claimed.count !== 1) return null;
          await tx.session.updateMany({
            where: { id: pairedId(params.sessionId), revokedAt: null },
            data: { revokedAt: params.now },
          });
          const refreshId = randomUUID();
          const accessId = pairedId(refreshId);
          await tx.session.createMany({
            data: [
              {
                id: accessId,
                userId: (await tx.session.findUnique({
                  where: { id: params.sessionId },
                }))!.userId,
                activeSchoolId: params.successor.activeSchoolId,
                refreshHash: ACCESS_PREFIX + params.successor.accessTokenHash,
                expiresAt: params.successor.accessExpiresAt,
              },
              {
                id: refreshId,
                userId: (await tx.session.findUnique({
                  where: { id: params.sessionId },
                }))!.userId,
                activeSchoolId: params.successor.activeSchoolId,
                refreshHash: REFRESH_PREFIX + params.successor.refreshTokenHash,
                expiresAt: params.successor.refreshExpiresAt,
              },
            ],
          });
          return logicalSession(
            {
              userId: (await tx.session.findUnique({
                where: { id: refreshId },
              }))!.userId,
              activeSchoolId: params.successor.activeSchoolId,
            },
            {
              id: accessId,
              refreshHash: ACCESS_PREFIX + params.successor.accessTokenHash,
              expiresAt: params.successor.accessExpiresAt,
            },
            {
              id: refreshId,
              refreshHash: REFRESH_PREFIX + params.successor.refreshTokenHash,
              expiresAt: params.successor.refreshExpiresAt,
              revokedAt: null,
              createdAt: params.now,
              lastUsedAt: params.now,
            },
          );
        },
        { isolationLevel: "Serializable" },
      ),
    );
  }

  private mapUser(row: Row | null): UserIdentity | null {
    if (!row) return null;
    return {
      id: String(row.id),
      loginIdentifier: String(row.loginIdentifier),
      displayName: String(row.displayName),
      passwordHash: String(row.passwordHash),
      preferredLocale: String(row.preferredLocale),
      status: String(row.status) as UserIdentity["status"],
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
