import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../domain/translation.types.js";

export const TRANSLATION_REPOSITORY = Symbol("TRANSLATION_REPOSITORY");

export interface ListJobsOptions {
  readonly status?: TranslationStatus;
  readonly cursor?: string;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface TranslationRepositoryPort {
  createJob(job: Omit<TranslationJob, "id" | "createdAt" | "updatedAt">): Promise<TranslationJob>;
  findJobById(schoolId: string, jobId: string): Promise<TranslationJob | null>;
  listJobsBySchool(
    schoolId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>>;
  updateJobStatus(
    schoolId: string,
    jobId: string,
    status: TranslationStatus,
    resultText?: string,
    errorCode?: string,
  ): Promise<TranslationJob | null>;
  listGlossary(
    schoolId: string,
    version?: number,
  ): Promise<readonly GlossaryEntry[]>;
  findGlossaryByVersion(version: number): Promise<readonly GlossaryEntry[]>;
}
