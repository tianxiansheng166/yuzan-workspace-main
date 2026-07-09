import { computed, ref } from "vue";
import {
  adaptReviewDetail,
  type ReviewDetailViewModel,
} from "~/features/submission-review/adapters/review.adapter";
import {
  fetchReviewDetail,
  type ReviewDemoMode,
} from "~/features/submission-review/gateway/review.gateway";
import type {
  ReviewRole,
  ReviewState,
} from "~/features/submission-review/types";

type LocalDecision = "accept" | "return" | "offline-support";

export function useReviewDetail(
  reviewId: string,
  mode: ReviewDemoMode = "default",
) {
  const state = ref<ReviewState>("loading");
  const role = ref<ReviewRole>("unknown");
  const detail = ref<ReviewDetailViewModel | null>(null);
  const draftNote = ref("");
  const errorMessage = ref("");
  const actionInFlight = ref<LocalDecision | null>(null);
  const actionBanner = ref("");

  const canReview = computed(() => role.value === "teacher");

  const load = async () => {
    state.value = "loading";
    actionBanner.value = "";
    errorMessage.value = "";

    try {
      const result = await fetchReviewDetail(reviewId, mode);
      role.value = result.role;

      if (result.role !== "teacher") {
        state.value = "permission";
        detail.value = null;
        draftNote.value = "";
        return;
      }

      if (!result.submission) {
        state.value = "unavailable";
        detail.value = null;
        draftNote.value = "";
        return;
      }

      detail.value = adaptReviewDetail(result.submission);
      draftNote.value = detail.value.teacherDraftNote;
      state.value = "ready";
    } catch (error) {
      state.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : "加载复核详情失败";
    }
  };

  const submitLocalDecision = async (decision: LocalDecision) => {
    if (!detail.value || actionInFlight.value) {
      return;
    }

    actionInFlight.value = decision;
    await new Promise((resolve) => setTimeout(resolve, 180));

    const decisionLabel =
      decision === "accept"
        ? "接受"
        : decision === "return"
          ? "退回补充"
          : "线下辅导 / 排障";

    detail.value = {
      ...detail.value,
      decisionLabel: `${decisionLabel}（demo / pending）`,
      teacherDraftNote: draftNote.value,
    };
    actionBanner.value = `已记录本地 ${decisionLabel} 操作，当前仅为 demo / pending，未接 SUB-001 真实提交服务。`;
    actionInFlight.value = null;
  };

  return {
    state,
    role,
    detail,
    draftNote,
    errorMessage,
    canReview,
    actionInFlight,
    actionBanner,
    load,
    submitLocalDecision,
  };
}
