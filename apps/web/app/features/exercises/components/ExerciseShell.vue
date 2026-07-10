<script setup lang="ts">
import { computed } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import type { Exercise, AnswerValue, ExerciseResult } from "../types.js";
import QuestionRenderer from "./QuestionRenderer.vue";

const props = defineProps<{
  exercise: Exercise;
  draftAnswers?: Readonly<Record<string, AnswerValue>> | undefined;
  loading?: boolean;
  submitting?: boolean;
  error?: string | undefined;
  offline?: boolean;
  draftState?: "clean" | "dirty" | "saving" | "saved" | "error" | undefined;
  result?: ExerciseResult | undefined;
}>();

const emit = defineEmits<{
  "update:draftAnswers": [answers: Record<string, AnswerValue>];
  saveDraft: [];
  submit: [];
  retry: [];
}>();

const answers = defineModel<Record<string, AnswerValue>>("draftAnswers", {
  default: () => ({}),
});

const canInteract = computed(
  () => !props.loading && !props.submitting && props.exercise.canStart,
);

const submitEnabled = computed(
  () =>
    canInteract.value &&
    props.exercise.canSubmit &&
    Object.keys(answers.value).length > 0,
);

const statusTone = computed(() => {
  if (props.offline) return "warning";
  if (props.error) return "danger";
  if (props.result?.status === "GRADED") return "success";
  if (props.result?.status === "NEEDS_REVIEW") return "information";
  return "neutral";
});

const statusText = computed(() => {
  if (props.offline) return "离线模式：答案已保存在本地";
  if (props.draftState === "saving") return "保存草稿中…";
  if (props.draftState === "saved") return "草稿已保存";
  if (props.draftState === "error") return "草稿保存失败";
  if (props.result?.status === "GRADED") return "已提交并自动评分";
  if (props.result?.status === "NEEDS_REVIEW") return "已提交，等待人工复核";
  if (!props.exercise.canStart) return props.exercise.reason ?? "当前不可作答";
  return "";
});

function updateAnswer(questionId: string, value: AnswerValue) {
  answers.value = { ...answers.value, [questionId]: value };
  emit("update:draftAnswers", answers.value);
}
</script>

<template>
  <section class="exercise yx-shell" aria-labelledby="exercise-title">
    <header class="exercise__header">
      <div>
        <p class="yx-kicker">练习作答</p>
        <h1 id="exercise-title">{{ exercise.title }}</h1>
        <p v-if="exercise.studentNotes" class="exercise__notes">
          {{ exercise.studentNotes }}
        </p>
      </div>
      <div class="exercise__meta">
        <YxStatus v-if="statusText" :tone="statusTone">{{
          statusText
        }}</YxStatus>
        <p>最多 {{ exercise.retryPolicy.maxAttempts }} 次作答</p>
      </div>
    </header>

    <div
      v-if="error"
      class="exercise__error"
      role="alert"
      aria-live="assertive"
    >
      <p>{{ error }}</p>
      <YxButton kind="secondary" type="button" @click="emit('retry')">
        重试
      </YxButton>
    </div>

    <div
      v-if="result"
      class="result-summary"
      role="region"
      aria-label="作答结果"
    >
      <p class="result-score" v-if="result.autoResult">
        得分 {{ result.autoResult.score }} / {{ result.autoResult.maxScore }}
      </p>
      <p v-else>提交成功，等待批阅</p>
    </div>

    <form class="exercise__form" @submit.prevent="emit('submit')">
      <ol class="question-list" aria-label="题目列表">
        <li v-for="question in exercise.questions" :key="question.id">
          <QuestionRenderer
            :question="question"
            :model-value="answers[question.id]"
            :disabled="!canInteract || Boolean(result)"
            :read-only="Boolean(result)"
            @update:model-value="updateAnswer(question.id, $event)"
          />
        </li>
      </ol>

      <div class="exercise__actions">
        <YxButton
          type="button"
          kind="secondary"
          :loading="draftState === 'saving'"
          :disabled="!canInteract || Boolean(result)"
          @click="emit('saveDraft')"
        >
          保存草稿
        </YxButton>
        <YxButton
          type="submit"
          :loading="submitting"
          :disabled="!submitEnabled || Boolean(result)"
        >
          提交答案
        </YxButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.exercise {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.exercise__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: start;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
  margin-bottom: 2rem;
}
.exercise h1 {
  margin: 0.6rem 0 0.8rem;
  font: 600 var(--yx-text-xl)/1.15 var(--yx-font-display);
}
.exercise__notes {
  max-width: 46rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}
.exercise__meta {
  display: grid;
  gap: var(--yx-space-300);
  justify-items: end;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.exercise__error {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.25rem;
  margin-bottom: 2rem;
  border: 1px solid var(--yx-danger-border);
  border-radius: var(--yx-radius-md);
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
}
.exercise__error p {
  margin: 0;
  flex: 1;
}
.result-summary {
  padding: 1.25rem;
  margin-bottom: 2rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-canvas-strong);
}
.result-score {
  margin: 0;
  font: 600 var(--yx-text-lg) var(--yx-font-display);
}
.exercise__form {
  display: grid;
  gap: 2rem;
}
.question-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.5rem;
}
.exercise__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
}
@media (max-width: 48rem) {
  .exercise__header {
    grid-template-columns: 1fr;
  }
  .exercise__meta {
    justify-items: start;
  }
}
</style>
