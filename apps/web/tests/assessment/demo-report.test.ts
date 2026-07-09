import { describe, expect, it } from "vitest";

import { getAssessmentReport } from "../../app/features/assessment/assessment-gateway";
import { createMemoryStorage } from "../../app/features/assessment/assessment-storage";

describe("assessment demo report direct link", () => {
  it("returns a demo report for reportId 'demo' even with empty storage", async () => {
    const storage = createMemoryStorage();
    const report = await getAssessmentReport("demo", storage);

    expect(report).not.toBeNull();
    expect(report?.reportId).toBe("demo");
    expect(report?.mode).toBe("demo");
    expect(report?.isDemo).toBe(true);
    expect(report?.status).toBe("complete");
  });

  it("marks the demo report as not a real AI result", async () => {
    const storage = createMemoryStorage();
    const report = await getAssessmentReport("demo", storage);

    expect(report?.summary).toMatch(/demo|演示数据/i);
    expect(report?.disclaimer).toMatch(/演示数据|验证/i);
  });

  it("does not overwrite stored reports when loading the demo report", async () => {
    const storage = createMemoryStorage();
    await getAssessmentReport("demo", storage);

    const storedReports = JSON.parse(
      storage.getItem("yuzan:assessment:reports") ?? "[]",
    );
    expect(storedReports).toHaveLength(0);
  });
});
