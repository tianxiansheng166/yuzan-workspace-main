import { describe, expect, it } from "vitest";
import {
  adaptReviewDetail,
  adaptReviewLanes,
} from "../../app/features/submission-review/adapters/review.adapter";
import {
  fetchReviewDashboard,
  fetchReviewDetail,
} from "../../app/features/submission-review/gateway/review.gateway";

describe("submission review adapters", () => {
  it("groups queue entries by risk lane instead of generic cards", async () => {
    const result = await fetchReviewDashboard();
    const lanes = adaptReviewLanes(result.queue ?? []);

    expect(lanes).toHaveLength(3);
    expect(lanes[0]?.title).toContain("未完成");
    expect(lanes[1]?.title).toContain("低置信度");
    expect(lanes[2]?.title).toContain("同步异常");
  });

  it("maps detail records into readable review labels", async () => {
    const result = await fetchReviewDetail("rv-demo-003");
    const detail = adaptReviewDetail(result.submission!);

    expect(detail.recommendedOutcomeLabel).toContain("线下辅导");
    expect(detail.confidenceLabel).toBe("不可用");
    expect(detail.syncLabel).toBe("同步失败");
    expect(detail.checklist.some((item) => item.tone === "warning")).toBe(true);
  });
});
