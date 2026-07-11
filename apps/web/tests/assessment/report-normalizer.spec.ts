import { describe, expect, it } from "vitest";
import { normalizeAssessmentReport } from "../../app/features/assessment/report-normalizer";

describe("normalizeAssessmentReport", () => {
  it("normalizes map dimensions and preserves unknown fields safely", () => {
    const result = normalizeAssessmentReport({
      status: "complete",
      dimensions: { pronunciation: { score: 120 }, futureDimension: { summary: "future" } },
      overallScore: null,
      unknownBackendField: { nested: true },
    });
    expect(result.overallScore).toBeNull();
    expect(result.dimensions).toHaveLength(2);
    expect(result.dimensions[0]?.score).toBe(100);
  });

  it("does not invent recommendations or scores when analysis is unavailable", () => {
    const result = normalizeAssessmentReport({
      analysisUnavailable: true,
      recommendations: ["fixed fallback must not leak"],
    });
    expect(result.status).toBe("unavailable");
    expect(result.overallScore).toBeNull();
    expect(result.recommendations).toEqual([]);
  });

  it("keeps provisional and review-required reports pending", () => {
    const result = normalizeAssessmentReport({ status: "complete", provisional: true, reviewRequired: true });
    expect(result.status).toBe("pending");
    expect(result.reviewRequired).toBe(true);
  });
});
