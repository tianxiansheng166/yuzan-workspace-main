<script setup lang="ts">
import type { PreviewState } from "../types";

withDefaults(
  defineProps<{
    modelValue: PreviewState;
    label?: string;
  }>(),
  {
    label: "预览状态",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: PreviewState];
}>();

function onChange(event: Event) {
  emit(
    "update:modelValue",
    (event.target as HTMLSelectElement).value as PreviewState,
  );
}
</script>

<template>
  <label class="preview-state">
    <span>{{ label }}</span>
    <select :value="modelValue" @change="onChange">
      <option value="complete">complete</option>
      <option value="loading">loading</option>
      <option value="empty">empty</option>
      <option value="error">error</option>
    </select>
  </label>
</template>

<style scoped>
.preview-state {
  display: grid;
  gap: 0.45rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}

select {
  min-height: 2.75rem;
  min-width: 11rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  padding-inline: 0.85rem;
}
</style>
