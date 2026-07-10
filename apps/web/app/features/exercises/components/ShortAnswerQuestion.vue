<script setup lang="ts">
import { computed } from "vue";
import type { ShortAnswerQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: ShortAnswerQuestion;
  modelValue?: { text: string } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

const text = computed(() => props.modelValue?.text ?? "");

function update(value: string) {
  if (props.disabled || props.readOnly) return;
  emit("update:modelValue", { kind: "SHORT_ANSWER", text: value });
}
</script>

<template>
  <div class="question-fieldset">
    <label class="question-prompt" :for="`q-${question.id}-input`">
      {{ question.prompt }}
    </label>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <textarea
      :id="`q-${question.id}-input`"
      :value="text"
      :readonly="readOnly"
      :disabled="disabled"
      rows="5"
      :aria-label="question.prompt"
      @input="update(($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
.question-fieldset {
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
textarea {
  min-height: 8rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  resize: vertical;
}
textarea:read-only,
textarea:disabled {
  background: var(--yx-bg-muted);
  opacity: 0.72;
}
</style>
