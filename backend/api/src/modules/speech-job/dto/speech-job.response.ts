import type { SpeechJob } from "@yuzan/database";

/**
 * Transform a Prisma SpeechJob record into the API response shape.
 * Strips internal fields and keeps only what clients need.
 */
export function toSpeechJobResponse(
  job: SpeechJob,
  options: { includeResult?: boolean } = {},
) {
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
    // The full provider payload is an internal audit record. Students receive
    // the bounded AssessmentItem.autoResult instead; teachers may opt in.
    result: options.includeResult ? job.result : null,
    confidence: job.confidence,
    processingMs: job.processingMs,
    retryCount: job.retryCount,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export type SpeechJobResponse = ReturnType<typeof toSpeechJobResponse>;
