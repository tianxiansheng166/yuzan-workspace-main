import {
  cloneSubmissionReviewSeed,
  defaultTeacherFeedbackDraft,
} from "../demo-data/submission-review.demo";
import type {
  ReviewScenario,
  SubmissionDetail,
  SubmissionReviewDashboardResult,
  SubmissionReviewDetailResult,
  SubmissionReviewGateway,
  TeacherFeedbackDraft,
  TeacherFeedbackResult,
} from "../types";
import { validateTeacherFeedbackDraft } from "../validation/feedback";

function delay(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function permissionFromScenario(scenario: ReviewScenario) {
  if (scenario === "student-role") {
    return "student" as const;
  }

  if (scenario === "unknown-role") {
    return "unknown" as const;
  }

  if (scenario === "demo-teacher") {
    return "demo-teacher" as const;
  }

  return "teacher" as const;
}

function findSubmission(submissionId: string): SubmissionDetail | null {
  return (
    cloneSubmissionReviewSeed().find((item) => item.id === submissionId) ?? null
  );
}

class DemoSubmissionReviewGateway implements SubmissionReviewGateway {
  async getDashboard(
    scenario: ReviewScenario = "default",
  ): Promise<SubmissionReviewDashboardResult> {
    await delay();

    if (scenario === "error") {
      throw new Error("Failed to load submission review dashboard");
    }

    if (scenario === "unavailable") {
      return {
        permission: permissionFromScenario(scenario),
        generatedAt: "2026-07-09 10:30",
        submissions: null,
      };
    }

    return {
      permission: permissionFromScenario(scenario),
      generatedAt: "2026-07-09 10:30",
      submissions: scenario === "empty" ? [] : cloneSubmissionReviewSeed(),
    };
  }

  async getSubmissionDetail(
    submissionId: string,
    scenario: ReviewScenario = "default",
  ): Promise<SubmissionReviewDetailResult> {
    await delay();

    if (scenario === "error" || submissionId === "submission-error") {
      throw new Error("Failed to load submission review detail");
    }

    if (
      scenario === "unavailable" ||
      submissionId === "submission-unavailable"
    ) {
      return {
        permission: permissionFromScenario(scenario),
        submission: null,
      };
    }

    return {
      permission: permissionFromScenario(scenario),
      submission: findSubmission(submissionId),
    };
  }

  async getFeedbackContext(
    submissionId: string,
    scenario: ReviewScenario = "default",
  ): Promise<SubmissionReviewDetailResult> {
    return this.getSubmissionDetail(submissionId, scenario);
  }

  async saveFeedbackDraft(
    draft: TeacherFeedbackDraft,
    scenario: ReviewScenario = "default",
  ): Promise<TeacherFeedbackResult> {
    await delay();

    const validation = validateTeacherFeedbackDraft(draft);
    if (!validation.valid) {
      throw new Error(validation.issues[0]?.message ?? "Invalid draft");
    }

    if (scenario === "unavailable" || scenario === "student-role") {
      return {
        kind: "unavailable",
        message: "反馈草稿当前 unavailable，真实保存要等 SUB-001 接入。",
        persisted: false,
      };
    }

    return {
      kind: "demo-saved",
      message: "已保存本地 demo 草稿，尚未写入真实服务器。",
      persisted: false,
    };
  }

  async submitFeedback(
    draft: TeacherFeedbackDraft,
    scenario: ReviewScenario = "default",
  ): Promise<TeacherFeedbackResult> {
    await delay();

    const validation = validateTeacherFeedbackDraft(draft);
    if (!validation.valid) {
      throw new Error(validation.issues[0]?.message ?? "Invalid draft");
    }

    if (scenario === "default" || scenario === "unavailable") {
      return {
        kind: "unavailable",
        message:
          "提交反馈当前 unavailable，SUB-001 完成前不会声称已写入服务器。",
        persisted: false,
      };
    }

    return {
      kind: "demo-saved",
      message: "已提交 demo 反馈预演，但仍未落到正式服务端。",
      persisted: false,
    };
  }
}

export const submissionReviewGateway: SubmissionReviewGateway =
  new DemoSubmissionReviewGateway();

export { defaultTeacherFeedbackDraft };
