<script setup lang="ts">
import { ref, watch } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import type { TrainingModule as TrainingModuleType } from "../types";

const props = defineProps<{
  module: TrainingModuleType;
  completed: boolean;
}>();

const emit = defineEmits<{
  complete: [moduleId: string];
}>();

const expanded = ref(false);

function toggle() {
  expanded.value = !expanded.value;
}

function markComplete() {
  emit("complete", props.module.id);
}

watch(
  () => props.module.id,
  () => {
    expanded.value = false;
  },
);
</script>

<template>
  <article
    class="training-module"
    :class="{ 'is-completed': completed }"
    :aria-labelledby="`module-title-${module.id}`"
  >
    <div class="training-module__header">
      <div class="training-module__meta">
        <h3 :id="`module-title-${module.id}`" class="training-module__title">
          {{ module.title }}
        </h3>
        <YxStatus
          v-if="completed"
          tone="success"
          data-testid="module-complete-status"
          >已完成</YxStatus
        >
      </div>
      <YxButton kind="quiet" data-testid="toggle-module" @click="toggle">
        {{ expanded ? "收起" : "展开" }}
      </YxButton>
    </div>

    <p class="training-module__summary">{{ module.summary }}</p>

    <div v-if="expanded" class="training-module__body">
      <ul class="training-module__list">
        <li v-for="(item, index) in module.content" :key="index">
          {{ item }}
        </li>
      </ul>
      <YxButton
        v-if="!completed"
        data-testid="mark-complete"
        @click="markComplete"
      >
        标记完成
      </YxButton>
      <YxButton v-else kind="secondary" data-testid="mark-complete" disabled>
        已完成
      </YxButton>
    </div>
  </article>
</template>

<style scoped>
.training-module {
  padding: var(--yx-space-500);
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-lg);
  border: 1px solid transparent;
}

.training-module.is-completed {
  border-color: var(--yx-success-border);
  background: color-mix(
    in srgb,
    var(--yx-success-bg) 30%,
    var(--yx-surface-raised)
  );
}

.training-module__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--yx-space-400);
}

.training-module__meta {
  display: flex;
  align-items: center;
  gap: var(--yx-space-300);
  flex-wrap: wrap;
}

.training-module__title {
  margin: 0;
  font: var(--yx-font-size-400) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.training-module__summary {
  margin: var(--yx-space-300) 0 0;
  color: var(--yx-text-secondary);
}

.training-module__body {
  margin-top: var(--yx-space-400);
  display: grid;
  gap: var(--yx-space-400);
}

.training-module__list {
  margin: 0;
  padding-left: var(--yx-space-600);
  display: grid;
  gap: var(--yx-space-200);
}

.training-module__list li {
  color: var(--yx-text-secondary);
}
</style>
