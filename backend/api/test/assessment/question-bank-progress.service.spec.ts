import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";
import {
  deriveQuestionBankProgress,
  QuestionBankProgressService,
  type QuestionBankProgressSession,
} from "../../src/modules/assessment/question-bank-progress.service.js";

const SCHOOL_ID = "school-progress";
const STUDENT_ID = "student-progress";
const LEVEL_ONE = "practice-level-one";
const LEVEL_TWO = "practice-level-two";
const BASELINE = new Date("2026-08-01T10:00:00.000Z");
const FOLLOW_UP = new Date("2026-08-10T10:00:00.000Z");

function auth(userId = STUDENT_ID): AuthContext {
  return {
    requestId: "progress-test",
    tenant: { schoolId: SCHOOL_ID },
    principal: { userId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
  };
}

function score(percentage: number) {
  return { earnedPoints: percentage, maxPoints: 100, percentage, proficiency: percentage >= 85 ? "STRONG" : percentage >= 70 ? "DEVELOPING" : "PRIORITY" };
}

function diagnosis(domainPercentages: number[], familyPercentages: number[], level = "水平一级") {
  const domains = ["LISTEN", "SPEAK", "READ", "WRITE"].map((domain, index) => ({
    ...score(domainPercentages[index] ?? 80),
    domain,
    displayName: ({ LISTEN: "听", SPEAK: "说", READ: "读", WRITE: "写" } as Record<string, string>)[domain],
    itemCount: 1,
    lostPoints: 0,
  }));
  const familyDefinitions = [
    ["LISTEN_IMAGE_CHOICE", "听音选图", "LISTEN", "听"],
    ["DICTATION", "听写句子", "LISTEN", "听"],
    ["READ_ALOUD", "朗读句子", "SPEAK", "说"],
    ["PICTURE_SPEAKING", "看图说话", "SPEAK", "说"],
    ["WORD_RECOGNITION", "单词认读", "READ", "读"],
    ["SENTENCE_COMPREHENSION", "句子理解", "READ", "读"],
    ["PICTURE_WORD", "看图写词", "WRITE", "写"],
    ["SENTENCE_COMPLETION", "句子补全", "WRITE", "写"],
  ];
  const families = familyDefinitions.map(([family, displayName, domain, domainDisplayName], index) => ({
    ...score(familyPercentages[index] ?? 80),
    family,
    displayName,
    domain,
    domainDisplayName,
    levels: [level],
    itemCount: 1,
    lostPoints: 0,
  }));
  return { version: "qb-diagnosis-v1", overall: score(80), domains, families, strengths: [], priorities: [], retryCandidates: [], nextSteps: [] };
}

function formal(input: {
  id: string;
  definitionId: string;
  versionId: string;
  completedAt: Date;
  overallScore: number;
  diagnosis?: ReturnType<typeof diagnosis>;
  items?: QuestionBankProgressSession["items"];
}): QuestionBankProgressSession {
  return {
    id: input.id,
    purpose: "STANDARD",
    status: "COMPLETED",
    completedAt: input.completedAt,
    createdAt: input.completedAt,
    practiceDefinitionId: input.definitionId,
    practiceVersionId: input.versionId,
    retestOfSessionId: null,
    report: { overallScore: input.overallScore, summary: { diagnosis: input.diagnosis ?? diagnosis([80, 80, 80, 80], Array(8).fill(80)) } },
    items: input.items ?? [],
  };
}

function remediation(id: string, sourceSessionId: string, createdAt: Date, values: number[], versions = ["qv-1", "qv-2", "qv-3", "qv-4"], maxScore = 4): QuestionBankProgressSession {
  return {
    id,
    purpose: "REMEDIATION",
    status: "COMPLETED",
    completedAt: new Date(createdAt.getTime() + 3_000),
    createdAt,
    practiceDefinitionId: LEVEL_ONE,
    practiceVersionId: "practice-version-2",
    retestOfSessionId: sourceSessionId,
    report: null,
    items: versions.map((questionVersionId, index) => ({ questionVersionId, maxScore, scoredScore: values[index] ?? 0 })),
  };
}

function fixtures() {
  const sourceItems = [1, 1, 1, 3].map((scoredScore, index) => ({ questionVersionId: `qv-${index + 1}`, maxScore: 4, scoredScore }));
  const baseline = formal({ id: "l1-baseline", definitionId: LEVEL_ONE, versionId: "practice-version-1", completedAt: BASELINE, overallScore: 84, items: sourceItems });
  const followUp = formal({
    id: "l1-follow-up",
    definitionId: LEVEL_ONE,
    versionId: "practice-version-2",
    completedAt: FOLLOW_UP,
    overallScore: 91,
    diagnosis: diagnosis([92, 80, 90, 100], [95, 90, 80, 80, 95, 85, 100, 100]),
  });
  const levelTwo = formal({ id: "l2-baseline", definitionId: LEVEL_TWO, versionId: "practice-v1-level-two", completedAt: new Date("2026-08-14T10:00:00.000Z"), overallScore: 78, diagnosis: diagnosis([78, 78, 78, 78], Array(8).fill(78), "水平二级") });
  return {
    baseline,
    followUp,
    levelTwo,
    firstRound: remediation("remediation-first", baseline.id, new Date("2026-08-02T10:00:00.000Z"), [4, 3, 1, 2]),
    secondRound: remediation("remediation-second", baseline.id, new Date("2026-08-03T10:00:00.000Z"), [4, 4, 2, 3]),
  };
}

const definitions = [
  { id: LEVEL_ONE, title: "国家通用语言文字能力｜水平一级综合测评", difficulty: "水平一级" },
  { id: LEVEL_TWO, title: "国家通用语言文字能力｜水平二级综合测评", difficulty: "水平二级" },
];

describe("Question Bank learning progress", () => {
  it("keeps formal trends within one practice definition and reuses persisted diagnosis percentages", () => {
    const data = fixtures();
    const result = deriveQuestionBankProgress([data.baseline, data.firstRound, data.followUp, data.levelTwo], definitions);

    expect(result.version).toBe("qb-progress-v1");
    expect(result.state).toBe("READY");
    expect(result.formalLevels).toHaveLength(2);
    const levelOne = result.formalLevels.find((entry) => entry.practiceDefinitionId === LEVEL_ONE)!;
    const levelTwo = result.formalLevels.find((entry) => entry.practiceDefinitionId === LEVEL_TWO)!;
    expect(levelOne).toMatchObject({ attemptCount: 2, firstScore: 84, latestScore: 91, bestScore: 91, latestVsPrevious: 7, firstVsLatest: 7, practiceVersionChanged: true, comparisonState: "COMPARABLE" });
    expect(levelTwo).toMatchObject({ attemptCount: 1, latestScore: 78, comparisonState: "BASELINE_ONLY", latestVsPrevious: null, firstVsLatest: null, practiceVersionChanged: false });
    expect(levelOne.domainTrend?.improvedDomains.map((entry) => entry.domain)).toContain("LISTEN");
    expect(levelOne.familyTrend?.improvedFamilies.map((entry) => entry.family)).toContain("LISTEN_IMAGE_CHOICE");
    expect(levelOne.familyTrend?.stableFamilies.map((entry) => entry.family)).toContain("PICTURE_SPEAKING");
    expect(JSON.stringify(result)).not.toContain("candidatePoints");
    expect(JSON.stringify(result)).not.toContain("scoringSpec");
  });

  it("compares remediation only by exact questionVersionId and supports deterministic rounds", () => {
    const data = fixtures();
    const sourceBefore = JSON.stringify(data.baseline.items);
    const result = deriveQuestionBankProgress([data.baseline, data.firstRound, data.secondRound, data.followUp, data.levelTwo], definitions);
    const remediationHistory = result.remediation[0]!;

    expect(remediationHistory.totalRounds).toBe(2);
    expect(remediationHistory.rounds.map((round) => round.sessionId)).toEqual(["remediation-first", "remediation-second"]);
    expect(remediationHistory.rounds[0]).toMatchObject({ itemCount: 4, masteredCount: 1, improvedCount: 1, unchangedCount: 1, lowerCount: 1, recoveredPoints: 5 });
    expect(remediationHistory.latestRound).toMatchObject({ round: 2, masteredCount: 2, improvedCount: 1, unchangedCount: 1, lowerCount: 0, recoveredPoints: 7 });
    expect(remediationHistory.latestRound.items.map((item) => item.state)).toEqual(["MASTERED", "MASTERED", "IMPROVED", "UNCHANGED"]);
    expect(remediationHistory.baselineLostPoints).toBe(10);
    expect(JSON.stringify(data.baseline.items)).toBe(sourceBefore);
    expect(JSON.stringify(result)).not.toMatch(/correctAnswer|referenceAnswer|acceptedAnswers|rubric|providerAudit|rawResponse|candidatePoints/);
  });

  it("fails closed when an exact remediation comparison is invalid", () => {
    const data = fixtures();
    const wrongVersion = remediation("wrong-version", data.baseline.id, new Date("2026-08-02T10:00:00.000Z"), [4, 3, 1, 2], ["qv-1", "qv-2", "qv-3", "not-in-source"]);
    const mismatchedMax = remediation("wrong-max", data.baseline.id, new Date("2026-08-02T10:00:00.000Z"), [4, 3, 1, 2], undefined, 5);
    expect(() => deriveQuestionBankProgress([data.baseline, wrongVersion], definitions)).toThrow(/精确匹配/);
    expect(() => deriveQuestionBankProgress([data.baseline, mismatchedMax], definitions)).toThrow(/满分不一致/);
  });

  it("excludes processing history and ignores any provider-shaped item data", () => {
    const data = fixtures();
    const processing = { ...data.followUp, id: "processing-formal", status: "PROCESSING" };
    (data.followUp.items as any).push({ questionVersionId: "provider-only", maxScore: 4, scoredScore: 4, autoResult: { candidatePoints: 999, rawResponse: "must-not-read" } });
    const result = deriveQuestionBankProgress([data.baseline, data.followUp, processing, data.firstRound], definitions);
    const levelOne = result.formalLevels.find((entry) => entry.practiceDefinitionId === LEVEL_ONE)!;
    expect(levelOne.attempts.map((attempt) => attempt.sessionId)).toEqual(["l1-baseline", "l1-follow-up"]);
    expect(levelOne.latestScore).toBe(91);
    expect(JSON.stringify(result)).not.toContain("provider-only");
    expect(JSON.stringify(result)).not.toContain("candidatePoints");
    expect(JSON.stringify(result)).not.toContain("rawResponse");
  });

  it("enforces student ownership and returns a stable EMPTY_STATE for a student with no Question Bank history", async () => {
    const prisma: any = {
      enrollment: { findFirst: vi.fn(async () => ({ id: "enrollment-progress" })) },
      assessmentSession: { findMany: vi.fn(async () => []) },
      practiceDefinition: { findMany: vi.fn(async () => []) },
    };
    const service = new QuestionBankProgressService(prisma);
    await expect(service.getForCurrentStudent(auth(), SCHOOL_ID)).resolves.toMatchObject({ state: "EMPTY_STATE", formalLevels: [], remediation: [] });
    await expect(service.getForCurrentStudent(auth(), "other-school")).rejects.toThrow(/无权访问/);
    expect(prisma.assessmentSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: SCHOOL_ID, enrollmentId: "enrollment-progress", status: "COMPLETED" }) }));
  });

  it("excludes legacy completed assessments that have neither a diagnosis nor a complete Question Bank snapshot", () => {
    const legacy: QuestionBankProgressSession = {
      id: "legacy-assessment",
      purpose: "STANDARD",
      status: "COMPLETED",
      completedAt: BASELINE,
      createdAt: BASELINE,
      practiceDefinitionId: "legacy-practice",
      practiceVersionId: "legacy-version",
      retestOfSessionId: null,
      report: { overallScore: 88, summary: {} },
      items: [{ questionVersionId: null, maxScore: 10, scoredScore: 8 }],
    };
    expect(deriveQuestionBankProgress([legacy], definitions)).toMatchObject({ state: "EMPTY_STATE", formalLevels: [], remediation: [] });
  });
});
