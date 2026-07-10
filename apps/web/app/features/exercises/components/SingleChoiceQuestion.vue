<script setup lang="ts">
import { computed } from "vue";
import type { SingleChoiceQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: SingleChoiceQuestion;
  modelValue?: { optionId: string } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

function select(optionId: string) {
  if (props.disabled || props.readOnly) return;
  emit("update:modelValue", { kind: "SINGLE_CHOICE", optionId });
}

function onKeydown(event: KeyboardEvent, optionId: string) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select(optionId);
  }
}
</script>

<template>
  <fieldset class="question-fieldset" :disabled="disabled">
    <legend class="question-prompt">{{ question.prompt }}</legend>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <div class="options" role="radiogroup" :aria-label="question.prompt">
      <div
        v-for="option in question.options"
        :key="option.id"
        class="option"
        :class="{
          'is-selected': modelValue?.optionId === option.id,
          'is-readonly': readOnly,
        }"
        role="radio"
        :aria-checked="modelValue?.optionId === option.id ? 'true' : 'false'"
        tabindex="0"
        @click="select(option.id)"
        @keydown="onKeydown($event, option.id)"
      >
        <span class="option-marker" aria-hidden="true" />
        <span class="option-text">{{ option.text }}</span>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.question-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-300);
}
.question-prompt {
  font: var(--yx-font-weight-semibold) var(--yx-text-lg) /
    var(--yx-line-height-tight) var(--yx-font-sans);
  color: var(--yx-text-primary);
}
.question-explanation {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-text-sm);
}
.options {
  display: grid;
  gap: var(--yx-space-200);
}
.option {
  display: flex;
  align-items: center;
  gap: var(--yx-space-300);
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  cursor: pointer;
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard);
}
.option:hover:not(.is-readonly):not([disabled]) {
  border-color: var(--yx-border-strong);
}
.option.is-selected {
  border-color: var(--yx-action-primary-bg);
  background: color-mix(in srgb, var(--yx-action-primary-bg) 8%, transparent);
}
.option.is-readonly {
  cursor: default;
  opacity: 0.72;
}
.option-marker {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 2px solid var(--yx-border-strong);
  flex-shrink: 0;
}
.option.is-selected .option-marker {
  border-width: 0.4rem;
  border-color: var(--yx-action-primary-bg);
}
.option-text {
  line-height: var(--yx-line-height-body);
}
</style>
