<script setup lang="ts">
import { computed } from "vue";
import type { OrderingQuestion, AnswerValue } from "../types.js";

const props = defineProps<{
  question: OrderingQuestion;
  modelValue?: { order: string[] } | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

const orderedIds = computed(() =>
  props.modelValue && "order" in props.modelValue
    ? props.modelValue.order
    : props.question.items.map((item) => item.id),
);

const orderedItems = computed(() =>
  orderedIds.value
    .map((id) => props.question.items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

function moveUp(index: number) {
  if (props.disabled || props.readOnly || index <= 0) return;
  const next = [...orderedIds.value];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  emit("update:modelValue", { kind: "ORDERING", order: next });
}

function moveDown(index: number) {
  if (props.disabled || props.readOnly || index >= orderedIds.value.length - 1)
    return;
  const next = [...orderedIds.value];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  emit("update:modelValue", { kind: "ORDERING", order: next });
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveUp(index);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveDown(index);
  }
}
</script>

<template>
  <fieldset class="question-fieldset" :disabled="disabled">
    <legend class="question-prompt">{{ question.prompt }}</legend>
    <p v-if="question.explanation" class="question-explanation">
      {{ question.explanation }}
    </p>
    <ol class="ordering-list" role="listbox" :aria-label="question.prompt">
      <li
        v-for="(item, index) in orderedItems"
        :key="item.id"
        class="ordering-item"
        role="option"
        :aria-selected="'false'"
        tabindex="0"
        @keydown="onKeydown($event, index)"
      >
        <span class="ordering-rank" aria-hidden="true">{{ index + 1 }}</span>
        <span class="ordering-text">{{ item.text }}</span>
        <div class="ordering-actions">
          <button
            type="button"
            :disabled="readOnly || disabled || index === 0"
            :aria-label="`将 '${item.text}' 向上移动`"
            @click="moveUp(index)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="
              readOnly || disabled || index === orderedItems.length - 1
            "
            :aria-label="`将 '${item.text}' 向下移动`"
            @click="moveDown(index)"
          >
            ↓
          </button>
        </div>
      </li>
    </ol>
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
.ordering-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-200);
}
.ordering-item {
  display: flex;
  align-items: center;
  gap: var(--yx-space-300);
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.ordering-rank {
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--yx-bg-canvas-strong);
  font-size: var(--yx-text-sm);
  font-weight: var(--yx-font-weight-semibold);
  flex-shrink: 0;
}
.ordering-text {
  flex: 1;
  line-height: var(--yx-line-height-body);
}
.ordering-actions {
  display: flex;
  gap: var(--yx-space-100);
}
.ordering-actions button {
  min-height: 2rem;
  min-width: 2rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-sm);
  background: var(--yx-surface-default);
  cursor: pointer;
}
.ordering-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
