import { describe, expect, it, vi } from "vitest";
import { TeacherQuestionBankDiagnosticService } from "../../src/modules/assessment/teacher-question-bank-diagnostic.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import {
  MembershipStatus,
  type AuthContext,
} from "../../src/common/security/auth.types.js";

const SCHOOL_ID = "school-dashboard";
const CLASS_ID = "class-dashboard";
const OTHER_CLASS_ID = "class-other";
const PRACTICE_ID = "practice-level-one";
const VERSION_ONE = "practice-version-one";
const VERSION_TWO = "practice-version-two";

function auth(roles: MembershipRole[] = [MembershipRole.TEACHER]): AuthContext {
  return {
    requestId: "diagnostic-test",
    tenant: { schoolId: SCHOOL_ID },
    principal: {
      userId: "teacher-1",
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    },
  };
}

function score(percentage: number) {
  return {
    earnedPoints: percentage,
    maxPoints: 100,
    percentage,
    proficiency:
      percentage < 70 ? "PRIORITY" : percentage >= 85 ? "STRONG" : "DEVELOPING",
  };
}

function diagnosis(
  overall: number,
  domainValues = [80, 70, 90, 60],
  familyValues = [80, 70, 60, 50, 90, 80, 60, 70],
) {
  const domains = [
    ["LISTEN", "听"],
    ["SPEAK", "说"],
    ["READ", "读"],
    ["WRITE", "写"],
  ].map(([domain, displayName], index) => ({
    ...score(domainValues[index]!),
    domain,
    displayName,
    itemCount: 1,
    lostPoints: 0,
  }));
  const families = [
    ["LISTEN_IMAGE_CHOICE", "听音选图", "LISTEN", "听"],
    ["DICTATION", "听写句子", "LISTEN", "听"],
    ["READ_ALOUD", "朗读句子", "SPEAK", "说"],
    ["PICTURE_SPEAKING", "看图说话", "SPEAK", "说"],
    ["WORD_RECOGNITION", "单词认读", "READ", "读"],
    ["SENTENCE_COMPREHENSION", "句子理解", "READ", "读"],
    ["PICTURE_WORD", "看图写词", "WRITE", "写"],
    ["SENTENCE_COMPLETION", "句子补全", "WRITE", "写"],
  ].map(([family, displayName, domain, domainDisplayName], index) => ({
    ...score(familyValues[index]!),
    family,
    displayName,
    domain,
    domainDisplayName,
    levels: ["水平一级"],
    itemCount: 1,
    lostPoints: 0,
  }));
  const priorities = families
    .filter((entry) => entry.percentage < 70)
    .slice(0, 3);
  return {
    version: "qb-diagnosis-v1",
    overall: score(overall),
    domains,
    families,
    strengths: families.filter((entry) => entry.percentage >= 85).slice(0, 2),
    priorities,
    retryCandidates: [],
    nextSteps: [],
  };
}

function formal(
  id: string,
  enrollmentId: string,
  overallScore: number,
  completedAt: string,
  versionId = VERSION_ONE,
  items: any[] = [],
) {
  return {
    id,
    enrollmentId,
    purpose: "STANDARD",
    status: "COMPLETED",
    completedAt: new Date(completedAt),
    createdAt: new Date(completedAt),
    practiceDefinitionId: PRACTICE_ID,
    practiceVersionId: versionId,
    retestOfSessionId: null,
    report: { overallScore, summary: { diagnosis: diagnosis(overallScore) } },
    items,
  };
}

