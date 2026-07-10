import { computed, ref } from "vue";
import {
  adaptSubmissionSummary,
  buildReviewFilterOptions,
  filterSubmissionSummaries,
  sortSubmissionSummaries,
  type ReviewFilterState,
} from "../adapters/review.adapter";
import { submissionReviewGateway } from "../gateway/review.gateway";
import type {
  ReviewPageState,
  ReviewScenario,
  SubmissionSummary,
} from "../types";

export function useReviewDashboard(scenario: ReviewScenario = "default") {
  const state = ref<ReviewPageState>("loading");
  const generatedAt = ref("");
  const permission = ref<"teacher" | "demo-teacher" | "student" | "unknown">(
    "unknown",
  );
  const submissions = ref<SubmissionSummary[]>([]);
  const errorMessage = ref("");
  const filters = ref<ReviewFilterState>({
    className: "all",
    taskType: "all",
    status: "all",
    timeOrder: "newest",
  });

  const filterOptions = computed(() =>
    buildReviewFilterOptions(submissions.value),
  );
  const filteredRows = computed(() =>
    sortSubmissionSummaries(
      filterSubmissionSummaries(submissions.value, filters.value),
      filters.value.timeOrder,
    ).map(adaptSubmissionSummary),
  );

  async function load() {
    state.value = "loading";
    errorMessage.value = "";

    try {
      const result = await submissionReviewGateway.getDashboard(scenario);
      permission.value = result.permission;
      generatedAt.value = result.generatedAt;

      if (result.permission === "student" || result.permission === "unknown") {
        state.value = "permission";
        submissions.value = [];
        return;
      }

      if (result.submissions === null) {
        state.value = "unavailable";
        submissions.value = [];
        return;
      }

      submissions.value = result.submissions;
      state.value = result.submissions.length === 0 ? "empty" : "ready";
    } catch (error) {
      state.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : "加载教师复核列表失败";
    }
  }

  return {
    state,
    generatedAt,
    permission,
    submissions,
    filters,
    filterOptions,
    filteredRows,
    errorMessage,
    load,
  };
}
