import { describe, expect, it, vi } from "vitest";
import { useReviewDashboard } from "../../app/features/submission-review/composables/useReviewDashboard";
import { useReviewDetail } from "../../app/features/submission-review/composables/useReviewDetail";
import { useTeacherFeedback } from "../../app/features/submission-review/composables/useTeacherFeedback";
import { defaultTeacherFeedbackDraft } from "../../app/features/submission-review/gateway/review.gateway";
import { submissionReviewGateway } from "../../app/features/submission-review/gateway/review.gateway";

describe("submission review composables", () => {
  it("loads dashboard default state", async () => {
    const review = useReviewDashboard();
    await review.load();
    expect(review.state.value).toBe("ready");
    expect(review.filteredRows.value.length).toBe(4);
  });

  it("loads dashboard permission denied for unknown role", async () => {
    const review = useReviewDashboard("unknown-role");
    await review.load();
    expect(review.state.value).toBe("permission");
    expect(review.permission.value).toBe("unknown");
  });

  it("filters dashboard rows by selected class", async () => {
    const review = useReviewDashboard();
    await review.load();
    review.filters.value = {
      className: "三年级一班",
      taskType: "all",
      status: "all",
      timeOrder: "newest",
    };
    expect(review.filteredRows.value).toHaveLength(2);
  });

  it("loads detail state with retest linkage", async () => {
    const detail = useReviewDetail("submission-demo-002");
    await detail.load();
    expect(detail.state.value).toBe("ready");
    expect(detail.detail.value?.previousSubmissionLabel).toContain("previous");
  });

  it("denies detail for student role", async () => {
    const detail = useReviewDetail("submission-demo-001", "student-role");
    await detail.load();
    expect(detail.state.value).toBe("permission");
  });

  it("keeps save draft in demo mode", async () => {
    const feedback = useTeacherFeedback(
      {
        ...defaultTeacherFeedbackDraft("submission-demo-001"),
        nextAction: "请重新听第二句，补做收音练习并回到班级里反馈。",
        reviewStatus: "returned",
        needsRedo: true,
        focusAreas: ["句尾收音"],
        returnReason: "第二句的句尾收音证据不完整。",
      },
      "demo-teacher",
    );
    await feedback.saveDraft();
    expect(feedback.lastMessage.value).toContain("demo");
  });

  it("returns unavailable for submit before SUB-001", async () => {
    const feedback = useTeacherFeedback({
      ...defaultTeacherFeedbackDraft("submission-demo-001"),
      nextAction: "先排查同步问题，再决定是否正式复测。",
      reviewStatus: "returned",
      needsRedo: true,
      focusAreas: ["同步排障"],
      returnReason: "同步证据不完整，需要先确认原始提交。",
    });
    await feedback.submitFeedback();
    expect(feedback.lastMessage.value).toContain("unavailable");
  });

  it("prevents duplicate feedback submissions", async () => {
    const gatewayCall = vi.spyOn(submissionReviewGateway, "submitFeedback");
    const feedback = useTeacherFeedback({
      ...defaultTeacherFeedbackDraft("submission-demo-001"),
      nextAction: "完成一次逐句跟读，再提交复核。",
      focusAreas: ["句尾收音"],
    });
    const first = feedback.submitFeedback();
    const second = feedback.submitFeedback();
    await Promise.all([first, second]);
    expect(gatewayCall).toHaveBeenCalledTimes(1);
    gatewayCall.mockRestore();
  });
});
