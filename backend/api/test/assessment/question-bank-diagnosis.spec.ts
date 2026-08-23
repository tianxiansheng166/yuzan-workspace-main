import { describe, expect, it } from "vitest";
import {
  buildQuestionBankDiagnosis,
  QuestionBankDiagnosisError,
  type QuestionBankDiagnosisItem,
} from "../../src/modules/assessment/question-bank-diagnosis.js";

const level = "水平一级";

const blueprint: Array<{
  family: string;
  domain: string;
  count: number;
  max: number;
}> = [
  { family: "LISTEN_IMAGE_CHOICE", domain: "LISTEN", count: 3, max: 3 },
  { family: "DICTATION", domain: "LISTEN", count: 3, max: 5 },
  { family: "READ_ALOUD", domain: "SPEAK", count: 3, max: 4 },
  { family: "PICTURE_SPEAKING", domain: "SPEAK", count: 1, max: 14 },
  { family: "WORD_RECOGNITION", domain: "READ", count: 3, max: 4 },
  { family: "SENTENCE_COMPREHENSION", domain: "READ", count: 3, max: 4 },
  { family: "PICTURE_WORD", domain: "WRITE", count: 2, max: 5 },
  { family: "SENTENCE_COMPLETION", domain: "WRITE", count: 2, max: 8 },
];

function items(
  scores: Record<string, number | number[]> = {},
): QuestionBankDiagnosisItem[] {
  let index = 0;
  return blueprint.flatMap((definition) =>
    Array.from({ length: definition.count }, (_unused, occurrence) => {
      index += 1;
      const configured = scores[definition.family];
      const earned = Array.isArray(configured)
        ? configured[occurrence]
        : configured;
      return {
        assessmentItemId: `assessment-item-${index}`,
        questionVersionId: `question-version-${index}`,
        sortOrder: index,
        domain: definition.domain,
        family: definition.family,
        level,
        earned: earned ?? definition.max,
        max: definition.max,
      };
    }),
  );
}

