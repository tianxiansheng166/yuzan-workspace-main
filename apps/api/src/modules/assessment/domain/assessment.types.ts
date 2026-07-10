export type QuestionKind =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "FILL_BLANK"
  | "SHORT_ANSWER"
  | "ORDERING"
  | "MATCHING";

export type GradingMode = "AUTO" | "MANUAL";

export interface ChoiceOption {
  readonly id: string;
  readonly text: string;
}

export interface MatchingPair {
  readonly leftId: string;
  readonly leftText: string;
  readonly rightId: string;
  readonly rightText: string;
}

export interface OrderingItem {
  readonly id: string;
  readonly text: string;
}

export interface QuestionBase {
  readonly id: string;
  readonly activityId: string;
  readonly kind: QuestionKind;
  readonly prompt: string;
  readonly explanation?: string;
  readonly sortOrder: number;
  readonly grading: GradingMode;
}

export interface SingleChoiceQuestion extends QuestionBase {
  readonly kind: "SINGLE_CHOICE";
  readonly options: readonly ChoiceOption[];
  readonly answerKey: { optionId: string };
}

export interface MultipleChoiceQuestion extends QuestionBase {
  readonly kind: "MULTIPLE_CHOICE";
  readonly options: readonly ChoiceOption[];
  readonly answerKey: { optionIds: readonly string[] };
}

export interface FillBlankQuestion extends QuestionBase {
  readonly kind: "FILL_BLANK";
  readonly blanks: readonly { id: string; label?: string }[];
  readonly answerKey: { values: readonly string[] };
}

export interface ShortAnswerQuestion extends QuestionBase {
  readonly kind: "SHORT_ANSWER";
  readonly answerKey?: never;
}

export interface OrderingQuestion extends QuestionBase {
  readonly kind: "ORDERING";
  readonly items: readonly OrderingItem[];
  readonly answerKey: { order: readonly string[] };
}

export interface MatchingQuestion extends QuestionBase {
  readonly kind: "MATCHING";
  readonly pairs: readonly MatchingPair[];
  readonly answerKey: { matches: Readonly<Record<string, string>> };
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | FillBlankQuestion
  | ShortAnswerQuestion
  | OrderingQuestion
  | MatchingQuestion;

export type AnswerValue =
  | { kind: "SINGLE_CHOICE"; optionId: string }
  | { kind: "MULTIPLE_CHOICE"; optionIds: readonly string[] }
  | { kind: "FILL_BLANK"; values: readonly string[] }
  | { kind: "SHORT_ANSWER"; text: string }
  | { kind: "ORDERING"; order: readonly string[] }
  | { kind: "MATCHING"; matches: Readonly<Record<string, string>> };

export interface AnswerDraft {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly studentUserId: string;
  readonly enrollmentId: string;
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly updatedAt: Date;
}

export type AttemptStatus = "SUBMITTED" | "GRADING" | "GRADED" | "NEEDS_REVIEW";

export interface QuestionResult {
  readonly questionId: string;
  readonly kind: QuestionKind;
  readonly correct: boolean | null;
  readonly score: number | null;
  readonly feedback?: string;
}

export interface AutoResult {
  readonly score: number;
  readonly maxScore: number;
  readonly details: readonly QuestionResult[];
}

export interface ActivityAttempt {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly studentUserId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly status: AttemptStatus;
  readonly autoResult?: AutoResult | undefined;
  readonly submittedAt: Date;
  readonly gradedAt?: Date | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface Exercise {
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

export interface ExerciseResult {
  readonly attemptId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly attemptNo: number;
  readonly status: AttemptStatus;
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly autoResult?: AutoResult | undefined;
  readonly questions: readonly Question[];
  readonly answerKeyVisible: boolean;
  readonly submittedAt: Date;
  readonly gradedAt?: Date | undefined;
}

export interface ExerciseContent {
  readonly questions: readonly Question[];
}
