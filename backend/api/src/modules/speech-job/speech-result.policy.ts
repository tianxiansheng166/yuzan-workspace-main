import { BadRequestException } from "@nestjs/common";

export const READ_ALOUD_STRATEGY = "SPEECH_READING" as const;
export const LOCAL_SPEECH_PROVIDER = "local" as const;
export const LOCAL_SPEECH_REASON = "LOCAL_BASELINE_UNCALIBRATED" as const;

export interface StoredSpeechProviderResult {
  provider: typeof LOCAL_SPEECH_PROVIDER;
  providerModel?: string;
  scorerVersion: string;
  confidence: number;
  scores: {
    accuracy: number;
    completeness: number;
    fluency: number;
    tone: number | null;
    overall: number;
  };
  requiresReview: boolean;
  experimental: true;
  toneMeta?: {
    experimental: boolean;
    method: string | null;
    reason: string | null;
  };
  transcript?: string;
  errors: Array<{
    text: string;
    pinyin: string;
    startMs: number;
    endMs: number;
    type: string;
    score: number;
  }>;
  processingMs?: number;
}

export interface SafeReadAloudDiagnostic {
  state: "NEEDS_REVIEW";
  strategy: typeof READ_ALOUD_STRATEGY;
  provider: typeof LOCAL_SPEECH_PROVIDER;
  scorerVersion: string;
  candidatePoints: number;
  maxScore: number;
  metrics: {
    accuracy: number;
    completeness: number;
    fluency: number;
    tone: number | null;
  };
  toneExperimental: true;
  confidence: number;
  finalizable: false;
  reasonCodes: string[];
}

export interface ReadAloudPolicyResult {
  providerResult: StoredSpeechProviderResult;
  diagnostic: SafeReadAloudDiagnostic;
  status: "NEEDS_REVIEW";
}

export class SpeechResultPolicyException extends BadRequestException {
  constructor(code: string, message: string) {
    super({ code, message });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 20000
  ) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      `${field} is invalid`,
    );
  }
  return value;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength = 200,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      `${field} is invalid`,
    );
  }
  return value;
}

function boundedNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_OUT_OF_RANGE",
      `${field} is outside its allowed range`,
    );
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 3_600_000
  ) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      `${field} is invalid`,
    );
  }
  return value;
}

function parseErrors(value: unknown): StoredSpeechProviderResult["errors"] {
  if (!Array.isArray(value)) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "errors is invalid",
    );
  }
  if (value.length > 500) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "errors is too large",
    );
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new SpeechResultPolicyException(
        "PROVIDER_RESULT_MALFORMED",
        `errors[${index}] is invalid`,
      );
    }
    return {
      text: requiredString(entry.text, `errors[${index}].text`),
      pinyin: requiredString(entry.pinyin, `errors[${index}].pinyin`),
      startMs: nonNegativeInteger(entry.startMs, `errors[${index}].startMs`),
      endMs: nonNegativeInteger(entry.endMs, `errors[${index}].endMs`),
      type: requiredString(entry.type, `errors[${index}].type`),
      score: boundedNumber(entry.score, `errors[${index}].score`, 0, 100),
    };
  });
}

function parseToneMeta(value: unknown): StoredSpeechProviderResult["toneMeta"] {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || typeof value.experimental !== "boolean") {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "toneMeta is invalid",
    );
  }
  if (value.experimental !== true) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_POLICY_REJECTED",
      "local tone analysis must remain experimental",
    );
  }
  const method =
    value.method === null
      ? null
      : optionalString(value.method, "toneMeta.method");
  const reason =
    value.reason === null
      ? null
      : optionalString(value.reason, "toneMeta.reason");
  return { experimental: true, method: method ?? null, reason: reason ?? null };
}

/**
 * Server-side validation and normalization of the provider-neutral result.
 * This is deliberately independent of any AssessmentItem score scale.
 */
