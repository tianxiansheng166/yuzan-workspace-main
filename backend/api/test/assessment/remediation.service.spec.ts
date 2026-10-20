import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@yuzan/database";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";
import type { AssessmentRemediationOrigin, AssessmentReport, AssessmentSession, AssessmentSessionPurpose, AssessmentSessionStatus, AssessmentType } from "../../src/modules/assessment/domain/assessment.types.js";
import type { AssessmentSessionRepositoryPort } from "../../src/modules/assessment/ports/assessment-session-repository.port.js";
import type { AssessmentItemRepositoryPort } from "../../src/modules/assessment/ports/assessment-item-repository.port.js";
import type { WrittenAnswerRepositoryPort } from "../../src/modules/assessment/ports/written-answer-repository.port.js";
import type { AssessmentReportRepositoryPort } from "../../src/modules/assessment/ports/assessment-report-repository.port.js";
import type { QuestionBankDeterministicScoringService } from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";

const SCHOOL_ID = "school-remediation";
const CLASS_ID = "class-remediation";
const STUDENT_ID = "student-remediation";
const ENROLLMENT_ID = "enrollment-remediation";
const SOURCE_ID = "source-remediation";
const now = new Date("2026-08-23T00:00:00.000Z");
type TestSourceItem = {
  id: string;
  questionVersionId: string | null;
  itemType: string;
  sectionTitle: string;
  sectionOrder: number;
  sortOrder: number;
  maxScore: number | null;
  scoredScore: number | null;
  prompt: Prisma.JsonValue;
  itemConfig: Prisma.JsonValue;
  questionVersion: {
    id: string;
    status: string;
    deliverySpec: Prisma.JsonValue;
    item: { domain: string | null; questionType: string | null };
  } | null;
};
type TestRemediationSource = Pick<AssessmentSession, "id" | "enrollmentId" | "classId" | "type" | "status" | "purpose"> & {
  practiceDefinitionId: string | null;
  practiceVersionId: string | null;
  deliveryId: string | null;
  report: { summary: unknown } | null;
  items: TestSourceItem[];
};
type RemediationAttempt = Omit<AssessmentSession, "status" | "remediationOrigin" | "remediationFocus"> & {
  type: AssessmentType;
  purpose: AssessmentSessionPurpose;
  status: AssessmentSessionStatus;
  remediationOrigin: AssessmentRemediationOrigin | null;
  remediationFocus: unknown;
  practiceDefinitionId: string | null;
  practiceVersionId: string | null;
  deliveryId: string | null;
  courseSubmissionId: string | null;
  courseActivityId: string | null;
  items: Array<{ questionVersionId: string | null }>;
};

function unexpected<T>(): Promise<T> {
  return Promise.reject(new Error("unexpected repository call"));
}

function emptySessionRepository(): AssessmentSessionRepositoryPort {
  return {
    findById: () => Promise.resolve(null),
    findByIdAndSchool: () => Promise.resolve(null),
    list: () => Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
    create: () => unexpected(),
    updateStatus: () => unexpected(),
  };
}

function emptyItemRepository(): AssessmentItemRepositoryPort {
  return {
    findBySessionId: () => unexpected(),
    findById: () => unexpected(),
    findByIdAndSession: () => unexpected(),
    createMany: () => unexpected(),
    updateRecordingId: () => unexpected(),
    updateStatus: () => unexpected(),
    updateScore: () => unexpected(),
  };
}

function emptyAnswerRepository(): WrittenAnswerRepositoryPort {
  return {
    findByItemId: () => Promise.resolve(null),
    findBySessionId: () => Promise.resolve([]),
    upsert: () => unexpected(),
    finalize: () => unexpected(),
  };
}

function emptyReportRepository(): AssessmentReportRepositoryPort {
  return {
    findBySessionId: () => Promise.resolve(null),
    create: () => unexpected(),
  };
}

function scorerMock(): QuestionBankDeterministicScoringService {
  return { scoreSession: () => Promise.resolve() } as unknown as QuestionBankDeterministicScoringService;
}

