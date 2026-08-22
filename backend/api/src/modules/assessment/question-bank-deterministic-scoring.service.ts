import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";

export const QUESTION_BANK_DETERMINISTIC_SCORER_VERSION = "qb-deterministic-v1" as const;

const CHOICE_KEYS = new Set(["A", "B", "C", "D"]);
const SPEECH_STRATEGIES = new Set(["SPEECH_READING", "SPEECH_OPEN_RESPONSE"]);

export type DeterministicScoringState = "AUTO_SCORED" | "NEEDS_REVIEW";

export interface DeterministicScoreResult {
  readonly state: DeterministicScoringState;
  readonly strategy: string;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly scorerVersion: typeof QUESTION_BANK_DETERMINISTIC_SCORER_VERSION;
  readonly reasonCode?: string;
  readonly metrics?: Record<string, number | boolean>;
}

export interface DeterministicScoreInput {
  readonly scoringSpec: unknown;
  readonly answer: unknown;
  readonly maxScore: unknown;
}

interface ScoringSpecRecord {
  readonly strategy?: unknown;
  readonly maxScore?: unknown;
  readonly referenceAnswer?: unknown;
  readonly acceptedAnswers?: unknown;
  readonly deductionRules?: unknown;
}

interface DictationRule {
  readonly characterPenalty: number;
  readonly zeroAtCharacterErrors: number;
  readonly orderPenalty: number;
  readonly orderNoDoubleDeductionAt: number | null;
}

interface AlignmentMetrics {
  readonly correct: number;
  readonly substitution: number;
  readonly deletion: number;
  readonly insertion: number;
}

interface AssessmentItemForScoring {
  readonly id: string;
  readonly maxScore: number | null;
  readonly scoredScore: number | null;
  readonly autoResult: unknown;
  readonly questionVersionId: string | null;
  readonly questionVersion: { status: string; scoringSpec: unknown } | null;
  readonly writtenAnswer: { content: unknown; finalSubmittedAt: Date | null } | null;
}

