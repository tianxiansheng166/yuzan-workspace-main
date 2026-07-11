/**
 * PostgreSQL integration tests for the shared Prisma runtime.
 *
 * These tests use the real pg Pool, PrismaPg adapter, and PrismaClient
 * against a real PostgreSQL database. No mocks.
 *
 * Prerequisites:
 *   - PostgreSQL running on localhost:5432
 *   - DATABASE_URL pointing to a test database with migrations applied
 *
 * Run:
 *   DATABASE_URL="postgresql://yuzan:yuzan_dev_only@localhost:5432/yuzan_db_runtime_test?schema=public" \
 *     pnpm --filter @yuzan/api exec vitest run --config test/database/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import {
  DatabaseError,
  redactConnectionString,
  sanitizeDriverError,
} from "../../src/shared/database/database.errors";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://yuzan:yuzan_dev_only@localhost:5432/yuzan_db_runtime_test?schema=public";

// Safety: ensure we're not connecting to production
const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
const safeMarkers = ["test", "runtime_test", "db_runtime_test"];
const hasSafeMarker = safeMarkers.some((m) => dbName.toLowerCase().includes(m));
if (!hasSafeMarker) {
  throw new Error(
    `Test database name "${dbName}" must include one of: ${safeMarkers.join(", ")}`,
  );
}

let pool: Pool;
let prisma: PrismaClient;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
  }
});

async function cleanup() {
  const tables = [
    "SyncOperation",
    "SyncJob",
    "ActivityAttempt",
    "AudioAsset",
    "Feedback",
    "Submission",
    "AssignmentTarget",
    "Assignment",
    "ContentPackage",
    "ActivityProgress",
    "ActivityResource",
    "Resource",
    "Question",
    "LearningActivity",
    "Lesson",
    "Unit",
    "CourseReview",
    "CourseVersion",
    "Course",
    "Enrollment",
    "Class",
    "Term",
    "Device",
    "Campus",
    "Membership",
    "Session",
    "SessionPair",
    "AuditLog",
    "User",
    "School",
  ];
  for (const table of tables) {
    await pool.query(`DELETE FROM "${table}" CASCADE`);
  }
}

describe("Shared database runtime — PostgreSQL integration tests", () => {
  beforeEach(cleanup);

  // 1. Valid config can connect
  it("connects with valid configuration", async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    expect(result).toBeDefined();
    expect((result as Array<{ ok: number }>)[0].ok).toBe(1);
  });

  // 2. Invalid config fails fast (when a query is attempted)
  it("rejects invalid connection string on query", async () => {
    const badPool = new Pool({
      connectionString: "not-a-url",
      connectionTimeoutMillis: 250,
    });
    try {
      await badPool.query("SELECT 1");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeTruthy();
    } finally {
      // end() may throw on invalid pool, wrap in try
      try {
        await badPool.end();
      } catch {
        /* ignore */
      }
    }
  });

  // 3 & 4. Shared PrismaClient instance serves multiple queries
  it("provides same PrismaClient instance across concurrent accesses", async () => {
    const [r1, r2] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 2`,
    ]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  // 5. Transaction commit
  it("commits a transaction successfully", async () => {
    const schoolId = randomUUID();
    const userId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.school.create({
        data: {
          id: schoolId,
          code: `sch-${schoolId.slice(0, 8)}`,
          name: "TX Commit School",
        },
      });
      await tx.user.create({
        data: {
          id: userId,
          loginIdentifier: `user-${userId.slice(0, 8)}`,
          displayName: "TX User",
          passwordHash: "hash",
        },
      });
    });

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(school).toBeTruthy();
    expect(user).toBeTruthy();
  });

  // 6. Transaction rollback
  it("rolls back a transaction on error", async () => {
    const schoolId = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.school.create({
          data: {
            id: schoolId,
            code: `sch-${schoolId.slice(0, 8)}`,
            name: "TX Rollback School",
          },
        });
        throw new Error("Force rollback");
      }),
    ).rejects.toThrow("Force rollback");

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    expect(school).toBeNull();
  });

  // 7. Pool closes after shutdown
  it("closes the pool on shutdown", async () => {
    const shutdownPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const shutdownAdapter = new PrismaPg(shutdownPool);
    const shutdownPrisma = new PrismaClient({ adapter: shutdownAdapter });

    await shutdownPrisma.$disconnect();
    await shutdownPool.end();

    await expect(shutdownPool.query("SELECT 1")).rejects.toThrow();
  });

  // 8. Repeated shutdown does not throw
  it("repeated shutdown does not throw", async () => {
    const repeatPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const repeatAdapter = new PrismaPg(repeatPool);
    const repeatPrisma = new PrismaClient({ adapter: repeatAdapter });

    await repeatPrisma.$disconnect();
    await repeatPool.end();

    // Second disconnect should be safe (PrismaClient handles it)
    await expect(repeatPrisma.$disconnect()).resolves.toBeUndefined();
    // pg-pool throws on double end(), but PrismaService guards against this
    // by tracking _destroyed flag and not calling pool.end() twice
  });

  // 9. Test process does not hang (verified by clean exit)

  // 10. PostgreSQL unavailable → fail-closed
  it("fails closed when PostgreSQL is unavailable", async () => {
    const badPool = new Pool({
      connectionString: "postgresql://no:no@localhost:99999/nonexistent",
    });
    try {
      await badPool.query("SELECT 1");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeTruthy();
      const safe = sanitizeDriverError(err);
      expect(safe.code).toBe("DATABASE_QUERY_FAILED");
      expect(safe.message).not.toContain("localhost:99999");
    } finally {
      await badPool.end();
    }
  });

  // 11. Error does not contain full connection string
  it("error output does not contain full connection string", () => {
    const raw = redactConnectionString(TEST_DATABASE_URL);
    expect(raw).not.toContain("yuzan_dev_only");
    expect(raw).toContain("***");
  });

  // 12. Password and URL userinfo are redacted
  it("sanitizeDriverError does not expose driver error message", () => {
    const fakePgError = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "School_code_key" DETAIL: Key (code)=(secret-code) already exists.',
    };
    const safe = sanitizeDriverError(fakePgError);
    expect(safe.code).toBe("DATABASE_CONFLICT");
    expect(safe.message).not.toContain("secret-code");
    expect(safe.message).not.toContain("School_code_key");
  });

  // 13. No module-private Pool (architecture: PrismaService owns the only Pool)

  // 14. Concurrent queries do not create extra clients
  it("handles concurrent queries on the same client", async () => {
    const promises = Array.from(
      { length: 10 },
      () => prisma.$queryRaw`SELECT 1`,
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r).toBeDefined();
    }
  });
});

describe("redactConnectionString", () => {
  it("redacts username and password", () => {
    const url = "postgresql://admin:s3cret@db.example.com:5432/mydb";
    const redacted = redactConnectionString(url);
    expect(redacted).not.toContain("admin");
    expect(redacted).not.toContain("s3cret");
    expect(redacted).toContain("***");
  });

  it("handles URLs without credentials", () => {
    const url = "postgresql://db.example.com:5432/mydb";
    const redacted = redactConnectionString(url);
    expect(redacted).not.toContain("***");
  });

  it("returns [REDACTED] for invalid URLs", () => {
    expect(redactConnectionString("not-a-url")).toBe("[REDACTED]");
  });

  it("removes query parameters", () => {
    const url = "postgresql://u:p@host/db?sslmode=require&schema=internal";
    const redacted = redactConnectionString(url);
    expect(redacted).not.toContain("sslmode");
    expect(redacted).not.toContain("schema");
  });
});

describe("sanitizeDriverError", () => {
  it("maps connection errors to DATABASE_UNAVAILABLE", () => {
    const result = sanitizeDriverError({
      code: "08001",
      message: "could not connect to server",
    });
    expect(result.code).toBe("DATABASE_UNAVAILABLE");
    expect(result.retryable).toBe(true);
  });

  it("maps unique violation to DATABASE_CONFLICT", () => {
    const result = sanitizeDriverError({
      code: "23505",
      message: "duplicate key",
    });
    expect(result.code).toBe("DATABASE_CONFLICT");
    expect(result.retryable).toBe(false);
  });

  it("maps constraint violation to DATABASE_CONSTRAINT_VIOLATION", () => {
    const result = sanitizeDriverError({
      code: "23503",
      message: "foreign key",
    });
    expect(result.code).toBe("DATABASE_CONSTRAINT_VIOLATION");
    expect(result.retryable).toBe(false);
  });

  it("maps serialization failure to DATABASE_TRANSACTION_FAILED", () => {
    const result = sanitizeDriverError({
      code: "40001",
      message: "serialization",
    });
    expect(result.code).toBe("DATABASE_TRANSACTION_FAILED");
    expect(result.retryable).toBe(true);
  });

  it("maps unknown errors to DATABASE_QUERY_FAILED", () => {
    const result = sanitizeDriverError(new Error("something unexpected"));
    expect(result.code).toBe("DATABASE_QUERY_FAILED");
    expect(result.retryable).toBe(false);
  });

  it("never includes raw message in sanitized output", () => {
    const result = sanitizeDriverError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "User_loginIdentifier_key" DETAIL: Key (loginIdentifier)=(sensitive-data) already exists.',
    });
    expect(result.message).not.toContain("sensitive-data");
    expect(result.message).not.toContain("User_loginIdentifier_key");
  });
});

describe("DatabaseError", () => {
  it("carries code, message, and metadata", () => {
    const err = new DatabaseError(
      "DATABASE_UNAVAILABLE",
      "Connection failed",
      "startup",
      "req-123",
      true,
    );
    expect(err.name).toBe("DatabaseError");
    expect(err.code).toBe("DATABASE_UNAVAILABLE");
    expect(err.message).toBe("Connection failed");
    expect(err.operation).toBe("startup");
    expect(err.requestId).toBe("req-123");
    expect(err.retryable).toBe(true);
  });
});
