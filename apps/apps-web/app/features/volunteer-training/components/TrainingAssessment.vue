<script setup lang="ts">
import { computed } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import type { AssessmentQuestion } from "../types";

const props = defineProps<{
  questions: AssessmentQuestion[];
  answers: Record<string, number>;
}>();

const emit = defineEmits<{
  answer: [questionId: string, optionIndex: number];
}>();

const progressText = computed(
  () => `${Object.keys(props.answers).length}/${props.questions.length}`,
);

function isSelected(questionId: string, optionIndex: number): boolean {
  return props.answers[questionId] === optionIndex;
}
</script>

<template>
  <section class="assessment" aria-labelledby="assessment-title">
    <div class="assessment__header">
      <h2 id="assessment-title" class="assessment__title">培训考核</h2>
      <YxStatus tone="information" data-testid="assessment-progress"
        >进度 {{ progressText }}</YxStatus
      >
    </div>

    <ol class="assessment__list">
      <li
        v-for="(question, qIndex) in questions"
        :key="question.id"
        class="assessment__item"
      >
        <p class="assessment__question">
          <span class="assessment__number">{{ qIndex + 1 }}.</span>
          {{ question.question }}
        </p>
        <ul class="assessment__options">
          <li
            v-for="(option, oIndex) in question.options"
            :key="`${question.id}-${oIndex}`"
          >
            <YxButton
              kind="secondary"
              data-testid="answer-option"
              :class="{ 'is-selected': isSelected(question.id, oIndex) }"
              @click="emit('answer', question.id, oIndex)"
            >
              {{ option }}
            </YxButton>
          </li>
        </ul>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.assessment {
  margin-top: var(--yx-space-800);
}

.assessment__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--yx-space-400);
  margin-bottom: var(--yx-space-500);
}

.assessment__title {
  margin: 0;
  font: var(--yx-font-size-400) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.assessment__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-500);
}

.assessment__item {
  padding: var(--yx-space-500);
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-lg);
}

.assessment__question {
  margin: 0 0 var(--yx-space-400);
  font-weight: var(--yx-font-weight-semibold);
}

.assessment__number {
  color: var(--yx-text-accent);
  margin-right: var(--yx-space-200);
}

.assessment__options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

.assessment__options .is-selected {
  background: var(--yx-action-primary-bg);
  color: var(--yx-action-primary-fg);
  border-color: transparent;
}
</style>
