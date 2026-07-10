import type {
  ActivityAttempt,
  AnswerDraft,
} from "../domain/assessment.types.js";

export const ASSESSMENT_REPOSITORY = Symbol("ASSESSMENT_REPOSITORY");

export interface SaveDraftOptions {
  readonly generateId?: boolean;
}

export interface SaveAttemptOptions {
  readonly generateId?: boolean;
}

export interface AssessmentRepositoryPort {
  findDraft(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<AnswerDraft | null>;
  saveDraft(
    draft: AnswerDraft,
    options?: SaveDraftOptions,
  ): Promise<AnswerDraft>;
  countAttempts(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    enrollmentId: string,
  ): Promise<number>;
  findAttempts(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    enrollmentId: string,
  ): Promise<readonly ActivityAttempt[]>;
  findAttemptById(
    schoolId: string,
    attemptId: string,
  ): Promise<ActivityAttempt | null>;
  saveAttempt(
    attempt: ActivityAttempt,
    options?: SaveAttemptOptions,
  ): Promise<ActivityAttempt>;
}
