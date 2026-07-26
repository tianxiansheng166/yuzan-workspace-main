export enum TranslationStatus {
  CREATED = "CREATED",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  FAILED = "FAILED",
}

export enum SupportedLanguage {
  BO = "BO",
  ZH = "ZH",
}

export enum ReviewStatus {
  NEEDS_REVIEW = "NEEDS_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface TranslationJob {
  readonly id: string;
  readonly schoolId: string;
  readonly createdByUserId: string;
  readonly sourceLanguage: SupportedLanguage;
  readonly targetLanguage: SupportedLanguage;
  readonly sourceTextHash: string;
  /** @internal AES-GCM encrypted — never expose to frontend */
  readonly sourceTextEncrypted: string;
  readonly status: TranslationStatus;
  readonly machineResult: string | null;
  readonly revisedResult: string | null;
  readonly reviewStatus: ReviewStatus | null;
  readonly revision: number;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: Date | null;
  readonly glossaryVersion: number;
  readonly provider: string | null;
  readonly providerRequestId: string | null;
  readonly providerModel: string | null;
  readonly providerLatencyMs: number | null;
  readonly errorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GlossaryEntry {
  readonly id: string;
  readonly schoolId: string;
  readonly term: string;
  readonly sourceLanguage: SupportedLanguage;
  readonly targetLanguage: SupportedLanguage;
  readonly translation: string;
  readonly category: string;
  readonly version: number;
  readonly createdAt: Date;
}
