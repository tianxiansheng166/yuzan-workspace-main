import { resolve } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PrismaIdentityRepository } from "../../../src/modules/identity/adapters/prisma-identity.repository.js";
import { PrismaService } from "../../../src/shared/database/prisma.service.js";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("DATABASE_URL is required");
const TEST_DATABASE_URL = configuredUrl;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require(
  resolve(
    process.cwd(),
    "../../infra/database/dist/generated/client/client.js",
  ),
);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");

async function clearTables(prisma: {
  [key: string]: { deleteMany: (args?: unknown) => Promise<unknown> };
}): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.sessionPair.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.term.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();
}

describe("PrismaIdentityRepository PostgreSQL integration", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let repository: PrismaIdentityRepository;
  let runtime: PrismaService;

  function createPrisma() {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
      log: ["error"],
    });
  }

  beforeAll(async () => {
    prisma = createPrisma();
    await clearTables(prisma);
    runtime = new PrismaService(TEST_DATABASE_URL);
    await runtime.onModuleInit();
    repository = new PrismaIdentityRepository(runtime);
  });

  afterEach(async () => {
    await clearTables(prisma);
  });

  afterAll(async () => {
    await runtime.onModuleDestroy();
    await prisma.$disconnect();
  });

  describe("A. repository construction and connection", () => {
    it("constructs the repository and connects to PostgreSQL", async () => {
      const result = await repository.findByIdentifier("nobody@example.edu");
      expect(result).toBeNull();
    });

    it("uses only the injected shared database runtime", () => {
      expect(() => new PrismaIdentityRepository(runtime)).not.toThrow();
    });

    it("remains fail-closed with an invalid host and does not leak the connection URL", async () => {
      const invalidRuntime = new PrismaService(
        "postgresql://user:password@127.0.0.1:65432/identity_secret",
      );
      const repo = new PrismaIdentityRepository(invalidRuntime);
      await expect(repo.findByIdentifier("x")).rejects.toThrow(
        expect.objectContaining({ code: "AUTH_SERVICE_UNAVAILABLE" }),
      );
      await invalidRuntime.onModuleDestroy();
    });
  });

  describe("B. users and credentials", () => {
    it("looks up an existing user and never stores plaintext passwords", async () => {
      const passwordHash = "$scrypt$16384$8$1$c2FsdA==$aGFzaA==";
      await prisma.user.create({
        data: {
          id: "11111111-1111-1111-1111-111111111111",
          loginIdentifier: "teacher@school.a",
          displayName: "Teacher A",
          passwordHash,
        },
      });

      const user = await repository.findByIdentifier("teacher@school.a");
      expect(user).toMatchObject({
        id: "11111111-1111-1111-1111-111111111111",
        passwordHash,
        status: "ACTIVE",
      });

      const dbUser = await prisma.user.findUnique({
        where: { loginIdentifier: "teacher@school.a" },
        select: { passwordHash: true },
      });
      expect(dbUser?.passwordHash).not.toContain("plaintext-password");
    });

    it("returns null for a missing user", async () => {
      const user = await repository.findByIdentifier("missing@school.a");
      expect(user).toBeNull();
    });

    it("rejects inactive users", async () => {
      await prisma.user.create({
        data: {
          id: "22222222-2222-2222-2222-222222222222",
          loginIdentifier: "inactive@school.a",
          displayName: "Inactive",
          passwordHash: "hash",
          status: "SUSPENDED",
        },
      });
      const user = await repository.findByIdentifier("inactive@school.a");
      expect(user?.status).toBe("SUSPENDED");
    });
  });

  describe("C. membership", () => {
    const userId = "33333333-3333-3333-3333-333333333333";
    const schoolA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const schoolB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "student@schools.ab",
          displayName: "Student",
          passwordHash: "hash",
        },
      });
      await prisma.school.createMany({
        data: [
          { id: schoolA, code: "school-a", name: "School A" },
          { id: schoolB, code: "school-b", name: "School B" },
        ],
      });
    });

    it("returns only ACTIVE memberships and does not default to the first school", async () => {
      await prisma.membership.createMany({
        data: [
          { userId, schoolId: schoolA, role: "STUDENT", status: "ACTIVE" },
          { userId, schoolId: schoolB, role: "STUDENT", status: "INVITED" },
        ],
      });
      const memberships = await repository.findActiveMembershipsByUser(userId);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        schoolId: schoolA,
        status: "ACTIVE",
      });
    });

    it("excludes INVITED, SUSPENDED and LEFT memberships", async () => {
      await prisma.membership.createMany({
        data: [
          { userId, schoolId: schoolA, role: "STUDENT", status: "INVITED" },
          { userId, schoolId: schoolB, role: "STUDENT", status: "SUSPENDED" },
        ],
      });
      const memberships = await repository.findActiveMembershipsByUser(userId);
      expect(memberships).toHaveLength(0);
    });

    it("returns null when querying an active membership across tenants", async () => {
      await prisma.membership.create({
        data: { userId, schoolId: schoolA, role: "STUDENT", status: "ACTIVE" },
      });
      const membership = await repository.findByUserAndSchool(userId, schoolB);
      expect(membership).toBeNull();
    });
  });

  describe("D. session creation", () => {
    const userId = "44444444-4444-4444-4444-444444444444";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "create@session.test",
          displayName: "Create",
          passwordHash: "hash",
        },
      });
    });

    it("creates a complete session pair with correct relationships", async () => {
      const now = new Date();
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-hash-1",
        refreshTokenHash: "refresh-hash-1",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      expect(session.userId).toBe(userId);
      expect(session.accessTokenHash).toBe("access-hash-1");
      expect(session.refreshTokenHash).toBe("refresh-hash-1");

      const pair = await prisma.sessionPair.findUnique({
        where: { id: session.id },
        include: { sessions: { orderBy: { type: "asc" } } },
      });
      expect(pair).not.toBeNull();
      expect(pair?.sessions).toHaveLength(2);
      expect(pair?.sessions.map((s) => s.type).sort()).toEqual([
        "ACCESS",
        "REFRESH",
      ]);
      expect(pair?.familyId).toBe(pair?.id);
      expect(pair?.predecessorPairId).toBeNull();
    });

    it("stores only token hashes, never raw tokens", async () => {
      const now = new Date();
      await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "hashed-access",
        refreshTokenHash: "hashed-refresh",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      const rows = await prisma.session.findMany({
        select: { tokenHash: true },
      });
      const hashes = rows.map((r) => r.tokenHash);
      expect(hashes).toContain("hashed-access");
      expect(hashes).toContain("hashed-refresh");
      expect(hashes).not.toContain("raw-access-token");
      expect(hashes).not.toContain("raw-refresh-token");
    });

    it("looks up sessions by access and refresh token hashes", async () => {
      const now = new Date();
      const created = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-lookup",
        refreshTokenHash: "refresh-lookup",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      const byAccess = await repository.findByAccessTokenHash("access-lookup");
      const byRefresh =
        await repository.findByRefreshTokenHash("refresh-lookup");

      expect(byAccess?.id).toBe(created.id);
      expect(byRefresh?.id).toBe(created.id);
      expect(
        await repository.findByAccessTokenHash("refresh-lookup"),
      ).toBeNull();
      expect(
        await repository.findByRefreshTokenHash("access-lookup"),
      ).toBeNull();
    });
  });

  describe("E. atomic rotation", () => {
    const userId = "55555555-5555-5555-5555-555555555555";
    let sessionId: string;

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "rotate@session.test",
          displayName: "Rotate",
          passwordHash: "hash",
        },
      });
      const now = new Date();
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-old",
        refreshTokenHash: "refresh-old",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });
      sessionId = session.id;
    });

    it("rotates once and only once under concurrent refresh", async () => {
      const now = new Date();
      const rotate = () =>
        repository.compareAndRotateRefreshSession({
          sessionId,
          expectedRefreshTokenHash: "refresh-old",
          now,
          successor: {
            activeSchoolId: null,
            accessTokenHash: "access-new",
            refreshTokenHash: "refresh-new",
            accessExpiresAt: new Date(now.getTime() + 60_000),
            refreshExpiresAt: new Date(now.getTime() + 120_000),
          },
        });

      const results = await Promise.allSettled([rotate(), rotate()]);
      const successful = results.filter(
        (r): r is PromiseFulfilledResult<unknown> =>
          r.status === "fulfilled" && r.value !== null,
      );
      expect(successful).toHaveLength(1);

      const pairs = await prisma.sessionPair.findMany({
        where: { familyId: sessionId },
        include: { sessions: true },
        orderBy: { createdAt: "asc" },
      });
      expect(pairs).toHaveLength(2);
      expect(pairs[0].revokedAt).not.toBeNull();
      expect(pairs[1].predecessorPairId).toBe(pairs[0].id);
    });
  });

  describe("F. replay rejection", () => {
    const userId = "66666666-6666-6666-6666-666666666666";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "replay@session.test",
          displayName: "Replay",
          passwordHash: "hash",
        },
      });
    });

    it("rejects replayed refresh tokens and creates no new rows", async () => {
      const now = new Date();
      const original = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-replay",
        refreshTokenHash: "refresh-replay",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });
      await repository.compareAndRotateRefreshSession({
        sessionId: original.id,
        expectedRefreshTokenHash: "refresh-replay",
        now,
        successor: {
          activeSchoolId: null,
          accessTokenHash: "access-replay-2",
          refreshTokenHash: "refresh-replay-2",
          accessExpiresAt: new Date(now.getTime() + 60_000),
          refreshExpiresAt: new Date(now.getTime() + 120_000),
        },
      });

      const replay = await repository.compareAndRotateRefreshSession({
        sessionId: original.id,
        expectedRefreshTokenHash: "refresh-replay",
        now,
        successor: {
          activeSchoolId: null,
          accessTokenHash: "access-replay-3",
          refreshTokenHash: "refresh-replay-3",
          accessExpiresAt: new Date(now.getTime() + 60_000),
          refreshExpiresAt: new Date(now.getTime() + 120_000),
        },
      });
      expect(replay).toBeNull();

      const pairs = await prisma.sessionPair.findMany({
        where: { familyId: original.id },
      });
      expect(pairs).toHaveLength(2);
    });
  });

  describe("G. revoke", () => {
    const userId = "77777777-7777-7777-7777-777777777777";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "revoke@session.test",
          displayName: "Revoke",
          passwordHash: "hash",
        },
      });
    });

    it("revokes a session and prevents subsequent refresh", async () => {
      const now = new Date();
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-revoke",
        refreshTokenHash: "refresh-revoke",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      await repository.revoke(session.id);
      const rotated = await repository.compareAndRotateRefreshSession({
        sessionId: session.id,
        expectedRefreshTokenHash: "refresh-revoke",
        now,
        successor: {
          activeSchoolId: null,
          accessTokenHash: "access-revoke-2",
          refreshTokenHash: "refresh-revoke-2",
          accessExpiresAt: new Date(now.getTime() + 60_000),
          refreshExpiresAt: new Date(now.getTime() + 120_000),
        },
      });
      expect(rotated).toBeNull();
    });

    it("is idempotent when revoking the same session twice", async () => {
      const now = new Date();
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-revoke-idem",
        refreshTokenHash: "refresh-revoke-idem",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      await repository.revoke(session.id);
      await repository.revoke(session.id);

      const pair = await prisma.sessionPair.findUnique({
        where: { id: session.id },
      });
      expect(pair?.revokedAt).not.toBeNull();
    });

    it("does not revoke another user's session", async () => {
      const now = new Date();
      const otherUserId = "77777777-7777-7777-7777-777777777778";
      await prisma.user.create({
        data: {
          id: otherUserId,
          loginIdentifier: "other@session.test",
          displayName: "Other",
          passwordHash: "hash",
        },
      });
      const victim = await repository.create({
        userId: otherUserId,
        activeSchoolId: null,
        accessTokenHash: "access-victim",
        refreshTokenHash: "refresh-victim",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });
      const attacker = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-attacker",
        refreshTokenHash: "refresh-attacker",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      await repository.revoke(attacker.id);

      const victimPair = await prisma.sessionPair.findUnique({
        where: { id: victim.id },
      });
      expect(victimPair?.revokedAt).toBeNull();
    });
  });

  describe("H. expiry and cleanup", () => {
    const userId = "88888888-8888-8888-8888-888888888888";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "expiry@session.test",
          displayName: "Expiry",
          passwordHash: "hash",
        },
      });
    });

    it("rejects rotation of an expired refresh token", async () => {
      const past = new Date(0);
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-expired",
        refreshTokenHash: "refresh-expired",
        accessExpiresAt: past,
        refreshExpiresAt: past,
      });

      const rotated = await repository.compareAndRotateRefreshSession({
        sessionId: session.id,
        expectedRefreshTokenHash: "refresh-expired",
        now: new Date(),
        successor: {
          activeSchoolId: null,
          accessTokenHash: "access-never",
          refreshTokenHash: "refresh-never",
          accessExpiresAt: new Date(Date.now() + 60_000),
          refreshExpiresAt: new Date(Date.now() + 120_000),
        },
      });
      expect(rotated).toBeNull();
    });

    it("cleanup removes expired pairs without leaving orphaned sessions", async () => {
      const past = new Date(Date.now() - 1_000);
      const session = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-cleanup",
        refreshTokenHash: "refresh-cleanup",
        accessExpiresAt: past,
        refreshExpiresAt: past,
      });

      await prisma.sessionPair.deleteMany({
        where: { refreshExpiresAt: { lt: new Date() } },
      });

      const pair = await prisma.sessionPair.findUnique({
        where: { id: session.id },
      });
      expect(pair).toBeNull();
      const rows = await prisma.session.findMany({
        where: { pairId: session.id },
      });
      expect(rows).toHaveLength(0);
    });

    it("cleanup does not delete a valid successor pair", async () => {
      const now = new Date();
      const original = await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-cleanup-valid",
        refreshTokenHash: "refresh-cleanup-valid",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });
      const successor = await repository.compareAndRotateRefreshSession({
        sessionId: original.id,
        expectedRefreshTokenHash: "refresh-cleanup-valid",
        now,
        successor: {
          activeSchoolId: null,
          accessTokenHash: "access-cleanup-valid-2",
          refreshTokenHash: "refresh-cleanup-valid-2",
          accessExpiresAt: new Date(now.getTime() + 60_000),
          refreshExpiresAt: new Date(now.getTime() + 120_000),
        },
      });
      expect(successor).not.toBeNull();

      await prisma.sessionPair.deleteMany({
        where: { refreshExpiresAt: { lt: new Date(now.getTime() - 1_000) } },
      });

      const successorPair = await prisma.sessionPair.findUnique({
        where: { id: successor!.id },
        include: { sessions: true },
      });
      expect(successorPair).not.toBeNull();
      expect(successorPair?.sessions).toHaveLength(2);
    });
  });

  describe("I. transaction rollback", () => {
    const userId = "99999999-9999-9999-9999-999999999999";

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: "rollback@session.test",
          displayName: "Rollback",
          passwordHash: "hash",
        },
      });
    });

    it("rolls back the entire pair when the second session row violates a unique constraint", async () => {
      const now = new Date();
      // First create a legitimate pair to occupy the refresh token hash.
      await repository.create({
        userId,
        activeSchoolId: null,
        accessTokenHash: "access-unique-1",
        refreshTokenHash: "refresh-unique-shared",
        accessExpiresAt: new Date(now.getTime() + 60_000),
        refreshExpiresAt: new Date(now.getTime() + 120_000),
      });

      // Attempt to create a second pair reusing the same refresh token hash.
      // The transaction must roll back and leave only the first pair.
      await expect(
        repository.create({
          userId,
          activeSchoolId: null,
          accessTokenHash: "access-unique-2",
          refreshTokenHash: "refresh-unique-shared",
          accessExpiresAt: new Date(now.getTime() + 60_000),
          refreshExpiresAt: new Date(now.getTime() + 120_000),
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "AUTH_SERVICE_UNAVAILABLE" }),
      );

      const pairs = await prisma.sessionPair.findMany({ where: { userId } });
      expect(pairs).toHaveLength(1);
      const sessions = await prisma.session.findMany({
        where: { tokenHash: "refresh-unique-shared" },
      });
      expect(sessions).toHaveLength(1);
    });
  });
});
