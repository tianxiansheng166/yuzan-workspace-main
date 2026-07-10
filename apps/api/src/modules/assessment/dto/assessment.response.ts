import type {
  AnswerDraft,
  ActivityAttempt,
  Exercise,
  ExerciseResult,
  Question,
} from "../domain/assessment.types.js";

export interface ExerciseResponse {
  readonly assignmentId: string;
  readonly activityId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly studentNotes: string | null;
  readonly publishAt: Date | null;
  readonly dueAt: Date | null;
  readonly latePolicy: string;
  readonly retryPolicy: {
    readonly maxAttempts: number;
    readonly allowRetest: boolean;
  };
  readonly questions: readonly Question[];
  readonly canStart: boolean;
  readonly canSubmit: boolean;
  readonly reason?: string | undefined;
}

export interface DraftResponse {
  readonly draftId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly updatedAt: Date;
}

export interface AttemptResponse {
  readonly attemptId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly attemptNo: number;
  readonly status: ActivityAttempt["status"];
  readonly answers: Readonly<Record<string, unknown>>;
  readonly autoResult?: {
    readonly score: number;
    readonly maxScore: number;
    readonly details: readonly {
      readonly questionId: string;
      readonly kind: Question["kind"];
      readonly correct: boolean | null;
      readonly score: number | null;
      readonly feedback?: string;
    }[];
  };
  readonly submittedAt: Date;
  readonly gradedAt?: Date | undefined;
}

export interface ResultResponse {
  readonly attemptId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly attemptNo: number;
  readonly status: ActivityAttempt["status"];
  readonly answers: Readonly<Record<string, unknown>>;
  readonly autoResult?: AttemptResponse["autoResult"];
  readonly questions: readonly Question[];
  readonly answerKeyVisible: boolean;
  readonly submittedAt: Date;
  readonly gradedAt?: Date | undefined;
}

export function toExerciseResponse(exercise: Exercise): ExerciseResponse {
  return {
    assignmentId: exercise.assignmentId,
    activityId: exercise.activityId,
    courseVersionId: exercise.courseVersionId,
    title: exercise.title,
    studentNotes: exercise.studentNotes,
    publishAt: exercise.publishAt,
    dueAt: exercise.dueAt,
    latePolicy: exercise.latePolicy,
    retryPolicy: exercise.retryPolicy,
    questions: exercise.questions,
    canStart: exercise.canStart,
    canSubmit: exercise.canSubmit,
    reason: exercise.reason,
  };
}

export function toDraftResponse(draft: AnswerDraft): DraftResponse {
  return {
    draftId: draft.id,
    assignmentId: draft.assignmentId,
    activityId: draft.activityId,
    answers: draft.answers as Readonly<Record<string, unknown>>,
    updatedAt: draft.updatedAt,
  };
}

export function toAttemptResponse(attempt: ActivityAttempt): AttemptResponse {
  return {
    attemptId: attempt.id,
    assignmentId: attempt.assignmentId,
    activityId: attempt.activityId,
    attemptNo: attempt.attemptNo,
    status: attempt.status,
    answers: attempt.answers as Readonly<Record<string, unknown>>,
    ...(attempt.autoResult
      ? {
          autoResult: {
            score: attempt.autoResult.score,
            maxScore: attempt.autoResult.maxScore,
            details: attempt.autoResult.details,
          },
        }
      : {}),
    submittedAt: attempt.submittedAt,
    gradedAt: attempt.gradedAt,
  };
}

export function toResultResponse(result: ExerciseResult): ResultResponse {
  return {
    attemptId: result.attemptId,
    assignmentId: result.assignmentId,
    activityId: result.activityId,
    attemptNo: result.attemptNo,
    status: result.status,
    answers: result.answers as Readonly<Record<string, unknown>>,
    ...(result.autoResult
      ? {
          autoResult: {
            score: result.autoResult.score,
            maxScore: result.autoResult.maxScore,
            details: result.autoResult.details,
          },
        }
      : {}),
    questions: result.questions,
    answerKeyVisible: result.answerKeyVisible,
    submittedAt: result.submittedAt,
    gradedAt: result.gradedAt,
  };
}
