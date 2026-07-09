import { describe, expect, it } from "vitest";
import {
  fetchReviewDashboard,
  fetchReviewDetail,
} from "../../app/features/submission-review/gateway/review.gateway";

describe("submission review gateway", () => {
  it("returns demo queue entries for the default dashboard", async () => {
    const result = await fetchReviewDashboard();
    expect(result.role).toBe("teacher");
    expect(result.queue).toHaveLength(3);
    expect(result.queue?.[0]?.isDemo).toBe(true);
  });

  it("returns permission and unavailable states without fabricating data access", async () => {
    const permission = await fetchReviewDashboard("permission");
    const unavailable = await fetchReviewDashboard("unavailable");

    expect(permission.role).toBe("observer");
    expect(permission.queue).not.toBeNull();
    expect(unavailable.role).toBe("teacher");
    expect(unavailable.queue).toBeNull();
  });

  it("throws explicit load failures for the dashboard error mode", async () => {
    await expect(fetchReviewDashboard("error")).rejects.toThrow(
      "Failed to load submission review queue",
    );
  });

  it("returns a review detail with artifacts, checklist and history", async () => {
    const result = await fetchReviewDetail("rv-demo-001");
    expect(result.role).toBe("teacher");
    expect(result.submission?.artifacts.length).toBeGreaterThan(0);
    expect(result.submission?.checklist.length).toBeGreaterThan(0);
    expect(result.submission?.history.length).toBeGreaterThan(0);
  });

  it("supports permission and unavailable detail states", async () => {
    const permission = await fetchReviewDetail("rv-demo-001", "permission");
    const unavailable = await fetchReviewDetail("rv-demo-001", "unavailable");

    expect(permission.role).toBe("observer");
    expect(permission.submission?.id).toBe("rv-demo-001");
    expect(unavailable.role).toBe("teacher");
    expect(unavailable.submission).toBeNull();
  });
});