export interface QuestionBankScoringSummary {
  readonly totalItems: number;
  readonly autoScoredItems: number;
  readonly needsReviewItems: number;
  readonly skippedItems: number;
  readonly awardedPoints: number;
  readonly scoredMaxPoints: number;
  readonly totalMaxPoints: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asScoringSpec(value: unknown): ScoringSpecRecord | null {
  return isRecord(value) ? value as ScoringSpecRecord : null;
}

function finiteNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeStrategy(value: unknown): string {
  if (typeof value !== "string") return "UNSUPPORTED";
  if (["EXACT_CHOICE", "DICTATION_ALIGNMENT", "ACCEPTED_TEXT", "RUBRIC_TEXT", ...SPEECH_STRATEGIES].includes(value)) return value;
  return "UNSUPPORTED";
}

function safeResult(
  strategy: string,
  maxScore: number | null,
  state: DeterministicScoringState,
  score: number | null,
  reasonCode?: string,
  metrics?: Record<string, number | boolean>,
): DeterministicScoreResult {
  const result: DeterministicScoreResult = {
    state,
    strategy,
    score: state === "AUTO_SCORED" ? score : null,
    maxScore,
    scorerVersion: QUESTION_BANK_DETERMINISTIC_SCORER_VERSION,
    ...(reasonCode ? { reasonCode } : {}),
    ...(metrics ? { metrics } : {}),
  };
  return result;
}

function needsReview(
  strategy: string,
  maxScore: number | null,
  reasonCode: string,
  metrics?: Record<string, number | boolean>,
): DeterministicScoreResult {
  return safeResult(strategy, maxScore, "NEEDS_REVIEW", null, reasonCode, metrics);
}

function autoScore(
  strategy: string,
  maxScore: number,
  score: number,
  metrics?: Record<string, number | boolean>,
): DeterministicScoreResult {
  const bounded = Math.min(maxScore, Math.max(0, Number.isFinite(score) ? score : 0));
  return safeResult(strategy, maxScore, "AUTO_SCORED", bounded, undefined, metrics);
}

function answerValue(answer: unknown): unknown {
  if (isRecord(answer) && "content" in answer) return answerValue(answer.content);
  if (!isRecord(answer)) return answer;
  if ("value" in answer) return answer.value;
  if ("text" in answer) return answer.text;
  return "";
}

function answerText(answer: unknown): string {
  const value = answerValue(answer);
  return typeof value === "string" ? value : "";
}

function configuredMaxScore(spec: ScoringSpecRecord, maxScore: unknown): number | null {
  const itemMaxScore = finiteNonNegativeNumber(maxScore);
  const specMaxScore = finiteNonNegativeNumber(spec.maxScore);
  if (itemMaxScore === null || specMaxScore === null || itemMaxScore !== specMaxScore || itemMaxScore <= 0) return null;
  return itemMaxScore;
}

function normalizedChoice(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizedAcceptedText(value: string): string {
  return value.normalize("NFKC").trim();
}

function compileAcceptedAnswers(spec: ScoringSpecRecord): string[] | null {
  if ("acceptedAnswers" in spec) {
    if (!Array.isArray(spec.acceptedAnswers) || spec.acceptedAnswers.length === 0) return null;
    const answers = spec.acceptedAnswers.map((value) => typeof value === "string" ? normalizedAcceptedText(value) : "");
    return answers.every(Boolean) ? [...new Set(answers)] : null;
  }

  if (typeof spec.referenceAnswer !== "string") return null;
  const reference = normalizedAcceptedText(spec.referenceAnswer);
  if (!reference) return null;

  // The canonical PICTURE_WORD source explicitly stores alternatives with `/`.
  // Splitting that authored list preserves source authority; it does not add
  // synonyms, translations, or inferred answers.
  const alternatives = reference.split("/").map((value) => value.trim()).filter(Boolean);
  return alternatives.length ? [...new Set(alternatives)] : null;
}

function parsePenalty(value: string): number | null {
  const match = value.match(/扣\s*(\d+(?:\.\d+)?)\s*分/);
  if (!match) return null;
  const penalty = Number(match[1]);
  return Number.isFinite(penalty) && penalty >= 0 ? penalty : null;
}

function compileDictationRule(spec: ScoringSpecRecord): DictationRule | null {
  if (typeof spec.referenceAnswer !== "string" || !spec.referenceAnswer) return null;
  if (!Array.isArray(spec.deductionRules) || spec.deductionRules.some((rule) => typeof rule !== "string")) return null;

  const rules = spec.deductionRules as string[];
  const characterRule = rules.find((rule) => /扣\s*\d+(?:\.\d+)?\s*分\s*[\/／]\s*字/.test(rule));
  const zeroMatch = characterRule?.match(/错\s*(\d+)\s*个字[^。；;]*本题不得分/);
  const orderRule = rules.find((rule) => /语序/.test(rule) && /扣\s*\d+(?:\.\d+)?\s*分/.test(rule));
  if (!characterRule || !zeroMatch || !orderRule || rules.length !== 2) return null;

  const characterPenalty = parsePenalty(characterRule);
  const orderPenalty = parsePenalty(orderRule);
  const zeroAtCharacterErrors = Number(zeroMatch[1]);
  const noDoubleMatch = orderRule.match(/错别字已扣满\s*(\d+)\s*个/);
  if (
    characterPenalty === null ||
    orderPenalty === null ||
    !Number.isInteger(zeroAtCharacterErrors) ||
    zeroAtCharacterErrors <= 0
  ) return null;

  return {
    characterPenalty,
    zeroAtCharacterErrors,
    orderPenalty,
    orderNoDoubleDeductionAt: noDoubleMatch ? Number(noDoubleMatch[1]) : null,
  };
}

function graphemes(value: string): string[] {
  // Array.from iterates Unicode code points rather than UTF-16 code units.
  // This keeps alignment deterministic for non-BMP characters without
  // changing authored punctuation or whitespace.
  return Array.from(value);
}

function align(reference: string, answer: string): AlignmentMetrics {
  const expected = graphemes(reference);
  const actual = graphemes(answer);
  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) costs[row]![0] = row;
  for (let column = 0; column < columns; column += 1) costs[0]![column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = costs[row - 1]![column - 1]! + (expected[row - 1] === actual[column - 1] ? 0 : 1);
      const deletion = costs[row - 1]![column]! + 1;
      const insertion = costs[row]![column - 1]! + 1;
      costs[row]![column] = Math.min(substitution, deletion, insertion);
    }
  }

