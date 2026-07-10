import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaIdentityRepository } from "../../../src/modules/identity/adapters/prisma-identity.repository.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require(
  resolve(
    process.cwd(),
    "../../infra/database/dist/generated/client/client.js",
  ),
);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repository = new PrismaIdentityRepository();
const userId = randomUUID();
const schoolA = randomUUID();
const schoolB = randomUUID();

describe("PrismaIdentityRepository integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        loginIdentifier: `identity-${userId}@test.invalid`,
        displayName: "Identity Integration",
        passwordHash: "hash",
      },
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, code: `a-${userId}`, name: "School A" },
        { id: schoolB, code: `b-${userId}`, name: "School B" },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId, schoolId: schoolA, role: "TEACHER", status: "ACTIVE" },
        { userId, schoolId: schoolB, role: "SCHOOL_ADMIN", status: "ACTIVE" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.membership.deleteMany({ where: { userId } });
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await repository.onModuleDestroy();
    await prisma.$disconnect();
  });

  it("looks up users, credentials, active memberships, and explicit tenants", async () => {
    const user = await repository.findById(userId);
    expect(user?.passwordHash).toBe("hash");
    const memberships = await repository.findActiveMembershipsByUser(userId);
    expect(memberships.map((item) => item.schoolId).sort()).toEqual(
      [schoolA, schoolB].sort(),
    );
    expect(await repository.findByUserAndSchool(userId, schoolB)).toMatchObject(
      { schoolId: schoolB, status: "ACTIVE" },
    );
  });

  it("stores only hashes, separates expiry, revokes, and rotates once under concurrency", async () => {
    const now = new Date();
    const original = await repository.create({
      userId,
      activeSchoolId: null,
      accessTokenHash: "access-old-hash",
      refreshTokenHash: "refresh-old-hash",
      accessExpiresAt: new Date(now.getTime() + 1_000),
      refreshExpiresAt: new Date(now.getTime() + 10_000),
    });
    const rotate = () =>
      repository.compareAndRotateRefreshSession({
        sessionId: original.id,
        expectedRefreshTokenHash: "refresh-old-hash",
        now,
        successor: {
          activeSchoolId: schoolB,
          accessTokenHash: "access-new-hash",
          refreshTokenHash: "refresh-new-hash",
          accessExpiresAt: new Date(now.getTime() + 2_000),
          refreshExpiresAt: new Date(now.getTime() + 20_000),
        },
      });
    const results = await Promise.allSettled([rotate(), rotate()]);
    expect(
      results.filter((result) => result.status === "fulfilled" && result.value),
    ).toHaveLength(1);
    expect(
      await repository.findByRefreshTokenHash("refresh-old-hash"),
    ).toMatchObject({ revokedAt: expect.any(Date) });
    expect(
      await repository.findByRefreshTokenHash("refresh-new-hash"),
    ).toMatchObject({ activeSchoolId: schoolB });
    expect(
      await prisma.session.findMany({
        where: { userId },
        select: { refreshHash: true },
      }),
    ).toEqual(
      expect.not.arrayContaining([
        { refreshHash: "access-old-hash" },
        { refreshHash: "refresh-old-hash" },
        { refreshHash: "access-new-hash" },
        { refreshHash: "refresh-new-hash" },
      ]),
    );
    await repository.revoke(
      (await repository.findByAccessTokenHash("access-new-hash"))!.id,
    );
    expect(
      await repository.findByRefreshTokenHash("refresh-new-hash"),
    ).toMatchObject({ revokedAt: expect.any(Date) });
  });

  it("rejects expired rotation", async () => {
    const expired = await repository.create({
      userId,
      activeSchoolId: schoolA,
      accessTokenHash: "expired-access",
      refreshTokenHash: "expired-refresh",
      accessExpiresAt: new Date(0),
      refreshExpiresAt: new Date(0),
    });
    await expect(
      repository.compareAndRotateRefreshSession({
        sessionId: expired.id,
        expectedRefreshTokenHash: "expired-refresh",
        now: new Date(),
        successor: {
          activeSchoolId: schoolA,
          accessTokenHash: "never-access",
          refreshTokenHash: "never-refresh",
          accessExpiresAt: new Date(Date.now() + 1000),
          refreshExpiresAt: new Date(Date.now() + 2000),
        },
      }),
    ).resolves.toBeNull();
  });
});
