import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../domain/translation.types.js";

export interface TranslationJobResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly sourceTextHash: string;
  readonly status: TranslationStatus;
  readonly resultText: string | undefined;
  readonly glossaryVersion: number;
  readonly errorCode: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Sanitize provider raw errors before returning to client.
 * Replaces any potentially sensitive internal error details with a generic message.
 */
function sanitizeErrorCode(errorCode?: string): string | undefined {
  if (!errorCode) return undefined;
  // Only allow known safe error codes; strip anything that could leak provider details
  const SAFE_CODES = new Set([
    "PROVIDER_UNAVAILABLE",
    "QUOTA_EXCEEDED",
    "INVALID_INPUT",
    "INTERNAL_ERROR",
  ]);
  return SAFE_CODES.has(errorCode) ? errorCode : "INTERNAL_ERROR";
}

export function toTranslationJobResponse(
  job: TranslationJob,
): TranslationJobResponse {
  // CRITICAL: do NOT include sourceTextEncrypted or provider keys
  return {
    id: job.id,
    schoolId: job.schoolId,
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    sourceTextHash: job.sourceTextHash,
    status: job.status,
    resultText: job.resultText,
    glossaryVersion: job.glossaryVersion,
    errorCode: sanitizeErrorCode(job.errorCode),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export interface GlossaryEntryResponse {
  readonly id: string;
  readonly term: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly translation: string;
  readonly category: string;
  readonly version: number;
  readonly createdAt: string;
}

export function toGlossaryEntryResponse(
  entry: GlossaryEntry,
): GlossaryEntryResponse {
  return {
    id: entry.id,
    term: entry.term,
    sourceLanguage: entry.sourceLanguage,
    targetLanguage: entry.targetLanguage,
    translation: entry.translation,
    category: entry.category,
    version: entry.version,
    createdAt: entry.createdAt.toISOString(),
  };
}
