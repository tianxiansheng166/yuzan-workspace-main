import { randomUUID } from "node:crypto";
import type {
  AnswerDraft,
  ActivityAttempt,
  Question,
} from "../../../src/modules/assessment/domain/assessment.types.js";

export function singleChoiceQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "SINGLE_CHOICE",
    prompt: "请选择正确选项",
    options: [
      { id: "opt-a", text: "选项 A" },
      { id: "opt-b", text: "选项 B" },
      { id: "opt-c", text: "选项 C" },
    ],
    answerKey: { optionId: "opt-a" },
    explanation: "A 是正确答案",
    sortOrder: 0,
    grading: "AUTO",
    ...overrides,
  } as Question;
}

export function multipleChoiceQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "MULTIPLE_CHOICE",
    prompt: "请选择所有正确选项",
    options: [
      { id: "opt-a", text: "选项 A" },
      { id: "opt-b", text: "选项 B" },
      { id: "opt-c", text: "选项 C" },
    ],
    answerKey: { optionIds: ["opt-a", "opt-c"] },
    explanation: "A 和 C 是正确答案",
    sortOrder: 0,
    grading: "AUTO",
    ...overrides,
  } as Question;
}

export function fillBlankQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "FILL_BLANK",
    prompt: "请填空",
    blanks: [{ id: "b1", label: "第一空" }],
    answerKey: { values: ["正确答案"] },
    explanation: "正确答案是“正确答案”",
    sortOrder: 0,
    grading: "AUTO",
    ...overrides,
  } as Question;
}

export function shortAnswerQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "SHORT_ANSWER",
    prompt: "请简答",
    sortOrder: 0,
    grading: "MANUAL",
    ...overrides,
  } as Question;
}

export function orderingQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "ORDERING",
    prompt: "请排序",
    items: [
      { id: "item-1", text: "第一步" },
      { id: "item-2", text: "第二步" },
      { id: "item-3", text: "第三步" },
    ],
    answerKey: { order: ["item-1", "item-2", "item-3"] },
    explanation: "正确顺序是 1-2-3",
    sortOrder: 0,
    grading: "AUTO",
    ...overrides,
  } as Question;
}

export function matchingQuestion(
  overrides: Partial<Question> & { id: string },
): Question {
  return {
    activityId: "act-1",
    kind: "MATCHING",
    prompt: "请匹配",
    pairs: [
      { leftId: "l1", leftText: "甲", rightId: "r1", rightText: "一" },
      { leftId: "l2", leftText: "乙", rightId: "r2", rightText: "二" },
    ],
    answerKey: { matches: { l1: "r1", l2: "r2" } },
    explanation: "甲-一，乙-二",
    sortOrder: 0,
    grading: "AUTO",
    ...overrides,
  } as Question;
}

export function answerDraft(
  overrides: Partial<AnswerDraft> &
    Pick<
      AnswerDraft,
      "schoolId" | "assignmentId" | "activityId" | "studentUserId"
    >,
): AnswerDraft {
  return {
    id: randomUUID(),
    enrollmentId: `${overrides.assignmentId ?? "class-a"}:${overrides.studentUserId}`,
    answers: {},
    updatedAt: new Date(),
    ...overrides,
  };
}

export function activityAttempt(
  overrides: Partial<ActivityAttempt> &
    Pick<
      ActivityAttempt,
      "schoolId" | "assignmentId" | "activityId" | "studentUserId" | "attemptNo"
    >,
): ActivityAttempt {
  return {
    id: randomUUID(),
    enrollmentId: `${overrides.assignmentId ?? "class-a"}:${overrides.studentUserId}`,
    answers: {},
    status: "GRADED",
    submittedAt: new Date(),
    ...overrides,
  };
}
