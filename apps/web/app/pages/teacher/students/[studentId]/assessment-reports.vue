<script setup lang="ts">
import { computed } from "vue";

import AssessmentPreviewStateSelect from "../../../../features/assessment-management/components/AssessmentPreviewStateSelect.vue";
import AssessmentStatePanel from "../../../../features/assessment-management/components/AssessmentStatePanel.vue";
import AssessmentStudentReportsView from "../../../../features/assessment-management/components/AssessmentStudentReportsView.vue";
import {
  assessmentManagementGateway,
  parsePreviewState,
} from "../../../../features/assessment-management/gateway";
import type { PreviewState } from "../../../../features/assessment-management/types";

const route = useRoute();
const router = useRouter();

const studentId = computed(() => String(route.params.studentId ?? ""));
const previewState = computed<PreviewState>(() =>
  parsePreviewState(route.query.state),
);

useSeoMeta({
  title: `学生测评报告 ${studentId.value}`,
});

const { data, error, refresh } = await useAsyncData(
  "teacher-student-assessment-reports",
  async () => {
    if (previewState.value === "loading") {
      return null;
    }

    return assessmentManagementGateway.getStudentAssessmentReports(
      studentId.value,
      previewState.value,
    );
  },
  {
    watch: [previewState, studentId],
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
        <p class="yx-kicker">STUDENT REPORTS</p>
        <h1>学生测评报告与历史对比</h1>
        <p>
          页面明确区分 ready、生成中和 unavailable 三种 demo
          状态，不伪造真实报告内容。
        </p>
      </div>
      <AssessmentPreviewStateSelect
        :model-value="previewState"
        @update:model-value="updatePreviewState"
      />
    </header>

    <AssessmentStatePanel
      v-if="previewState === 'loading'"
      kicker="LOADING"
      title="正在读取学生测评报告……"
      description="这里用于演示报告页加载态，真实数据会由 AssessmentManagementGateway 替换。"
      tone="information"
    />

    <AssessmentStatePanel
      v-else-if="error"
      kicker="ERROR"
      title="学生测评报告暂时不可读取"
      description="当前展示的是错误态；可以重试，或切回 complete 继续查看 demo 报告。"
      tone="danger"
    >
      <template #actions>
        <button type="button" @click="refresh()">重试</button>
      </template>
    </AssessmentStatePanel>

    <AssessmentStatePanel
      v-else-if="!data"
      kicker="EMPTY"
      title="当前没有可展示的学生报告"
      description="空态已就位；真实环境会在学生参与过测评任务后显示对应报告。"
    >
      <template #actions>
        <NuxtLink to="/teacher/assessments">返回测评任务列表</NuxtLink>
      </template>
    </AssessmentStatePanel>

    <AssessmentStudentReportsView v-else :data="data" />
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
