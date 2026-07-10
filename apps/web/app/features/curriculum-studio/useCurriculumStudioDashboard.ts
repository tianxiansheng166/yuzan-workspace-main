import type { Ref } from "vue";

import { createDemoCurriculumStudioGateway } from "./gateway";
import type {
  CurriculumStudioDashboardData,
  GatewayResult,
  StudioScenario,
} from "./model";

export function useCurriculumStudioDashboard(scenario: Ref<StudioScenario>) {
  const gateway = createDemoCurriculumStudioGateway();
  const result = ref<GatewayResult<CurriculumStudioDashboardData> | null>(null);
  const pending = ref(false);

  async function refresh() {
    if (scenario.value === "loading") {
      pending.value = true;
      result.value = null;
      return;
    }

    pending.value = false;
    result.value = await gateway.getDashboard(scenario.value);
  }

  watch(
    scenario,
    () => {
      void refresh();
    },
    { immediate: true },
  );

  return {
    pending,
    result,
    refresh,
  };
}
