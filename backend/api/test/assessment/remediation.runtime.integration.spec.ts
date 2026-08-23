import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import { PrismaAssessmentSessionRepository } from "../../src/modules/assessment/infra/prisma-assessment-session.repository.js";
import { PrismaAssessmentItemRepository } from "../../src/modules/assessment/infra/prisma-assessment-item.repository.js";
import { PrismaWrittenAnswerRepository } from "../../src/modules/assessment/infra/prisma-written-answer.repository.js";
import { PrismaAssessmentReportRepository } from "../../src/modules/assessment/infra/prisma-assessment-report.repository.js";
import { QuestionBankDeterministicScoringService } from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";
import { buildQuestionBankDiagnosis } from "../../src/modules/assessment/question-bank-diagnosis.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL;
const schoolId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";

const auth: AuthContext = {
  requestId: "remediation-runtime-integration",
  tenant: { schoolId },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
};

let pool: Pool;
let prisma: PrismaClient;
let sourceSessionId: string | undefined;
let remediationIds: string[] = [];

describe.skipIf(!databaseUrl)("Question Bank remediation — PostgreSQL integration", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    if (remediationIds.length) await prisma.assessmentSession.deleteMany({ where: { id: { in: remediationIds } } });
    if (sourceSessionId) await prisma.assessmentSession.deleteMany({ where: { id: sourceSessionId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("creates and completes a diagnosis-owned subset without changing the formal report", async () => {
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { schoolId, userId: studentId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, classId: true },
    });
    const deliveries = await prisma.practiceDelivery.findMany({
      where: { schoolId, status: "OPEN", practiceVersion: { status: "PUBLISHED", definition: { status: "PUBLISHED" } } },
      include: {
        practiceVersion: {
          include: {
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
    const delivery = deliveries.find((candidate) => {
      const items = candidate.practiceVersion.sections.flatMap((section) => section.items);
      return items.length === 20 && items.every((item) => item.questionVersion?.status === "PUBLISHED");
    });
    expect(delivery).toBeDefined();
    const snapshot = delivery!.practiceVersion.sections.flatMap((section) => section.items.map((item) => ({ section, item })));

    const source = await prisma.assessmentSession.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        initiatorUserId: studentId,
        type: "MIXED",
        purpose: "STANDARD",
        status: "COMPLETED",
        completedAt: new Date(),
        practiceDefinitionId: delivery!.practiceVersion.definitionId,
        practiceVersionId: delivery!.practiceVersionId,
        deliveryId: delivery!.id,
      },
    });
    sourceSessionId = source.id;
    await prisma.assessmentItem.createMany({
      data: snapshot.map(({ section, item }, index) => {
        const version = item.questionVersion!;
        const spec = version.scoringSpec as Record<string, unknown>;
        const maxScore = Number(spec.maxScore);
        return {
          sessionId: source.id,
          questionVersionId: version.id,
          prompt: version.deliverySpec,
          itemConfig: version.deliverySpec,
          itemType: item.itemType,
          sectionTitle: section.title,
          sectionOrder: section.sortOrder,
          sortOrder: index + 1,
          maxScore,
          scoredScore: index < 4 ? 0 : maxScore,
        };
      }),
    });
    const sourceItems = await prisma.assessmentItem.findMany({
      where: { sessionId: source.id },
      select: {
        id: true, questionVersionId: true, sortOrder: true, maxScore: true, scoredScore: true,
        questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });
    const diagnosis = buildQuestionBankDiagnosis(sourceItems.map((item) => ({
      assessmentItemId: item.id,
      questionVersionId: item.questionVersionId!,
      sortOrder: item.sortOrder,
      domain: item.questionVersion?.item.domain ?? null,
      family: item.questionVersion?.item.questionType ?? null,
      level: item.questionVersion?.item.level ?? null,
      earned: item.scoredScore,
      max: item.maxScore,
    })));
    expect(diagnosis.retryCandidates).toHaveLength(4);
    const formalReport = await prisma.assessmentReport.create({
      data: { sessionId: source.id, schoolId, overallScore: diagnosis.overall.earnedPoints, dataCompleteness: 100, summary: { diagnosis } },
    });

    const service = new AssessmentService(
      new PrismaAssessmentSessionRepository(prisma as any),
      new PrismaAssessmentItemRepository(prisma as any),
      new PrismaWrittenAnswerRepository(prisma as any),
      new PrismaAssessmentReportRepository(prisma as any),
      prisma as any,
      new QuestionBankDeterministicScoringService(prisma as any),
    );
    const first = await service.createOrResumeRemediation(auth, schoolId, source.id);
    const second = await service.createOrResumeRemediation(auth, schoolId, source.id);
    expect(first).toMatchObject({ outcome: "CREATED", itemCount: 4, resumed: false });
    expect(second).toMatchObject({ outcome: "RESUMED", attemptId: first.attemptId, resumed: true });
    remediationIds.push(first.attemptId!);

    const remediationItems = await prisma.assessmentItem.findMany({ where: { sessionId: first.attemptId! }, orderBy: { sortOrder: "asc" } });
    expect(remediationItems).toHaveLength(4);
    expect(remediationItems.map((item) => item.questionVersionId)).toEqual(diagnosis.retryCandidates.map((candidate) => candidate.questionVersionId));
    expect(remediationItems.every((item) => item.scoredScore === null && item.recordingId === null && item.autoResult === null)).toBe(true);

    await prisma.assessmentItem.updateMany({
      where: { sessionId: first.attemptId! },
      data: { scoredScore: 1 },
    });
    await prisma.assessmentSession.update({
      where: { id: first.attemptId! },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await service.finalizeRemediationIfComplete(schoolId, first.attemptId!);
    const completed = await prisma.assessmentSession.findUniqueOrThrow({ where: { id: first.attemptId! } });
    expect(completed).toMatchObject({ purpose: "REMEDIATION", status: "COMPLETED", retestOfSessionId: source.id });
    expect(await prisma.assessmentReport.count({ where: { sessionId: first.attemptId! } })).toBe(0);
    expect(await prisma.assessmentReport.findUniqueOrThrow({ where: { id: formalReport.id } })).toMatchObject({ summary: { diagnosis } });

    const result = await service.getRemediationResult(auth, schoolId, first.attemptId!);
    expect(result).toMatchObject({ itemCount: 4, completedItemCount: 4, pendingItemCount: 0 });
    const serialized = JSON.stringify(result);
    for (const forbidden of ["correctAnswer", "referenceAnswer", "acceptedAnswers", "rubric", "deductionRules", "scoringSpec", "providerAudit", "rawResponse"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