describe("Question Bank deterministic diagnosis", () => {
  it("aggregates the canonical 100-point structure without priorities for a perfect report", () => {
    const diagnosis = buildQuestionBankDiagnosis(items());

    expect(diagnosis).toMatchObject({
      version: "qb-diagnosis-v1",
      overall: {
        earnedPoints: 100,
        maxPoints: 100,
        percentage: 100,
        proficiency: "STRONG",
      },
      domains: [
        { domain: "LISTEN", earnedPoints: 24, maxPoints: 24 },
        { domain: "SPEAK", earnedPoints: 26, maxPoints: 26 },
        { domain: "READ", earnedPoints: 24, maxPoints: 24 },
        { domain: "WRITE", earnedPoints: 26, maxPoints: 26 },
      ],
    });
    expect(diagnosis.families).toHaveLength(8);
    expect(diagnosis.priorities).toEqual([]);
    expect(diagnosis.retryCandidates).toEqual([]);
    expect(diagnosis.strengths.map((family) => family.family)).toEqual([
      "SENTENCE_COMPLETION",
      "DICTATION",
    ]);
  });

  it("identifies one weak family and emits its fixed, student-facing guidance", () => {
    const diagnosis = buildQuestionBankDiagnosis(items({ DICTATION: 2 }));

    expect(diagnosis.priorities).toMatchObject([
      {
        family: "DICTATION",
        displayName: "听写句子",
        percentage: 40,
        lostPoints: 9,
      },
    ]);
    expect(diagnosis.nextSteps).toEqual([
      expect.objectContaining({
        family: "DICTATION",
        displayName: "听写句子",
        guidance: "重点练习听清句子中的关键字词，再完整写出句子。",
      }),
    ]);
    expect(
      diagnosis.retryCandidates.filter(
        (candidate) => candidate.family === "DICTATION",
      ),
    ).toHaveLength(3);
  });

  it("returns at most three priorities using percentage, lost points, then canonical family order", () => {
    const diagnosis = buildQuestionBankDiagnosis(
      items({
        LISTEN_IMAGE_CHOICE: 0,
        DICTATION: 0,
        READ_ALOUD: 0,
        PICTURE_SPEAKING: 0,
      }),
    );

    expect(diagnosis.priorities.map((family) => family.family)).toEqual([
      "DICTATION",
      "PICTURE_SPEAKING",
      "READ_ALOUD",
    ]);
    expect(diagnosis.nextSteps).toHaveLength(3);
  });

  it("uses canonical family order as the final tie breaker", () => {
    const diagnosis = buildQuestionBankDiagnosis(
      items({
        LISTEN_IMAGE_CHOICE: 3,
        DICTATION: 5,
        READ_ALOUD: 4,
        PICTURE_SPEAKING: 14,
        WORD_RECOGNITION: [0, 4, 4],
        SENTENCE_COMPREHENSION: [0, 4, 4],
        PICTURE_WORD: 5,
        SENTENCE_COMPLETION: 8,
      }),
    );

    expect(diagnosis.priorities.map((family) => family.family)).toEqual([
      "WORD_RECOGNITION",
      "SENTENCE_COMPREHENSION",
    ]);
  });

  it("uses teacher-finalized speech score and ignores extra provider candidate data", () => {
    const source = items({ READ_ALOUD: [0, 4, 4] });
    (
      source.find(
        (item) => item.family === "READ_ALOUD",
      ) as QuestionBankDiagnosisItem & { candidatePoints?: number }
    ).candidatePoints = 4;

    const diagnosis = buildQuestionBankDiagnosis(source);
    const readAloud = diagnosis.families.find(
      (family) => family.family === "READ_ALOUD",
    );
    expect(readAloud).toMatchObject({
      earnedPoints: 8,
      maxPoints: 12,
      percentage: 66.67,
      proficiency: "PRIORITY",
    });
    expect(JSON.stringify(diagnosis)).not.toContain("candidatePoints");
  });

  it("keeps a formal zero score valid and creates a retry candidate", () => {
    const diagnosis = buildQuestionBankDiagnosis(
      items({ PICTURE_SPEAKING: 0 }),
    );
    expect(
      diagnosis.families.find((family) => family.family === "PICTURE_SPEAKING"),
    ).toMatchObject({ earnedPoints: 0, maxPoints: 14 });
    expect(
      diagnosis.retryCandidates.find(
        (candidate) => candidate.family === "PICTURE_SPEAKING",
      ),
    ).toMatchObject({ earned: 0, max: 14 });
  });

  it("fails closed for zero-point or missing Question Bank metadata", () => {
    const zeroPoint = items();
    zeroPoint[0] = { ...zeroPoint[0]!, max: 0, earned: 0 };
    expect(() => buildQuestionBankDiagnosis(zeroPoint)).toThrow(
      QuestionBankDiagnosisError,
    );

    const missingFamily = items();
    missingFamily[0] = { ...missingFamily[0]!, family: null };
    expect(() => buildQuestionBankDiagnosis(missingFamily)).toThrow(
      QuestionBankDiagnosisError,
    );
  });

  it("is deeply equal on repeat runs", () => {
    const source = items({
      DICTATION: [0, 5, 2],
      READ_ALOUD: [4, 1, 4],
      PICTURE_WORD: [0, 5],
    });
    expect(buildQuestionBankDiagnosis(source)).toEqual(
      buildQuestionBankDiagnosis(source),
    );
  });

  it.each(["水平一级", "水平三级", "水平六级"])(
    "uses actual metadata aggregation for %s without level-specific branches",
    (targetLevel) => {
      const source = items({ DICTATION: [4, 5, 5], READ_ALOUD: [4, 0, 4] }).map(
        (item) => ({ ...item, level: targetLevel }),
      );
      const diagnosis = buildQuestionBankDiagnosis(source);
      expect(diagnosis.overall.maxPoints).toBe(100);
      expect(
        diagnosis.families.find((family) => family.family === "DICTATION")
          ?.levels,
      ).toEqual([targetLevel]);
      expect(diagnosis.priorities.map((family) => family.family)).toEqual([
        "READ_ALOUD",
      ]);
    },
  );
});
