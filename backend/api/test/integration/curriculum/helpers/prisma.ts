import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@yuzan/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * DATABASE_URL must be set in the shell environment (e.g. CI) for integration
 * tests to run. The vitest config has `dotenv: false` so .env is NOT loaded.
 */
const hasDb = !!process.env.DATABASE_URL;

let _pool: Pool | undefined;
let _prisma: PrismaClient | undefined;

/**
 * Lazy-accessor for the shared PrismaClient.
 * The Pool and PrismaClient are only created on first call,
 * so importing this module without DATABASE_URL does not throw.
 */
export function prisma(): PrismaClient {
  if (!_prisma) {
    if (!_pool) {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    const adapter = new PrismaPg(_pool);
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

export { hasDb };

export async function createSchoolAndUser(): Promise<{
  schoolId: string;
  authorUserId: string;
}> {
  const schoolId = randomUUID();
  const authorUserId = randomUUID();

  await prisma().school.create({
    data: {
      id: schoolId,
      code: `sch-${schoolId.slice(0, 8)}`,
      name: "Test School",
    },
  });

  await prisma().user.create({
    data: {
      id: authorUserId,
      loginIdentifier: `user-${authorUserId.slice(0, 8)}`,
      displayName: "Test User",
      passwordHash: "secret",
    },
  });

  await prisma().membership.create({
    data: {
      schoolId,
      userId: authorUserId,
      role: "TEACHER",
      status: "ACTIVE",
    },
  });

  return { schoolId, authorUserId };
}

export async function cleanCurriculumTables(): Promise<void> {
  await prisma().$transaction([
    prisma().activityResource.deleteMany(),
    prisma().resource.deleteMany(),
    prisma().learningActivity.deleteMany(),
    prisma().lesson.deleteMany(),
    prisma().unit.deleteMany(),
    prisma().courseVersion.deleteMany(),
    prisma().course.deleteMany(),
    prisma().membership.deleteMany(),
    prisma().user.deleteMany(),
    prisma().school.deleteMany(),
  ]);
}

export async function disconnect(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
  }
  if (_pool) {
    await _pool.end();
  }
}

export function bilingualContent(
  text: string,
): Prisma.InputJsonValue {
  return {
    originalText: text,
    locale: "zh-CN",
    translationSource: "NONE",
    reviewStatus: "PENDING",
  };
}
