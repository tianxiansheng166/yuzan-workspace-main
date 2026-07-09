<script setup lang="ts">
import { computed, ref } from "vue";

import AssessmentPreviewStateSelect from "../../../features/assessment-management/components/AssessmentPreviewStateSelect.vue";
import AssessmentStatePanel from "../../../features/assessment-management/components/AssessmentStatePanel.vue";
import AssessmentTaskDetailView from "../../../features/assessment-management/components/AssessmentTaskDetailView.vue";
import {
  assessmentManagementGateway,
  parsePreviewState,
} from "../../../features/assessment-management/gateway";
import type { PreviewState } from "../../../features/assessment-management/types";

const route = useRoute();
const router = useRouter();

const taskId = computed(() => String(route.params.taskId ?? ""));
const previewState = computed<PreviewState>(() =>
  parsePreviewState(route.query.state),
);
const deactivating = ref(false);
const actionError = ref("");

useSeoMeta({
  title: `教师测评任务 ${taskId.value}`,
});

const { data, error, refresh } = await useAsyncData(
  "teacher-assessment-detail",
  async () => {
    if (previewState.value === "loading") {
      return null;
    }

    return assessmentManagementGateway.getAssessmentTaskDetail(
      taskId.value,
      previewState.value,
    );
  },
  {
    watch: [previewState, taskId],
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

async function deactivateTask() {
  deactivating.value = true;
  actionError.value = "";

  try {
    await assessmentManagementGateway.deactivateAssessmentTask(taskId.value);
    await refresh();
  } catch (caughtError) {
    actionError.value =
      caughtError instanceof Error
        ? caughtError.message
        : "停用 demo 链接失败。";
  } finally {
    deactivating.value = false;
  }
}
</script>

<template>
  <section class="assessment-page yx-shell">
    <header class="assessment-page__header">
      <div>
        <p class="yx-kicker">TASK DETAIL</p>
        <h1>教师测评任务详情</h1>
        <p>在详情页管理 demo 链接、停用任务，并进入学生报告与历史对比。</p>
      </div>
      <AssessmentPreviewStateSelect
        :model-value="previewState"
        @update:model-value="updatePreviewState"
      />
    </header>

    <AssessmentStatePanel
      v-if="previewState === 'loading'"
      kicker="LOADING"
      title="正在读取任务详情……"
      description="demo 详情页的加载态已接好，真实接入后会替换为 API 返回的任务数据。"
      tone="information"
    />

    <AssessmentStatePanel
      v-else-if="error"
      kicker="ERROR"
      title="任务详情暂时不可读取"
      description="当前展示的是错误态；可以重试，或切回 complete 继续查看 demo 详情。"
      tone="danger"
    >
      <template #actions>
        <button type="button" @click="refresh()">重试</button>
      </template>
    </AssessmentStatePanel>

    <AssessmentStatePanel
      v-else-if="!data"
      kicker="EMPTY"
      title="当前没有可展示的任务详情"
      description="详情页空态已就位；真实环境中会在任务存在且允许访问时展示完整信息。"
    >
      <template #actions>
        <NuxtLink to="/teacher/assessments">返回任务列表</NuxtLink>
      </template>
    </AssessmentStatePanel>

    <template v-else>
      <AssessmentTaskDetailView
        :detail="data"
        :deactivating="deactivating"
        @deactivate="deactivateTask"
      />

      <AssessmentStatePanel
        v-if="actionError"
        kicker="ACTION ERROR"
        title="任务操作失败"
        :description="actionError"
        tone="danger"
      />
    </template>
  </section>
</template>

<style scoped>
.assessment-page {
  display: grid;
  gap: 1.4rem;
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.assessment-page__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}

h1 {
  margin: 0.8rem 0 1rem;
  font: 600 clamp(2.3rem, 5vw, 4.2rem) / 0.98 var(--yx-font-display);
}

.assessment-page__header p {
  max-width: 44rem;
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}

button,
a {
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
