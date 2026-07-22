export type RecordingStatus =
  | "INITIALIZED"
  | "UPLOADING"
  | "COMPLETE"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export interface Recording {
  id: string;
  schoolId: string;
  enrollmentId: string;
  submissionId?: string;
  status: RecordingStatus;
  partCount: number;
  uploadedParts: readonly number[];
  durationMs?: number;
  mimeType?: string;
  objectKey?: string;
  revision: number;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingChunk {
  id: string;
  recordingId: string;
  partNumber: number;
  objectKey: string;
  byteSize: number;
  checksumMd5?: string;
  createdAt: Date;
}

export interface InitRecordingInput {
  schoolId: string;
  enrollmentId: string;
  submissionId?: string;
  partCount: number;
  mimeType?: string;
  idempotencyKey?: string;
}

export interface CompleteRecordingInput {
  durationMs?: number;
  objectKey?: string;
  /** If provided with targetText, triggers SpeechJob creation after recording completion */
  assessmentItemId?: string;
  /** The text the student was supposed to read; required if assessmentItemId is provided */
  targetText?: string;
}
