import { computed, ref } from "vue";
import { submissionReviewGateway } from "../gateway/review.gateway";
import type {
  FeedbackValidationIssue,
  ReviewPageState,
  ReviewScenario,
  TeacherFeedbackDraft,
} from "../types";
import { validateTeacherFeedbackDraft } from "../validation/feedback";

export function useTeacherFeedback(
  initialDraft: TeacherFeedbackDraft,
  scenario: ReviewScenario = "default",
) {
  const draft = ref<TeacherFeedbackDraft>({ ...initialDraft });
  const state = ref<ReviewPageState>("ready");
  const issues = ref<FeedbackValidationIssue[]>([]);
  const lastMessage = ref("");
  const actionState = ref<"idle" | "saving" | "submitting">("idle");

  const canSubmit = computed(() => issues.value.length === 0);

  function validate() {
    const result = validateTeacherFeedbackDraft(draft.value);
    issues.value = result.issues;
    return result.valid;
  }

  async function saveDraft() {
    if (actionState.value !== "idle") return;
    if (!validate()) {
      return;
    }

    actionState.value = "saving";
    try {
      const result = await submissionReviewGateway.saveFeedbackDraft(
        draft.value,
        scenario,
      );
      lastMessage.value = result.message;
    } catch (error) {
      state.value = "error";
      lastMessage.value =
        error instanceof Error
          ? `草稿未保存：${error.message}`
          : "草稿未保存，当前内容仍保留在页面中。";
    } finally {
      actionState.value = "idle";
    }
  }

  async function submitFeedback() {
    if (actionState.value !== "idle") return;
    if (!validate()) {
      return;
    }

    actionState.value = "submitting";
    try {
      const result = await submissionReviewGateway.submitFeedback(
        draft.value,
        scenario,
      );
      lastMessage.value = result.message;
    } catch (error) {
      state.value = "error";
      lastMessage.value =
        error instanceof Error
          ? `反馈未提交：${error.message}`
          : "反馈未提交，当前草稿仍保留在页面中。";
    } finally {
      actionState.value = "idle";
    }
  }

  return {
    draft,
    state,
    issues,
    lastMessage,
    actionState,
    canSubmit,
    validate,
    saveDraft,
    submitFeedback,
  };
}