  let row = expected.length;
  let column = actual.length;
  let correct = 0;
  let substitution = 0;
  let deletion = 0;
  let insertion = 0;
  while (row > 0 || column > 0) {
    const current = costs[row]![column]!;
    if (
      row > 0 &&
      column > 0 &&
      current === costs[row - 1]![column - 1]! + (expected[row - 1] === actual[column - 1] ? 0 : 1)
    ) {
      if (expected[row - 1] === actual[column - 1]) correct += 1;
      else substitution += 1;
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0 && current === costs[row - 1]![column]! + 1) {
      deletion += 1;
      row -= 1;
      continue;
    }
    insertion += 1;
    column -= 1;
  }
  return { correct, substitution, deletion, insertion };
}

function sameCharacterMultiset(left: string, right: string): boolean {
  const counts = (value: string) => {
    const result = new Map<string, number>();
    for (const character of graphemes(value)) result.set(character, (result.get(character) ?? 0) + 1);
    return result;
  };
  const leftCounts = counts(left);
  const rightCounts = counts(right);
  if (leftCounts.size !== rightCounts.size) return false;
  for (const [character, count] of leftCounts) if (rightCounts.get(character) !== count) return false;
  return true;
}

function scoreExactChoice(spec: ScoringSpecRecord, answer: unknown, maxScore: number): DeterministicScoreResult {
  if (typeof spec.referenceAnswer !== "string") return needsReview("EXACT_CHOICE", maxScore, "SCORING_CONFIG_INVALID");
  const expected = spec.referenceAnswer.trim().toUpperCase();
  if (!CHOICE_KEYS.has(expected)) return needsReview("EXACT_CHOICE", maxScore, "SCORING_CONFIG_INVALID");
  const actual = normalizedChoice(answerValue(answer));
  const matched = actual === expected && CHOICE_KEYS.has(actual);
  return autoScore("EXACT_CHOICE", maxScore, matched ? maxScore : 0, { matched });
}

function scoreAcceptedText(spec: ScoringSpecRecord, answer: unknown, maxScore: number): DeterministicScoreResult {
  const acceptedAnswers = compileAcceptedAnswers(spec);
  if (!acceptedAnswers) return needsReview("ACCEPTED_TEXT", maxScore, "SCORING_CONFIG_INVALID");
  const actual = normalizedAcceptedText(answerText(answer));
  const matched = acceptedAnswers.includes(actual);
  return autoScore("ACCEPTED_TEXT", maxScore, matched ? maxScore : 0, { matched });
}

function scoreDictation(spec: ScoringSpecRecord, answer: unknown, maxScore: number): DeterministicScoreResult {
  const rule = compileDictationRule(spec);
  if (!rule) return needsReview("DICTATION_ALIGNMENT", maxScore, "SCORING_RULE_UNSUPPORTED");

  const reference = spec.referenceAnswer as string;
  const actual = answerText(answer);
  const alignment = align(reference, actual);
  const characterErrors = alignment.substitution + alignment.deletion + alignment.insertion;
  const orderError = actual !== reference && sameCharacterMultiset(reference, actual);

  // The authored rule names wrong and omitted characters, but does not name
  // extra characters. Do not silently assign a penalty to an unsupported
  // category; keep that response reviewable instead of inventing a rule.
  if (alignment.insertion > 0) {
    return needsReview("DICTATION_ALIGNMENT", maxScore, "SCORING_RULE_UNSUPPORTED", {
      characterErrors,
      correct: alignment.correct,
      substitution: alignment.substitution,
      deletion: alignment.deletion,
      insertion: alignment.insertion,
      orderError,
    });
  }

  const characterScore = characterErrors >= rule.zeroAtCharacterErrors
    ? 0
    : maxScore - characterErrors * rule.characterPenalty;
  const orderDeduction = orderError && (rule.orderNoDoubleDeductionAt === null || characterErrors < rule.orderNoDoubleDeductionAt)
    ? rule.orderPenalty
    : 0;
  const score = Math.min(maxScore, Math.max(0, characterScore - orderDeduction));
  return autoScore("DICTATION_ALIGNMENT", maxScore, score, {
    characterErrors,
    correct: alignment.correct,
    substitution: alignment.substitution,
    deletion: alignment.deletion,
    insertion: alignment.insertion,
    orderError,
  });
}

