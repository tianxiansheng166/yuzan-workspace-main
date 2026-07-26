import type {
  GlossaryEntry,
  TranslationJob,
} from "../../../../src/modules/translations/domain/translation.types.js";
import {
  ReviewStatus,
  SupportedLanguage,
  TranslationStatus,
} from "../../../../src/modules/translations/domain/translation.types.js";

let nextJobId = 1;
function jobId(): string {
  return `job-${nextJobId++}`;
}

let nextGlossaryId = 1;
function glossaryId(): string {
  return `glossary-${nextGlossaryId++}`;
}

export function translationJob(
  overrides: Partial<TranslationJob> & { schoolId: string },
): TranslationJob {
  const now = new Date();
  return {
    id: jobId(),
    createdByUserId: "teacher-1",
    sourceLanguage: SupportedLanguage.BO,
    targetLanguage: SupportedLanguage.ZH,
    sourceTextHash:
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    sourceTextEncrypted: "encrypted-placeholder",
    status: TranslationStatus.CREATED,
    machineResult: null,
    revisedResult: null,
    reviewStatus: null,
    revision: 0,
    reviewedByUserId: null,
    reviewedAt: null,
    glossaryVersion: 1,
    provider: null,
    providerRequestId: null,
    providerModel: null,
    providerLatencyMs: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function completedJob(
  overrides: Partial<TranslationJob> & { schoolId: string },
): TranslationJob {
  return translationJob({
    status: TranslationStatus.COMPLETED,
    machineResult: "翻译结果文本",
    reviewStatus: ReviewStatus.NEEDS_REVIEW,
    ...overrides,
  });
}

export function failedJob(
  overrides: Partial<TranslationJob> & { schoolId: string },
): TranslationJob {
  return translationJob({
    status: TranslationStatus.FAILED,
    errorCode: "PROVIDER_UNAVAILABLE",
    ...overrides,
  });
}

export function providerUnavailableJob(
  overrides: Partial<TranslationJob> & { schoolId: string },
): TranslationJob {
  return translationJob({
    status: TranslationStatus.PROVIDER_UNAVAILABLE,
    errorCode: "PROVIDER_UNAVAILABLE",
    ...overrides,
  });
}

export function glossaryEntry(
  overrides: Partial<GlossaryEntry>,
): GlossaryEntry {
  const now = new Date();
  return {
    id: glossaryId(),
    schoolId: "school-1",
    term: "བཀྲ་ཤིས་བདེ་ལེགས།",
    sourceLanguage: SupportedLanguage.BO,
    targetLanguage: SupportedLanguage.ZH,
    translation: "吉祥如意",
    category: "greeting",
    version: 1,
    createdAt: now,
    ...overrides,
  };
}
