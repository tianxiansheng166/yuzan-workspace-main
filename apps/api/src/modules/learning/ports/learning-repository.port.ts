import type {
  LearningProgress,
  LearningSession,
  Submission,
} from "../domain/learning.types.js";

export const LEARNING_REPOSITORY = Symbol("LEARNING_REPOSITORY");

export interface SaveSessionOptions {
  readonly generateId?: boolean;
}

export interface SaveProgressOptions {
  readonly generateId?: boolean;
}

export interface SaveSubmissionOptions {
  readonly generateId?: boolean;
}

export interface LearningRepositoryPort {
  findSession(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<LearningSession | null>;
  saveSession(
    session: LearningSession,
    options?: SaveSessionOptions,
  ): Promise<LearningSession>;
  findProgress(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<LearningProgress | null>;
  saveProgress(
    progress: LearningProgress,
    options?: SaveProgressOptions,
  ): Promise<LearningProgress>;
  countSubmissions(
    schoolId: string,
    assignmentId: string,
    enrollmentId: string,
  ): Promise<number>;
  saveSubmission(
    submission: Submission,
    options?: SaveSubmissionOptions,
  ): Promise<Submission>;
}
