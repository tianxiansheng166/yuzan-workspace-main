import { describe, expect, it, vi } from "vitest";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import type { AssessmentItemStatus, AssessmentReport, AssessmentSession, AssessmentSessionStatus, WrittenAnswer } from "../../src/modules/assessment/domain/assessment.types.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";
import type { AssessmentSessionRepositoryPort } from "../../src/modules/assessment/ports/assessment-session-repository.port.js";
import type { AssessmentItemRepositoryPort } from "../../src/modules/assessment/ports/assessment-item-repository.port.js";
import type { WrittenAnswerRepositoryPort } from "../../src/modules/assessment/ports/written-answer-repository.port.js";
import type { AssessmentReportRepositoryPort, CreateAssessmentReportData } from "../../src/modules/assessment/ports/assessment-report-repository.port.js";
import type { QuestionBankDeterministicScoringService } from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";

const SCHOOL_ID = "school-qb-007";
const CLASS_ID = "class-qb-007";
const SESSION_ID = "session-qb-007";
const TEACHER_ID = "teacher-qb-007";
const OTHER_TEACHER_ID = "teacher-other-qb-007";
const now = new Date("2026-08-23T00:00:00.000Z");
type ReviewTestItem = {
  id: string;
  sessionId: string;
  questionVersionId: string | null;
  itemType: string;
  sortOrder: number;
  maxScore: number | null;
  scoredScore: number | null;
  reviewerUserId: string | null;
  reviewerComment: string | null;
  reviewedAt: Date | null;
  revision: number;
  status: AssessmentItemStatus;
  autoResult: Record<string, unknown> | null;
  session: { id: string; schoolId: string; classId: string; status: AssessmentSessionStatus };
  questionVersion: {
    status: string;
    scoringSpec: unknown;
    item: { domain: string | null; questionType: string | null; level: string | null };
  };
};

function auth(userId: string, roles: MembershipRole[] = [MembershipRole.TEACHER]): AuthContext {
  const principal: Principal = { userId, roles, membershipStatus: MembershipStatus.ACTIVE, source: "session" };
  const tenant: TenantContext = { schoolId: SCHOOL_ID };
  return { requestId: "review-test", principal, tenant };
}