export function validateSpeechProviderResult(
  value: unknown,
): StoredSpeechProviderResult {
  if (!isRecord(value)) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "provider result must be an object",
    );
  }
  if (value.provider !== LOCAL_SPEECH_PROVIDER) {
    throw new SpeechResultPolicyException(
      "PROVIDER_NOT_CONFIGURED",
      "speech provider is not configured for this callback",
    );
  }
  if (value.experimental !== true) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_POLICY_REJECTED",
      "local speech results must be experimental",
    );
  }
  if (typeof value.requiresReview !== "boolean") {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "requiresReview is invalid",
    );
  }
  if (!isRecord(value.scores)) {
    throw new SpeechResultPolicyException(
      "PROVIDER_RESULT_MALFORMED",
      "scores is invalid",
    );
  }

  const providerModel = optionalString(value.providerModel, "providerModel");
  const transcript =
    value.transcript === undefined
      ? undefined
      : typeof value.transcript === "string" && value.transcript.length <= 20000
        ? value.transcript
        : (() => {
            throw new SpeechResultPolicyException(
              "PROVIDER_RESULT_MALFORMED",
              "transcript is invalid",
            );
          })();
  const toneMeta = parseToneMeta(value.toneMeta);
  const processingMs =
    value.processingMs === undefined
      ? undefined
      : nonNegativeInteger(value.processingMs, "processingMs");

  return {
    provider: LOCAL_SPEECH_PROVIDER,
    ...(providerModel !== undefined ? { providerModel } : {}),
    scorerVersion: requiredString(value.scorerVersion, "scorerVersion"),
    confidence: boundedNumber(value.confidence, "confidence", 0, 1),
    scores: {
      accuracy: boundedNumber(value.scores.accuracy, "scores.accuracy", 0, 100),
      completeness: boundedNumber(
        value.scores.completeness,
        "scores.completeness",
        0,
        100,
      ),
      fluency: boundedNumber(value.scores.fluency, "scores.fluency", 0, 100),
      tone:
        value.scores.tone === null
          ? null
          : boundedNumber(value.scores.tone, "scores.tone", 0, 100),
      overall: boundedNumber(value.scores.overall, "scores.overall", 0, 100),
    },
    requiresReview: value.requiresReview,
    experimental: true,
    ...(toneMeta ? { toneMeta } : {}),
    ...(transcript !== undefined ? { transcript } : {}),
    errors: parseErrors(value.errors),
    ...(processingMs !== undefined ? { processingMs } : {}),
  };
}

function configuredMaxScore(value: unknown, field: string): number {
  return boundedNumber(value, field, Number.EPSILON, 1000);
}

function roundTenths(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Apply the current local-provider policy to one published Question Bank item.
 * The returned diagnostic is safe for students; the provider result is kept
 * server-side for SpeechJob audit history.
 */
export function buildReadAloudPolicyResult(input: {
  providerResult: unknown;
  strategy: unknown;
  itemMaxScore: unknown;
  specMaxScore: unknown;
}): ReadAloudPolicyResult {
  if (input.strategy !== READ_ALOUD_STRATEGY) {
    throw new SpeechResultPolicyException(
      "SPEECH_STRATEGY_MISMATCH",
      "speech callback is not for a read-aloud item",
    );
  }
  const itemMaxScore = configuredMaxScore(
    input.itemMaxScore,
    "assessmentItem.maxScore",
  );
  const specMaxScore = configuredMaxScore(
    input.specMaxScore,
    "scoringSpec.maxScore",
  );
  if (itemMaxScore !== specMaxScore) {
    throw new SpeechResultPolicyException(
      "SCORING_CONFIG_INVALID",
      "assessment item and scoring specification max scores differ",
    );
  }

  const providerResult = validateSpeechProviderResult(input.providerResult);
  const candidatePoints = Math.min(
    itemMaxScore,
    Math.max(
      0,
      roundTenths((providerResult.scores.overall / 100) * itemMaxScore),
    ),
  );
  const reasonCodes = [LOCAL_SPEECH_REASON];
  if (providerResult.requiresReview)
    reasonCodes.push("PROVIDER_REQUIRES_REVIEW");
  if (providerResult.confidence < 0.75) reasonCodes.push("LOW_CONFIDENCE");

  const diagnostic: SafeReadAloudDiagnostic = {
    state: "NEEDS_REVIEW",
    strategy: READ_ALOUD_STRATEGY,
    provider: LOCAL_SPEECH_PROVIDER,
    scorerVersion: providerResult.scorerVersion,
    candidatePoints,
    maxScore: itemMaxScore,
    metrics: providerResult.scores,
    toneExperimental: true,
    confidence: providerResult.confidence,
    finalizable: false,
    reasonCodes,
  };

  return { providerResult, diagnostic, status: "NEEDS_REVIEW" };
}
