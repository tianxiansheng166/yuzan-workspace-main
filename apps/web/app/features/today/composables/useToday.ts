import { computed, ref } from "vue";
import {
  completedActivities,
  continuingActivities,
  retestReminders,
  selectPrimaryActivity,
  sortTodayActivities,
} from "../adapters/today.adapter";
import { demoTodayGateway } from "../gateway/today.gateway";
import type { TodayActivity, TodayScenario } from "../types";

export function useToday(scenario: TodayScenario = "demo") {
  const state = ref<
    "loading" | "ready" | "empty" | "permission" | "unavailable"
  >("loading");
  const activities = ref<TodayActivity[]>([]);
  const load = async () => {
    state.value = "loading";
    const result = await demoTodayGateway.load(scenario);
    if (!result.permitted) return void (state.value = "permission");
    if (result.activities === null) return void (state.value = "unavailable");
    activities.value = sortTodayActivities(result.activities);
    state.value = activities.value.length ? "ready" : "empty";
  };
  return {
    state,
    activities,
    primary: computed(() => selectPrimaryActivity(activities.value)),
    continuing: computed(() => continuingActivities(activities.value)),
    retests: computed(() => retestReminders(activities.value)),
    completed: computed(() => completedActivities(activities.value)),
    load,
  };
}
