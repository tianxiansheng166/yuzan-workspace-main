<script setup lang="ts">
import CurriculumStudioDraftDetailView from "../../features/curriculum-studio/CurriculumStudioDraftDetailView.vue";
import CurriculumStudioScenarioField from "../../features/curriculum-studio/CurriculumStudioScenarioField.vue";
import type { StudioScenario } from "../../features/curriculum-studio/model";
import { useCurriculumStudioDraft } from "../../features/curriculum-studio/useCurriculumStudioDraft";

const route = useRoute();
const draftId = computed(() => String(route.params.draftId ?? ""));
const scenario = ref<StudioScenario>("demo");

const { pending, result } = useCurriculumStudioDraft(draftId, scenario);
</script>

<template>
  <section class="studio-page yx-shell">
    <header class="studio-page__header">
      <div>
        <p class="yx-kicker">CURRICULUM STUDIO · DRAFT DETAIL</p>
        <h1>课程草稿详情与发布边界</h1>
        <p>
          当前页面用于 CUR-002 Web
          框架与状态演示，不伪造真实发布成功或真实评分结果。
        </p>
      </div>
      <CurriculumStudioScenarioField v-model="scenario" />
    </header>

    <CurriculumStudioDraftDetailView :pending="pending" :result="result" />
  </section>
</template>

<style scoped>
.studio-page {
  padding-block: clamp(3rem, 7vw, 7rem);
  display: grid;
  gap: 2rem;
}

.studio-page__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: end;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
}

h1 {
  max-width: 16ch;
  margin: 0.8rem 0;
  font: 600 clamp(2rem, 5vw, 4.8rem)/1 var(--yx-font-display);
}

.studio-page__header p:last-child {
  max-width: 52rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

@media (max-width: 48rem) {
  .studio-page__header {
    grid-template-columns: 1fr;
  }
}
</style>
