import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../../src/modules/organizations/infra/prisma/prisma.service.js";

export function getTestDatabaseUrl(): string {
  const url = process.env.GOV003_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "GOV003_TEST_DATABASE_URL or DATABASE_URL is required for integration tests",
    );
  }

  const dbName = new URL(url).pathname.replace(/^\//, "");
  const markers = ["gov003", "test", "verify"];
  if (!markers.some((marker) => dbName.toLowerCase().includes(marker))) {
    throw new Error(
      `Integration tests must target a test database. Name "${dbName}" missing one of: ${markers.join(", ")}`,
    );
  }

  return url;
}

export function createPrismaService(): PrismaService {
  const url = getTestDatabaseUrl();
  process.env.DATABASE_URL = url;
  return new PrismaService();
}

export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  const tables = [
    "ActivityAttempt",
    "ActivityProgress",
    "AudioAsset",
    "Submission",
    "AssignmentTarget",
    "Assignment",
    "Feedback",
    "LearningActivity",
    "Lesson",
    "Unit",
    "CourseVersion",
    "Course",
    "Enrollment",
    "Class",
    "Term",
    "Membership",
    "Device",
    "User",
    "School",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}" CASCADE;`);
  }
}

export function seedId(): string {
  return randomUUID();
}
