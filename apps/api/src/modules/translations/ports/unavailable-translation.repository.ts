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
  async createJob(
    _job: Omit<TranslationJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<TranslationJob> {
    throw new TranslationUnavailableException();
  }

  async findJobById(
    _schoolId: string,
    _jobId: string,
  ): Promise<TranslationJob | null> {
    throw new TranslationUnavailableException();
  }

  async listJobsBySchool(
    _schoolId: string,
    _options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>> {
    throw new TranslationUnavailableException();
  }

  async updateJobStatus(
    _schoolId: string,
    _jobId: string,
    _status: TranslationStatus,
    _resultText?: string,
    _errorCode?: string,
  ): Promise<TranslationJob | null> {
    throw new TranslationUnavailableException();
  }

  async listGlossary(
    _schoolId: string,
    _version?: number,
  ): Promise<readonly GlossaryEntry[]> {
    throw new TranslationUnavailableException();
  }

  async findGlossaryByVersion(
    _version: number,
  ): Promise<readonly GlossaryEntry[]> {
    throw new TranslationUnavailableException();
  }
}
