import { describe, expect, it } from "vitest";
import {
  defaultTeacherFeedbackDraft,
  submissionReviewGateway,
} from "../../app/features/submission-review/gateway/review.gateway";

describe("submission review gateway", () => {
  it("returns default dashboard submissions", async () => {
    const result = await submissionReviewGateway.getDashboard();
    expect(result.permission).toBe("teacher");
    expect(result.submissions).toHaveLength(4);
  });

  it("returns empty dashboard state without fabricating rows", async () => {
    const result = await submissionReviewGateway.getDashboard("empty");
    expect(result.submissions).toHaveLength(0);
  });

  it("returns unavailable dashboard state", async () => {
    const result = await submissionReviewGateway.getDashboard("unavailable");
    expect(result.submissions).toBeNull();
  });

  it("maps student and unknown role to permission-only responses", async () => {
    const student = await submissionReviewGateway.getDashboard("student-role");
    const unknown = await submissionReviewGateway.getDashboard("unknown-role");
    expect(student.permission).toBe("student");
    expect(unknown.permission).toBe("unknown");
  });

  it("throws for dashboard error scenario", async () => {
    await expect(submissionReviewGateway.getDashboard("error")).rejects.toThrow(
      "Failed to load submission review dashboard",
    );
  });

  it("returns detail with reading, writing and review history context", async () => {
    const result = await submissionReviewGateway.getSubmissionDetail(
      "submission-demo-001",
    );
    expect(result.submission?.audioMetadata.recordingSubmitted).toBe(true);
    expect(result.submission?.writtenExercises.length).toBeGreaterThan(0);
    expect(result.submission?.reviewHistory.length).toBeGreaterThan(0);
  });

  it("returns detail permission scenario for student role", async () => {
    const result = await submissionReviewGateway.getSubmissionDetail(
      "submission-demo-001",
      "student-role",
    );
    expect(result.permission).toBe("student");
    expect(result.submission?.id).toBe("submission-demo-001");
  });

  it("returns unavailable detail when evidence chain is missing", async () => {
    const result = await submissionReviewGateway.getSubmissionDetail(
      "submission-unavailable",
    );
    expect(result.submission).toBeNull();
  });

  it("saves valid draft as demo only", async () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "请重听第二句，重点看句尾收音是否稳定。";
    draft.reviewStatus = "returned";
    draft.needsRedo = true;
    draft.focusAreas = ["句尾收音"];
    draft.returnReason = "句尾收音证据不完整，需要重新提交。";
    const result = await submissionReviewGateway.saveFeedbackDraft(draft);
    expect(result.kind).toBe("demo-saved");
    expect(result.persisted).toBe(false);
  });

  it("submits valid draft as unavailable before SUB-001", async () => {
    const draft = defaultTeacherFeedbackDraft("submission-demo-001");
    draft.nextAction = "建议先补录，再决定是否进入正式评分。";
    draft.reviewStatus = "returned";
    draft.needsRedo = true;
    draft.focusAreas = ["同步排障"];
    draft.returnReason = "录音同步状态不完整，需要补录确认。";
    const result = await submissionReviewGateway.submitFeedback(draft);
    expect(result.kind).toBe("unavailable");
    expect(result.message).toContain("SUB-001");
  });
});
