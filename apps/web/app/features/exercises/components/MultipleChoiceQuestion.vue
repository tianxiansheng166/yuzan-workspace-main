<script setup lang="ts">
import { computed } from "vue";
import type { MultipleChoiceQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: MultipleChoiceQuestion;
  modelValue?: { optionIds: string[] } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

const selectedIds = computed(() =>
  props.modelValue && "optionIds" in props.modelValue
    ? new Set(props.modelValue.optionIds)
    : new Set<string>(),
);

function toggle(optionId: string) {
  if (props.disabled || props.readOnly) return;
  const next = new Set(selectedIds.value);
  if (next.has(optionId)) {
    next.delete(optionId);
  } else {
    next.add(optionId);
  }
  emit("update:modelValue", {
    kind: "MULTIPLE_CHOICE",
    optionIds: Array.from(next),
  });
}

function onKeydown(event: KeyboardEvent, optionId: string) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggle(optionId);
  }
}
</script>

<template>
  <fieldset class="question-fieldset" :disabled="disabled">
    <legend class="question-prompt">{{ question.prompt }}</legend>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <div class="options" role="group" :aria-label="question.prompt">
      <div
        v-for="option in question.options"
        :key="option.id"
        class="option"
        :class="{
          'is-selected': selectedIds.has(option.id),
          'is-readonly': readOnly,
        }"
        role="checkbox"
        :aria-checked="selectedIds.has(option.id) ? 'true' : 'false'"
        tabindex="0"
        @click="toggle(option.id)"
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
  border-radius: var(--yx-radius-sm);
  border: 2px solid var(--yx-border-strong);
  flex-shrink: 0;
}
.option.is-selected .option-marker {
  background: var(--yx-action-primary-bg);
  border-color: var(--yx-action-primary-bg);
}
.option-text {
  line-height: var(--yx-line-height-body);
}
</style>
