import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@yuzan/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(
      new URL("../../../../../../.env", import.meta.url),
    );
  } catch {
    // In CI the variable is provided directly.
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function createSchoolAndUser(): Promise<{
  schoolId: string;
  authorUserId: string;
}> {
  const schoolId = randomUUID();
  const authorUserId = randomUUID();

  await prisma.school.create({
    data: {
      id: schoolId,
      code: `sch-${schoolId.slice(0, 8)}`,
      name: "Test School",
    },
  });

  await prisma.user.create({
    data: {
      id: authorUserId,
      loginIdentifier: `user-${authorUserId.slice(0, 8)}`,
      displayName: "Test User",
      passwordHash: "secret",
    },
  });

  await prisma.membership.create({
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
  await prisma.$transaction([
    prisma.activityResource.deleteMany(),
    prisma.resource.deleteMany(),
    prisma.learningActivity.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.courseVersion.deleteMany(),
    prisma.course.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ]);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
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
