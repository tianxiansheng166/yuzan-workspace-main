<script setup lang="ts">
import CurriculumStudioDashboardView from "../../features/curriculum-studio/CurriculumStudioDashboardView.vue";
import CurriculumStudioScenarioField from "../../features/curriculum-studio/CurriculumStudioScenarioField.vue";
import type { StudioScenario } from "../../features/curriculum-studio/model";
import { useCurriculumStudioDashboard } from "../../features/curriculum-studio/useCurriculumStudioDashboard";

useSeoMeta({
  title: "课程工作台｜语赞心声",
});

const scenario = ref<StudioScenario>("demo");
const { pending, result } = useCurriculumStudioDashboard(scenario);
</script>

<template>
  <section class="studio-page yx-shell">
    <header class="studio-page__header">
      <div>
        <p class="yx-kicker">CURRICULUM STUDIO</p>
        <h1>教研内容工作台围绕课程版本、内容关系和发布前检查组织。</h1>
        <p>
          当前是 CUR-002 Web
          框架：目录、草稿详情、关联视图和版权检查都已建边界； CUR-001
          接入前不伪造真实发布、评分或正式服务成功。
        </p>
      </div>
      <CurriculumStudioScenarioField v-model="scenario" />
    </header>

    <CurriculumStudioDashboardView :pending="pending" :result="result" />
  </section>
</template>

<style scoped>
.studio-page {
  padding-block: clamp(3rem, 7vw, 7rem);
  display: grid;
  gap: clamp(2rem, 5vw, 3rem);
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
  max-width: 15ch;
  margin: 0.8rem 0;
  font: 600 clamp(2.2rem, 6vw, 5rem)/1 var(--yx-font-display);
}

.studio-page__header p:last-child {
  max-width: 50rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.8;
}

@media (max-width: 48rem) {
  .studio-page__header {
    grid-template-columns: 1fr;
  }
}
</style>
