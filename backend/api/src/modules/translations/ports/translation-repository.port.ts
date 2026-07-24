import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../domain/translation.types.js";

export const TRANSLATION_REPOSITORY = Symbol("TRANSLATION_REPOSITORY");

export interface ListJobsOptions {
  readonly userId?: string;
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
  findJobByIdOnly(jobId: string): Promise<TranslationJob | null>;
  listJobsBySchool(
    schoolId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>>;
  updateJobResult(
    schoolId: string,
    jobId: string,
    data: {
      status: TranslationStatus;
      machineResult?: string | null;
      provider?: string;
      providerRequestId?: string;
      providerModel?: string;
      providerLatencyMs?: number;
      errorCode?: string;
    },
  ): Promise<TranslationJob | null>;
  updateJobRevision(
    schoolId: string,
    jobId: string,
    data: {
      revisedResult: string;
      reviewStatus: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      revision: number;
    },
  ): Promise<TranslationJob | null>;
  listGlossary(
    schoolId: string,
    version?: number,
  ): Promise<readonly GlossaryEntry[]>;
  findGlossaryByVersion(version: number): Promise<readonly GlossaryEntry[]>;
}
