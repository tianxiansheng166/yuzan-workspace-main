import { describe, expect, it, vi } from "vitest";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import type { AssessmentSession } from "../../src/modules/assessment/domain/assessment.types.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";

const SCHOOL_ID = "school-qb-007";
const CLASS_ID = "class-qb-007";
const SESSION_ID = "session-qb-007";
const TEACHER_ID = "teacher-qb-007";
const OTHER_TEACHER_ID = "teacher-other-qb-007";
const now = new Date("2026-08-23T00:00:00.000Z");

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

function makeRows() {
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
    ...deterministicStrategies.map((strategy, index) => ({
      id: `det-${index}`,
      sessionId: SESSION_ID,
      questionVersionId: `version-det-${index}`,
      sortOrder: index + 1,
      maxScore: deterministicMax[index],
      scoredScore: deterministicMax[index],
      reviewerUserId: null,
      reviewerComment: null,
      reviewedAt: null,
      revision: 1,
      status: "REVIEWED",
      autoResult: { state: "AUTO_SCORED" },
      session: { id: SESSION_ID, schoolId: SCHOOL_ID, classId: CLASS_ID, status: "PROCESSING" },
      questionVersion: { status: "PUBLISHED", scoringSpec: { strategy, maxScore: deterministicMax[index] }, item: { domain: deterministicMetadata[index]![1], questionType: deterministicMetadata[index]![0], level: "水平一级" } },
    })),
    ...review.map(([id, strategy, maxScore, domain], index) => ({
      id,
      sessionId: SESSION_ID,
      questionVersionId: `version-${id}`,
      sortOrder: deterministicStrategies.length + index + 1,
      maxScore,
      scoredScore: null as number | null,
      reviewerUserId: null as string | null,
      reviewerComment: null as string | null,
      reviewedAt: null as Date | null,
      revision: 1,
      status: "PENDING",
      autoResult: { state: "NEEDS_REVIEW", strategy },
      session: { id: SESSION_ID, schoolId: SCHOOL_ID, classId: CLASS_ID, status: "PROCESSING" },
      questionVersion: { status: "PUBLISHED", scoringSpec: { strategy, maxScore }, item: { domain, questionType: strategy === "SPEECH_READING" ? "READ_ALOUD" : strategy === "SPEECH_OPEN_RESPONSE" ? "PICTURE_SPEAKING" : "SENTENCE_COMPLETION", level: "水平一级" } },
    })),
  ];
}

function harness() {
  const rows = makeRows();
  let currentSession = session();
  let report: any = null;
  const sessionRepo = {
    findByIdAndSchool: vi.fn(async () => currentSession),
    updateStatus: vi.fn(async (_id: string, status: AssessmentSession["status"], extra?: Partial<AssessmentSession>) => {
      currentSession = { ...currentSession, ...extra, status, updatedAt: now };
      rows.forEach((row) => { row.session.status = status; });
      return currentSession;
    }),
  };
  const reportRepo = {
    findBySessionId: vi.fn(async () => report),
    create: vi.fn(async (data: any) => {
      report = {
        id: "report-qb-007",
        sessionId: data.sessionId,
        schoolId: data.schoolId,
        overallScore: data.overallScore,
        readingScore: data.readingScore ?? null,
        writtenScore: data.writtenScore ?? null,
        summary: data.summary,
        recommendations: null,
        dataCompleteness: data.dataCompleteness,
        generatedAt: now,
        generatedByUserId: data.generatedByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      return report;
    }),
  };
  const prisma: any = {
    enrollment: {
      findFirst: vi.fn(async ({ where }: any) => [TEACHER_ID, OTHER_TEACHER_ID].includes(where.userId) ? { id: "teacher-enrollment" } : null),
    },
    assessmentItem: {
      findFirst: vi.fn(async ({ where }: any) => rows.find((row) => row.id === where.id && row.sessionId === where.sessionId) ?? null),
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error("not found");
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = rows.find((candidate) => candidate.id === where.id && candidate.revision === where.revision && candidate.scoredScore === null);
        if (!row) return { count: 0 };
        row.scoredScore = data.scoredScore;
        row.reviewerUserId = data.reviewerUserId;
        row.reviewerComment = data.reviewerComment ?? row.reviewerComment;
        row.reviewedAt = data.reviewedAt;
        row.status = data.status;
        row.revision += 1;
        return { count: 1 };
      }),
    },
  };
  const scorer = { scoreSession: vi.fn(async () => undefined) };
  const service = new AssessmentService(sessionRepo as any, {} as any, {} as any, reportRepo as any, prisma, scorer as any);
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

    expect(sessionRepo.updateStatus).toHaveBeenCalledWith(SESSION_ID, "COMPLETED", expect.objectContaining({ completedAt: expect.any(Date) }));
    expect(getReport()).toMatchObject({ overallScore: 100, summary: { totalItems: 20, answeredItems: 20, aggregation: "POINTS", awardedPoints: 100, totalMaxPoints: 100, diagnosis: { version: "qb-diagnosis-v1", domains: expect.any(Array) } } });
    expect(reportRepo.create).toHaveBeenCalledTimes(1);

    const repeated = await service.finalizeQuestionBankIfComplete(SCHOOL_ID, SESSION_ID, TEACHER_ID);
    expect(repeated?.id).toBe("report-qb-007");
    expect(reportRepo.create).toHaveBeenCalledTimes(1);
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
