<script setup lang="ts">
import { computed } from "vue";

import AssessmentPreviewStateSelect from "../../../features/assessment-management/components/AssessmentPreviewStateSelect.vue";
import AssessmentStatePanel from "../../../features/assessment-management/components/AssessmentStatePanel.vue";
import AssessmentTaskList from "../../../features/assessment-management/components/AssessmentTaskList.vue";
import {
  assessmentManagementGateway,
  parsePreviewState,
} from "../../../features/assessment-management/gateway";
import type { PreviewState } from "../../../features/assessment-management/types";

useSeoMeta({
  title: "教师测评任务管理",
});

const route = useRoute();
const router = useRouter();

const previewState = computed<PreviewState>(() =>
  parsePreviewState(route.query.state),
);

const { data, error, refresh } = await useAsyncData(
  "teacher-assessments-dashboard",
  async () => {
    if (previewState.value === "loading") {
      return null;
    }

    return assessmentManagementGateway.getDashboardData(previewState.value);
  },
  {
    watch: [previewState],
  },
);

function updatePreviewState(value: PreviewState) {
  void router.replace({
    query: {
      ...route.query,
      state: value === "complete" ? undefined : value,
    },
  });
}
</script>

<template>
  <section class="assessment-page yx-shell">
    <header class="assessment-page__header">
      <div>
        <p class="yx-kicker">TEACHER ASSESSMENT MANAGEMENT</p>
        <h1>教师测评任务与学生报告管理</h1>
        <p>
          这里集中展示 demo
          流程：创建任务、管理唯一访问链接、停用任务，以及进入学生报告与历史对比页面。
        </p>
      </div>
      <div class="assessment-page__controls">
        <AssessmentPreviewStateSelect
          :model-value="previewState"
          @update:model-value="updatePreviewState"
        />
        <NuxtLink class="assessment-page__create" to="/teacher/assessments/new">
          创建新测评任务
        </NuxtLink>
      </div>
    </header>

    <AssessmentStatePanel
      v-if="previewState === 'loading'"
      kicker="LOADING"
      title="正在读取教师测评任务……"
      description="demo 页面会在这里展示加载态，真实任务将由 AssessmentManagementGateway 对接 API。"
      tone="information"
    />

    <AssessmentStatePanel
      v-else-if="error"
      kicker="ERROR"
      title="测评任务暂时不可读取"
      description="当前展示的是 demo 错误态；你可以重试，或切回 complete 查看已接好的页面。"
      tone="danger"
    >
      <template #actions>
        <button type="button" @click="refresh()">重试</button>
      </template>
    </AssessmentStatePanel>

    <AssessmentStatePanel
      v-else-if="!data || data.tasks.length === 0"
      kicker="EMPTY"
      title="还没有可展示的测评任务"
      description="列表页空态已就位；教师可以直接进入创建页生成新的 demo 测评任务。"
    >
      <template #actions>
        <NuxtLink to="/teacher/assessments/new">前往创建页</NuxtLink>
      </template>
    </AssessmentStatePanel>

    <AssessmentTaskList v-else :tasks="data.tasks" />
  </section>
</template>

<style scoped>
.assessment-page {
  display: grid;
  gap: 1.4rem;
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.assessment-page__header,
.assessment-page__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}

h1 {
  max-width: 13ch;
  margin: 0.8rem 0 1rem;
  font: 600 clamp(2.4rem, 5vw, 4.6rem) / 0.98 var(--yx-font-display);
}

.assessment-page__header p {
  max-width: 46rem;
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}

.assessment-page__controls {
  align-items: end;
}

.assessment-page__create,
button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-pill);
  background: white;
  text-decoration: none;
}
</style>
