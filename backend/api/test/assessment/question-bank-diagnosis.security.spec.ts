import { describe, expect, it } from "vitest";
import { toAssessmentReportResponse } from "../../src/modules/assessment/dto/assessment-session.response.js";
import type { AssessmentReport } from "../../src/modules/assessment/domain/assessment.types.js";
import { buildQuestionBankDiagnosis } from "../../src/modules/assessment/question-bank-diagnosis.js";

const now = new Date("2026-08-23T00:00:00.000Z");

function reportWithDiagnosis(): AssessmentReport {
  const diagnosis = buildQuestionBankDiagnosis([
    {
      assessmentItemId: "assessment-item-safe",
      questionVersionId: "question-version-safe",
      sortOrder: 1,
      domain: "LISTEN",
      family: "DICTATION",
      level: "水平一级",
      earned: 0,
      max: 5,
    },
  ]);
  const unsafeSnapshot = {
    ...diagnosis,
    sourceTrace: { paragraph: 99 },
    providerAudit: { rawResponse: "PROVIDER_RAW_MUST_NOT_LEAK" },
    retryCandidates: diagnosis.retryCandidates.map((item) => ({
      ...item,
      correctAnswer: "SECRET_CORRECT_ANSWER",
      rubric: "SECRET_RUBRIC",
      deductionRules: ["SECRET_DEDUCTION"],
      acceptedAnswers: ["SECRET_ACCEPTED"],
      scoringSpec: { secret: true },
      teacherTranscript: "SECRET_TRANSCRIPT",
    })),
  };
  return {
    id: "report-safe",
    sessionId: "session-safe",
    schoolId: "school-safe",
    overallScore: 0,
    readingScore: null,
    writtenScore: 0,
    summary: { aggregation: "POINTS", diagnosis: unsafeSnapshot },
    recommendations: null,
    dataCompleteness: 100,
    generatedAt: now,
    generatedByUserId: "teacher-safe",
    createdAt: now,
    updatedAt: now,
  };
}

describe("Question Bank diagnosis student-report boundary", () => {
  it("does not surface a diagnosis until the completed-session gate is open", () => {
    const report = reportWithDiagnosis();
    expect(
      toAssessmentReportResponse(report, { includeDiagnosis: false }).diagnosis,
    ).toBeNull();
    expect(
      toAssessmentReportResponse(report, { includeDiagnosis: true }).diagnosis,
    ).toMatchObject({
      version: "qb-diagnosis-v1",
      retryCandidates: [
        { assessmentItemId: "assessment-item-safe", earned: 0, max: 5 },
      ],
    });
  });

  it("recursively allowlists the diagnosis payload and rejects answer, rubric, trace, and provider leaks", () => {
    const serialized = JSON.stringify(
      toAssessmentReportResponse(reportWithDiagnosis(), {
        includeDiagnosis: true,
      }),
    );
    for (const forbidden of [
      "correctAnswer",
      "referenceAnswer",
      "acceptedAnswers",
      "scoringSpec",
      "rubric",
      "deductionRules",
      "sourceTrace",
      "providerAudit",
      "rawResponse",
      "teacherTranscript",
      "SECRET_CORRECT_ANSWER",
      "SECRET_RUBRIC",
      "SECRET_DEDUCTION",
      "SECRET_ACCEPTED",
      "SECRET_TRANSCRIPT",
      "PROVIDER_RAW_MUST_NOT_LEAK",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("keeps legacy reports compatible without inventing a diagnosis", () => {
    const legacy = { ...reportWithDiagnosis(), summary: { legacy: true } };
    expect(
      toAssessmentReportResponse(legacy, { includeDiagnosis: true }).diagnosis,
    ).toBeNull();
  });
});