export function scoreQuestionBankResponse(input: DeterministicScoreInput): DeterministicScoreResult {
  const spec = asScoringSpec(input.scoringSpec);
  const strategy = safeStrategy(spec?.strategy);
  const maxScore = spec ? configuredMaxScore(spec, input.maxScore) : finiteNonNegativeNumber(input.maxScore);
  if (!spec || maxScore === null) return needsReview(strategy, maxScore, "SCORING_CONFIG_INVALID");

  switch (strategy) {
    case "EXACT_CHOICE":
      return scoreExactChoice(spec, input.answer, maxScore);
    case "ACCEPTED_TEXT":
      return scoreAcceptedText(spec, input.answer, maxScore);
    case "DICTATION_ALIGNMENT":
      return scoreDictation(spec, input.answer, maxScore);
    case "RUBRIC_TEXT":
      return needsReview(strategy, maxScore, "RUBRIC_REVIEW_REQUIRED");
    case "SPEECH_READING":
    case "SPEECH_OPEN_RESPONSE":
      return needsReview(strategy, maxScore, "SPEECH_SCORING_OUT_OF_SCOPE");
    default:
      return needsReview(strategy, maxScore, "SCORING_RULE_UNSUPPORTED");
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

@Injectable()
export class QuestionBankDeterministicScoringService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  score(input: DeterministicScoreInput): DeterministicScoreResult {
    return scoreQuestionBankResponse(input);
  }

  async scoreSession(sessionId: string): Promise<QuestionBankScoringSummary> {
    const rows = await this.prisma.assessmentItem.findMany({
      where: { sessionId, questionVersionId: { not: null } },
      select: {
        id: true,
        questionVersionId: true,
        maxScore: true,
        scoredScore: true,
        autoResult: true,
        questionVersion: { select: { status: true, scoringSpec: true } },
        writtenAnswer: { select: { content: true, finalSubmittedAt: true } },
      },
      orderBy: { sortOrder: "asc" },
    }) as AssessmentItemForScoring[];

    let autoScoredItems = 0;
    let needsReviewItems = 0;
    let skippedItems = 0;
    let awardedPoints = 0;
    let scoredMaxPoints = 0;
    let totalMaxPoints = 0;

    for (const item of rows) {
      const spec = asScoringSpec(item.questionVersion?.scoringSpec);
      const strategy = safeStrategy(spec?.strategy);
      const itemMaxScore = finiteNonNegativeNumber(item.maxScore);
      if (itemMaxScore !== null) totalMaxPoints += itemMaxScore;

      // Speech is owned by the existing speech-job pipeline. In particular,
      // never replace its autoResult or score with a deterministic placeholder.
      if (SPEECH_STRATEGIES.has(strategy)) {
        skippedItems += 1;
        continue;
      }
      if (!item.writtenAnswer?.finalSubmittedAt) {
        skippedItems += 1;
        continue;
      }

      const result = item.questionVersion?.status === "PUBLISHED"
        ? this.score({
          scoringSpec: item.questionVersion.scoringSpec,
          answer: item.writtenAnswer.content,
          maxScore: item.maxScore,
        })
        : needsReview(strategy, itemMaxScore, "SCORING_CONFIG_INVALID");
      const nextScore = result.state === "AUTO_SCORED" ? result.score : null;
      const shouldPersist = item.scoredScore !== nextScore || !sameJson(item.autoResult, result);
      if (shouldPersist) {
        await this.prisma.assessmentItem.update({
          where: { id: item.id },
          data: {
            scoredScore: nextScore,
            autoResult: result as unknown as Prisma.InputJsonValue,
          },
        });
      }

      if (result.state === "AUTO_SCORED") {
        autoScoredItems += 1;
        awardedPoints += result.score ?? 0;
        scoredMaxPoints += result.maxScore ?? 0;
      } else {
        needsReviewItems += 1;
      }
    }

    return {
      totalItems: rows.length,
      autoScoredItems,
      needsReviewItems,
      skippedItems,
      awardedPoints,
      scoredMaxPoints,
      totalMaxPoints,
    };
  }
}
