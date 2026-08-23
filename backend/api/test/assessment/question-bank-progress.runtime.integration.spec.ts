import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { buildQuestionBankDiagnosis } from "../../src/modules/assessment/question-bank-diagnosis.js";
import { QuestionBankProgressService } from "../../src/modules/assessment/question-bank-progress.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL;
const schoolId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";

const auth: AuthContext = {
  requestId: "progress-runtime-integration",
  tenant: { schoolId },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
};

let pool: Pool;
let prisma: PrismaClient;
const createdSessionIds: string[] = [];

function scoredPoints(maxScores: number[], totalLoss: number, splitAcross = 0) {
  if (splitAcross > 0) {
    const indexes: number[] = [];
    const choose = (start: number, remaining: number, capacity: number): boolean => {
      if (remaining === 0) return capacity >= totalLoss;
      for (let index = start; index < maxScores.length; index += 1) {
        indexes.push(index);
        if (choose(index + 1, remaining - 1, capacity + maxScores[index]!)) return true;
        indexes.pop();
      }
      return false;
    };
    if (!choose(0, splitAcross, 0)) throw new Error("fixture cannot distribute the requested formal score loss");
    const losses = new Map(indexes.map((index) => [index, 1]));
    let remaining = totalLoss - splitAcross;
    for (const index of indexes) {
      const addition = Math.min(maxScores[index]! - 1, remaining);
      losses.set(index, 1 + addition);
      remaining -= addition;
    }
    if (remaining !== 0) throw new Error("fixture cannot distribute the requested formal score loss");
    return maxScores.map((maxScore, index) => maxScore - (losses.get(index) ?? 0));
  }
  let remaining = totalLoss;
  return maxScores.map((maxScore) => {
    const loss = Math.min(maxScore, remaining);
    remaining -= loss;
    return maxScore - loss;
  });
}

