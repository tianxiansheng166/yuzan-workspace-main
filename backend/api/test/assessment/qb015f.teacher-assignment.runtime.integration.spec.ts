import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import { AssessmentReviewService } from "../../src/modules/assessment/assessment-review.service.js";
import { TeacherQuestionBankDiagnosticService } from "../../src/modules/assessment/teacher-question-bank-diagnostic.service.js";
import { PrismaAssessmentSessionRepository } from "../../src/modules/assessment/infra/prisma-assessment-session.repository.js";
import { PrismaAssessmentItemRepository } from "../../src/modules/assessment/infra/prisma-assessment-item.repository.js";
import { PrismaWrittenAnswerRepository } from "../../src/modules/assessment/infra/prisma-written-answer.repository.js";
import { PrismaAssessmentReportRepository } from "../../src/modules/assessment/infra/prisma-assessment-report.repository.js";
import { QuestionBankDeterministicScoringService } from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";
import { buildQuestionBankDiagnosis } from "../../src/modules/assessment/question-bank-diagnosis.js";
import { SpeechJobService } from "../../src/modules/speech-job/speech-job.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
const schoolId = "11111111-1111-4111-8111-111111111111";
const teacherId = "33333333-3333-4333-8333-333333333333";

const forbiddenStudentFields = [
  "correctAnswer",
  "referenceAnswer",
  "acceptedAnswers",
  "scoringSpec",
  "rubric",
  "deductionRules",
  "sourceTrace",
  "providerAudit",
  "rawResponse",
  "transcript",
  "candidatePoints",
];

function auth(userId: string, role: MembershipRole, tenantSchoolId = schoolId): AuthContext {
  return {
    requestId: `qb015f-${randomUUID()}`,
    tenant: { schoolId: tenantSchoolId },
    principal: {
      userId,
      roles: [role],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    },
  };
}

