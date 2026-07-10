import type {
  Exercise,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  FillBlankQuestion,
  ShortAnswerQuestion,
  OrderingQuestion,
  MatchingQuestion,
} from "~/features/exercises/types.js";

export const singleChoiceQuestion: SingleChoiceQuestion = {
  id: "q-single",
  kind: "SINGLE_CHOICE",
  prompt: "请选择正确的声母",
  explanation: "本题考查声母辨析",
  sortOrder: 1,
  grading: "AUTO",
  options: [
    { id: "opt-a", text: "b" },
    { id: "opt-b", text: "p" },
  ],
};

export const multipleChoiceQuestion: MultipleChoiceQuestion = {
  id: "q-multi",
  kind: "MULTIPLE_CHOICE",
  prompt: "下列哪些是前鼻音韵母？",
  sortOrder: 2,
  grading: "AUTO",
  options: [
    { id: "opt-an", text: "an" },
    { id: "opt-ang", text: "ang" },
    { id: "opt-en", text: "en" },
  ],
};

export const fillBlankQuestion: FillBlankQuestion = {
  id: "q-fill",
  kind: "FILL_BLANK",
  prompt: "补全句子",
  sortOrder: 3,
  grading: "AUTO",
  blanks: [
    { id: "b1", label: "第一空" },
    { id: "b2", label: "第二空" },
  ],
};

export const shortAnswerQuestion: ShortAnswerQuestion = {
  id: "q-short",
  kind: "SHORT_ANSWER",
  prompt: "请用一句话描述你最喜欢的季节",
  sortOrder: 4,
  grading: "MANUAL",
};

export const orderingQuestion: OrderingQuestion = {
  id: "q-order",
  kind: "ORDERING",
  prompt: "按正确顺序排列下列词语",
  sortOrder: 5,
  grading: "AUTO",
  items: [
    { id: "item-1", text: "春天" },
    { id: "item-2", text: "夏天" },
    { id: "item-3", text: "秋天" },
  ],
};

export const matchingQuestion: MatchingQuestion = {
  id: "q-match",
  kind: "MATCHING",
  prompt: "将词语与释义连线",
  sortOrder: 6,
  grading: "AUTO",
  pairs: [
    {
      leftId: "l1",
      leftText: "河流",
      rightId: "r1",
      rightText: "水流汇聚的地方",
    },
    { leftId: "l2", leftText: "山川", rightId: "r2", rightText: "高大的地貌" },
  ],
};

export const exerciseFixture: Exercise = {
  assignmentId: "asn-1",
  activityId: "act-1",
  courseVersionId: "cv-1",
  title: "第一单元综合练习",
  studentNotes: "请认真审题",
  publishAt: null,
  dueAt: null,
  latePolicy: "REJECT",
  retryPolicy: { maxAttempts: 3, allowRetest: true },
  questions: [
    singleChoiceQuestion,
    multipleChoiceQuestion,
    fillBlankQuestion,
    shortAnswerQuestion,
    orderingQuestion,
    matchingQuestion,
  ],
  canStart: true,
  canSubmit: true,
};
