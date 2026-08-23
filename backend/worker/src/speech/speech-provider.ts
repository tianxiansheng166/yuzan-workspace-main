/**
 * Provider-neutral speech boundary shared by the worker adapters.
 *
 * Cloud providers are diagnostic evidence only in QB-009A. Every adapter
 * therefore returns an uncalibrated, non-finalizable result and the API is the
 * authority that keeps AssessmentItem.scoredScore null.
 */

export const SUPPORTED_SPEECH_PROVIDERS = [
  "disabled",
  "local",
  "iflytek",
  "tencent",
] as const;
export type SpeechProviderName = (typeof SUPPORTED_SPEECH_PROVIDERS)[number];

export const LOCAL_SPEECH_PROVIDER = "local" as const;
export const SPEECH_READING_STRATEGY = "SPEECH_READING" as const;
export const SPEECH_OPEN_RESPONSE_STRATEGY = "SPEECH_OPEN_RESPONSE" as const;
export type SpeechTaskStrategy =
  | typeof SPEECH_READING_STRATEGY
  | typeof SPEECH_OPEN_RESPONSE_STRATEGY;

export type SpeechCalibrationStatus = "UNCALIBRATED" | "CALIBRATED";

export interface SpeechReadingInput {
  /** Immutable, normalized 16 kHz / 16-bit / mono WAV bytes. */
  audio: Uint8Array;
  /** Optional only for the local HTTP scorer, which downloads the presigned URL. */
  audioUrl?: string;
  targetText: string;
  language: string;
  requestId: string;
}

export interface SpeechProviderError {
  text: string;
  pinyin: string;
  startMs: number;
  endMs: number;
  type: string;
  score: number;
}

export interface SpeechProviderScores {
  /** Null means the vendor did not provide this dimension. It is not zero. */
  accuracy: number | null;
  completeness: number | null;
  fluency: number | null;
  tone: number | null;
  overall: number | null;
}

export interface SpeechProviderToneMeta {
  experimental: boolean;
  method: string | null;
  reason: string | null;
}

export interface SpeechProviderOpenDiagnostics {
  durationMs: number;
  speechDurationMs: number | null;
  speechRate: number | null;
  silenceRatio: number | null;
  fluency: number | null;
  audioQuality: {
    acceptable: boolean;
    status: "ACCEPTABLE" | "REVIEW_REQUIRED";
  };
}

export interface SpeechProviderResult {
  provider: Exclude<SpeechProviderName, "disabled">;
  strategy?: SpeechTaskStrategy;
  providerModel?: string;
  scorerVersion: string;
  confidence: number;
  scores?: SpeechProviderScores;
  diagnostics?: SpeechProviderOpenDiagnostics;
  requiresReview: boolean;
  /** Keep this true until an explicit calibration decision is shipped. */
  experimental: true;
  productionCapable?: boolean;
  calibrationStatus: SpeechCalibrationStatus;
  finalizable: false;
  toneMeta?: SpeechProviderToneMeta;
  transcript?: string;
  errors: SpeechProviderError[];
  reasonCodes: string[];
  processingMs?: number;
  /** Provider scale/dimension metadata is safe for server audit only. */
  providerRawScale?: Record<string, unknown>;
  /** Raw vendor payload is never copied into student autoResult. */
  providerAudit?: {
    requestId: string;
    responseCount: number;
    rawResponse: string;
  };
}

export interface SpeechReadingProvider {
  readonly name: Exclude<SpeechProviderName, "disabled">;
  readonly productionCapable: boolean;
  configured(): boolean;
  scoreReading(input: SpeechReadingInput): Promise<SpeechProviderResult>;
}

export class SpeechProviderResponseError extends Error {
  readonly code = "INVALID_PROVIDER_RESPONSE";

  constructor(message: string) {
    super(message);
    this.name = "SpeechProviderResponseError";
  }
}

export class SpeechProviderConfigurationError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "SpeechProviderConfigurationError";
  }
}

