import { ref } from "vue";
import { adaptSubmissionDetail } from "../adapters/review.adapter";
import { submissionReviewGateway } from "../gateway/review.gateway";
import type {
  ReviewPageState,
  ReviewScenario,
  SubmissionDetail,
} from "../types";

export function useReviewDetail(
  submissionId: string,
  scenario: ReviewScenario = "default",
) {
  const state = ref<ReviewPageState>("loading");
  const permission = ref<"teacher" | "demo-teacher" | "student" | "unknown">(
    "unknown",
  );
  const detail = ref<ReturnType<typeof adaptSubmissionDetail> | null>(null);
  const rawDetail = ref<SubmissionDetail | null>(null);
  const errorMessage = ref("");

  async function load() {
    state.value = "loading";
    errorMessage.value = "";

    try {
      const result = await submissionReviewGateway.getSubmissionDetail(
        submissionId,
        scenario,
      );
      permission.value = result.permission;

      if (result.permission === "student" || result.permission === "unknown") {
        state.value = "permission";
        detail.value = null;
        rawDetail.value = null;
        return;
      }

      if (!result.submission) {
        state.value = "unavailable";
        detail.value = null;
        rawDetail.value = null;
        return;
      }

      rawDetail.value = result.submission;
      detail.value = adaptSubmissionDetail(result.submission);
      state.value = "ready";
    } catch (error) {
      state.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : "加载提交详情失败";
    }
  }

  return {
    state,
    permission,
    detail,
    rawDetail,
    errorMessage,
    load,
  };
}
