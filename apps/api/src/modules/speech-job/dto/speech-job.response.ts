import type { SpeechJob } from "@yuzan/database";

/**
 * Transform a Prisma SpeechJob record into the API response shape.
 * Strips internal fields and keeps only what clients need.
 */
export function toSpeechJobResponse(job: SpeechJob) {
  return {
    id: job.id,
    recordingId: job.recordingId,
    assessmentItemId: job.assessmentItemId,
    schoolId: job.schoolId,
    targetText: job.targetText,
    scorerVersion: job.scorerVersion,
    status: job.status,
    provider: job.provider,
    providerModel: job.providerModel,
    result: job.result,
    confidence: job.confidence,
    processingMs: job.processingMs,
    retryCount: job.retryCount,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export type SpeechJobResponse = ReturnType<typeof toSpeechJobResponse>;
