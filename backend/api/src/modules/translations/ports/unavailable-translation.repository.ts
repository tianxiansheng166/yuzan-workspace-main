import { Injectable } from "@nestjs/common";
import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../domain/translation.types.js";
import { TranslationUnavailableException } from "../domain/translation.errors.js";
import type {
  ListJobsOptions,
  PaginatedResult,
  TranslationRepositoryPort,
} from "./translation-repository.port.js";

@Injectable()
export class UnavailableTranslationRepository implements TranslationRepositoryPort {
  createJob(
    _job: Omit<TranslationJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<TranslationJob> {
    void _job;
    return Promise.reject(new TranslationUnavailableException());
  }

  findJobById(
    _schoolId: string,
    _jobId: string,
  ): Promise<TranslationJob | null> {
    void _schoolId;
    void _jobId;
    return Promise.reject(new TranslationUnavailableException());
  }

  findJobByIdOnly(_jobId: string): Promise<TranslationJob | null> {
    void _jobId;
    return Promise.reject(new TranslationUnavailableException());
  }

  listJobsBySchool(
    _schoolId: string,
    _options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>> {
    void _schoolId;
    void _options;
    return Promise.reject(new TranslationUnavailableException());
  }

  updateJobResult(
    _schoolId: string,
    _jobId: string,
    _data: {
      status: TranslationStatus;
      machineResult?: string | null;
      provider?: string;
      providerRequestId?: string;
      providerModel?: string;
      providerLatencyMs?: number;
      errorCode?: string;
    },
  ): Promise<TranslationJob | null> {
    void _schoolId;
    void _jobId;
    void _data;
    return Promise.reject(new TranslationUnavailableException());
  }

  updateJobRevision(
    _schoolId: string,
    _jobId: string,
    _data: {
      revisedResult: string;
      reviewStatus: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      revision: number;
    },
  ): Promise<TranslationJob | null> {
    void _schoolId;
    void _jobId;
    void _data;
    return Promise.reject(new TranslationUnavailableException());
  }

  listGlossary(
    _schoolId: string,
    _version?: number,
  ): Promise<readonly GlossaryEntry[]> {
    void _schoolId;
    void _version;
    return Promise.reject(new TranslationUnavailableException());
  }

  findGlossaryByVersion(_version: number): Promise<readonly GlossaryEntry[]> {
    void _version;
    return Promise.reject(new TranslationUnavailableException());
  }
}
