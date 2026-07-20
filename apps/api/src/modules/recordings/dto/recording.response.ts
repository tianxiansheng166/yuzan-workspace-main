import type { PresignedUrlResult } from "../../../shared/storage/storage.port.js";
import type { Recording } from "../domain/recording.types.js";

export function toInitRecordingResponse(
  recording: Recording,
  uploadUrls: PresignedUrlResult[],
) {
  return {
    id: recording.id,
    status: recording.status,
    partCount: recording.partCount,
    uploadedParts: recording.uploadedParts,
    uploadUrls: uploadUrls.map((u, index) => ({
      partNumber: index + 1,
      url: u.url,
      objectKey: u.objectKey,
      expiresInSeconds: u.expiresInSeconds,
    })),
    createdAt: recording.createdAt,
  };
}

export function toInitSimpleRecordingResponse(
  recording: Recording,
  uploadUrl: PresignedUrlResult,
) {
  return {
    id: recording.id,
    status: recording.status,
    partCount: recording.partCount,
    uploadedParts: recording.uploadedParts,
    uploadUrl: {
      url: uploadUrl.url,
      objectKey: uploadUrl.objectKey,
      expiresInSeconds: uploadUrl.expiresInSeconds,
    },
    createdAt: recording.createdAt,
  };
}

export function toRecordingStatusResponse(recording: Recording) {
  return {
    id: recording.id,
    status: recording.status,
    partCount: recording.partCount,
    uploadedParts: recording.uploadedParts,
    durationMs: recording.durationMs,
    mimeType: recording.mimeType,
    objectKey: recording.objectKey,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
  };
}

export function toRecordingEvidenceResponse(
  recording: Recording,
  downloadUrl: string,
) {
  return {
    id: recording.id,
    durationMs: recording.durationMs,
    mimeType: recording.mimeType,
    downloadUrl,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
  };
}
