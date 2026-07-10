<script setup lang="ts">
import type { InterventionSuggestion } from "../types";

defineProps<{
  suggestion: InterventionSuggestion;
}>();
</script>

<template>
  <aside class="intervention" aria-labelledby="intervention-title">
    <h2 id="intervention-title" class="section-title">教师干预建议</h2>
    <div class="intervention__card" :data-level="suggestion.level">
      <h3 class="intervention__heading">{{ suggestion.title }}</h3>
      <p class="intervention__description">{{ suggestion.description }}</p>

      <div class="intervention__actions">
        <p class="intervention__actions-title">建议行动</p>
        <ol>
          <li v-for="(action, index) in suggestion.actions" :key="index">
            {{ action }}
          </li>
        </ol>
      </div>

      <p class="intervention__disclaimer">{{ suggestion.disclaimer }}</p>
    </div>
  </aside>
</template>

<style scoped>
.intervention {
  margin-top: 2rem;
}
.section-title {
  font: 500 var(--yx-text-xl) / 1.2 var(--yx-font-display);
  margin: 0 0 1.25rem;
}
.intervention__card {
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  border-left: 4px solid var(--yx-color-wine);
}
.intervention__heading {
  margin: 0 0 0.75rem;
  font: 500 var(--yx-text-lg) / 1.3 var(--yx-font-display);
}
.intervention__description {
  margin: 0 0 1rem;
  line-height: 1.7;
}
.intervention__actions {
  margin-bottom: 1rem;
}
.intervention__actions-title {
  margin: 0 0 0.5rem;
  font-weight: 500;
}
.intervention__actions ol {
  margin: 0;
  padding-left: 1.25rem;
  line-height: 1.8;
}
.intervention__disclaimer {
  margin: 0;
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
  line-height: 1.6;
}
</style>
