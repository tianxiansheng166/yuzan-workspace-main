import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AssessmentForbiddenException, QuestionBankProgressIntegrityException } from "./domain/assessment.errors.js";
import { isQuestionBankDiagnosis, type QuestionBankDiagnosis } from "./question-bank-diagnosis.js";

export const QUESTION_BANK_PROGRESS_VERSION = "qb-progress-v1";

type PersistedScore = {
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
};

type PersistedDomain = PersistedScore & {
  domain: string;
  displayName: string;
};

type PersistedFamily = PersistedScore & {
  family: string;
  displayName: string;
  domain: string;
  domainDisplayName: string;
  levels: string[];
};

export type QuestionBankProgressSession = {
  id: string;
  purpose: "STANDARD" | "REMEDIATION" | string;
  remediationOrigin?: "SELF_INITIATED" | "TEACHER_ASSIGNED" | string | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  practiceDefinitionId: string | null;
  practiceVersionId: string | null;
  retestOfSessionId: string | null;
  report: { overallScore: number | null; summary: unknown } | null;
  items: Array<{
    questionVersionId: string | null;
    maxScore: number | null;
    scoredScore: number | null;
  }>;
};

export type QuestionBankProgressDefinition = {
  id: string;
  title: string;
  difficulty: string;
};

type FormalAttempt = {
  sessionId: string;
  completedAt: Date;
  practiceDefinitionId: string;
  practiceVersionId: string;
  overallScore: number;
  diagnosis: QuestionBankDiagnosis;
  items: QuestionBankProgressSession["items"];
};

type ComparisonEntry = {
  currentPercentage: number;
  previousPercentage: number;
  deltaPercentagePoints: number;
};

type DomainComparison = ComparisonEntry & {
  domain: string;
  displayName: string;
};

type FamilyComparison = ComparisonEntry & {
  family: string;
  displayName: string;
  domain: string;
  domainDisplayName: string;
};

