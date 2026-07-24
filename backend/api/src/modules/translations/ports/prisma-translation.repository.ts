import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type {
  GlossaryEntry,
  TranslationJob,
  TranslationStatus,
} from "../domain/translation.types.js";
import {
  ReviewStatus,
  SupportedLanguage,
  TranslationStatus as TS,
} from "../domain/translation.types.js";
import type {
  ListJobsOptions,
  PaginatedResult,
  TranslationRepositoryPort,
} from "./translation-repository.port.js";

function toDomainJob(raw: Record<string, unknown>): TranslationJob {
  return {
    id: raw.id as string,
    schoolId: raw.schoolId as string,
    createdByUserId: raw.createdByUserId as string,
    sourceLanguage: raw.sourceLanguage as SupportedLanguage,
    targetLanguage: raw.targetLanguage as SupportedLanguage,
    sourceTextHash: raw.sourceTextHash as string,
    sourceTextEncrypted: raw.sourceTextEncrypted as string,
    status: raw.status as TranslationStatus,
    machineResult: (raw.machineResult as string) ?? null,
    revisedResult: (raw.revisedResult as string) ?? null,
    reviewStatus: (raw.reviewStatus as ReviewStatus) ?? null,
    revision: raw.revision as number,
    reviewedByUserId: (raw.reviewedByUserId as string) ?? null,
    reviewedAt: (raw.reviewedAt as Date) ?? null,
    glossaryVersion: raw.glossaryVersion as number,
    provider: (raw.provider as string) ?? null,
    providerRequestId: (raw.providerRequestId as string) ?? null,
    providerModel: (raw.providerModel as string) ?? null,
    providerLatencyMs: (raw.providerLatencyMs as number) ?? null,
    errorCode: (raw.errorCode as string) ?? null,
    createdAt: raw.createdAt as Date,
    updatedAt: raw.updatedAt as Date,
  };
}

function toDomainGlossary(raw: Record<string, unknown>): GlossaryEntry {
  return {
    id: raw.id as string,
    schoolId: raw.schoolId as string,
    term: raw.term as string,
    sourceLanguage: raw.sourceLanguage as SupportedLanguage,
    targetLanguage: raw.targetLanguage as SupportedLanguage,
    translation: raw.translation as string,
    category: raw.category as string,
    version: raw.version as number,
    createdAt: raw.createdAt as Date,
  };
}

@Injectable()
export class PrismaTranslationRepository implements TranslationRepositoryPort {
  private readonly logger = new Logger(PrismaTranslationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createJob(
    job: Omit<TranslationJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<TranslationJob> {
    const raw = await this.prisma.translationJob.create({
      data: {
        schoolId: job.schoolId,
        createdByUserId: job.createdByUserId,
        sourceLanguage: job.sourceLanguage,
        targetLanguage: job.targetLanguage,
        sourceTextHash: job.sourceTextHash,
        sourceTextEncrypted: job.sourceTextEncrypted,
        status: job.status,
        machineResult: job.machineResult,
        revisedResult: job.revisedResult,
        reviewStatus: job.reviewStatus,
        revision: job.revision,
        reviewedByUserId: job.reviewedByUserId,
        reviewedAt: job.reviewedAt,
        glossaryVersion: job.glossaryVersion,
        provider: job.provider,
        providerRequestId: job.providerRequestId,
        providerModel: job.providerModel,
        providerLatencyMs: job.providerLatencyMs,
        errorCode: job.errorCode,
      },
    });
    return toDomainJob(raw as unknown as Record<string, unknown>);
  }

  async findJobById(
    schoolId: string,
    jobId: string,
  ): Promise<TranslationJob | null> {
    const raw = await this.prisma.translationJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!raw) return null;
    return toDomainJob(raw as unknown as Record<string, unknown>);
  }

  async findJobByIdOnly(jobId: string): Promise<TranslationJob | null> {
    const raw = await this.prisma.translationJob.findFirst({
      where: { id: jobId },
    });
    if (!raw) return null;
    return toDomainJob(raw as unknown as Record<string, unknown>);
  }

  async listJobsBySchool(
    schoolId: string,
    options: ListJobsOptions,
  ): Promise<PaginatedResult<TranslationJob>> {
    const where: Record<string, unknown> = { schoolId };

    if (options.userId) {
      where.createdByUserId = options.userId;
    }
    if (options.status) {
      where.status = options.status;
    }

    const take = options.limit + 1;

    const rows = await this.prisma.translationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, -1) : rows;

    return {
      items: items.map(
        (r) => toDomainJob(r as unknown as Record<string, unknown>),
      ),
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
      hasMore,
    };
  }

  async updateJobResult(
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
  ): Promise<TranslationJob | null> {
    // Do not overwrite APPROVED jobs with provider retries
    const existing = await this.prisma.translationJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!existing) return null;
    if (existing.reviewStatus === ReviewStatus.APPROVED) {
      return toDomainJob(existing as unknown as Record<string, unknown>);
    }

    const raw = await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: data.status,
        ...(data.machineResult !== undefined
          ? { machineResult: data.machineResult }
          : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.providerRequestId !== undefined
          ? { providerRequestId: data.providerRequestId }
          : {}),
        ...(data.providerModel !== undefined
          ? { providerModel: data.providerModel }
          : {}),
        ...(data.providerLatencyMs !== undefined
          ? { providerLatencyMs: data.providerLatencyMs }
          : {}),
        ...(data.errorCode !== undefined
          ? { errorCode: data.errorCode }
          : {}),
      },
    });
    return toDomainJob(raw as unknown as Record<string, unknown>);
  }

  async updateJobRevision(
    schoolId: string,
    jobId: string,
    data: {
      revisedResult: string;
      reviewStatus: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      revision: number;
    },
  ): Promise<TranslationJob | null> {
    // Optimistic concurrency: WHERE revision = expectedRevision
    const result = await this.prisma.translationJob.updateMany({
      where: {
        id: jobId,
        schoolId,
        revision: data.revision,
      },
      data: {
        revisedResult: data.revisedResult,
        reviewStatus: data.reviewStatus,
        reviewedByUserId: data.reviewedByUserId,
        reviewedAt: data.reviewedAt,
        revision: { increment: 1 },
      },
    });

    if (result.count === 0) {
      // Revision mismatch — conflict
      return null;
    }

    const raw = await this.prisma.translationJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!raw) return null;
    return toDomainJob(raw as unknown as Record<string, unknown>);
  }

  async listGlossary(
    schoolId: string,
    version?: number,
  ): Promise<readonly GlossaryEntry[]> {
    const where: Record<string, unknown> = { schoolId };
    if (version !== undefined) {
      where.version = version;
    }
    const rows = await this.prisma.translationGlossary.findMany({ where });
    return rows.map(
      (r) => toDomainGlossary(r as unknown as Record<string, unknown>),
    );
  }

  async findGlossaryByVersion(
    version: number,
  ): Promise<readonly GlossaryEntry[]> {
    const rows = await this.prisma.translationGlossary.findMany({
      where: { version },
    });
    return rows.map(
      (r) => toDomainGlossary(r as unknown as Record<string, unknown>),
    );
  }
}