function harness() {
  const students = [
    "student-a",
    "student-b",
    "student-c",
    "student-d",
    "student-e",
  ].map((id, index) => ({
    id,
    user: { displayName: `学生${String.fromCharCode(65 + index)}` },
  }));
  const sourceItems = [1, 1, 2, 3].map((scoredScore, index) => ({
    questionVersionId: `question-version-${index}`,
    maxScore: 4,
    scoredScore,
  }));
  const sessions = [
    formal(
      "a-baseline",
      "student-a",
      84,
      "2026-08-01T08:00:00.000Z",
      VERSION_ONE,
      sourceItems,
    ),
    formal(
      "a-follow-up",
      "student-a",
      91,
      "2026-08-10T08:00:00.000Z",
      VERSION_TWO,
    ),
    formal("b-baseline", "student-b", 80, "2026-08-03T08:00:00.000Z"),
    formal("c-baseline", "student-c", 72, "2026-08-04T08:00:00.000Z"),
    {
      id: "a-remediation",
      enrollmentId: "student-a",
      purpose: "REMEDIATION",
      status: "COMPLETED",
      completedAt: new Date("2026-08-05T08:00:00.000Z"),
      createdAt: new Date("2026-08-05T08:00:00.000Z"),
      practiceDefinitionId: PRACTICE_ID,
      practiceVersionId: VERSION_ONE,
      retestOfSessionId: "a-baseline",
      report: null,
      items: sourceItems.map((item, index) => ({
        ...item,
        scoredScore: [4, 3, 3, 4][index],
      })),
    },
    {
      id: "d-processing",
      enrollmentId: "student-d",
      purpose: "STANDARD",
      status: "PROCESSING",
      completedAt: null,
      createdAt: new Date("2026-08-12T08:00:00.000Z"),
      practiceDefinitionId: PRACTICE_ID,
      practiceVersionId: VERSION_TWO,
      retestOfSessionId: null,
      report: null,
      items: [],
    },
  ];
  const publishedRefs = Array.from({ length: 20 }, (_, index) => ({
    questionVersionId: `published-question-${index}`,
    questionVersion: { status: "PUBLISHED" },
  }));
  const prisma: any = {
    class: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === CLASS_ID && where.schoolId === SCHOOL_ID
          ? { id: CLASS_ID, name: "一年级一班", grade: "一年级" }
          : null,
      ),
      findMany: vi.fn(async () => [
        { id: CLASS_ID, name: "一年级一班", grade: "一年级" },
      ]),
    },
    enrollment: {
      findMany: vi.fn(async () => students),
      groupBy: vi.fn(async () => [
        { classId: CLASS_ID, _count: { _all: students.length } },
      ]),
    },
    practiceDefinition: {
      findMany: vi.fn(async () => [
        {
          id: PRACTICE_ID,
          title: "国家通用语言文字能力｜水平一级综合测评",
          difficulty: "水平一级",
          versions: [{ id: VERSION_TWO, sections: [{ items: publishedRefs }] }],
        },
      ]),
    },
    assessmentSession: {
      findMany: vi.fn(async ({ where }: any) =>
        sessions.filter((entry) => {
          if (Array.isArray(where.enrollmentId?.in))
            return where.enrollmentId.in.includes(entry.enrollmentId);
          return (
            !where.enrollmentId || where.enrollmentId === entry.enrollmentId
          );
        }),
      ),
    },
    assessmentItem: {
      findMany: vi.fn(async () => [
        {
          session: { enrollmentId: "student-a" },
          questionVersion: { scoringSpec: { strategy: "SPEECH_READING" } },
        },
      ]),
    },
  };
  const reviewService: any = {
    authorizedClassIds: vi.fn(async () => [CLASS_ID]),
    assertAuthorizedClass: vi.fn(
      async (_auth: any, schoolId: string, classId: string) => {
        if (schoolId !== SCHOOL_ID || classId !== CLASS_ID)
          throw new Error("无权访问该测评");
      },
    ),
  };
  return {
    service: new TeacherQuestionBankDiagnosticService(prisma, reviewService),
    prisma,
    reviewService,
  };
}

