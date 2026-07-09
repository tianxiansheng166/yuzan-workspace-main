import { computed, ref } from "vue";
import {
  adaptReviewLanes,
  type ReviewLaneViewModel,
} from "~/features/submission-review/adapters/review.adapter";
import {
  fetchReviewDashboard,
  type ReviewDemoMode,
} from "~/features/submission-review/gateway/review.gateway";
import type {
  QueueLane,
  ReviewRole,
  ReviewState,
} from "~/features/submission-review/types";

export function useReviewDashboard(mode: ReviewDemoMode = "default") {
  const state = ref<ReviewState>("loading");
  const role = ref<ReviewRole>("unknown");
  const generatedAt = ref("");
  const lanes = ref<ReviewLaneViewModel[]>([]);
  const errorMessage = ref("");

  const totalCount = computed(() =>
    lanes.value.reduce((count, lane) => count + lane.items.length, 0),
  );

  const activeRiskSummary = computed(() =>
    lanes.value
      .filter((lane) => lane.items.length > 0)
      .map((lane) => `${lane.title} ${lane.items.length} 项`)
      .join(" · "),
  );

  const laneCounts = computed<Record<QueueLane, number>>(() => ({
    incomplete:
      lanes.value.find((lane) => lane.lane === "incomplete")?.items.length ?? 0,
    "low-confidence":
      lanes.value.find((lane) => lane.lane === "low-confidence")?.items
        .length ?? 0,
    "sync-exception":
      lanes.value.find((lane) => lane.lane === "sync-exception")?.items
        .length ?? 0,
  }));

  const load = async () => {
    state.value = "loading";
    errorMessage.value = "";
    try {
      const result = await fetchReviewDashboard(mode);
      role.value = result.role;
      generatedAt.value = result.generatedAt;

      if (result.role !== "teacher") {
        state.value = "permission";
        lanes.value = [];
        return;
      }

      if (result.queue === null) {
        state.value = "unavailable";
        lanes.value = [];
        return;
      }

      lanes.value = adaptReviewLanes(result.queue);
      state.value = result.queue.length === 0 ? "empty" : "ready";
    } catch (error) {
      state.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : "加载复核队列失败";
    }
  };

  return {
    state,
    role,
    generatedAt,
    lanes,
    totalCount,
    laneCounts,
    activeRiskSummary,
    errorMessage,
    load,
  };
}