type RemediationRound = {
  round: number;
  sessionId: string;
  createdAt: string;
  completedAt: string | null;
  itemCount: number;
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
  masteredCount: number;
  improvedCount: number;
  unchangedCount: number;
  lowerCount: number;
  recoveredPoints: number;
  origin: "SELF_INITIATED" | "TEACHER_ASSIGNED";
  items: Array<{
    questionVersionId: string;
    sourceEarnedPoints: number;
    earnedPoints: number;
    maxPoints: number;
    state: "MASTERED" | "IMPROVED" | "UNCHANGED" | "LOWER";
  }>;
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stableDateCompare(left: { completedAt: Date; sessionId: string }, right: { completedAt: Date; sessionId: string }) {
  return left.completedAt.getTime() - right.completedAt.getTime() || left.sessionId.localeCompare(right.sessionId);
}

function stableCreatedCompare(left: { createdAt: Date; id: string }, right: { createdAt: Date; id: string }) {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

function requiredText(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new QuestionBankProgressIntegrityException(message);
  return value;
}

function requiredPercentage(value: unknown, message: string) {
  if (!isFiniteScore(value) || value < 0 || value > 100) throw new QuestionBankProgressIntegrityException(message);
  return round(value);
}

function validatedPersistedScore(value: unknown, message: string): PersistedScore {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new QuestionBankProgressIntegrityException(message);
  const entry = value as Record<string, unknown>;
  if (!isFiniteScore(entry.earnedPoints) || !isFiniteScore(entry.maxPoints) || entry.maxPoints <= 0 || entry.earnedPoints < 0 || entry.earnedPoints > entry.maxPoints) {
    throw new QuestionBankProgressIntegrityException(message);
  }
  return {
    earnedPoints: round(entry.earnedPoints),
    maxPoints: round(entry.maxPoints),
    percentage: requiredPercentage(entry.percentage, message),
  };
}

function validatedDiagnosis(value: unknown) {
  if (!isQuestionBankDiagnosis(value)) throw new QuestionBankProgressIntegrityException("正式题库测评缺少已保存的 qb-diagnosis-v1 诊断");
  const diagnosis = value as QuestionBankDiagnosis;
  const domains: PersistedDomain[] = diagnosis.domains.map((entry) => ({
    ...validatedPersistedScore(entry, "正式题库诊断领域数据无效"),
    domain: requiredText(entry?.domain, "正式题库诊断领域数据无效"),
    displayName: requiredText(entry?.displayName, "正式题库诊断领域数据无效"),
  }));
  const families: PersistedFamily[] = diagnosis.families.map((entry) => ({
    ...validatedPersistedScore(entry, "正式题库诊断题型数据无效"),
    family: requiredText(entry?.family, "正式题库诊断题型数据无效"),
    displayName: requiredText(entry?.displayName, "正式题库诊断题型数据无效"),
    domain: requiredText(entry?.domain, "正式题库诊断题型数据无效"),
    domainDisplayName: requiredText(entry?.domainDisplayName, "正式题库诊断题型数据无效"),
    levels: Array.isArray(entry?.levels) ? entry.levels.filter((level): level is string => typeof level === "string" && Boolean(level.trim())) : [],
  }));
  if (!domains.length || !families.length) throw new QuestionBankProgressIntegrityException("正式题库诊断缺少能力领域或题型数据");
  return { diagnosis, domains, families };
}

function diagnosisFromSummary(summary: unknown) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  return (summary as Record<string, unknown>).diagnosis ?? null;
}

function comparisonBuckets<T extends { currentPercentage: number; previousPercentage: number; deltaPercentagePoints: number }>(entries: T[]) {
  const ordered = [...entries].sort((left, right) =>
    right.deltaPercentagePoints - left.deltaPercentagePoints || String((left as any).domain ?? (left as any).family).localeCompare(String((right as any).domain ?? (right as any).family)),
  );
  return {
    improved: ordered.filter((entry) => entry.deltaPercentagePoints > 0),
    stable: ordered.filter((entry) => entry.deltaPercentagePoints === 0),
    needsAttention: ordered.filter((entry) => entry.deltaPercentagePoints < 0),
  };
}

function compareDomains(current: PersistedDomain[], previous: PersistedDomain[]) {
  const before = new Map(previous.map((entry) => [entry.domain, entry]));
  const entries: DomainComparison[] = current.flatMap((entry) => {
    const prior = before.get(entry.domain);
    if (!prior) return [];
    return [{
      domain: entry.domain,
      displayName: entry.displayName,
      currentPercentage: entry.percentage,
      previousPercentage: prior.percentage,
      deltaPercentagePoints: round(entry.percentage - prior.percentage),
    }];
  });
  const buckets = comparisonBuckets(entries);
  return { improvedDomains: buckets.improved, stableDomains: buckets.stable, needsAttentionDomains: buckets.needsAttention };
}

function compareFamilies(current: PersistedFamily[], previous: PersistedFamily[]) {
  const before = new Map(previous.map((entry) => [entry.family, entry]));
  const entries: FamilyComparison[] = current.flatMap((entry) => {
    const prior = before.get(entry.family);
    if (!prior) return [];
    return [{
      family: entry.family,
      displayName: entry.displayName,
      domain: entry.domain,
      domainDisplayName: entry.domainDisplayName,
      currentPercentage: entry.percentage,
      previousPercentage: prior.percentage,
      deltaPercentagePoints: round(entry.percentage - prior.percentage),
    }];
  });
  const buckets = comparisonBuckets(entries);
  return { improvedFamilies: buckets.improved, stableFamilies: buckets.stable, needsAttentionFamilies: buckets.needsAttention };
}

function levelFor(attempt: FormalAttempt, definitions: Map<string, QuestionBankProgressDefinition>) {
  const definition = definitions.get(attempt.practiceDefinitionId);
  if (definition?.difficulty) return definition.difficulty;
  const levels = [...new Set(attempt.diagnosis.families.flatMap((family) => family.levels))];
  return levels.length === 1 ? levels[0]! : definition?.title || "未标注等级";
}

function validItemScore(item: { maxScore: number | null; scoredScore: number | null }, message: string) {
  if (!isFiniteScore(item.maxScore) || item.maxScore <= 0 || !isFiniteScore(item.scoredScore) || item.scoredScore < 0 || item.scoredScore > item.maxScore) {
    throw new QuestionBankProgressIntegrityException(message);
  }
  return { maxScore: round(item.maxScore), scoredScore: round(item.scoredScore) };
}

function remediationRound(session: QuestionBankProgressSession, source: FormalAttempt, roundNumber: number): RemediationRound {
  if (!session.retestOfSessionId || session.retestOfSessionId !== source.sessionId) throw new QuestionBankProgressIntegrityException("专项巩固的正式测评来源无效");
  const sourceByVersion = new Map<string, Array<{ maxScore: number | null; scoredScore: number | null }>>();
  for (const item of source.items) {
    if (!item.questionVersionId) continue;
    const entries = sourceByVersion.get(item.questionVersionId) ?? [];
    entries.push(item);
    sourceByVersion.set(item.questionVersionId, entries);
  }

  const items = session.items.map((item) => {
    if (!item.questionVersionId) throw new QuestionBankProgressIntegrityException("专项巩固题目缺少 questionVersionId");
    const sourceItems = sourceByVersion.get(item.questionVersionId);
    if (!sourceItems || sourceItems.length !== 1) throw new QuestionBankProgressIntegrityException("专项巩固题目无法与原测评题目精确匹配");
    const sourceScore = validItemScore(sourceItems[0]!, "原测评题目正式分数无效");
    const remediationScore = validItemScore(item, "专项巩固题目正式分数无效");
    if (sourceScore.maxScore !== remediationScore.maxScore) {
      throw new QuestionBankProgressIntegrityException("专项巩固题目与原测评题目的满分不一致");
    }
    if (sourceScore.scoredScore >= sourceScore.maxScore) {
      throw new QuestionBankProgressIntegrityException("原测评满分题目不应进入专项巩固");
    }
    const state = remediationScore.scoredScore === remediationScore.maxScore
      ? "MASTERED"
      : remediationScore.scoredScore > sourceScore.scoredScore
        ? "IMPROVED"
        : remediationScore.scoredScore === sourceScore.scoredScore
          ? "UNCHANGED"
          : "LOWER";
    return {
      questionVersionId: item.questionVersionId,
      sourceEarnedPoints: sourceScore.scoredScore,
      earnedPoints: remediationScore.scoredScore,
      maxPoints: remediationScore.maxScore,
      state,
    } as const;
  });
  if (!items.length) throw new QuestionBankProgressIntegrityException("专项巩固练习不包含可比较的题目");
  const earnedPoints = round(items.reduce((total, item) => total + item.earnedPoints, 0));
  const maxPoints = round(items.reduce((total, item) => total + item.maxPoints, 0));
  return {
    round: roundNumber,
    sessionId: session.id,
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    itemCount: items.length,
    earnedPoints,
    maxPoints,
    percentage: round((earnedPoints / maxPoints) * 100),
    masteredCount: items.filter((item) => item.state === "MASTERED").length,
    improvedCount: items.filter((item) => item.state === "IMPROVED").length,
    unchangedCount: items.filter((item) => item.state === "UNCHANGED").length,
    lowerCount: items.filter((item) => item.state === "LOWER").length,
    recoveredPoints: round(items.reduce((total, item) => total + Math.max(0, item.earnedPoints - item.sourceEarnedPoints), 0)),
    origin: session.remediationOrigin === "TEACHER_ASSIGNED" ? "TEACHER_ASSIGNED" : "SELF_INITIATED",
    items,
  };
}

/**
 * Deterministically derives the student-safe QB-012 view from immutable rows.
 * It intentionally accepts only persisted diagnosis values for formal trends
 * and only formal AssessmentItem scores for exact remediation comparisons.
 */
export function deriveQuestionBankProgress(
  sessions: QuestionBankProgressSession[],
  definitions: QuestionBankProgressDefinition[] = [],
) {
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const formalAttempts: FormalAttempt[] = [];

  for (const session of sessions) {
    if (session.status !== "COMPLETED" || session.purpose !== "STANDARD") continue;
    const diagnosisValue = diagnosisFromSummary(session.report?.summary);
    const hasQuestionBankSnapshot = Boolean(
      session.practiceDefinitionId &&
      session.practiceVersionId &&
      session.items.length === 20 &&
      session.items.every((item) => item.questionVersionId),
    );
    const looksLikeQuestionBank = Boolean(diagnosisValue || hasQuestionBankSnapshot);
    if (!looksLikeQuestionBank) continue;
    if (!session.report || !session.practiceDefinitionId || !session.practiceVersionId || !session.completedAt || !isFiniteScore(session.report.overallScore)) {
      throw new QuestionBankProgressIntegrityException("正式题库测评缺少完成时间、练习版本或正式报告");
    }
    const validated = validatedDiagnosis(diagnosisValue);
    formalAttempts.push({
      sessionId: session.id,
      completedAt: session.completedAt,
      practiceDefinitionId: session.practiceDefinitionId,
      practiceVersionId: session.practiceVersionId,
      overallScore: round(session.report.overallScore),
      diagnosis: { ...validated.diagnosis, domains: validated.domains as any, families: validated.families as any },
      items: session.items,
    });
  }

  const formalBySessionId = new Map(formalAttempts.map((attempt) => [attempt.sessionId, attempt]));
  const byDefinition = new Map<string, FormalAttempt[]>();
  for (const attempt of formalAttempts) {
    const group = byDefinition.get(attempt.practiceDefinitionId) ?? [];
    group.push(attempt);
    byDefinition.set(attempt.practiceDefinitionId, group);
  }

  const formalLevels = [...byDefinition.entries()].map(([practiceDefinitionId, attempts]) => {
    attempts.sort(stableDateCompare);
    const first = attempts[0]!;
    const latest = attempts.at(-1)!;
    const previous = attempts.length > 1 ? attempts.at(-2)! : null;
    const currentDiagnosis = validatedDiagnosis(latest.diagnosis);
    const previousDiagnosis = previous ? validatedDiagnosis(previous.diagnosis) : null;
    return {
      level: levelFor(latest, definitionMap),
      practiceDefinitionId,
      practiceVersionId: latest.practiceVersionId,
      attemptCount: attempts.length,
      firstScore: first.overallScore,
      latestScore: latest.overallScore,
      bestScore: Math.max(...attempts.map((attempt) => attempt.overallScore)),
      latestVsPrevious: previous ? round(latest.overallScore - previous.overallScore) : null,
      firstVsLatest: attempts.length > 1 ? round(latest.overallScore - first.overallScore) : null,
      latestCompletedAt: latest.completedAt.toISOString(),
      comparisonState: previous ? "COMPARABLE" : "BASELINE_ONLY",
      practiceVersionChanged: Boolean(previous && previous.practiceVersionId !== latest.practiceVersionId),
      attempts: attempts.map((attempt) => ({
        sessionId: attempt.sessionId,
        overallScore: attempt.overallScore,
        practiceVersionId: attempt.practiceVersionId,
        completedAt: attempt.completedAt.toISOString(),
      })),
      domainTrend: previousDiagnosis ? compareDomains(currentDiagnosis.domains, previousDiagnosis.domains) : null,
      familyTrend: previousDiagnosis ? compareFamilies(currentDiagnosis.families, previousDiagnosis.families) : null,
    };
  }).sort((left, right) => left.latestCompletedAt.localeCompare(right.latestCompletedAt) || left.practiceDefinitionId.localeCompare(right.practiceDefinitionId));

  const remediationBySource = new Map<string, QuestionBankProgressSession[]>();
  for (const session of sessions) {
    if (session.status !== "COMPLETED" || session.purpose !== "REMEDIATION") continue;
    if (!session.retestOfSessionId) throw new QuestionBankProgressIntegrityException("专项巩固缺少正式测评来源");
    if (!formalBySessionId.has(session.retestOfSessionId)) {
      throw new QuestionBankProgressIntegrityException("专项巩固找不到可验证的正式题库测评来源");
    }
    const group = remediationBySource.get(session.retestOfSessionId) ?? [];
    group.push(session);
    remediationBySource.set(session.retestOfSessionId, group);
  }

  const remediation = [...remediationBySource.entries()].map(([sourceSessionId, attempts]) => {
    const source = formalBySessionId.get(sourceSessionId)!;
    attempts.sort(stableCreatedCompare);
    const rounds = attempts.map((attempt, index) => remediationRound(attempt, source, index + 1));
    const latestRound = rounds.at(-1)!;
    const bestRound = [...rounds].sort((left, right) => right.percentage - left.percentage || right.earnedPoints - left.earnedPoints || left.round - right.round)[0]!;
    const baselineLostPoints = round(latestRound.items.reduce((total, item) => total + (item.maxPoints - item.sourceEarnedPoints), 0));
    return {
      sourceSessionId,
      level: levelFor(source, definitionMap),
      practiceDefinitionId: source.practiceDefinitionId,
      totalRounds: rounds.length,
      latestRound,
      bestRound,
      baselineLostPoints,
      latestRecoveredPoints: latestRound.recoveredPoints,
      rounds,
    };
  }).sort((left, right) => left.latestRound.createdAt.localeCompare(right.latestRound.createdAt) || left.sourceSessionId.localeCompare(right.sourceSessionId));

  const milestones: Array<{ kind: "FORMAL_ASSESSMENT" | "REMEDIATION"; occurredAt: string; level: string; sessionId: string; sourceSessionId?: string; label: string }> = [];
  for (const level of formalLevels) {
    const first = level.attempts[0]!;
    milestones.push({ kind: "FORMAL_ASSESSMENT", occurredAt: first.completedAt, level: level.level, sessionId: first.sessionId, label: `完成${level.level}测评` });
  }
  for (const entry of remediation) {
    for (const round of entry.rounds) {
      milestones.push({ kind: "REMEDIATION", occurredAt: round.completedAt ?? round.createdAt, level: entry.level, sessionId: round.sessionId, sourceSessionId: entry.sourceSessionId, label: `完成${entry.level}专项巩固（第 ${round.round} 轮）` });
    }
  }
  milestones.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.sessionId.localeCompare(right.sessionId));

  const mostRecentFormal = [...formalLevels].sort((left, right) => right.latestCompletedAt.localeCompare(left.latestCompletedAt) || right.practiceDefinitionId.localeCompare(left.practiceDefinitionId))[0] ?? null;
  const mostRecentRound = remediation.flatMap((entry) => entry.rounds.map((round) => ({ entry, round }))).sort((left, right) => right.round.createdAt.localeCompare(left.round.createdAt) || right.round.sessionId.localeCompare(left.round.sessionId))[0] ?? null;
  return {
    version: QUESTION_BANK_PROGRESS_VERSION,
    state: formalLevels.length || remediation.length ? "READY" : "EMPTY_STATE",
    formalLevels,
    remediation,
    milestones,
    latest: mostRecentFormal ? {
      level: mostRecentFormal.level,
      formal: {
        sessionId: mostRecentFormal.attempts.at(-1)!.sessionId,
        overallScore: mostRecentFormal.latestScore,
        completedAt: mostRecentFormal.latestCompletedAt,
        comparisonState: mostRecentFormal.comparisonState,
        latestVsPrevious: mostRecentFormal.latestVsPrevious,
      },
      remediation: mostRecentRound ? {
        sourceSessionId: mostRecentRound.entry.sourceSessionId,
        sessionId: mostRecentRound.round.sessionId,
        round: mostRecentRound.round.round,
        itemCount: mostRecentRound.round.itemCount,
        masteredCount: mostRecentRound.round.masteredCount,
        recoveredPoints: mostRecentRound.round.recoveredPoints,
      } : null,
    } : null,
  };
}

