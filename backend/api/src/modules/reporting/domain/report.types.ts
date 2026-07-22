export type ReportType = "STUDENT_GROWTH" | "CLASS_SUMMARY" | "SCHOOL_OVERVIEW";
export type ReportStatus = "PENDING" | "GENERATING" | "READY" | "FAILED";

export interface Report {
  readonly id: string;
  readonly schoolId: string;
  readonly type: ReportType;
  readonly status: ReportStatus;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly filters: Record<string, unknown> | null;
  readonly dataCompleteness: number;
  readonly providerDisclosure: string;
  readonly generatedAt: Date | null;
  readonly generatedByUserId: string | null;
  readonly enrollmentId: string | null;
  readonly classId: string | null;
  readonly data: Record<string, unknown> | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StudentGrowthProfile {
  readonly enrollmentId: string;
  readonly schoolId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly generatedAt: Date;
  readonly dataCompleteness: number;
  readonly providerDisclosure: string;
  readonly data: Record<string, unknown>;
}

/** Aggregated learning summary for a student */
export interface LearningSummary {
  readonly totalActivities: number;
  readonly completedActivities: number;
  readonly completionRate: number;
  readonly learningStreakDays: number;
}

/** Pronunciation error cluster item */
export interface PronunciationErrorItem {
  readonly type: string;
  readonly label: string;
  readonly count: number;
}

/** Pronunciation summary aggregated from speech jobs */
export interface PronunciationSummary {
  readonly totalRecordings: number;
  readonly topErrors: PronunciationErrorItem[];
}

/** Feedback summary item */
export interface FeedbackSummaryItem {
  readonly feedbackId: string;
  readonly comment: string;
  readonly decision: string;
  readonly score: number | null;
  readonly courseTitle: string;
  readonly assignmentTitle: string;
  readonly releasedAt: string;
}

/** Feedback summary for a student */
export interface FeedbackSummary {
  readonly totalCount: number;
  readonly averageScore: number | null;
  readonly recentFeedbacks: FeedbackSummaryItem[];
}

/** Assessment summary for a student */
export interface AssessmentSummary {
  readonly totalSessions: number;
  readonly completedSessions: number;
  readonly latestSessionDate: string | null;
}

/** Growth stage definition */
export interface GrowthStage {
  readonly id: string;
  readonly title: string;
  readonly status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  readonly progressPercent: number;
}

/** Recording evidence item */
export interface RecordingEvidenceItem {
  readonly recordingId: string;
  readonly durationMs: number | null;
  readonly createdAt: string;
  readonly courseTitle: string | null;
}

/** Enriched student growth profile with aggregated data */
export interface EnrichedStudentGrowthProfile {
  readonly enrollmentId: string;
  readonly schoolId: string;
  readonly className: string | null;
  readonly grade: string | null;
  readonly displayName: string | null;
  readonly learningSummary: LearningSummary;
  readonly pronunciationSummary: PronunciationSummary;
  readonly feedbackSummary: FeedbackSummary;
  readonly assessmentSummary: AssessmentSummary;
  readonly stages: GrowthStage[];
  readonly recordings: RecordingEvidenceItem[];
  readonly dataCompleteness: number;
}
