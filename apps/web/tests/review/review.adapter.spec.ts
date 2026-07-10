import { describe, expect, it } from "vitest";
import { cloneSubmissionReviewSeed } from "../../app/features/submission-review/demo-data/submission-review.demo";
import {
  adaptSubmissionDetail,
  adaptSubmissionSummary,
  buildReviewFilterOptions,
  filterSubmissionSummaries,
  sortSubmissionSummaries,
} from "../../app/features/submission-review/adapters/review.adapter";

describe("submission review adapters", () => {
  it("builds class and task filter options from demo data", () => {
    const seed = cloneSubmissionReviewSeed();
    const options = buildReviewFilterOptions(seed);
    expect(options.classOptions).toContain("三年级一班");
    expect(options.taskOptions).toContain("initial-assessment");
    expect(options.statusOptions).toContain("attention");
  });

  it("filters by class name", () => {
    const result = filterSubmissionSummaries(cloneSubmissionReviewSeed(), {
      className: "三年级一班",
      taskType: "all",
      status: "all",
      timeOrder: "newest",
    });
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.className === "三年级一班")).toBe(true);
  });

  it("filters by task name", () => {
    const result = filterSubmissionSummaries(cloneSubmissionReviewSeed(), {
      className: "all",
      taskType: "written-practice",
      status: "all",
      timeOrder: "newest",
    });
    expect(result).toHaveLength(2);
    expect(
      result.every((item) => item.submissionType === "written-practice"),
    ).toBe(true);
  });

  it("filters by review status", () => {
    const result = filterSubmissionSummaries(cloneSubmissionReviewSeed(), {
      className: "all",
      taskType: "all",
      status: "overdue",
      timeOrder: "newest",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.isOverdue).toBe(true);
  });

  it("adapts summary into readable status labels", () => {
    const result = adaptSubmissionSummary(cloneSubmissionReviewSeed()[0]!);
    expect(result.submissionTypeLabel).toBe("首次测评");
    expect(result.reviewStatusLabel).toBe("待复核");
    expect(result.aiAssistLabel).toContain("pending");
  });

  it("sorts priority work before the remaining queue", () => {
    const result = sortSubmissionSummaries(cloneSubmissionReviewSeed());
    expect(result[0]?.reviewStatus).toBe("priority");
    expect(result.at(-1)?.reviewStatus).toBe("completed");
  });

  it("adapts detail with report and previous submission labels", () => {
    const result = adaptSubmissionDetail(cloneSubmissionReviewSeed()[1]!);
    expect(result.reportLabel).toContain("unavailable");
    expect(result.previousSubmissionLabel).toContain("previous");
    expect(result.teacherReviewLabel).toContain("pending");
  });
});
