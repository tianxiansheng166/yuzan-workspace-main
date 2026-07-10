<script setup lang="ts">
import { computed } from "vue";
import type { MatchingQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: MatchingQuestion;
  modelValue?: { matches: Record<string, string> } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

const leftItems = computed(() =>
  props.question.pairs.map((pair) => pair.leftId),
);
const rightItems = computed(() =>
  [...props.question.pairs].sort((a, b) =>
    a.rightText.localeCompare(b.rightText),
  ),
);

const matches = computed<Record<string, string>>(() => {
  if (!props.modelValue) return {};
  return props.modelValue.matches;
});

function update(leftId: string, rightId: string) {
  if (props.disabled || props.readOnly) return;
  emit("update:modelValue", {
    kind: "MATCHING",
    matches: { ...matches.value, [leftId]: rightId },
  });
}

function labelFor(leftId: string) {
  return (
    props.question.pairs.find((pair) => pair.leftId === leftId)?.leftText ??
    leftId
  );
}
</script>

<template>
  <fieldset class="question-fieldset" :disabled="disabled">
    <legend class="question-prompt">{{ question.prompt }}</legend>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <div class="matches" role="group" :aria-label="question.prompt">
      <div v-for="leftId in leftItems" :key="leftId" class="match-row">
        <span class="match-left" :id="`q-${question.id}-left-${leftId}`">
          {{ labelFor(leftId) }}
        </span>
        <select
          :aria-labelledby="`q-${question.id}-left-${leftId}`"
          :value="matches[leftId] ?? ''"
          :disabled="readOnly"
          @change="update(leftId, ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>请选择匹配项</option>
          <option
            v-for="right in rightItems"
            :key="right.rightId"
            :value="right.rightId"
          >
            {{ right.rightText }}
          </option>
        </select>
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
.matches {
  display: grid;
  gap: var(--yx-space-300);
}
.match-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--yx-space-300);
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.match-left {
  font-weight: var(--yx-font-weight-medium);
}
select {
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
select:disabled {
  background: var(--yx-bg-muted);
  opacity: 0.72;
}
</style>
