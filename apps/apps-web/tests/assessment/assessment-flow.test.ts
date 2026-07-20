import { describe, expect, it } from "vitest";

import { assessmentWrittenQuestions } from "../../app/features/assessment/assessment-content";
import {
  createDemoAssessmentGateway,
  createLiveAssessmentGateway,
  listAssessmentHistory,
} from "../../app/features/assessment/assessment-gateway";
import {
  countAnsweredQuestions,
  createInitialWrittenAnswers,
} from "../../app/features/assessment/assessment-helpers";
import {
  createMemoryStorage,
  readWrittenDraft,
  saveWrittenDraft,
} from "../../app/features/assessment/assessment-storage";
import type {
  ReadingAttemptMeta,
  WrittenAnswers,
} from "../../app/features/assessment/assessment-types";

const readingMeta: ReadingAttemptMeta = {
  startedAt: "2026-07-09T08:00:00.000Z",
  completedAt: "2026-07-09T08:00:24.000Z",
  durationMs: 24000,
  mimeType: "audio/webm",
  promptTitle: "朗读热身",
};

function buildAnswers(): WrittenAnswers {
  return {
    "q-choice-tone": "a",
    "q-judgement-expression": "true",
    "q-fill-blank-scene": {
      "blank-1": "窗户",
      "blank-2": "窗子",
    },
    "q-short-answer-reflection":
      "我会放慢开头语速，在句尾稍作停顿，让重音更自然。",
  };
}

describe("assessment helper coverage", () => {
  it("creates and counts answers across all supported written question kinds", () => {
    const initialAnswers = createInitialWrittenAnswers(
      assessmentWrittenQuestions,
    );

    expect(initialAnswers["q-choice-tone"]).toBe("");
    expect(initialAnswers["q-judgement-expression"]).toBe("");
    expect(initialAnswers["q-short-answer-reflection"]).toBe("");
    expect(initialAnswers["q-fill-blank-scene"]).toEqual({
      "blank-1": "",
      "blank-2": "",
    });

    expect(
      countAnsweredQuestions(assessmentWrittenQuestions, buildAnswers()),
    ).toBe(4);
  });

  it("round-trips written drafts through storage", () => {
    const storage = createMemoryStorage();
    const draft = {
      answers: buildAnswers(),
      updatedAt: "2026-07-09T08:10:00.000Z",
    };

    saveWrittenDraft("demo", draft, storage);

    expect(readWrittenDraft("demo", storage)).toEqual(draft);
  });
});

describe("assessment gateways", () => {
  it("stores live submissions as pending without demo scores", async () => {
    const storage = createMemoryStorage();
    const gateway = createLiveAssessmentGateway(storage);
    const report = await gateway.submitAssessment({
      mode: "live",
      reading: readingMeta,
      answers: buildAnswers(),
      totalQuestions: assessmentWrittenQuestions.length,
      answeredQuestions: 4,
    });

    expect(report.mode).toBe("live");
    expect(report.status).toBe("pending");
    expect(report.isDemo).toBe(false);
    expect(report.overallScore).toBeUndefined();
    expect(
      report.dimensions.every((dimension) => dimension.score === undefined),
    ).toBe(true);

    const history = await gateway.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.reportId).toBe(report.reportId);
  });

  it("stores demo submissions as explicit demo reports with scores", async () => {
    const storage = createMemoryStorage();
    const gateway = createDemoAssessmentGateway(storage);
    const report = await gateway.submitAssessment({
      mode: "demo",
      reading: readingMeta,
      answers: buildAnswers(),
      totalQuestions: assessmentWrittenQuestions.length,
      answeredQuestions: 4,
    });

    expect(report.mode).toBe("demo");
    expect(report.status).toBe("complete");
    expect(report.isDemo).toBe(true);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.summary).toContain("demo 数据");
    expect(
      report.dimensions.every(
        (dimension) => typeof dimension.score === "number",
      ),
    ).toBe(true);
  });

  it("keeps old records when multiple attempts are submitted", async () => {
    const storage = createMemoryStorage();
    const liveGateway = createLiveAssessmentGateway(storage);
    const demoGateway = createDemoAssessmentGateway(storage);

    const first = await liveGateway.submitAssessment({
      mode: "live",
      reading: readingMeta,
      answers: buildAnswers(),
      totalQuestions: assessmentWrittenQuestions.length,
      answeredQuestions: 3,
    });

    const second = await demoGateway.submitAssessment({
      mode: "demo",
      reading: readingMeta,
      answers: buildAnswers(),
      totalQuestions: assessmentWrittenQuestions.length,
      answeredQuestions: 4,
    });

    const history = await listAssessmentHistory(storage);

    expect(history).toHaveLength(2);
    expect(new Set(history.map((item) => item.reportId)).size).toBe(2);
    expect(history.some((item) => item.reportId === first.reportId)).toBe(true);
    expect(history.some((item) => item.reportId === second.reportId)).toBe(
      true,
    );
  });
});
