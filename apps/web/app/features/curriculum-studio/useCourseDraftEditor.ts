import type { Ref } from "vue";
import { computed, readonly, ref, watch } from "vue";

import { useDirtyState } from "../dirty-state/composables/useDirtyState";
import type { DirtyStateEntrySaveResult } from "../dirty-state/types";

import { createDemoCurriculumStudioGateway } from "./gateway";
import type {
  CurriculumDraftDetail,
  CurriculumVersionSummary,
  GatewayResult,
  StudioScenario,
} from "./model";

export function useCourseDraftEditor(
  draftId: Ref<string>,
  scenario: Ref<StudioScenario>,
) {
  const gateway = createDemoCurriculumStudioGateway();
  const result = ref<GatewayResult<CurriculumDraftDetail> | null>(null);
  const pending = ref(false);
  const baseline = ref<CurriculumVersionSummary | null>(null);
  const summary = ref("");
  const releaseBoundary = ref("");

  async function refresh() {
    if (scenario.value === "loading") {
      pending.value = true;
      result.value = null;
      return;
    }

    pending.value = false;
    result.value = await gateway.getDraftDetail(draftId.value, scenario.value);

    if (result.value.kind === "ready") {
      baseline.value = result.value.data.version;
      summary.value = result.value.data.summary;
      releaseBoundary.value = result.value.data.releaseBoundary;
    } else {
      baseline.value = null;
      summary.value = "";
      releaseBoundary.value = "";
    }
  }

  watch(
    [draftId, scenario],
    () => {
      void refresh();
    },
    { immediate: true },
  );

  function buildDraftDetail(): CurriculumDraftDetail | null {
    if (result.value?.kind !== "ready") return null;
    return {
      ...result.value.data,
      summary: summary.value,
      releaseBoundary: releaseBoundary.value,
    };
  }

  function isDirty(): boolean {
    if (result.value?.kind !== "ready") return false;
    return (
      summary.value !== result.value.data.summary ||
      releaseBoundary.value !== result.value.data.releaseBoundary
    );
  }

  const entryId = computed(() => `course-draft:${draftId.value}`);
  const entryTitle = computed(() => {
    if (result.value?.kind === "ready") {
      return `课程草稿：${result.value.data.version.title}`;
    }
    return "课程草稿";
  });
  const entryDescription = computed(() =>
    isDirty() ? "摘要或发布边界有未保存修改" : undefined,
  );

  const dirtyEntry = useDirtyState<{
    draftId: string;
    resourceType: "course-draft";
    resourceId: string;
  }>({
    id: entryId.value,
    scope: "RESOURCE",
    owner: "curriculum-studio",
    title: entryTitle.value,
    description: entryDescription.value,
    status: "CLEAN",
    canAutoSave: true,
    canDiscard: true,
    isBlocking: true,
    save: async (): Promise<DirtyStateEntrySaveResult> => {
      const draft = buildDraftDetail();
      if (!draft || !gateway.saveDraftDetail || !baseline.value) {
        return { status: "failed", message: "无法保存：缺少草稿或基线" };
      }

      const saveResult = await gateway.saveDraftDetail(
        draftId.value,
        draft,
        baseline.value,
      );

      if (saveResult.status === "success") {
        result.value = {
          kind: "ready",
          source: "demo",
          data: saveResult.data,
          note: "草稿已保存",
        };
        baseline.value = saveResult.data.version;
      }

      return saveResult;
    },
    discard: async () => {
      await refresh();
    },
    metadata: {
      draftId: draftId.value,
      resourceType: "course-draft",
      resourceId: draftId.value,
    },
  });

  watch([summary, releaseBoundary], () => {
    dirtyEntry.updateEntry({
      description: entryDescription.value,
    });
    if (isDirty()) {
      dirtyEntry.markDirty();
    } else {
      dirtyEntry.markClean();
    }
  });

  return {
    pending: readonly(pending),
    result: readonly(result),
    summary,
    releaseBoundary,
    refresh,
    isDirty,
    dirtyEntry,
  };
}
