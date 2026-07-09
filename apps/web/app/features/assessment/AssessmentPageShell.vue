<script setup lang="ts">
import { computed } from "vue";

import { YxStatus } from "@yuzan/ui";

import type { AssessmentMode } from "./assessment-types";

const props = withDefaults(
  defineProps<{
    kicker?: string;
    title: string;
    summary: string;
    mode?: AssessmentMode;
    modeLabel?: string;
  }>(),
  {
    kicker: "学生端测评",
    mode: undefined,
    modeLabel: undefined,
  },
);

const resolvedModeLabel = computed(
  () => props.modeLabel ?? (props.mode === "demo" ? "演示流程" : "真实流程"),
);
</script>

<template>
  <section class="assessment-shell">
    <div class="yx-shell assessment-shell__inner">
      <header class="assessment-shell__header">
        <div class="assessment-shell__heading">
          <p class="yx-kicker">{{ kicker }}</p>
          <div class="assessment-shell__title-row">
            <h1>{{ title }}</h1>
            <YxStatus
              v-if="mode"
              :tone="mode === 'demo' ? 'information' : 'neutral'"
            >
              {{ resolvedModeLabel }}
            </YxStatus>
          </div>
          <p class="assessment-shell__summary">{{ summary }}</p>
        </div>
        <div v-if="$slots.actions" class="assessment-shell__actions">
          <slot name="actions" />
        </div>
      </header>
      <div
        class="assessment-shell__body"
        :class="{ 'has-aside': $slots.aside }"
      >
        <div class="assessment-shell__content">
          <slot />
        </div>
        <aside v-if="$slots.aside" class="assessment-shell__aside">
          <slot name="aside" />
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.assessment-shell {
  padding: var(--yx-space-1200) 0 var(--yx-space-1600);
}

.assessment-shell__inner {
  display: grid;
  gap: var(--yx-space-800);
}

.assessment-shell__header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: var(--yx-space-600);
  padding-bottom: var(--yx-space-600);
  border-bottom: 1px solid var(--yx-border-default);
}

.assessment-shell__heading {
  max-width: 48rem;
}

.assessment-shell__title-row {
  display: flex;
  align-items: center;
  gap: var(--yx-space-400);
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-family: var(--yx-font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: var(--yx-line-height-tight);
}

.assessment-shell__summary {
  margin: var(--yx-space-300) 0 0;
  font-size: var(--yx-font-size-400);
  color: var(--yx-text-secondary);
}

.assessment-shell__actions {
  display: flex;
  gap: var(--yx-space-300);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.assessment-shell__body {
  display: grid;
  gap: var(--yx-space-800);
}

.assessment-shell__body.has-aside {
  grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 0.9fr);
  align-items: start;
}

.assessment-shell__content,
.assessment-shell__aside {
  min-width: 0;
}

@media (max-width: 72rem) {
  .assessment-shell__header {
    align-items: start;
    flex-direction: column;
  }

  .assessment-shell__actions {
    justify-content: start;
  }

  .assessment-shell__body.has-aside {
    grid-template-columns: 1fr;
  }
}
</style>
