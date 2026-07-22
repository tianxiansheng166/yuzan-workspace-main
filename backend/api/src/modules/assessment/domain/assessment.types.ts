export type AssessmentType = "READING" | "WRITTEN" | "MIXED";
export type AssessmentSessionStatus = "CREATED" | "IN_PROGRESS" | "SUBMITTED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
export type AssessmentItemStatus = "PENDING" | "ANSWERED" | "REVIEWED" | "FLAGGED";

export interface AssessmentSession {
  readonly id: string;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly classId: string;
  readonly initiatorUserId: string;
  readonly type: AssessmentType;
  readonly status: AssessmentSessionStatus;
  readonly startedAt: Date | null;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
  readonly retestOfSessionId: string | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AssessmentItem {
  readonly id: string;
  readonly sessionId: string;
  readonly questionId: string | null;
  readonly recordingId: string | null;
  readonly prompt: Record<string, unknown>;
  readonly itemType: string;
  readonly status: AssessmentItemStatus;
  readonly sortOrder: number;
  readonly maxScore: number | null;
  readonly scoredScore: number | null;
  readonly autoResult: Record<string, unknown> | null;
  readonly reviewerUserId: string | null;
  readonly reviewerComment: string | null;
  readonly reviewedAt: Date | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WrittenAnswer {
  readonly id: string;
  readonly itemId: string;
  readonly content: Record<string, unknown>;
  readonly wordCount: number;
  readonly charCount: number;
  readonly autoSavedAt: Date | null;
  readonly finalSubmittedAt: Date | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AssessmentReport {
  readonly id: string;
  readonly sessionId: string;
  readonly schoolId: string;
  readonly overallScore: number | null;
  readonly readingScore: number | null;
  readonly writtenScore: number | null;
  readonly summary: Record<string, unknown> | null;
  readonly recommendations: Record<string, unknown> | null;
  readonly dataCompleteness: number;
  readonly generatedAt: Date | null;
  readonly generatedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
