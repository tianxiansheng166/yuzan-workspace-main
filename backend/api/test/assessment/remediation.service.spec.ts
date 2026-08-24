import { describe, expect, it, vi } from "vitest";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";

const SCHOOL_ID = "school-remediation";
const CLASS_ID = "class-remediation";
const STUDENT_ID = "student-remediation";
const ENROLLMENT_ID = "enrollment-remediation";
const SOURCE_ID = "source-remediation";
const now = new Date("2026-08-23T00:00:00.000Z");

function studentAuth(userId = STUDENT_ID): AuthContext {
  const principal: Principal = { userId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" };
  const tenant: TenantContext = { schoolId: SCHOOL_ID };
  return { requestId: "remediation-test", principal, tenant };
}

function sourceItems() {
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
  const source = {
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
  const remediation: any[] = [];
  const createdItems: any[][] = [];
  const prisma: any = {
    enrollment: {
      findFirst: vi.fn(async ({ where }: any) => where.userId === STUDENT_ID ? { id: ENROLLMENT_ID, classId: CLASS_ID } : null),
    },
    assessmentSession: {
      findFirst: vi.fn(async ({ where }: any) => {
        if ((where.id === SOURCE_ID || (where.enrollmentId === ENROLLMENT_ID && where.practiceDefinitionId === "practice-definition")) && where.schoolId === SCHOOL_ID && (!where.purpose || where.purpose === "STANDARD")) return source;
        if (where.purpose === "REMEDIATION") return remediation.find((attempt) => where.status.in.includes(attempt.status)) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const attempt = { id: `remediation-${remediation.length + 1}`, status: "CREATED", ...data, createdAt: now, updatedAt: now };
        remediation.push(attempt);
        return { id: attempt.id, status: attempt.status };
      }),
      findMany: vi.fn(async ({ where }: any) => remediation.filter((attempt) =>
        where.status.in.includes(attempt.status) &&
        attempt.retestOfSessionId === where.retestOfSessionId &&
        attempt.initiatorUserId === where.initiatorUserId &&
        (where.remediationOrigin === "TEACHER_ASSIGNED"
          ? attempt.remediationOrigin === "TEACHER_ASSIGNED"
          : where.OR
            ? ["SELF_INITIATED", null, undefined].includes(attempt.remediationOrigin)
            : false),
      )),
    },
    assessmentItem: {
      createMany: vi.fn(async ({ data }: any) => {
        createdItems.push(data);
        const attempt = remediation.find((entry) => entry.id === data[0]?.sessionId);
        if (attempt) attempt.items = data.map((item: any) => ({ questionVersionId: item.questionVersionId }));
        return { count: data.length };
      }),
    },
    $transaction: async (callback: any) => callback(prisma),
  };
  const service = new AssessmentService({} as any, {} as any, {} as any, {} as any, prisma, { scoreSession: vi.fn() } as any);
  return { service, source, remediation, createdItems, prisma };
}

describe("Diagnosis remediation attempts", () => {
  it("creates only persisted retry candidates, reuses versions, and starts with no answer or score data", async () => {
    const { service, remediation, createdItems } = harness();
    const result = await service.createOrResumeRemediation(studentAuth(), SCHOOL_ID, SOURCE_ID);

    expect(result).toMatchObject({ outcome: "CREATED", itemCount: 4, resumed: false });
    expect(remediation).toHaveLength(1);
    expect(remediation[0]).toMatchObject({ purpose: "REMEDIATION", retestOfSessionId: SOURCE_ID, practiceDefinitionId: "practice-definition", practiceVersionId: "practice-version", deliveryId: "delivery" });
    expect(createdItems[0]).toHaveLength(4);
    expect(createdItems[0].map((item) => item.questionVersionId)).toEqual([
      "question-version-1", "question-version-2", "question-version-3", "question-version-4",
    ]);
    expect(createdItems[0].map((item) => item.sortOrder)).toEqual([1, 2, 3, 4]);
    const serialized = JSON.stringify(createdItems[0]);
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

    remediation[0].status = "COMPLETED";
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
    let session: any = {
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
    const sessionRepo: any = {
      findByIdAndSchool: vi.fn(async () => session),
      updateStatus: vi.fn(async (_id: string, status: string, extra: any = {}) => {
        session = { ...session, ...extra, status };
        return session;
      }),
    };
    const reportRepo = { create: vi.fn() };
    const prisma: any = {
      assessmentItem: {
        findMany: vi.fn(async () => [
          { questionVersionId: "version-1", maxScore: 3, scoredScore: 3 },
          { questionVersionId: "version-2", maxScore: 5, scoredScore: 4 },
        ]),
      },
    };
    const scorer = { scoreSession: vi.fn(async () => undefined) };
    const service = new AssessmentService(sessionRepo, {} as any, {} as any, reportRepo as any, prisma, scorer as any);

    await expect(service.finalizeRemediationIfComplete(SCHOOL_ID, session.id)).resolves.toBeNull();
    expect(scorer.scoreSession).toHaveBeenCalledWith(session.id);
    expect(sessionRepo.updateStatus).toHaveBeenCalledWith(session.id, "COMPLETED", expect.objectContaining({ completedAt: expect.any(Date) }));
    expect(reportRepo.create).not.toHaveBeenCalled();
  });

  it("projects only student-safe remediation result fields", async () => {
    const session: any = {
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
    const prisma: any = {
      enrollment: { findFirst: vi.fn(async () => ({ id: ENROLLMENT_ID })) },
      assessmentItem: {
        findMany: vi.fn(async () => [{
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
    const service = new AssessmentService({ findByIdAndSchool: vi.fn(async () => session) } as any, {} as any, {} as any, {} as any, prisma, {} as any);
    const result = await service.getRemediationResult(studentAuth(), SCHOOL_ID, session.id);

    expect(result).toMatchObject({ sourceSessionId: SOURCE_ID, earnedPoints: 2, maxPoints: 3, percentage: 66.67, pendingItemCount: 0 });
    const serialized = JSON.stringify(result);
    for (const forbidden of ["correctAnswer", "acceptedAnswers", "providerAudit", "SECRET", "scoringSpec", "prompt", "autoResult"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
