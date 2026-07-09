<script setup lang="ts">
import { ref, computed } from "vue";
import { YxButton } from "@yuzan/ui";

import AssessmentPreviewStateSelect from "../../../features/assessment-management/components/AssessmentPreviewStateSelect.vue";
import AssessmentStatePanel from "../../../features/assessment-management/components/AssessmentStatePanel.vue";
import AssessmentTaskForm from "../../../features/assessment-management/components/AssessmentTaskForm.vue";
import {
  assessmentManagementGateway,
  parsePreviewState,
} from "../../../features/assessment-management/gateway";
import type {
  AssessmentTask,
  CreateAssessmentTaskInput,
  PreviewState,
} from "../../../features/assessment-management/types";

useSeoMeta({
  title: "创建教师测评任务",
});

const route = useRoute();
const router = useRouter();

const previewState = computed<PreviewState>(() =>
  parsePreviewState(route.query.state),
);

const createdTask = ref<AssessmentTask | null>(null);
const createMessage = ref("");
const createError = ref("");
const submitting = ref(false);

const { data, error, refresh } = await useAsyncData(
  "teacher-assessments-new",
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

async function createTask(payload: CreateAssessmentTaskInput) {
  submitting.value = true;
  createError.value = "";

  try {
    createdTask.value =
      await assessmentManagementGateway.createAssessmentTask(payload);
    createMessage.value = "新的 demo 测评任务已生成，并带有唯一访问链接。";
  } catch (caughtError) {
    createError.value =
      caughtError instanceof Error
        ? caughtError.message
        : "创建 demo 任务失败。";
  } finally {
    submitting.value = false;
  }
}

async function copyCreatedLink() {
  if (!createdTask.value) {
    return;
  }

  if (typeof navigator === "undefined" || !navigator.clipboard) {
    createMessage.value = "当前环境不支持自动复制，请手动复制 demo 访问链接。";
    return;
  }

  await navigator.clipboard.writeText(createdTask.value.demoLink.url);
  createMessage.value = "新的 demo 访问链接已复制。";
}
</script>

<template>
  <section class="assessment-page yx-shell">
    <header class="assessment-page__header">
      <div>
        <p class="yx-kicker">CREATE ASSESSMENT</p>
        <h1>创建新的教师测评任务</h1>
        <p>
          在这个页面选择朗读材料、书面任务、开放时间和学校/班级/学生目标，随后生成唯一
          demo 链接。
        </p>
      </div>
      <div class="assessment-page__controls">
        <AssessmentPreviewStateSelect
          :model-value="previewState"
          @update:model-value="updatePreviewState"
        />
        <NuxtLink class="assessment-page__back" to="/teacher/assessments">
          返回测评任务列表
        </NuxtLink>
      </div>
    </header>

    <AssessmentStatePanel
      v-if="previewState === 'loading'"
      kicker="LOADING"
      title="正在准备创建表单……"
      description="这里会显示材料、目标和开放时间相关配置的加载态。"
      tone="information"
    />

    <AssessmentStatePanel
      v-else-if="error"
      kicker="ERROR"
      title="创建表单暂时不可读取"
      description="demo 错误态已接好；恢复后会重新显示朗读材料、书面任务和目标选择。"
      tone="danger"
    >
      <template #actions>
        <button type="button" @click="refresh()">重试</button>
      </template>
    </AssessmentStatePanel>

    <AssessmentStatePanel
      v-else-if="
        !data ||
        data.readingMaterials.length === 0 ||
        data.writingTasks.length === 0 ||
        data.targets.length === 0
      "
      kicker="EMPTY"
      title="当前没有可用于创建的 demo 配置"
      description="空态已就位；真实环境会在材料和目标都可用后开放创建。"
    />

    <template v-else>
      <AssessmentTaskForm
        :reading-materials="data.readingMaterials"
        :writing-tasks="data.writingTasks"
        :targets="data.targets"
        :submitting="submitting"
        @submit="createTask"
      />

      <section v-if="createdTask" class="created-card">
        <div>
          <p class="yx-kicker">TASK READY</p>
          <h2>{{ createdTask.title }}</h2>
          <p>{{ createMessage }}</p>
          <code>{{ createdTask.demoLink.url }}</code>
        </div>
        <div class="created-card__actions">
          <YxButton @click="copyCreatedLink">复制链接</YxButton>
          <NuxtLink :to="`/teacher/assessments/${createdTask.id}`">
            查看任务详情
          </NuxtLink>
        </div>
      </section>

      <AssessmentStatePanel
        v-if="createError"
        kicker="CREATE ERROR"
        title="创建任务时发生错误"
        :description="createError"
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

.assessment-page__header,
.assessment-page__controls,
.created-card,
.created-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}

h1,
h2 {
  margin: 0.8rem 0 1rem;
  font-family: var(--yx-font-display);
}

h1 {
  max-width: 13ch;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 0.98;
}

.assessment-page__header p,
.created-card p {
  max-width: 46rem;
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}

.assessment-page__controls {
  align-items: end;
}

.assessment-page__back,
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

.created-card {
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background:
    linear-gradient(145deg, #fffefb 0%, #f3eadf 50%, #edf2e9 100%),
    var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

code {
  display: block;
  padding: 0.95rem;
  border-radius: var(--yx-radius-lg);
  background: var(--yx-color-ink);
  color: white;
  overflow-wrap: anywhere;
}

.created-card__actions {
  align-items: center;
}

.created-card__actions a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
</style>