describe.skipIf(!databaseUrl)("Question Bank progress — PostgreSQL integration", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    if (createdSessionIds.length) await prisma.assessmentSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("derives same-level 84 → 91 and four-item remediation without a cross-level delta", async () => {
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { schoolId, userId: studentId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, classId: true },
    });
    const deliveries = await prisma.practiceDelivery.findMany({
      where: { schoolId, status: "OPEN", practiceVersion: { status: "PUBLISHED", definition: { status: "PUBLISHED" } } },
      include: {
        practiceVersion: {
          include: {
            definition: { select: { difficulty: true } },
            sections: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  orderBy: { sortOrder: "asc" },
                  include: { questionVersion: { include: { item: true } } },
                },
              },
            },
          },
        },
      },
    });
    const levelOne = deliveries.find((delivery) => delivery.practiceVersion.definition.difficulty === "水平一级");
    const levelTwo = deliveries.find((delivery) => delivery.practiceVersion.definition.difficulty === "水平二级");
    expect(levelOne).toBeDefined();
    expect(levelTwo).toBeDefined();

    const createFormal = async (delivery: NonNullable<typeof levelOne>, totalLoss: number, completedAt: Date, candidateCount = 0) => {
      const snapshot = delivery.practiceVersion.sections.flatMap((section) => section.items.map((item) => ({ section, item })));
      expect(snapshot).toHaveLength(20);
      const maxScores = snapshot.map(({ item }) => Number((item.questionVersion!.scoringSpec as Record<string, unknown>).maxScore));
      expect(maxScores.reduce((total, value) => total + value, 0)).toBe(100);
      const scores = scoredPoints(maxScores, totalLoss, candidateCount);
      expect(scores.reduce((total, value) => total + value, 0)).toBe(100 - totalLoss);
      const session = await prisma.assessmentSession.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classId: enrollment.classId,
          initiatorUserId: studentId,
          type: "MIXED",
          purpose: "STANDARD",
          status: "COMPLETED",
          completedAt,
          practiceDefinitionId: delivery.practiceVersion.definitionId,
          practiceVersionId: delivery.practiceVersionId,
          deliveryId: delivery.id,
        },
      });
      createdSessionIds.push(session.id);
      await prisma.assessmentItem.createMany({
        data: snapshot.map(({ section, item }, index) => ({
          sessionId: session.id,
          questionVersionId: item.questionVersion!.id,
          prompt: item.questionVersion!.deliverySpec,
          itemConfig: item.questionVersion!.deliverySpec,
          itemType: item.itemType,
          sectionTitle: section.title,
          sectionOrder: section.sortOrder,
          sortOrder: index + 1,
          maxScore: maxScores[index]!,
          scoredScore: scores[index]!,
        })),
      });
      const items = await prisma.assessmentItem.findMany({
        where: { sessionId: session.id },
        select: {
          id: true, questionVersionId: true, sortOrder: true, maxScore: true, scoredScore: true,
          questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      });
      const diagnosis = buildQuestionBankDiagnosis(items.map((item) => ({
        assessmentItemId: item.id,
        questionVersionId: item.questionVersionId!,
        sortOrder: item.sortOrder,
        domain: item.questionVersion?.item.domain ?? null,
        family: item.questionVersion?.item.questionType ?? null,
        level: item.questionVersion?.item.level ?? null,
        earned: item.scoredScore,
        max: item.maxScore,
      })));
      await prisma.assessmentReport.create({
        data: { sessionId: session.id, schoolId, overallScore: diagnosis.overall.earnedPoints, dataCompleteness: 100, summary: { diagnosis } },
      });
      return { session, items, diagnosis };
    };

    // Four whole-question losses total 16 points, so the source formal result is 84/100.
    const baseline = await createFormal(levelOne!, 16, new Date("2026-08-01T10:00:00.000Z"), 4);
    expect(baseline.diagnosis.overall.earnedPoints).toBe(84);
    const candidates = baseline.diagnosis.retryCandidates;
    expect(candidates).toHaveLength(4);

    const remediation = await prisma.assessmentSession.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        initiatorUserId: studentId,
        type: "MIXED",
        purpose: "REMEDIATION",
        status: "COMPLETED",
        createdAt: new Date("2026-08-03T10:00:00.000Z"),
        completedAt: new Date("2026-08-03T10:10:00.000Z"),
        retestOfSessionId: baseline.session.id,
        practiceDefinitionId: levelOne!.practiceVersion.definitionId,
        practiceVersionId: levelOne!.practiceVersionId,
        deliveryId: levelOne!.id,
      },
    });
    createdSessionIds.push(remediation.id);
    const sourceByItemId = new Map(baseline.items.map((item) => [item.id, item]));
    const expectedRecoveredPoints = candidates.slice(0, 3).reduce((total, candidate) => {
      const source = sourceByItemId.get(candidate.assessmentItemId)!;
      return total + (source.maxScore! - source.scoredScore!);
    }, 0);
    await prisma.assessmentItem.createMany({
      data: candidates.map((candidate, index) => {
        const source = sourceByItemId.get(candidate.assessmentItemId)!;
        return {
          sessionId: remediation.id,
          questionVersionId: candidate.questionVersionId,
          prompt: { type: "REMEDIATION" },
          itemType: "CHOICE",
          sortOrder: index + 1,
          maxScore: source.maxScore,
          // The last candidate deliberately remains unmastered; the others recover full points.
          scoredScore: index < 3 ? source.maxScore : source.scoredScore,
        };
      }),
    });

    const followUp = await createFormal(levelOne!, 9, new Date("2026-08-10T10:00:00.000Z"));
    expect(followUp.diagnosis.overall.earnedPoints).toBe(91);
    const levelTwoBaseline = await createFormal(levelTwo!, 22, new Date("2026-08-15T10:00:00.000Z"));
    expect(levelTwoBaseline.diagnosis.overall.earnedPoints).toBe(78);

    const sourceScoresBefore = await prisma.assessmentItem.findMany({ where: { sessionId: baseline.session.id }, select: { id: true, scoredScore: true }, orderBy: { id: "asc" } });
    const progress = await new QuestionBankProgressService(prisma as any).getForCurrentStudent(auth, schoolId);
    const levelOneProgress = progress.formalLevels.find((entry) => entry.practiceDefinitionId === levelOne!.practiceVersion.definitionId)!;
    const levelTwoProgress = progress.formalLevels.find((entry) => entry.practiceDefinitionId === levelTwo!.practiceVersion.definitionId)!;
    const remediationProgress = progress.remediation.find((entry) => entry.sourceSessionId === baseline.session.id)!;

    expect(levelOneProgress).toMatchObject({ attemptCount: 2, firstScore: 84, latestScore: 91, latestVsPrevious: 7, practiceVersionChanged: false });
    expect(levelTwoProgress).toMatchObject({ attemptCount: 1, latestScore: 78, comparisonState: "BASELINE_ONLY", latestVsPrevious: null });
    expect(remediationProgress.latestRound).toMatchObject({ itemCount: 4, masteredCount: 3, unchangedCount: 1, recoveredPoints: expectedRecoveredPoints });
    expect(remediationProgress.latestRound.items.every((item) => candidates.some((candidate) => candidate.questionVersionId === item.questionVersionId))).toBe(true);
    expect(await prisma.assessmentItem.findMany({ where: { sessionId: baseline.session.id }, select: { id: true, scoredScore: true }, orderBy: { id: "asc" } })).toEqual(sourceScoresBefore);
    expect(JSON.stringify(progress)).not.toMatch(/correctAnswer|referenceAnswer|acceptedAnswers|scoringSpec|rubric|providerAudit|rawResponse|candidatePoints/);
  }, 30_000);
});