@Injectable()
export class QuestionBankProgressService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getForCurrentStudent(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || auth.principal.membershipStatus !== "ACTIVE" || !auth.principal.roles.includes(MembershipRole.STUDENT)) {
      throw new AssessmentForbiddenException();
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { schoolId, userId: auth.principal.userId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) throw new AssessmentForbiddenException("当前用户没有有效的学生班级关系");

    const sessions = await this.prisma.assessmentSession.findMany({
      where: {
        schoolId,
        enrollmentId: enrollment.id,
        status: "COMPLETED",
        purpose: { in: ["STANDARD", "REMEDIATION"] },
      },
      select: {
        id: true,
        purpose: true,
        remediationOrigin: true,
        status: true,
        completedAt: true,
        createdAt: true,
        practiceDefinitionId: true,
        practiceVersionId: true,
        retestOfSessionId: true,
        report: { select: { overallScore: true, summary: true } },
        items: { select: { questionVersionId: true, maxScore: true, scoredScore: true } },
      },
    });
    const definitionIds = [...new Set(sessions.map((session) => session.practiceDefinitionId).filter((id): id is string => Boolean(id)))];
    const definitions = definitionIds.length
      ? await this.prisma.practiceDefinition.findMany({ where: { id: { in: definitionIds } }, select: { id: true, title: true, difficulty: true } })
      : [];
    return deriveQuestionBankProgress(sessions as unknown as QuestionBankProgressSession[], definitions);
  }
}