export class SpeechProviderTaskError extends Error {
  readonly code = "PROVIDER_TASK_UNSUPPORTED";
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "SpeechProviderTaskError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SpeechProviderResponseError(`${field} must be a non-empty string`);
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
    throw new SpeechProviderResponseError(
      `${field} must be a finite number between ${min} and ${max}`,
    );
  }
  return value;
}

function nullableBoundedNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) return null;
  return boundedNumber(value, field, min, max);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new SpeechProviderResponseError(`${field} must be a non-negative integer`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value !== null && typeof value !== "string") {
    throw new SpeechProviderResponseError(`${field} must be a string or null`);
  }
  return value;
}

function parseErrors(value: unknown): SpeechProviderError[] {
  if (!Array.isArray(value)) {
    throw new SpeechProviderResponseError("errors must be an array");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new SpeechProviderResponseError(`errors[${index}] must be an object`);
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

function parseToneMeta(value: unknown): SpeechProviderToneMeta | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || typeof value.experimental !== "boolean") {
    throw new SpeechProviderResponseError("toneMeta is invalid");
  }
  return {
    experimental: value.experimental,
    method: nullableString(value.method, "toneMeta.method"),
    reason: nullableString(value.reason, "toneMeta.reason"),
  };
}

function parseCalibration(value: unknown, provider: string): SpeechCalibrationStatus {
  if (value === undefined) return "UNCALIBRATED";
  if (value !== "UNCALIBRATED" && value !== "CALIBRATED") {
    throw new SpeechProviderResponseError(`${provider} calibrationStatus is invalid`);
  }
  return value;
}

function parseReasonCodes(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every((reason) => typeof reason === "string" && reason.length <= 100)
  ) {
    throw new SpeechProviderResponseError("reasonCodes must be an array of strings");
  }
  return value;
}

/** Parse and normalize the Python local scorer response. */
export function parseLocalSpeechResponse(value: unknown): SpeechProviderResult {
  if (!isRecord(value)) {
    throw new SpeechProviderResponseError("provider response must be an object");
  }
  const scores = value.scores;
  if (!isRecord(scores)) {
    throw new SpeechProviderResponseError("scores must be an object");
  }
  if (value.requiresReview !== undefined && typeof value.requiresReview !== "boolean") {
    throw new SpeechProviderResponseError("requiresReview must be boolean");
  }
  if (value.experimental !== undefined && value.experimental !== true) {
    throw new SpeechProviderResponseError("local provider results must remain experimental");
  }
  const transcript =
    value.transcript === undefined
      ? undefined
      : typeof value.transcript === "string" && value.transcript.length <= 20000
        ? value.transcript
        : (() => { throw new SpeechProviderResponseError("transcript must be a string"); })();
  const providerModel = value.providerModel === undefined
    ? undefined
    : requiredString(value.providerModel, "providerModel");
  const processingMs = value.processingMs === undefined
    ? undefined
    : nonNegativeInteger(value.processingMs, "processingMs");
  const toneMeta = parseToneMeta(value.toneMeta);
  const reasonCodes = parseReasonCodes(value.reasonCodes);

  return {
    provider: LOCAL_SPEECH_PROVIDER,
    strategy: SPEECH_READING_STRATEGY,
    ...(providerModel !== undefined ? { providerModel } : {}),
    scorerVersion: requiredString(value.scorerVersion, "scorerVersion"),
    confidence: boundedNumber(value.confidence, "confidence", 0, 1),
    scores: {
      accuracy: boundedNumber(scores.accuracy, "scores.accuracy", 0, 100),
      completeness: boundedNumber(scores.completeness, "scores.completeness", 0, 100),
      fluency: boundedNumber(scores.fluency, "scores.fluency", 0, 100),
      tone: nullableBoundedNumber(scores.tone, "scores.tone", 0, 100),
      overall: boundedNumber(scores.overall, "scores.overall", 0, 100),
    },
    requiresReview: value.requiresReview ?? true,
    experimental: true,
    productionCapable: false,
    calibrationStatus: parseCalibration(value.calibrationStatus, LOCAL_SPEECH_PROVIDER),
    finalizable: false,
    ...(toneMeta ? { toneMeta } : {}),
    ...(transcript !== undefined ? { transcript } : {}),
    errors: parseErrors(value.errors),
    reasonCodes: reasonCodes.length ? reasonCodes : ["LOCAL_BASELINE_UNCALIBRATED"],
    ...(processingMs !== undefined ? { processingMs } : {}),
  };
}