function session(): AssessmentSession {
  return {
    id: SESSION_ID,
    schoolId: SCHOOL_ID,
    enrollmentId: "enrollment-qb-007",
    classId: CLASS_ID,
    initiatorUserId: "student-qb-007",
    type: "MIXED",
    purpose: "STANDARD",
    status: "PROCESSING",
    startedAt: now,
    submittedAt: now,
    completedAt: null,
    retestOfSessionId: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function makeRows(): ReviewTestItem[] {
  const deterministicStrategies = [
    "EXACT_CHOICE", "EXACT_CHOICE", "EXACT_CHOICE",
    "DICTATION_ALIGNMENT", "DICTATION_ALIGNMENT", "DICTATION_ALIGNMENT",
    "ACCEPTED_TEXT", "ACCEPTED_TEXT", "EXACT_CHOICE", "EXACT_CHOICE", "EXACT_CHOICE", "EXACT_CHOICE", "EXACT_CHOICE", "EXACT_CHOICE",
  ];
  const deterministicMax = [3, 3, 3, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4];
  const deterministicMetadata = [
    ["LISTEN_IMAGE_CHOICE", "LISTEN"], ["LISTEN_IMAGE_CHOICE", "LISTEN"], ["LISTEN_IMAGE_CHOICE", "LISTEN"],
    ["DICTATION", "LISTEN"], ["DICTATION", "LISTEN"], ["DICTATION", "LISTEN"],
    ["PICTURE_WORD", "WRITE"], ["PICTURE_WORD", "WRITE"],
    ["WORD_RECOGNITION", "READ"], ["WORD_RECOGNITION", "READ"], ["WORD_RECOGNITION", "READ"],
    ["SENTENCE_COMPREHENSION", "READ"], ["SENTENCE_COMPREHENSION", "READ"], ["SENTENCE_COMPREHENSION", "READ"],
  ] as const;
  const review = [
    ["rubric-1", "RUBRIC_TEXT", 8, "WRITE"],
    ["rubric-2", "RUBRIC_TEXT", 8, "WRITE"],
    ["reading-1", "SPEECH_READING", 4, "SPEAK"],
    ["reading-2", "SPEECH_READING", 4, "SPEAK"],
    ["reading-3", "SPEECH_READING", 4, "SPEAK"],
    ["picture-1", "SPEECH_OPEN_RESPONSE", 14, "SPEAK"],
  ] as const;
  return [
    ...deterministicStrategies.map((strategy, index) => {
      const maxScore = deterministicMax[index];
      const metadata = deterministicMetadata[index];
      if (maxScore === undefined || metadata === undefined) throw new Error("deterministic item fixture is incomplete");
      return {
        id: `det-${index}`,
        sessionId: SESSION_ID,
        questionVersionId: `version-det-${index}`,
        itemType: strategy,
        sortOrder: index + 1,
        maxScore,
        scoredScore: maxScore,
        reviewerUserId: null,
        reviewerComment: null,
        reviewedAt: null,
        revision: 1,
        status: "REVIEWED" as const,
        autoResult: { state: "AUTO_SCORED" },
        session: { id: SESSION_ID, schoolId: SCHOOL_ID, classId: CLASS_ID, status: "PROCESSING" as const },
        questionVersion: { status: "PUBLISHED", scoringSpec: { strategy, maxScore }, item: { domain: metadata[1], questionType: metadata[0], level: "水平一级" } },
      };
    }),
    ...review.map(([id, strategy, maxScore, domain], index) => ({
      id,
      sessionId: SESSION_ID,
      questionVersionId: `version-${id}`,
      itemType: strategy,
      sortOrder: deterministicStrategies.length + index + 1,
      maxScore,
      scoredScore: null as number | null,
      reviewerUserId: null as string | null,
      reviewerComment: null as string | null,
      reviewedAt: null as Date | null,
      revision: 1,
      status: "PENDING" as const,
      autoResult: { state: "NEEDS_REVIEW", strategy },
      session: { id: SESSION_ID, schoolId: SCHOOL_ID, classId: CLASS_ID, status: "PROCESSING" as const },
      questionVersion: { status: "PUBLISHED", scoringSpec: { strategy, maxScore }, item: { domain, questionType: strategy === "SPEECH_READING" ? "READ_ALOUD" : strategy === "SPEECH_OPEN_RESPONSE" ? "PICTURE_SPEAKING" : "SENTENCE_COMPLETION", level: "水平一级" } },
    })),
  ];
}

function harness() {
  const rows = makeRows();
  let currentSession = session();
  let report: AssessmentReport | null = null;
  const sessionRepo = {
    findById: () => Promise.resolve(null),
    findByIdAndSchool: vi.fn(() => Promise.resolve(currentSession)),
    list: () => Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
    create: () => Promise.resolve(currentSession),
    updateStatus: vi.fn((_id: string, status: AssessmentSession["status"], extra?: Partial<AssessmentSession>) => {
      currentSession = { ...currentSession, ...extra, status, updatedAt: now };
      rows.forEach((row) => { row.session.status = status; });
      return Promise.resolve(currentSession);
    }),
  } satisfies AssessmentSessionRepositoryPort;
  const unexpected = <T>(): Promise<T> => Promise.reject(new Error("unexpected repository call"));
  const itemRepo: AssessmentItemRepositoryPort = {
    findBySessionId: () => unexpected(),
    findById: () => unexpected(),
    findByIdAndSession: () => unexpected(),
    createMany: () => unexpected(),
    updateRecordingId: () => unexpected(),
    updateStatus: () => unexpected(),
    updateScore: () => unexpected(),
  };
  const answerRepo: WrittenAnswerRepositoryPort = {
    findByItemId: () => Promise.resolve(null),
    findBySessionId: () => Promise.resolve([]),
    upsert: () => unexpected<WrittenAnswer>(),
    finalize: () => unexpected(),
  };
  const reportRepo = {
    findBySessionId: vi.fn(() => Promise.resolve(report)),
    create: vi.fn((data: CreateAssessmentReportData) => {
      const createdReport: AssessmentReport = {
        id: "report-qb-007",
        sessionId: data.sessionId,
        schoolId: data.schoolId,
        overallScore: data.overallScore ?? null,
        readingScore: data.readingScore ?? null,
        writtenScore: data.writtenScore ?? null,
        summary: data.summary ?? null,
        recommendations: null,
        dataCompleteness: data.dataCompleteness ?? 1,
        generatedAt: now,
        generatedByUserId: data.generatedByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      report = createdReport;
      return Promise.resolve(createdReport);
    }),
  } satisfies AssessmentReportRepositoryPort;
  type ReviewFirstArgs = { where: { id: string; sessionId: string } };
  type ReviewUpdateArgs = {
    where: { id: string; revision: number; scoredScore: null };
    data: {
      scoredScore: number;
      reviewerUserId: string;
      reviewerComment?: string;
      reviewedAt: Date;
      status: "REVIEWED";
      revision: { increment: number };
    };
  };
  const prisma = {
    enrollment: {
      findFirst: vi.fn((args: { where: { userId: string } }) =>
        Promise.resolve([TEACHER_ID, OTHER_TEACHER_ID].includes(args.where.userId) ? { id: "teacher-enrollment" } : null)),
    },
    assessmentItem: {
      findFirst: vi.fn((args: ReviewFirstArgs) =>
        Promise.resolve(rows.find((row) => row.id === args.where.id && row.sessionId === args.where.sessionId) ?? null)),
      findMany: vi.fn(() => Promise.resolve(rows)),
      findUnique: vi.fn((args: { where: { id: string } }) =>
        Promise.resolve(rows.find((row) => row.id === args.where.id) ?? null)),
      findUniqueOrThrow: vi.fn((args: { where: { id: string } }) => {
        const row = rows.find((candidate) => candidate.id === args.where.id);
        return row ? Promise.resolve(row) : Promise.reject(new Error("not found"));
      }),
      updateMany: vi.fn((args: ReviewUpdateArgs) => {
        const row = rows.find((candidate) => candidate.id === args.where.id && candidate.revision === args.where.revision && candidate.scoredScore === null);
        if (!row) return Promise.resolve({ count: 0 });
        row.scoredScore = args.data.scoredScore;
        row.reviewerUserId = args.data.reviewerUserId;
        row.reviewerComment = args.data.reviewerComment ?? row.reviewerComment;
        row.reviewedAt = args.data.reviewedAt;
        row.status = args.data.status;
        row.revision += 1;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const scorer = { scoreSession: () => Promise.resolve() };
  const service = new AssessmentService(
    sessionRepo,
    itemRepo,
    answerRepo,
    reportRepo,
    prisma as unknown as PrismaService,
    scorer as unknown as QuestionBankDeterministicScoringService,
  );
  return { service, rows, sessionRepo, reportRepo, prisma, getReport: () => report };
}

describe("AssessmentService Question Bank human review", () => {
  it("keeps a session processing for five reviews and creates one 100-point report on the sixth", async () => {
    const { service, rows, sessionRepo, reportRepo, getReport } = harness();
    const pending = rows.filter((row) => row.scoredScore === null);

    for (const [index, row] of pending.entries()) {
      const result = await service.reviewQuestionBankItem(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID, row.id, { score: row.maxScore!, comment: `review-${index}` });
      if (index < 5) expect(result.report).toBeNull();
    }

    expect(sessionRepo.updateStatus.mock.calls.some(([id, status, extra]) =>
      id === SESSION_ID && status === "COMPLETED" && extra?.completedAt instanceof Date,
    )).toBe(true);
    const savedReport = getReport();
    expect(savedReport).toMatchObject({
      overallScore: 100,
      summary: {
        totalItems: 20,
        answeredItems: 20,
        aggregation: "POINTS",
        awardedPoints: 100,
        totalMaxPoints: 100,
        diagnosis: { version: "qb-diagnosis-v1" },
      },
    });
    const diagnosis = savedReport?.summary?.diagnosis;
    expect(
      typeof diagnosis === "object" && diagnosis !== null &&
      "domains" in diagnosis && Array.isArray(diagnosis.domains),
    ).toBe(true);
    expect(reportRepo.create).toHaveBeenCalledTimes(1);

    const repeated = await service.finalizeQuestionBankIfComplete(SCHOOL_ID, SESSION_ID, TEACHER_ID);
    expect(repeated?.id).toBe("report-qb-007");
    expect(reportRepo.create).toHaveBeenCalledTimes(1);

    const studentSafeReport = await service.getReport(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID);
    expect(studentSafeReport?.teacherFeedback.some((feedback) =>
      feedback.comment === "review-0" && typeof feedback.reviewedAt === "string",
    )).toBe(true);
    expect(studentSafeReport).not.toHaveProperty("reviewerUserId");
    expect(studentSafeReport).not.toHaveProperty("rubric");
  });

  it("bounds scores, rejects deterministic items, enforces class scope, and keeps idempotency/concurrency safe", async () => {
    const { service, rows, prisma } = harness();
    const picture = rows.find((row) => row.id === "picture-1")!;

    await expect(service.reviewQuestionBankItem(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID, picture.id, { score: 15 })).rejects.toThrow(/0 到 14/);

    const deterministic = rows[0]!;
    await expect(service.reviewQuestionBankItem(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID, deterministic.id, { score: 1 })).rejects.toThrow(/不允许人工复核/);

    await expect(service.reviewQuestionBankItem(auth("student-qb-007", [MembershipRole.STUDENT]), SCHOOL_ID, SESSION_ID, picture.id, { score: 1 })).rejects.toThrow();
    await expect(service.reviewQuestionBankItem(auth("outsider-qb-007"), SCHOOL_ID, SESSION_ID, picture.id, { score: 1 })).rejects.toThrow(/任课教师/);

    await service.reviewQuestionBankItem(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID, picture.id, { score: 12 });
    const before = prisma.assessmentItem.updateMany.mock.calls.length;
    await service.reviewQuestionBankItem(auth(TEACHER_ID), SCHOOL_ID, SESSION_ID, picture.id, { score: 12 });
    expect(prisma.assessmentItem.updateMany).toHaveBeenCalledTimes(before);
    await expect(service.reviewQuestionBankItem(auth(OTHER_TEACHER_ID), SCHOOL_ID, SESSION_ID, picture.id, { score: 10 })).rejects.toThrow(/不能静默覆盖/);
  });
});