function studentAuth(userId = STUDENT_ID): AuthContext {
  const principal: Principal = { userId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" };
  const tenant: TenantContext = { schoolId: SCHOOL_ID };
  return { requestId: "remediation-test", principal, tenant };
}

function sourceItems(): TestSourceItem[] {
  return Array.from({ length: 20 }, (_, index) => {
    const retry = index < 4;
    const maxScore = index < 2 ? 3 : 5;
    return {
      id: `source-item-${index + 1}`,
      questionVersionId: `question-version-${index + 1}`,
      prompt: { leaked: "source-answer-must-not-copy" },
      itemConfig: { leaked: "source-answer-must-not-copy" },
      itemType: "SINGLE_CHOICE",
      sectionTitle: "专项",
      sectionOrder: 1,
      sortOrder: index + 1,
      maxScore,
      scoredScore: retry ? 0 : maxScore,
      questionVersion: {
        id: `question-version-${index + 1}`,
        status: "PUBLISHED",
        deliverySpec: {
          stimulus: { type: "TEXT", promptText: `题目 ${index + 1}` },
          response: { type: "CHOICE", options: [{ key: "A", label: "选项 A" }, { key: "B", label: "选项 B" }] },
        },
        item: { domain: "LISTEN", questionType: "LISTEN_IMAGE_CHOICE" },
      },
    };
  });
}

function diagnosis(items: ReturnType<typeof sourceItems>, retryCount = 4) {
  return {
    version: "qb-diagnosis-v1" as const,
    overall: {}, domains: [], families: [], strengths: [], priorities: [], nextSteps: [],
    retryCandidates: items.slice(0, retryCount).map((item) => ({
      assessmentItemId: item.id,
      questionVersionId: item.questionVersionId,
      family: "LISTEN_IMAGE_CHOICE",
      displayName: "听音选图",
      domain: "LISTEN",
      domainDisplayName: "听",
      earned: item.scoredScore,
      max: item.maxScore,
    })),
  };
}

function harness(options: { retryCount?: number; sourceEnrollmentId?: string } = {}) {
  const items = sourceItems();
  const source: TestRemediationSource = {
    id: SOURCE_ID,
    enrollmentId: options.sourceEnrollmentId ?? ENROLLMENT_ID,
    classId: CLASS_ID,
    type: "MIXED",
    status: "COMPLETED",
    purpose: "STANDARD",
    practiceDefinitionId: "practice-definition",
    practiceVersionId: "practice-version",
    deliveryId: "delivery",
    report: { summary: { diagnosis: diagnosis(items, options.retryCount ?? 4) } },
    items,
  };
  const remediation: RemediationAttempt[] = [];
  type RemediationItemCreateData = {
    sessionId: string;
    questionVersionId: string;
    prompt: Prisma.InputJsonValue;
    itemConfig: Prisma.InputJsonValue;
    itemType: string;
    sectionTitle: string;
    sectionOrder: number;
    sortOrder: number;
    maxScore: number;
  };
  const createdItems: RemediationItemCreateData[][] = [];
  type RemediationWhere = {
    id?: string;
    schoolId?: string;
    enrollmentId?: string;
    practiceDefinitionId?: string;
    purpose?: string;
    status?: string | { in: readonly string[] };
    initiatorUserId?: string;
    retestOfSessionId?: string;
    remediationOrigin?: string | null;
    OR?: readonly unknown[];
  };
  type RemediationFindArgs = { where: RemediationWhere };
  type RemediationCreateData = {
    schoolId: string;
    enrollmentId: string;
    classId: string;
    initiatorUserId: string;
    type: AssessmentType;
    purpose: "REMEDIATION";
    remediationOrigin: AssessmentRemediationOrigin;
    remediationFocus: Prisma.InputJsonValue;
    retestOfSessionId: string;
    practiceDefinitionId: string;
    practiceVersionId: string;
    deliveryId: string;
  };
  type RemediationCreateArgs = { data: RemediationCreateData };
  type CreateItemsArgs = { data: RemediationItemCreateData[] };
  const enrollment = {
    findFirst: vi.fn<(args: { where: { userId: string } }) => Promise<{ id: string; classId: string } | null>>()
      .mockImplementation((args) => Promise.resolve(args.where.userId === STUDENT_ID ? { id: ENROLLMENT_ID, classId: CLASS_ID } : null)),
  };
  const assessmentSession = {
    findFirst: vi.fn<(args: RemediationFindArgs) => Promise<TestRemediationSource | RemediationAttempt | null>>()
      .mockImplementation((args) => {
        const { where } = args;
        if (where.id === SOURCE_ID || (where.enrollmentId === ENROLLMENT_ID && where.practiceDefinitionId === "practice-definition")) {
          return Promise.resolve(source);
        }
        if (where.purpose === "REMEDIATION") {
          const activeStatuses = typeof where.status === "object" ? where.status.in : [];
          return Promise.resolve(remediation.find((attempt) =>
            activeStatuses.includes(attempt.status) &&
            attempt.retestOfSessionId === where.retestOfSessionId &&
            attempt.initiatorUserId === where.initiatorUserId &&
            (where.remediationOrigin === "TEACHER_ASSIGNED"
              ? attempt.remediationOrigin === "TEACHER_ASSIGNED"
              : Boolean(where.OR) && ["SELF_INITIATED", null, undefined].includes(attempt.remediationOrigin)),
          ) ?? null);
        }
        return Promise.resolve(null);
      }),
    create: vi.fn<(args: RemediationCreateArgs) => Promise<{ id: string; status: AssessmentSessionStatus }>>()
      .mockImplementation(({ data }) => {
        const attempt: RemediationAttempt = {
          id: `remediation-${remediation.length + 1}`,
          schoolId: data.schoolId,
          enrollmentId: data.enrollmentId,
          classId: data.classId,
          initiatorUserId: data.initiatorUserId,
          type: data.type,
          purpose: "REMEDIATION",
          remediationOrigin: data.remediationOrigin ?? null,
          remediationFocus: data.remediationFocus ?? null,
          status: "CREATED",
          startedAt: null,
          submittedAt: null,
          completedAt: null,
          retestOfSessionId: data.retestOfSessionId ?? null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          practiceDefinitionId: data.practiceDefinitionId ?? null,
          practiceVersionId: data.practiceVersionId ?? null,
          deliveryId: data.deliveryId ?? null,
          courseSubmissionId: null,
          courseActivityId: null,
          items: [],
        };
        remediation.push(attempt);
        return Promise.resolve({ id: attempt.id, status: attempt.status });
      }),
    findMany: vi.fn<(args: RemediationFindArgs) => Promise<RemediationAttempt[]>>()
      .mockImplementation(({ where }) => {
        const activeStatuses = typeof where.status === "object" ? where.status.in : [];
        return Promise.resolve(remediation.filter((attempt) =>
          activeStatuses.includes(attempt.status) &&
          attempt.retestOfSessionId === where.retestOfSessionId &&
          attempt.initiatorUserId === where.initiatorUserId &&
          (where.remediationOrigin === "TEACHER_ASSIGNED"
            ? attempt.remediationOrigin === "TEACHER_ASSIGNED"
            : Boolean(where.OR) && ["SELF_INITIATED", null, undefined].includes(attempt.remediationOrigin)),
        ));
      }),
  };
  const assessmentItem = {
    createMany: vi.fn<(args: CreateItemsArgs) => Promise<{ count: number }>>()
      .mockImplementation(({ data }) => {
        createdItems.push(data);
        const attempt = remediation.find((entry) => entry.id === data[0]?.sessionId);
        if (attempt) attempt.items = data.map((item) => ({ questionVersionId: item.questionVersionId ?? null }));
        return Promise.resolve({ count: data.length });
      }),
  };
  const tx = { assessmentSession, assessmentItem };
  const prisma = {
    enrollment: {
      ...enrollment,
    },
    assessmentSession,
    assessmentItem,
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new AssessmentService(
    emptySessionRepository(),
    emptyItemRepository(),
    emptyAnswerRepository(),
    emptyReportRepository(),
    prisma as unknown as PrismaService,
    scorerMock(),
  );
  return { service, source, remediation, createdItems, prisma };
}

describe("Diagnosis remediation attempts", () => {
  it("creates only persisted retry candidates, reuses versions, and starts with no answer or score data", async () => {
    const { service, remediation, createdItems } = harness();
    const result = await service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID);

    expect(result).toMatchObject({ outcome: "CREATED", itemCount: 4, resumed: false });
    expect(remediation).toHaveLength(1);
    const createdAttempt = remediation[0];
    const firstItemBatch = createdItems[0];
    if (!createdAttempt || !firstItemBatch) throw new Error("remediation attempt fixture was not created");
    expect(createdAttempt).toMatchObject({ purpose: "REMEDIATION", retestOfSessionId: SOURCE_ID, practiceDefinitionId: "practice-definition", practiceVersionId: "practice-version", deliveryId: "delivery" });
    expect(firstItemBatch).toHaveLength(4);
    expect(firstItemBatch.map((item) => item.questionVersionId)).toEqual([
      "question-version-1", "question-version-2", "question-version-3", "question-version-4",
    ]);
    expect(firstItemBatch.map((item) => item.sortOrder)).toEqual([1, 2, 3, 4]);
    const serialized = JSON.stringify(firstItemBatch);
    for (const forbidden of ["scoredScore", "autoResult", "recordingId", "reviewerUserId", "writtenAnswer", "source-answer-must-not-copy"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("resumes an active remediation and allows a new round after completion", async () => {
    const { service, remediation, createdItems } = harness();
    const first = await service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID);
    const second = await service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID);
    expect(second).toMatchObject({ outcome: "RESUMED", attemptId: first.attemptId, resumed: true });
    expect(createdItems).toHaveLength(1);

    const firstAttempt = remediation[0];
    if (!firstAttempt) throw new Error("remediation attempt fixture was not created");
    firstAttempt.status = "COMPLETED";
    const third = await service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID);
    expect(third).toMatchObject({ outcome: "CREATED", resumed: false });
    expect(third.attemptId).not.toBe(first.attemptId);
    expect(remediation.map((attempt) => attempt.retestOfSessionId)).toEqual([SOURCE_ID, SOURCE_ID]);
  });

  it("returns a safe no-op for a perfect diagnosis and rejects another student's source", async () => {
    const noRetry = harness({ retryCount: 0 });
    await expect(noRetry.service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID)).resolves.toMatchObject({ outcome: "NO_REMEDIATION_NEEDED", attemptId: null });
    expect(noRetry.remediation).toHaveLength(0);

    const otherStudent = harness({ sourceEnrollmentId: "other-enrollment" });
    await expect(otherStudent.service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID)).rejects.toThrow(/其他学生/);
  });

  it("keeps teacher-assigned origin/focus distinct while duplicate assignment resumes the exact subset", async () => {
    const { service, remediation, createdItems } = harness();
    const input = {
      schoolId: SCHOOL_ID,
      enrollment: { id: ENROLLMENT_ID, classId: CLASS_ID },
      actorUserId: "teacher-1",
      practiceDefinitionId: "practice-definition",
      focus: { mode: "FAMILY" as const, family: "LISTEN_IMAGE_CHOICE" },
    };
    const first = await service.createTeacherAssignedRemediation(input);
    const duplicate = await service.createTeacherAssignedRemediation(input);
    const otherFocus = await service.createTeacherAssignedRemediation({ ...input, focus: { mode: "ALL_RETRY" } });
    expect(first).toMatchObject({ outcome: "CREATED", itemCount: 4 });
    expect(duplicate).toMatchObject({ outcome: "RESUMED", attemptId: first.attemptId });
    expect(otherFocus).toMatchObject({ outcome: "CREATED", itemCount: 4 });
    expect(remediation).toHaveLength(2);
    expect(remediation.map((attempt) => attempt.remediationOrigin)).toEqual(["TEACHER_ASSIGNED", "TEACHER_ASSIGNED"]);
    expect(remediation.map((attempt) => attempt.remediationFocus)).toEqual([
      { mode: "FAMILY", family: "LISTEN_IMAGE_CHOICE" }, { mode: "ALL_RETRY" },
    ]);
    expect(createdItems).toHaveLength(2);
  });

  it("completes a fully scored subset without creating an AssessmentReport", async () => {
    let session: AssessmentSession = {
      id: "remediation-complete",
      schoolId: SCHOOL_ID,
      enrollmentId: ENROLLMENT_ID,
      classId: CLASS_ID,
      initiatorUserId: STUDENT_ID,
      type: "MIXED",
      purpose: "REMEDIATION",
      status: "SUBMITTED",
      startedAt: now,
      submittedAt: now,
      completedAt: null,
      retestOfSessionId: SOURCE_ID,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    const sessionRepo = {
      findById: () => Promise.resolve(null),
      findByIdAndSchool: vi.fn((id: string, schoolId: string) =>
        Promise.resolve(id === session.id && schoolId === session.schoolId ? session : null)),
      list: () => Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
      create: () => unexpected(),
      updateStatus: vi.fn((id: string, status: AssessmentSessionStatus, extra?: Partial<AssessmentSession>) => {
        session = { ...session, ...extra, id, status };
        return Promise.resolve(session);
      }),
    } satisfies AssessmentSessionRepositoryPort;
    const reportRepo = {
      findBySessionId: () => Promise.resolve(null),
      create: vi.fn(() => unexpected<AssessmentReport>()),
    } satisfies AssessmentReportRepositoryPort;
    const prisma = {
      assessmentItem: {
        findMany: vi.fn<() => Promise<Array<{ questionVersionId: string; maxScore: number; scoredScore: number }>>>().mockResolvedValue([
          { questionVersionId: "version-1", maxScore: 3, scoredScore: 3 },
          { questionVersionId: "version-2", maxScore: 5, scoredScore: 4 },
        ]),
      },
    };
    const scorer = { scoreSession: vi.fn<(sessionId: string) => Promise<void>>().mockResolvedValue() };
    const service = new AssessmentService(
      sessionRepo,
      emptyItemRepository(),
      emptyAnswerRepository(),
      reportRepo,
      prisma as unknown as PrismaService,
      scorer as unknown as QuestionBankDeterministicScoringService,
    );

    await expect(service.finalizeRemediationIfComplete(SCHOOL_ID, session.id)).resolves.toBeNull();
    expect(scorer.scoreSession).toHaveBeenCalledWith(session.id);
    const completedUpdate = sessionRepo.updateStatus.mock.calls.find(([id, status]) =>
      id === session.id && status === "COMPLETED",
    );
    expect(completedUpdate?.[2]?.completedAt).toBeInstanceOf(Date);
    expect(reportRepo.create).not.toHaveBeenCalled();
  });

  it("projects only student-safe remediation result fields", async () => {
    const session: AssessmentSession = {
      id: "remediation-result",
      schoolId: SCHOOL_ID,
      enrollmentId: ENROLLMENT_ID,
      classId: CLASS_ID,
      initiatorUserId: STUDENT_ID,
      type: "MIXED",
      purpose: "REMEDIATION",
      status: "COMPLETED",
      startedAt: now,
      submittedAt: now,
      completedAt: now,
      retestOfSessionId: SOURCE_ID,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    type ResultItem = {
      id: string;
      itemType: string;
      sortOrder: number;
      maxScore: number;
      scoredScore: number;
      prompt: Record<string, unknown>;
      autoResult: Record<string, unknown>;
      questionVersion: {
        item: { domain: string; questionType: string };
        scoringSpec: Record<string, unknown>;
      };
    };
    type ResultDelivery = {
      practiceVersion: {
        definition: {
          id: string;
          title: string;
          summary: string;
          difficulty: string;
          estimatedMinutes: number;
          abilityCategories: string[];
        };
      };
    };
    const prisma = {
      enrollment: {
        findFirst: vi.fn<(args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>>()
          .mockResolvedValue({ id: ENROLLMENT_ID }),
      },
      practiceDelivery: {
        findMany: vi.fn<() => Promise<ResultDelivery[]>>().mockResolvedValue([{
          practiceVersion: {
            definition: {
              id: "practice-listening",
              title: "听辨专项训练",
              summary: "真实开放练习",
              difficulty: "基础",
              estimatedMinutes: 10,
              abilityCategories: ["听辨训练"],
            },
          },
        }]),
      },
      assessmentItem: {
        findMany: vi.fn<() => Promise<ResultItem[]>>().mockResolvedValue([{
          id: "remediation-item",
          itemType: "CHOICE",
          sortOrder: 1,
          maxScore: 3,
          scoredScore: 2,
          prompt: { correctAnswer: "SECRET" },
          autoResult: { providerAudit: "SECRET" },
          questionVersion: { item: { domain: "LISTEN", questionType: "LISTEN_IMAGE_CHOICE" }, scoringSpec: { acceptedAnswers: ["SECRET"] } },
        }]),
      },
    };
    const sessionRepo = {
      findById: () => Promise.resolve(null),
      findByIdAndSchool: vi.fn((id: string, schoolId: string) =>
        Promise.resolve(id === session.id && schoolId === session.schoolId ? session : null)),
      list: () => Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
      create: () => unexpected(),
      updateStatus: () => unexpected(),
    } satisfies AssessmentSessionRepositoryPort;
    const service = new AssessmentService(
      sessionRepo,
      emptyItemRepository(),
      emptyAnswerRepository(),
      emptyReportRepository(),
      prisma as unknown as PrismaService,
      scorerMock(),
    );
    const result = await service.getRemediationResult(studentAuth(), SCHOOL_ID, session.id);

    expect(result).toMatchObject({ sourceSessionId: SOURCE_ID, earnedPoints: 2, maxPoints: 3, percentage: 66.67, pendingItemCount: 0 });
    expect(result.recommendations).toMatchObject([{ practiceDefinitionId: "practice-listening", targetFamily: "听音选图" }]);
    const serialized = JSON.stringify(result);
    for (const forbidden of ["correctAnswer", "acceptedAnswers", "providerAudit", "SECRET", "scoringSpec", "prompt", "autoResult"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
