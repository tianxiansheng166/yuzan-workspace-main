import type { Question } from "./assessment.types.js";

export function stripAnswerKey(question: Question): Question {
  switch (question.kind) {
    case "SINGLE_CHOICE":
      return {
        ...question,
        answerKey: { optionId: "" },
      };
    case "MULTIPLE_CHOICE":
      return {
        ...question,
        answerKey: { optionIds: [] },
      };
    case "FILL_BLANK":
      return {
        ...question,
        answerKey: { values: [] },
      };
    case "SHORT_ANSWER":
      return question;
    case "ORDERING":
      return {
        ...question,
        answerKey: { order: [] },
      };
    case "MATCHING":
      return {
        ...question,
        answerKey: { matches: {} },
      };
    default:
      return question;
  }
}

export function withAnswerKeyVisibility(
  questions: readonly Question[],
  visible: boolean,
): readonly Question[] {
  if (visible) return questions;
  return questions.map(stripAnswerKey);
}