/** Parse the separate local open-response diagnostic contract. */
export function parseLocalOpenResponse(value: unknown): SpeechProviderResult {
  if (!isRecord(value)) throw new SpeechProviderResponseError("provider response must be an object");
  if (value.strategy !== undefined && value.strategy !== SPEECH_OPEN_RESPONSE_STRATEGY) {
    throw new SpeechProviderResponseError("open-response provider strategy must be SPEECH_OPEN_RESPONSE");
  }
  if (value.requiresReview !== undefined && value.requiresReview !== true) {
    throw new SpeechProviderResponseError("open-response diagnostics must require teacher review");
  }
  if (value.experimental !== undefined && value.experimental !== true) {
    throw new SpeechProviderResponseError("local provider results must remain experimental");
  }
  if (!isRecord(value.diagnostics) || !isRecord(value.diagnostics.audioQuality)) {
    throw new SpeechProviderResponseError("diagnostics.audioQuality must be an object");
  }
  const audioQuality = value.diagnostics.audioQuality;
  if (typeof audioQuality.acceptable !== "boolean" ||
      (audioQuality.status !== "ACCEPTABLE" && audioQuality.status !== "REVIEW_REQUIRED")) {
    throw new SpeechProviderResponseError("diagnostics.audioQuality is invalid");
  }
  const transcript = value.transcript === undefined
    ? undefined
    : typeof value.transcript === "string" && value.transcript.length <= 20000
      ? value.transcript
      : (() => { throw new SpeechProviderResponseError("transcript must be a string"); })();
  const reasonCodes = parseReasonCodes(value.reasonCodes);
  return {
    provider: LOCAL_SPEECH_PROVIDER,
    strategy: SPEECH_OPEN_RESPONSE_STRATEGY,
    scorerVersion: requiredString(value.scorerVersion, "scorerVersion"),
    confidence: boundedNumber(value.confidence, "confidence", 0, 1),
    diagnostics: {
      durationMs: nonNegativeInteger(value.diagnostics.durationMs, "diagnostics.durationMs"),
      speechDurationMs: value.diagnostics.speechDurationMs == null
        ? null
        : nonNegativeInteger(value.diagnostics.speechDurationMs, "diagnostics.speechDurationMs"),
      speechRate: nullableBoundedNumber(value.diagnostics.speechRate, "diagnostics.speechRate", 0, 20),
      silenceRatio: nullableBoundedNumber(value.diagnostics.silenceRatio, "diagnostics.silenceRatio", 0, 1),
      fluency: nullableBoundedNumber(value.diagnostics.fluency, "diagnostics.fluency", 0, 100),
      audioQuality: { acceptable: audioQuality.acceptable, status: audioQuality.status },
    },
    requiresReview: true,
    experimental: true,
    productionCapable: false,
    calibrationStatus: "UNCALIBRATED",
    finalizable: false,
    ...(transcript !== undefined ? { transcript } : {}),
    reasonCodes: reasonCodes.length ? reasonCodes : ["LOCAL_BASELINE_UNCALIBRATED"],
    errors: [],
    ...(value.processingMs !== undefined
      ? { processingMs: nonNegativeInteger(value.processingMs, "processingMs") }
      : {}),
  };
}

export function configuredSpeechProvider(value = process.env.SPEECH_PROVIDER): SpeechProviderName {
  const normalized = (value ?? "disabled").trim().toLowerCase();
  if ((SUPPORTED_SPEECH_PROVIDERS as readonly string[]).includes(normalized)) {
    return normalized as SpeechProviderName;
  }
  throw new SpeechProviderConfigurationError(
    `Unsupported SPEECH_PROVIDER=${normalized || "<empty>"}; expected disabled or local, or cloud provider iflytek/tencent`,
  );
}
