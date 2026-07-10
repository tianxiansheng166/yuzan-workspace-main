import type {
  ActivityDetail,
  LearningProgress,
  LearningSession,
  Submission,
  TodayLearningItem,
} from "../domain/learning.types.js";

export interface TodayLearningResponse {
  readonly items: readonly TodayLearningItem[];
}

export interface ActivityDetailResponse extends ActivityDetail {}

export interface LearningSessionResponse {
  readonly sessionId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly status: LearningSession["status"];
  readonly startedAt: Date;
  readonly lastActiveAt: Date;
}

export interface LearningProgressResponse {
  readonly progressId: string;
  readonly sessionId: string;
  readonly progressPercent: number;
  readonly localState: Record<string, unknown>;
  readonly serverState: Record<string, unknown>;
  readonly updatedAt: Date;
}

export interface SubmissionResponse {
  readonly submissionId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly status: Submission["status"];
  readonly submittedAt: Date;
  readonly score?: number;
}

export function toSessionResponse(
  session: LearningSession,
): LearningSessionResponse {
  return {
    sessionId: session.id,
    assignmentId: session.assignmentId,
    activityId: session.activityId,
    status: session.status,
    startedAt: session.startedAt,
    lastActiveAt: session.lastActiveAt,
  };
}

export function toProgressResponse(
  progress: LearningProgress,
): LearningProgressResponse {
  return {
    progressId: progress.id,
    sessionId: progress.sessionId,
    progressPercent: progress.progressPercent,
    localState: progress.localState,
    serverState: progress.serverState,
    updatedAt: progress.updatedAt,
  };
}

export function toSubmissionResponse(
  submission: Submission,
): SubmissionResponse {
  return {
    submissionId: submission.id,
    assignmentId: submission.assignmentId,
    enrollmentId: submission.enrollmentId,
    attemptNo: submission.attemptNo,
    status: submission.status,
    submittedAt: submission.submittedAt,
    ...(submission.score !== undefined ? { score: submission.score } : {}),
  };
}
