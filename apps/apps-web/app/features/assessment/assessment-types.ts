export type AssessmentMode = "live" | "demo";

export type AssessmentReportStatus = "pending" | "unavailable" | "complete";

export type WrittenQuestionKind =
  "choice" | "judgement" | "fill-blank" | "short-answer";

export interface WrittenOption {
  value: string;
  label: string;
}

export interface WrittenBlank {
  id: string;
  label: string;
  placeholder: string;
}

interface WrittenQuestionBase {
  id: string;
  kind: WrittenQuestionKind;
  prompt: string;
  helperText?: string;
}

export interface ChoiceQuestion extends WrittenQuestionBase {
  kind: "choice" | "judgement";
  options: WrittenOption[];
}

export interface FillBlankQuestion extends WrittenQuestionBase {
  kind: "fill-blank";
  blanks: WrittenBlank[];
}

export interface ShortAnswerQuestion extends WrittenQuestionBase {
  kind: "short-answer";
  minLength?: number;
  placeholder: string;
}

export type WrittenQuestion =
  ChoiceQuestion | FillBlankQuestion | ShortAnswerQuestion;

export type WrittenAnswerValue = string | Record<string, string>;

export type WrittenAnswers = Record<string, WrittenAnswerValue>;

export interface WrittenDraft {
  answers: WrittenAnswers;
  updatedAt: string;
}

export interface ReadingAttemptMeta {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  mimeType: string;
  promptTitle: string;
}

export interface AssessmentSubmissionInput {
  mode: AssessmentMode;
  reading: ReadingAttemptMeta;
  answers: WrittenAnswers;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface AssessmentDimensionResult {
  key: "reading" | "written";
  label: string;
  status: AssessmentReportStatus;
  summary: string;
  score?: number;
}

export interface AssessmentReport {
  reportId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: AssessmentMode;
  status: AssessmentReportStatus;
  isDemo: boolean;
  summary: string;
  disclaimer: string;
  reading: ReadingAttemptMeta;
  written: {
    totalQuestions: number;
    answeredQuestions: number;
  };
  dimensions: AssessmentDimensionResult[];
  highlights: string[];
  overallScore?: number;
}
