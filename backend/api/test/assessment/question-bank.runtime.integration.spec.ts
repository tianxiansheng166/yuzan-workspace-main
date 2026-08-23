import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { PracticeService } from "../../src/modules/assessment/practice.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL;
const schoolId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const classId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const secretMarker = "SCORING_SECRET_MUST_NOT_LEAK_42";

const auth: AuthContext = {
  requestId: "question-bank-runtime-integration",
  tenant: { schoolId },
  principal: {
    userId: studentId,
    roles: [MembershipRole.STUDENT],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
};

let pool: Pool;
let prisma: PrismaClient;

describe.skipIf(!databaseUrl)("Question Bank runtime delivery — PostgreSQL integration", () => {
  const suffix = randomUUID();
  const stableKey = `QB-RUNTIME-VERIFY-${suffix}`;
  let itemId: string;
  let definitionId: string;
  let deliveryId: string;
  let attemptId: string | undefined;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    if (attemptId) await prisma.assessmentSession.deleteMany({ where: { id: attemptId } });
    if (deliveryId) await prisma.practiceDelivery.deleteMany({ where: { id: deliveryId } });
    if (definitionId) await prisma.practiceDefinition.deleteMany({ where: { id: definitionId } });
    if (itemId) await prisma.questionBankItem.deleteMany({ where: { id: itemId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("keeps the six seeded legacy practices and six published level practices runnable", async () => {
    const service = new PracticeService(prisma as any);
    const catalog = await service.listForStudent(auth, schoolId);
    expect(catalog.total).toBe(12);

    const legacy = catalog.items[0];
    expect(legacy).toBeDefined();
    const created = await service.createOrResume(auth, schoolId, legacy.id);
    const items = await service.getAttemptItems(auth, schoolId, created.attemptId);
    expect(items.length).toBeGreaterThan(0);
    if (!created.resumed) {
      await prisma.assessmentSession.delete({ where: { id: created.attemptId } });
    }
  });

  it("snapshots only deliverySpec for a temporary Question Bank practice", async () => {
    const deliverySpec = {
      stimulus: { type: "TEXT", promptText: "QB runtime verification" },
      response: { type: "CHOICE", options: [{ key: "A", text: "A" }, { key: "B", text: "B" }] },
    };
    const scoringSpec = {
      strategy: "EXACT_CHOICE",
      maxScore: 3,
      correctAnswer: "B",
      secretMarker,
    };
    const question = await prisma.questionBankItem.create({
      data: {
        schoolId,
        stableKey,
        itemType: "CHOICE",
        versions: { create: { version: 1, deliverySpec, scoringSpec, status: "PUBLISHED", publishedAt: new Date() } },
      },
      include: { versions: true },
    });
    itemId = question.id;
    const questionVersionId = question.versions[0]!.id;

    const definition = await prisma.practiceDefinition.create({
      data: {
        schoolId,
        visibility: "SCHOOL",
        title: `Temporary QB runtime verification ${suffix}`,
        summary: "Temporary integration fixture",
        difficulty: "EASY",
        estimatedMinutes: 1,
        status: "PUBLISHED",
        versions: {
          create: {
            version: 1,
            status: "PUBLISHED",
            contentHash: suffix,
            publishedAt: new Date(),
            sections: {
              create: {
                title: "Runtime verification",
                sortOrder: 1,
                estimatedMinutes: 1,
                items: { create: { itemType: "CHOICE", sortOrder: 1, config: {}, questionVersionId } },
              },
            },
          },
        },
      },
      include: { versions: true },
    });
    definitionId = definition.id;
    const versionId = definition.versions[0]!.id;
    const delivery = await prisma.practiceDelivery.create({
      data: { practiceVersionId: versionId, schoolId, classId, mode: "SELF_PRACTICE", status: "OPEN", reRecordPolicy: {}, mobilePolicy: {} },
    });
    deliveryId = delivery.id;

    const service = new PracticeService(prisma as any);
    const created = await service.createOrResume(auth, schoolId, definitionId);
    attemptId = created.attemptId;
    const snapshot = await prisma.assessmentItem.findFirstOrThrow({ where: { sessionId: attemptId } });
    expect(snapshot.questionVersionId).toBe(questionVersionId);
    expect(snapshot.prompt).toEqual(deliverySpec);
    expect(snapshot.itemConfig).toEqual(deliverySpec);
    expect(snapshot.maxScore).toBe(3);
    expect(JSON.stringify(snapshot)).not.toContain(secretMarker);
    expect(JSON.stringify(snapshot)).not.toContain("correctAnswer");

    const studentItems = await service.getAttemptItems(auth, schoolId, attemptId);
    const serialized = JSON.stringify(studentItems);
    expect(serialized).toContain("QB runtime verification");
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("acceptedAnswers");
    expect(serialized).not.toContain("referenceAnswer");
    expect(serialized).not.toContain("scoringSpec");
    expect(serialized).not.toContain(secretMarker);
  });
});
