import type { Ref } from "vue";

import { createDemoCurriculumStudioGateway } from "./gateway";
import type {
  CurriculumDraftDetail,
  GatewayResult,
  StudioScenario,
} from "./model";

export function useCurriculumStudioDraft(
  draftId: Ref<string>,
  scenario: Ref<StudioScenario>,
) {
  const gateway = createDemoCurriculumStudioGateway();
  const result = ref<GatewayResult<CurriculumDraftDetail> | null>(null);
  const pending = ref(false);

  async function refresh() {
    if (scenario.value === "loading") {
      pending.value = true;
      result.value = null;
      return;
    }

    pending.value = false;
    result.value = await gateway.getDraftDetail(draftId.value, scenario.value);
  }

  watch(
    [draftId, scenario],
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