describe("Teacher Question Bank diagnostic dashboard", () => {
  it("uses latest formal evidence per active student, keeps remediation separate, and derives deterministic class aggregates", async () => {
    const { service, prisma } = harness();
    const result = await service.getDashboard(
      auth(),
      SCHOOL_ID,
      CLASS_ID,
      PRACTICE_ID,
    );

    expect(result.summary).toMatchObject({
      eligibleStudents: 5,
      assessedStudents: 3,
      inProgressStudents: 1,
      notAssessedStudents: 1,
      coveragePercentage: 60,
      averageScore: 81,
      versionMixed: true,
    });
    expect(result.summary.averageScore).toBe((91 + 80 + 72) / 3);
    expect(result.students.map((entry) => entry.displayName)).toEqual([
      "学生A",
      "学生B",
      "学生C",
      "学生D",
      "学生E",
    ]);
    expect(
      result.students.find((entry) => entry.enrollmentId === "student-a"),
    ).toMatchObject({
      latestScore: 91,
      comparisonState: "COMPARABLE",
      latestVsPrevious: 7,
      state: "NEEDS_ATTENTION",
      remediationSummary: { completedRounds: 1, latestRoundItemCount: 4 },
    });
    expect(
      result.students.find((entry) => entry.enrollmentId === "student-d"),
    ).toMatchObject({ latestScore: null, state: "IN_PROGRESS" });
    expect(
      result.students.find((entry) => entry.enrollmentId === "student-e"),
    ).toMatchObject({ latestScore: null, state: "NOT_ASSESSED" });
    expect(result.domains).toHaveLength(4);
    expect(result.families).toHaveLength(8);
    expect(result.commonDifficulties).toHaveLength(3);
    expect(result.strengths).toHaveLength(2);
    expect(result.summary.pendingReviewItemCount).toBe(1);
    expect(result.summary.pendingReviewStudentCount).toBe(1);
    expect(prisma.assessmentSession.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(1);

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "rank",
      "position",
      "percentile",
      "classRank",
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
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("uses the shared review scope for own-class, cross-class, and cross-school authorization", async () => {
    const { service, reviewService } = harness();
    await expect(
      service.getDashboard(auth(), SCHOOL_ID, CLASS_ID, PRACTICE_ID),
    ).resolves.toBeTruthy();
    await expect(
      service.getDashboard(auth(), SCHOOL_ID, OTHER_CLASS_ID, PRACTICE_ID),
    ).rejects.toThrow(/无权/);
    await expect(
      service.getDashboard(auth(), "other-school", CLASS_ID, PRACTICE_ID),
    ).rejects.toThrow(/无权/);
    expect(reviewService.assertAuthorizedClass).toHaveBeenCalledWith(
      expect.anything(),
      SCHOOL_ID,
      CLASS_ID,
    );
  });

  it("returns active teacher classes only and allows the review-authorized administrator scope", async () => {
    const { service, reviewService } = harness();
    const teacherCatalog = await service.getCatalog(auth());
    expect(teacherCatalog.availableClasses).toEqual([
      {
        classId: CLASS_ID,
        className: "一年级一班",
        grade: "一年级",
        activeStudentCount: 5,
      },
    ]);
    reviewService.authorizedClassIds.mockResolvedValueOnce(null);
    const adminCatalog = await service.getCatalog(
      auth([MembershipRole.SCHOOL_ADMIN]),
    );
    expect(adminCatalog.availableClasses).toHaveLength(1);
  });

  it("keeps the teacher detail class-scoped and projects only safe persisted aggregates", async () => {
    const { service } = harness();
    const detail = await service.getStudentDetail(
      auth(),
      SCHOOL_ID,
      CLASS_ID,
      "student-a",
      PRACTICE_ID,
    );
    expect(detail).toMatchObject({ latestScore: 91, latestVsPrevious: 7 });
    expect(detail.formalHistory).toHaveLength(2);
    expect(detail.latestDiagnosis?.domains).toHaveLength(4);
    expect(detail.familyPriorities).not.toHaveLength(0);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(
      /correctAnswer|scoringSpec|rubric|candidatePoints|transcript/,
    );
  });
});
