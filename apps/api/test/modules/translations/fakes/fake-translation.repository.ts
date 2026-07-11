import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../../../../src/modules/translations/domain/translation.types.js";
import type {
  ListJobsOptions,
  PaginatedResult,
  TranslationRepositoryPort,
} from "../../../../src/modules/translations/ports/translation-repository.port.js";

type GlossaryEntryWithSchool = GlossaryEntry & { schoolId: string };

export class FakeTranslationRepository implements TranslationRepositoryPort {
  private jobs: Map<string, TranslationJob> = new Map();
  private glossaryEntries: Map<string, GlossaryEntryWithSchool> = new Map();
  private nextId = 1;

  async createJob(
    data: Omit<TranslationJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<TranslationJob> {
    const now = new Date();
    const job: TranslationJob = {
      id: `job-${this.nextId++}`,
      schoolId: data.schoolId,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      sourceTextHash: data.sourceTextHash,
      sourceTextEncrypted: data.sourceTextEncrypted,
      status: data.status,
      provider: data.provider,
      resultText: data.resultText,
      glossaryVersion: data.glossaryVersion,
      errorCode: data.errorCode,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async findJobById(
    schoolId: string,
    jobId: string,
  ): Promise<TranslationJob | null> {
    const job = this.jobs.get(jobId);
    return job && job.schoolId === schoolId ? job : null;
  }

  async listJobsBySchool(
    schoolId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>> {
    let items = [...this.jobs.values()].filter(
      (j) => j.schoolId === schoolId,
    );

    if (options.status) {
      items = items.filter((j) => j.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor:
        hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
      hasMore,
    };
  }

  async updateJobStatus(
    schoolId: string,
    jobId: string,
    status: TranslationStatus,
    resultText?: string,
    errorCode?: string,
  ): Promise<TranslationJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.schoolId !== schoolId) return null;
    const updated: TranslationJob = {
      ...job,
      status,
      resultText,
      errorCode,
      updatedAt: new Date(),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  async listGlossary(
    schoolId: string,
    version?: number,
  ): Promise<readonly GlossaryEntry[]> {
    let items = [...this.glossaryEntries.values()].filter(
      (e) => e.schoolId === schoolId,
    );
    if (version !== undefined) {
      items = items.filter((e) => e.version === version);
    }
    // Strip schoolId from results — GlossaryEntry does not carry it
    return items.map(({ schoolId: _sid, ...rest }) => rest);
  }

  async findGlossaryByVersion(
    version: number,
  ): Promise<readonly GlossaryEntry[]> {
    const items = [...this.glossaryEntries.values()].filter(
      (e) => e.version === version,
    );
    return items.map(({ schoolId: _sid, ...rest }) => rest);
  }

  /** Test helper: seed a job into the repository. */
  addJob(job: TranslationJob): void {
    this.jobs.set(job.id, job);
  }

  /** Test helper: seed a glossary entry into the repository. */
  addGlossaryEntry(entry: GlossaryEntryWithSchool): void {
    this.glossaryEntries.set(entry.id, entry);
  }
}
