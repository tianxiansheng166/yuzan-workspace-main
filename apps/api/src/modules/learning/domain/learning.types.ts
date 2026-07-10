export type LearningSessionStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface LearningSession {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly studentUserId: string;
  readonly enrollmentId: string;
  readonly status: LearningSessionStatus;
  readonly startedAt: Date;
  readonly lastActiveAt: Date;
  readonly completedAt?: Date;
}

export interface LearningProgress {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly studentUserId: string;
  readonly enrollmentId: string;
  readonly sessionId: string;
  readonly progressPercent: number;
  readonly localState: Record<string, unknown>;
  readonly serverState: Record<string, unknown>;
  readonly updatedAt: Date;
}

export interface Submission {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly activityIds: readonly string[];
  readonly status: "SUBMITTED" | "GRADING" | "GRADED";
  readonly submittedAt: Date;
  readonly score?: number;
  readonly answers?: Record<string, unknown>;
}

export interface TodayLearningItem {
  readonly assignmentId: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly studentNotes: string | null;
  readonly dueAt: Date | null;
  readonly activity: {
    readonly activityId: string;
    readonly activityType: string;
    readonly title: string;
  };
  readonly sessionId: string | null;
  readonly progressPercent: number;
}

export interface ActivityDetail {
  readonly assignmentId: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly assignmentTitle: string;
  readonly studentNotes: string | null;
  readonly publishAt: Date | null;
  readonly dueAt: Date | null;
  readonly latePolicy: string;
  readonly retryPolicy: {
    readonly maxAttempts: number;
    readonly allowRetest: boolean;
  };
  readonly activity: {
    readonly activityId: string;
    readonly activityType: string;
    readonly title: string;
  };
  readonly canStart: boolean;
  readonly canSubmit: boolean;
  readonly reason?: string | undefined;
}
