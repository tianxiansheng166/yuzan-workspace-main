import { describe, expect, it } from "vitest";
import {
  QUESTION_BANK_DETERMINISTIC_SCORER_VERSION,
  scoreQuestionBankResponse,
} from "../../src/modules/assessment/question-bank-deterministic-scoring.service.js";

const exactSpec = { strategy: "EXACT_CHOICE", maxScore: 3, referenceAnswer: "B" };
const textSpec = { strategy: "ACCEPTED_TEXT", maxScore: 5, acceptedAnswers: ["春风吹，花儿开。"] };
const dictationSpec = {
  strategy: "DICTATION_ALIGNMENT",
  maxScore: 5,
  referenceAnswer: "甲乙丙丁",
  deductionRules: [
    "扣1分/字；错5个字，本题不得分",
    "语序颠倒无序，扣1分（如错别字已扣满5个，不重复扣分）",
  ],
};

function score(scoringSpec: unknown, answer: unknown, maxScore = 5) {
  return scoreQuestionBankResponse({ scoringSpec, answer, maxScore });
}

describe("Question Bank deterministic scorer", () => {
  it("scores exact choices by option key only", () => {
    expect(score({ ...exactSpec }, { value: "B" }, 3)).toMatchObject({ state: "AUTO_SCORED", score: 3, maxScore: 3, strategy: "EXACT_CHOICE" });
    expect(score({ ...exactSpec }, { value: "A" }, 3)).toMatchObject({ state: "AUTO_SCORED", score: 0 });
    expect(score({ ...exactSpec }, { value: " b " }, 3)).toMatchObject({ state: "AUTO_SCORED", score: 3 });
    expect(score({ ...exactSpec }, { value: "B. option text" }, 3)).toMatchObject({ state: "AUTO_SCORED", score: 0 });
    expect(score({ ...exactSpec }, { value: "E" }, 3)).toMatchObject({ state: "AUTO_SCORED", score: 0 });
    expect(score({ ...exactSpec }, {}, 3)).toMatchObject({ state: "AUTO_SCORED", score: 0 });
  });

  it("scores accepted text with only authored alternatives and conservative normalization", () => {
    expect(score(textSpec, { value: "春风吹，花儿开。" })).toMatchObject({ state: "AUTO_SCORED", score: 5 });
    expect(score(textSpec, { value: "　春风吹，花儿开。　" })).toMatchObject({ state: "AUTO_SCORED", score: 5 });
    expect(score(textSpec, { value: "春風吹，花儿开。" })).toMatchObject({ state: "AUTO_SCORED", score: 0 });
    expect(score(textSpec, { value: "春风吹，花儿开" })).toMatchObject({ state: "AUTO_SCORED", score: 0 });
    expect(score({ strategy: "ACCEPTED_TEXT", maxScore: 5, referenceAnswer: "学校/操场/树木" }, { value: "操场" })).toMatchObject({ state: "AUTO_SCORED", score: 5 });
  });

  it("compiles the published dictation rule without allowing unsupported insertions", () => {
    expect(score(dictationSpec, { value: "甲乙丙丁" })).toMatchObject({ state: "AUTO_SCORED", score: 5, maxScore: 5 });
    expect(score(dictationSpec, { value: "甲乙X丁" })).toMatchObject({ state: "AUTO_SCORED", score: 4 });
    expect(score(dictationSpec, { value: "甲乙丁" })).toMatchObject({ state: "AUTO_SCORED", score: 4 });
    expect(score(dictationSpec, { value: "甲乙丙X丁" })).toMatchObject({ state: "NEEDS_REVIEW", score: null, reasonCode: "SCORING_RULE_UNSUPPORTED" });
    expect(score(dictationSpec, { value: "甲X丁" })).toMatchObject({ state: "AUTO_SCORED", score: 3 });
    expect(score({ ...dictationSpec, referenceAnswer: "甲乙丙丁戊" }, { value: "己庚辛壬癸" })).toMatchObject({ state: "AUTO_SCORED", score: 0 });
  });

  it("applies the authored one-point order deduction and score bounds", () => {
    const result = score({ ...dictationSpec, referenceAnswer: "甲乙丙" }, { value: "乙甲丙" });
    expect(result).toMatchObject({ state: "AUTO_SCORED", score: 2 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(result.maxScore ?? 0);
  });

  it("fails closed for unsupported or malformed dictation rules", () => {
    expect(score({ ...dictationSpec, deductionRules: ["每错一字扣两分"] }, { value: "甲乙丙丁" })).toMatchObject({ state: "NEEDS_REVIEW", score: null, reasonCode: "SCORING_RULE_UNSUPPORTED" });
    expect(score({ strategy: "DICTATION_ALIGNMENT", maxScore: 5, referenceAnswer: "甲乙丙丁" }, { value: "甲乙丙丁" })).toMatchObject({ state: "NEEDS_REVIEW", score: null, reasonCode: "SCORING_RULE_UNSUPPORTED" });
    expect(score({ ...exactSpec, maxScore: 4 }, { value: "B" }, 3)).toMatchObject({ state: "NEEDS_REVIEW", score: null, reasonCode: "SCORING_CONFIG_INVALID" });
  });

  it("never auto-scores rubric text or speech", () => {
    expect(score({ strategy: "RUBRIC_TEXT", maxScore: 8, referenceAnswer: "搬运", rubric: ["secret"] }, { value: "搬运" }, 8)).toMatchObject({ state: "NEEDS_REVIEW", strategy: "RUBRIC_TEXT", score: null, reasonCode: "RUBRIC_REVIEW_REQUIRED" });
    expect(score({ strategy: "SPEECH_READING", maxScore: 4, targetText: "secret" }, { value: "anything" }, 4)).toMatchObject({ state: "NEEDS_REVIEW", strategy: "SPEECH_READING", score: null, reasonCode: "SPEECH_SCORING_OUT_OF_SCOPE" });
  });

  it("returns stable safe results without authored scoring fields", () => {
    const first = score({ ...exactSpec, acceptedAnswers: ["secret"] }, { value: "B" }, 3);
    const second = score({ ...exactSpec, acceptedAnswers: ["secret"] }, { value: "B" }, 3);
    expect(first).toEqual(second);
    expect(first.scorerVersion).toBe(QUESTION_BANK_DETERMINISTIC_SCORER_VERSION);
    const serialized = JSON.stringify(first);
    for (const protectedKey of ["correctAnswer", "referenceAnswer", "acceptedAnswers", "rubric", "deductionRules", "scoringSpec", "targetText"]) {
      expect(serialized).not.toContain(protectedKey);
    }
  });
});
