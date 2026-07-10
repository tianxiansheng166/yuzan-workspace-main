<script setup lang="ts">
import { computed } from "vue";
import type { FillBlankQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: FillBlankQuestion;
  modelValue?: { values: string[] } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

const values = computed<string[]>(() => {
  if (!props.modelValue) {
    return props.question.blanks.map(() => "");
  }
  return props.question.blanks.map(
    (_, index) => props.modelValue?.values[index] ?? "",
  );
});

function update(index: number, value: string) {
  if (props.disabled || props.readOnly) return;
  const next = [...values.value];
  next[index] = value;
  emit("update:modelValue", { kind: "FILL_BLANK", values: next });
}
</script>

<template>
  <fieldset class="question-fieldset" :disabled="disabled">
    <legend class="question-prompt">{{ question.prompt }}</legend>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <div class="blanks" role="group" :aria-label="question.prompt">
      <div
        v-for="(blank, index) in question.blanks"
        :key="blank.id"
        class="blank-field"
      >
        <label :for="`q-${question.id}-blank-${blank.id}`">
          {{ blank.label ?? `空格 ${index + 1}` }}
        </label>
        <input
          :id="`q-${question.id}-blank-${blank.id}`"
          type="text"
          :value="values[index]"
          :readonly="readOnly"
          :aria-label="`${blank.label ?? `空格 ${index + 1}`}，${question.prompt}`"
          @input="update(index, ($event.target as HTMLInputElement).value)"
        />
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
.blanks {
  display: grid;
  gap: var(--yx-space-300);
}
.blank-field {
  display: grid;
  gap: var(--yx-space-200);
}
.blank-field label {
  font-weight: var(--yx-font-weight-medium);
  font-size: var(--yx-text-sm);
}
.blank-field input {
  min-height: 2.75rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.blank-field input:read-only {
  background: var(--yx-bg-muted);
  opacity: 0.72;
}
</style>
