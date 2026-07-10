import type {
  AnswerValue,
  AutoResult,
  Question,
  QuestionResult,
} from "./assessment.types.js";

export function gradeAnswers(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerValue>>,
): AutoResult {
  const details: QuestionResult[] = [];
  let score = 0;
  let maxScore = 0;

  for (const question of questions) {
    const answer = answers[question.id];
    maxScore += 1;

    if (!answer) {
      details.push({
        questionId: question.id,
        kind: question.kind,
        correct: false,
        score: 0,
        feedback: "未作答",
      });
      continue;
    }

    if (answer.kind !== question.kind) {
      details.push({
        questionId: question.id,
        kind: question.kind,
        correct: false,
        score: 0,
        feedback: "题型不匹配",
      });
      continue;
    }

    if (question.kind === "SHORT_ANSWER") {
      details.push({
        questionId: question.id,
        kind: question.kind,
        correct: null,
        score: null,
        feedback: "待人工复核",
      });
      continue;
    }

    const correct = isCorrect(question, answer);
    if (correct) {
      score += 1;
    }
    details.push({
      questionId: question.id,
      kind: question.kind,
      correct,
      score: correct ? 1 : 0,
    });
  }

  return { score, maxScore, details };
}

export function hasManualReview(questions: readonly Question[]): boolean {
  return questions.some(
    (q) => q.grading === "MANUAL" || q.kind === "SHORT_ANSWER",
  );
}

function isCorrect(question: Question, answer: AnswerValue): boolean {
  switch (question.kind) {
    case "SINGLE_CHOICE": {
      if (answer.kind !== "SINGLE_CHOICE") return false;
      return question.answerKey.optionId === answer.optionId;
    }
    case "MULTIPLE_CHOICE": {
      if (answer.kind !== "MULTIPLE_CHOICE") return false;
      const expected = [...question.answerKey.optionIds].sort();
      const actual = [...answer.optionIds].sort();
      return (
        expected.length === actual.length &&
        expected.every((id, index) => id === actual[index])
      );
    }
    case "FILL_BLANK": {
      if (answer.kind !== "FILL_BLANK") return false;
      const expected = question.answerKey.values.map((v) => normalizeText(v));
      const actual = answer.values.map((v) => normalizeText(v));
      return (
        expected.length === actual.length &&
        expected.every((v, index) => v === actual[index])
      );
    }
    case "ORDERING": {
      if (answer.kind !== "ORDERING") return false;
      return question.answerKey.order.every(
        (id, index) => id === answer.order[index],
      );
    }
    case "MATCHING": {
      if (answer.kind !== "MATCHING") return false;
      const expected = question.answerKey.matches;
      const actual = answer.matches;
      const expectedKeys = Object.keys(expected);
      const actualKeys = Object.keys(actual);
      if (expectedKeys.length !== actualKeys.length) return false;
      return expectedKeys.every((key) => expected[key] === actual[key]);
    }
    default:
      return false;
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
