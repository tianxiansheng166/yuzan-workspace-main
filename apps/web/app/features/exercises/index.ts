export { default as ExerciseShell } from "./components/ExerciseShell.vue";
export { default as QuestionRenderer } from "./components/QuestionRenderer.vue";
export { default as SingleChoiceQuestion } from "./components/SingleChoiceQuestion.vue";
export { default as MultipleChoiceQuestion } from "./components/MultipleChoiceQuestion.vue";
export { default as FillBlankQuestion } from "./components/FillBlankQuestion.vue";
export { default as ShortAnswerQuestion } from "./components/ShortAnswerQuestion.vue";
export { default as OrderingQuestion } from "./components/OrderingQuestion.vue";
export { default as MatchingQuestion } from "./components/MatchingQuestion.vue";

export type {
  AnswerDraft,
  AnswerValue,
  Attempt,
  AttemptStatus,
  AutoResult,
  Exercise,
  ExerciseResult,
  ExerciseState,
  DraftState,
  FillBlankQuestion,
  MatchingQuestion,
  MultipleChoiceQuestion,
  OrderingQuestion,
  Question,
  QuestionKind,
  ShortAnswerQuestion,
  SingleChoiceQuestion,
  SubmitState,
} from "./types.js";

export { useExercise } from "./useExercise.js";
export type { UseExerciseOptions, UseExerciseReturn } from "./useExercise.js";
