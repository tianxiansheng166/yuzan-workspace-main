import { describe, expect, it } from "vitest";
import { validateTeacherFeedbackDraft } from "../../app/features/submission-review/validation/feedback";
import { defaultTeacherFeedbackDraft } from "../../app/features/submission-review/gateway/review.gateway";

describe("submission review feedback validation", () => {
  it("rejects empty feedback comment", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.focusAreas = ["句尾收音"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.valid).toBe(false);
    expect(result.issues.some((item) => item.field === "summary")).toBe(true);
  });

  it("rejects too long feedback comment", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.summary = "过".repeat(241);
    draft.nextAction = "完成一次逐句跟读练习。";
    draft.focusAreas = ["句尾收音"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.issues.some((item) => item.message.includes("240"))).toBe(
      true,
    );
  });

  it("rejects empty focus areas", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "请先把第二句的尾音收稳，再回来复测。";
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.issues.some((item) => item.field === "focusAreas")).toBe(
      true,
    );
  });

  it("rejects redo + reviewed contradiction", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "重做以澄清同步缺口。";
    draft.needsRedo = true;
    draft.focusAreas = ["同步排障"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.issues.some((item) => item.field === "reviewStatus")).toBe(
      true,
    );
  });

  it("accepts a valid feedback draft", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "请重录第二句，注意句尾收音。";
    draft.reviewStatus = "returned";
    draft.needsRedo = true;
    draft.retestRecommended = true;
    draft.returnReason = "第二句的句尾收音证据不完整。";
    draft.retestGoal = "连续两次保持句尾收音清晰。";
    draft.focusAreas = ["句尾收音"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.valid).toBe(true);
  });

  it("requires a return reason when work is sent back", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "重新提交第二句朗读。";
    draft.reviewStatus = "returned";
    draft.needsRedo = true;
    draft.focusAreas = ["句尾收音"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.issues.some((item) => item.field === "returnReason")).toBe(
      true,
    );
  });

  it("requires a measurable retest goal", () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "完成一次复测。";
    draft.retestRecommended = true;
    draft.focusAreas = ["句尾收音"];
    const result = validateTeacherFeedbackDraft(draft);
    expect(result.issues.some((item) => item.field === "retestGoal")).toBe(
      true,
    );
  });
});
