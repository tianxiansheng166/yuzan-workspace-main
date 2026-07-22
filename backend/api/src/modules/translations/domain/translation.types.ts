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

export interface TranslationJob {
  readonly id: string;
  readonly schoolId: string;
  readonly sourceLanguage: SupportedLanguage;
  readonly targetLanguage: SupportedLanguage;
  readonly sourceTextHash: string;
  /** @internal Controlled — never expose to frontend */
  readonly sourceTextEncrypted: string;
  readonly status: TranslationStatus;
  readonly provider?: string;
  readonly resultText?: string;
  readonly glossaryVersion: number;
  readonly errorCode?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GlossaryEntry {
  readonly id: string;
  readonly term: string;
  readonly sourceLanguage: SupportedLanguage;
  readonly targetLanguage: SupportedLanguage;
  readonly translation: string;
  readonly category: string;
  readonly version: number;
  readonly createdAt: Date;
}
