import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { QuestionBankDeterministicScoringService } from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
const schoolId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";

let pool: Pool;
let prisma: PrismaClient;

describe.skipIf(!databaseUrl)("Question Bank deterministic scoring — canonical Level 1 integration", () => {
  let sessionId: string | undefined;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    if (sessionId) await prisma.assessmentSession.delete({ where: { id: sessionId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("audits and scores the real published Level 1 versions without logging answer data", async () => {
    const publishedVersions = await prisma.questionBankItemVersion.findMany({
      where: { status: "PUBLISHED", item: { level: "水平一级", stableKey: { startsWith: "L1-" } } },
      select: { id: true, version: true, scoringSpec: true, deliverySpec: true, item: { select: { stableKey: true, questionType: true } } },
      orderBy: { item: { stableKey: "asc" } },
    });
    // Immutable repair leaves the former published version addressable for
    // historical attempts. The active practice references the newest version;
    // this integration exercises that current version while separately proving
    // that old versions were not mutated below.
    const versions = [...publishedVersions.reduce((latest, version) => {
      const current = latest.get(version.item.stableKey);
      const versionNumber = Number((version as { version?: number }).version ?? 0);
      const currentNumber = Number((current as { version?: number } | undefined)?.version ?? 0);
      if (!current || versionNumber >= currentNumber) latest.set(version.item.stableKey, version);
      return latest;
    }, new Map<string, typeof publishedVersions[number]>()).values()];
    expect(versions).toHaveLength(20);

    const distribution = versions.reduce<Record<string, { items: number; maxPoints: number }>>((result, version) => {
      const spec = version.scoringSpec as Record<string, unknown>;
      const strategy = String(spec.strategy);
      const entry = result[strategy] ?? { items: 0, maxPoints: 0 };
      entry.items += 1;
      entry.maxPoints += Number(spec.maxScore);
      result[strategy] = entry;
      return result;
    }, {});
    expect(distribution).toEqual({
      ACCEPTED_TEXT: { items: 2, maxPoints: 10 },
      DICTATION_ALIGNMENT: { items: 3, maxPoints: 15 },
      EXACT_CHOICE: { items: 9, maxPoints: 33 },
      RUBRIC_TEXT: { items: 2, maxPoints: 16 },
      SPEECH_OPEN_RESPONSE: { items: 1, maxPoints: 14 },
      SPEECH_READING: { items: 3, maxPoints: 12 },
    });

    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { schoolId, userId: studentId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, classId: true },
    });
    const session = await prisma.assessmentSession.create({
      data: {
        school: { connect: { id: schoolId } },
        enrollment: { connect: { schoolId, id: enrollment.id } },
        classId: enrollment.classId,
        initiatorUserId: studentId,
        type: "MIXED",
        status: "PROCESSING",
      },
    });
    sessionId = session.id;

    for (const [index, version] of versions.entries()) {
      const spec = version.scoringSpec as Record<string, unknown>;
      const strategy = String(spec.strategy);
      const item = await prisma.assessmentItem.create({
        data: {
          session: { connect: { id: session.id } },
          questionVersion: { connect: { id: version.id } },
          prompt: version.deliverySpec,
          itemType: strategy.startsWith("SPEECH") || strategy === "SPEECH_OPEN_RESPONSE" ? "SPEECH" : strategy === "EXACT_CHOICE" ? "CHOICE" : "TEXT",
          sortOrder: index + 1,
          maxScore: Number(spec.maxScore),
        },
      });

      if (!strategy.startsWith("SPEECH")) {
        let value = "integration review answer";
        if (strategy === "EXACT_CHOICE") value = String(spec.referenceAnswer);
        if (strategy === "DICTATION_ALIGNMENT") value = String(spec.referenceAnswer);
        if (strategy === "ACCEPTED_TEXT") value = String(spec.referenceAnswer).split("/")[0]!;
        await prisma.writtenAnswer.create({
          data: {
            item: { connect: { id: item.id } },
            content: { value },
            autoSavedAt: new Date("2026-08-23T00:00:00.000Z"),
            finalSubmittedAt: new Date("2026-08-23T00:01:00.000Z"),
          },
        });
      }
    }

    const scorer = new QuestionBankDeterministicScoringService(prisma as any);
    const first = await scorer.scoreSession(session.id);
    const second = await scorer.scoreSession(session.id);
    expect(first).toEqual({
      totalItems: 20,
      autoScoredItems: 14,
      needsReviewItems: 2,
      skippedItems: 4,
      awardedPoints: 58,
      scoredMaxPoints: 58,
      totalMaxPoints: 100,
    });
    expect(second).toEqual(first);

    const persisted = await prisma.assessmentItem.findMany({
      where: { sessionId: session.id },
      select: {
        scoredScore: true,
        maxScore: true,
        autoResult: true,
        questionVersion: {
          select: {
            scoringSpec: true,
            deliverySpec: true,
            item: { select: { stableKey: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    expect(persisted.filter((item) => item.scoredScore !== null)).toHaveLength(14);
    expect(persisted.filter((item) => item.scoredScore === null)).toHaveLength(6);
    const recoveredChoice = persisted.find((item) => item.questionVersion?.item.stableKey === "L1-READ-WORD_RECOGNITION-003");
    expect(recoveredChoice).toMatchObject({
      scoredScore: 4,
      autoResult: {
        state: "AUTO_SCORED",
        strategy: "EXACT_CHOICE",
        scorerVersion: "qb-deterministic-v1",
      },
    });
    for (const item of persisted) {
      if (item.scoredScore !== null) {
        expect(item.scoredScore).toBeGreaterThanOrEqual(0);
        expect(item.scoredScore).toBeLessThanOrEqual(item.maxScore ?? 0);
      }
      const serialized = JSON.stringify(item.autoResult);
      for (const protectedKey of ["correctAnswer", "referenceAnswer", "acceptedAnswers", "rubric", "deductionRules", "scoringSpec"]) {
        expect(serialized).not.toContain(protectedKey);
      }
    }
  }, 30_000);
});