describe.skipIf(!databaseUrl)("QB-015F teacher assignment — isolated PostgreSQL", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let classAId: string;
  let classBId: string;
  let teacherBId: string;
  let studentIds: string[] = [];
  let enrollmentIds: string[] = [];
  let createdSessionIds: string[] = [];
  let practiceDefinitionId: string;
  let sourceByEnrollment = new Map<string, { id: string; reportSummary: unknown; itemScores: Map<string, number | null> }>();
  let service: AssessmentService;
  let diagnosticService: TeacherQuestionBankDiagnosticService;
  let reviewService: AssessmentReviewService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    const term = await prisma.term.findFirstOrThrow({ where: { schoolId }, select: { id: true } });
    const delivery = await prisma.practiceDelivery.findFirstOrThrow({
      where: {
        schoolId,
        status: "OPEN",
        practiceVersion: {
          status: "PUBLISHED",
          definition: { difficulty: "水平一级", status: "PUBLISHED" },
        },
      },
      include: {
        practiceVersion: {
          include: {
            definition: { select: { id: true } },
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
    practiceDefinitionId = delivery.practiceVersion.definitionId;
    const snapshot = delivery.practiceVersion.sections.flatMap((section) =>
      section.items.map((item) => ({ section, item, version: item.questionVersion! })),
    );
    expect(snapshot).toHaveLength(20);

    classAId = randomUUID();
    classBId = randomUUID();
    teacherBId = randomUUID();
    studentIds = [randomUUID(), randomUUID(), randomUUID()];
    await prisma.class.createMany({
      data: [
        { id: classAId, schoolId, termId: term.id, name: `QB-015F Class A ${classAId.slice(0, 8)}`, grade: "七年级" },
        { id: classBId, schoolId, termId: term.id, name: `QB-015F Class B ${classBId.slice(0, 8)}`, grade: "七年级" },
      ],
    });
    await prisma.user.createMany({
      data: [
        ...studentIds.map((id, index) => ({ id, loginIdentifier: `qb015f-student-${index}-${id}@test.invalid`, displayName: `QB-015F Student ${index + 1}`, passwordHash: "integration-only" })),
        { id: teacherBId, loginIdentifier: `qb015f-teacher-b-${teacherBId}@test.invalid`, displayName: "QB-015F Teacher B", passwordHash: "integration-only" },
      ],
    });
    await prisma.membership.createMany({
      data: [
        ...studentIds.map((userId) => ({ id: randomUUID(), schoolId, userId, role: "STUDENT" as const, status: "ACTIVE" as const })),
        { id: randomUUID(), schoolId, userId: teacherBId, role: "TEACHER" as const, status: "ACTIVE" as const },
      ],
    });
    const teacherEnrollment = await prisma.enrollment.create({
      data: { id: randomUUID(), schoolId, classId: classAId, userId: teacherId, role: "TEACHER", status: "ACTIVE" },
    });
    void teacherEnrollment;
    const studentEnrollments = await Promise.all(studentIds.map((userId, index) => prisma.enrollment.create({
      data: {
        id: randomUUID(),
        schoolId,
        classId: index === 2 ? classBId : classAId,
        userId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    })));
    enrollmentIds = studentEnrollments.map((row) => row.id);
    const teacherBEnrollment = await prisma.enrollment.create({
      data: { id: randomUUID(), schoolId, classId: classBId, userId: teacherBId, role: "TEACHER", status: "ACTIVE" },
    });
    void teacherBEnrollment;

    for (const enrollment of studentEnrollments.slice(0, 2)) {
      const session = await prisma.assessmentSession.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classId: enrollment.classId,
          initiatorUserId: enrollment.userId,
          type: "MIXED",
          purpose: "STANDARD",
          status: "COMPLETED",
          completedAt: new Date(),
          practiceDefinitionId,
          practiceVersionId: delivery.practiceVersionId,
          deliveryId: delivery.id,
        },
      });
      createdSessionIds.push(session.id);
      await prisma.assessmentItem.createMany({
        data: snapshot.map(({ section, item, version }, index) => {
          const family = version.item.questionType!;
          const maxScore = Number((version.scoringSpec as Record<string, unknown>).maxScore);
          const retry = ["LISTEN_IMAGE_CHOICE", "DICTATION", "READ_ALOUD"].includes(family);
          return {
            sessionId: session.id,
            questionVersionId: version.id,
            prompt: version.deliverySpec,
            itemConfig: version.deliverySpec,
            itemType: item.itemType,
            sectionTitle: section.title,
            sectionOrder: section.sortOrder,
            sortOrder: index + 1,
            maxScore,
            scoredScore: retry ? 0 : maxScore,
          };
        }),
      });
      const items = await prisma.assessmentItem.findMany({
        where: { sessionId: session.id },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          questionVersionId: true,
          sortOrder: true,
          maxScore: true,
          scoredScore: true,
          questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } },
        },
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
      const report = await prisma.assessmentReport.create({
        data: { sessionId: session.id, schoolId, overallScore: diagnosis.overall.earnedPoints, dataCompleteness: 100, summary: { diagnosis } },
      });
      sourceByEnrollment.set(enrollment.id, {
        id: session.id,
        reportSummary: report.summary,
        itemScores: new Map(items.map((item) => [item.id, item.scoredScore])),
      });
    }

    service = new AssessmentService(
      new PrismaAssessmentSessionRepository(prisma as any),
      new PrismaAssessmentItemRepository(prisma as any),
      new PrismaWrittenAnswerRepository(prisma as any),
      new PrismaAssessmentReportRepository(prisma as any),
      prisma as any,
      new QuestionBankDeterministicScoringService(prisma as any),
    );
    reviewService = new AssessmentReviewService(prisma as any, service);
    diagnosticService = new TeacherQuestionBankDiagnosticService(prisma as any, reviewService, service);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdSessionIds.length) await prisma.assessmentSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    if (enrollmentIds.length) await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
    if (classAId && classBId) await prisma.enrollment.deleteMany({ where: { classId: { in: [classAId, classBId] } } });
    const userIds = [...studentIds, teacherBId].filter((id): id is string => Boolean(id));
    if (userIds.length) {
      await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const classIds = [classAId, classBId].filter((id): id is string => Boolean(id));
    if (classIds.length) await prisma.class.deleteMany({ where: { id: { in: classIds } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("proves exact candidate snapshots, idempotency, focus coexistence, separation, and scope", async () => {
    const teacherAuth = auth(teacherId, MembershipRole.TEACHER);
    const student1 = enrollmentIds[0]!;
    const student2 = enrollmentIds[1]!;
    const student3 = enrollmentIds[2]!;
    const deterministicFamily = "LISTEN_IMAGE_CHOICE";
    const secondFamily = "DICTATION";

    const assignment = await diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1, student2],
      focus: { mode: "FAMILY", family: deterministicFamily },
    });
    expect(assignment).toMatchObject({ requested: 2, assigned: 2, resumed: 0, skipped: 0 });
    const assignedIds = assignment.targets.map((target) => target.attemptId!);
    createdSessionIds.push(...assignedIds);

    const sourceIds = [student1, student2].map((id) => sourceByEnrollment.get(id)!.id);
    const assignedSessions = await prisma.assessmentSession.findMany({
      where: { id: { in: assignedIds } },
      include: { items: { include: { writtenAnswer: true, speechJobs: true } } },
    });
    expect(assignedSessions.map((session) => session.retestOfSessionId).sort()).toEqual(sourceIds.sort());
    for (const assignedSession of assignedSessions) {
      expect(assignedSession).toMatchObject({
        purpose: "REMEDIATION",
        remediationOrigin: "TEACHER_ASSIGNED",
        initiatorUserId: teacherId,
        practiceDefinitionId,
        remediationFocus: { mode: "FAMILY", family: deterministicFamily },
      });
      const source = await prisma.assessmentItem.findMany({
        where: { sessionId: assignedSession.retestOfSessionId!, questionVersion: { item: { questionType: deterministicFamily } } },
        orderBy: { sortOrder: "asc" },
        select: { questionVersionId: true },
      });
      const actual = assignedSession.items.map((item) => item.questionVersionId);
      expect(actual).toEqual(source.map((item) => item.questionVersionId));
      expect(assignedSession.items.every((item) => item.scoredScore === null && item.autoResult === null && item.recordingId === null && !item.writtenAnswer && item.speechJobs.length === 0)).toBe(true);
      const serialized = JSON.stringify(assignedSession.items);
      for (const field of forbiddenStudentFields) expect(serialized).not.toContain(field);
    }

    const activeBeforeDuplicate = await prisma.assessmentSession.count({ where: { id: { in: assignedIds }, status: { in: ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"] } } });
    const duplicate = await diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1, student2],
      focus: { mode: "FAMILY", family: deterministicFamily },
    });
    expect(duplicate).toMatchObject({ requested: 2, assigned: 0, resumed: 2, skipped: 0 });
    expect(duplicate.targets.map((target) => target.attemptId).sort()).toEqual(assignedIds.sort());
    expect(await prisma.assessmentSession.count({ where: { id: { in: assignedIds }, status: { in: ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"] } } })).toBe(activeBeforeDuplicate);

    const differentFocus = await diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1],
      focus: { mode: "FAMILY", family: secondFamily },
    });
    expect(differentFocus).toMatchObject({ assigned: 1, resumed: 0 });
    createdSessionIds.push(differentFocus.targets[0]!.attemptId!);
    expect(differentFocus.targets[0]!.attemptId).not.toBe(assignedIds[0]);

    const self = await service.createOrResumeRemediation(auth(student1 && studentIds[0]!, MembershipRole.STUDENT), schoolId, sourceByEnrollment.get(student1)!.id);
    expect(self).toMatchObject({ outcome: "CREATED", resumed: false });
    createdSessionIds.push(self.attemptId!);
    const teacherAll = await diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1],
      focus: { mode: "ALL_RETRY" },
    });
    expect(teacherAll).toMatchObject({ assigned: 1, resumed: 0 });
    createdSessionIds.push(teacherAll.targets[0]!.attemptId!);
    expect(teacherAll.targets[0]!.attemptId).not.toBe(self.attemptId);
    expect((await prisma.assessmentSession.findUniqueOrThrow({ where: { id: self.attemptId! } })).remediationOrigin).toBe("SELF_INITIATED");

    await expect(diagnosticService.createRemediationAssignments(auth(studentIds[0]!, MembershipRole.STUDENT), schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1],
      focus: { mode: "FAMILY", family: deterministicFamily },
    })).rejects.toThrow();
    await expect(diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classBId, {
      practiceDefinitionId,
      enrollmentIds: [student1],
      focus: { mode: "FAMILY", family: deterministicFamily },
    })).rejects.toThrow();
    await expect(diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1, student3],
      focus: { mode: "FAMILY", family: deterministicFamily },
    })).rejects.toThrow();
    await expect(diagnosticService.createRemediationAssignments(auth(teacherId, MembershipRole.TEACHER, randomUUID()), schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [student1],
      focus: { mode: "FAMILY", family: deterministicFamily },
    })).rejects.toThrow();
  });

  it("keeps assigned READ_ALOUD experimental and completes only through teacher review", async () => {
    const teacherAuth = auth(teacherId, MembershipRole.TEACHER);
    const studentEnrollmentId = enrollmentIds[0]!;
    const source = sourceByEnrollment.get(studentEnrollmentId)!;
    const assigned = await diagnosticService.createRemediationAssignments(teacherAuth, schoolId, classAId, {
      practiceDefinitionId,
      enrollmentIds: [studentEnrollmentId],
      focus: { mode: "FAMILY", family: "READ_ALOUD" },
    });
    expect(assigned).toMatchObject({ assigned: 1, resumed: 0 });
    const sessionId = assigned.targets[0]!.attemptId!;
    createdSessionIds.push(sessionId);

    const items = await prisma.assessmentItem.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" }, include: { questionVersion: true } });
    expect(items.length).toBeGreaterThan(0);
    const speechService = new SpeechJobService(prisma as any, { get: (key: string) => key === "SPEECH_PROVIDER" ? "local" : undefined } as any, null);
    for (const item of items) {
      const recording = await prisma.recording.create({
        data: {
          schoolId,
          enrollmentId: studentEnrollmentId,
          status: "READY",
          partCount: 1,
          uploadedParts: [0],
          mimeType: "audio/wav",
          objectKey: `qb015f/${sessionId}/${item.id}.wav`,
          idempotencyKey: `qb015f-${sessionId}-${item.id}`,
        },
      });
      await prisma.assessmentItem.update({ where: { id: item.id }, data: { recordingId: recording.id } });
      const job = await speechService.triggerSpeechProcessing(recording.id, item.id, undefined, schoolId);
      expect(job).toMatchObject({ provider: "local", status: "CREATED" });
      const targetText = (item.questionVersion!.scoringSpec as Record<string, unknown>).targetText;
      await speechService.applySpeechProviderResult(job.id, {
        provider: "local",
        scorerVersion: "mandarin-reading-v0.1.0",
        confidence: 0.82,
        scores: { accuracy: 84, completeness: 78, fluency: 80, tone: 71, overall: 80 },
        requiresReview: false,
        experimental: true,
        toneMeta: { experimental: true, method: "f0_cv_heuristic", reason: null },
        transcript: String(targetText),
        errors: [],
        processingMs: 12,
      });
    }
    await prisma.assessmentSession.update({ where: { id: sessionId }, data: { status: "PROCESSING", submittedAt: new Date() } });
    const processed = await prisma.assessmentItem.findMany({ where: { sessionId }, include: { speechJobs: true } });
    expect(processed.every((item) => item.autoResult && item.autoResult !== null && item.scoredScore === null && item.speechJobs[0]?.status === "NEEDS_REVIEW")).toBe(true);
    expect(new Set(processed.map((item) => item.recordingId)).size).toBe(items.length);

    const sourceBefore = await prisma.assessmentReport.findUniqueOrThrow({ where: { sessionId: source.id } });
    for (const item of processed) {
      await expect(reviewService.submit(auth(teacherId, MembershipRole.TEACHER), schoolId, item.id, { score: 2, comment: "QB-015F teacher review" })).resolves.toBeDefined();
    }
    const completed = await prisma.assessmentSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(completed.status).toBe("COMPLETED");
    expect(await prisma.assessmentReport.count({ where: { sessionId } })).toBe(0);
    const sourceAfter = await prisma.assessmentReport.findUniqueOrThrow({ where: { sessionId: source.id } });
    expect(sourceAfter.summary).toEqual(sourceBefore.summary);
    const sourceItems = await prisma.assessmentItem.findMany({ where: { sessionId: source.id }, select: { id: true, scoredScore: true } });
    expect(new Map(sourceItems.map((item) => [item.id, item.scoredScore]))).toEqual(source.itemScores);
    const reviewed = await prisma.assessmentItem.findMany({ where: { sessionId }, select: { scoredScore: true, autoResult: true } });
    expect(reviewed.every((item) => item.scoredScore === 2)).toBe(true);
    expect(reviewed.some((item) => JSON.stringify(item.autoResult).includes("candidatePoints"))).toBe(true);
    await expect(reviewService.submit(auth(teacherBId, MembershipRole.TEACHER), schoolId, processed[0]!.id, { score: 1 })).rejects.toThrow();
    await expect(reviewService.submit(auth(studentIds[0]!, MembershipRole.STUDENT), schoolId, processed[0]!.id, { score: 1 })).rejects.toThrow();
    for (const item of processed) {
      const recordingId = item.recordingId!;
      await prisma.recording.delete({ where: { id: recordingId } });
    }
  });
});
