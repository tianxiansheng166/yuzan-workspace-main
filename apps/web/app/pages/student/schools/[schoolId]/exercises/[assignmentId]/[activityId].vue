<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useSeoMeta } from "nuxt/app";
import { ExerciseShell } from "~/features/exercises/index.js";
import { useExercise } from "~/features/exercises/useExercise.js";
import type { AnswerValue } from "~/features/exercises/types.js";

const route = useRoute();
const schoolId = computed(() => route.params.schoolId as string);
const assignmentId = computed(() => route.params.assignmentId as string);
const activityId = computed(() => route.params.activityId as string);

const {
  exercise,
  loading,
  error,
  offline,
  draft,
  draftState,
  submitState,
  result,
  load,
  loadDraft,
  saveDraft,
  submit,
  resetSubmit,
} = useExercise({
  schoolId: schoolId.value,
  assignmentId: assignmentId.value,
  activityId: activityId.value,
});

const draftAnswers = ref<Record<string, AnswerValue>>({});

onMounted(async () => {
  await load();
  await loadDraft();
  if (draft.value?.answers) {
    draftAnswers.value = { ...draft.value.answers };
  }
});

watch(draft, (next) => {
  if (next?.answers) {
    draftAnswers.value = { ...next.answers };
  }
});

async function handleSaveDraft() {
  await saveDraft(draftAnswers.value);
}

async function handleSubmit() {
  const response = await submit(draftAnswers.value);
  if (response) {
    draftAnswers.value = { ...response.answers };
  }
}

useSeoMeta({
  title: `${exercise.value?.title ?? "练习作答"}｜语赞心声`,
});
</script>

<template>
  <div v-if="loading" class="state-message" role="status" aria-live="polite">
    正在加载练习…
  </div>
  <ExerciseShell
    v-else-if="exercise"
    :exercise="exercise"
    v-model:draft-answers="draftAnswers"
    :loading="loading"
    :submitting="submitState === 'submitting'"
    :error="error?.message"
    :offline="offline"
    :draft-state="draftState"
    :result="result ?? undefined"
    @save-draft="handleSaveDraft"
    @submit="handleSubmit"
    @retry="
      resetSubmit();
      load();
    "
  />
  <div v-else class="state-message" role="alert">
    练习加载失败，请稍后重试。
  </div>
</template>

<style scoped>
.state-message {
  min-height: 24rem;
  display: grid;
  align-content: center;
  justify-items: center;
  color: var(--yx-color-ink-soft);
}
</style>
