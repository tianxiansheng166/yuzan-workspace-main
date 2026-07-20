<script setup lang="ts">
import type { GrowthEvent } from "../types";

defineProps<{
  events: GrowthEvent[];
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN");
}
</script>

<template>
  <section class="timeline" aria-labelledby="growth-timeline-title">
    <h2 id="growth-timeline-title" class="section-title">成长时间线</h2>
    <ol class="timeline__list">
      <li v-for="event in events" :key="event.id" class="timeline__item">
        <span class="timeline__dot" aria-hidden="true" />
        <div class="timeline__content">
          <p class="timeline__date">{{ formatDate(event.occurredAt) }}</p>
          <h3 class="timeline__label">{{ event.label }}</h3>
          <p class="timeline__note">{{ event.note }}</p>
          <p v-if="event.scoreDelta !== null" class="timeline__delta">
            变化：{{ event.scoreDelta > 0 ? "+" : "" }}{{ event.scoreDelta }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.timeline {
  margin-top: 2rem;
}
.section-title {
  font: 500 var(--yx-text-xl) / 1.2 var(--yx-font-display);
  margin: 0 0 1.25rem;
}
.timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}
.timeline__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: start;
}
.timeline__dot {
  width: 0.75rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-wine);
  margin-top: 0.35rem;
}
.timeline__content {
  border-left: 1px solid var(--yx-color-line);
  padding-left: 1rem;
}
.timeline__date {
  margin: 0;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.timeline__label {
  margin: 0.25rem 0 0;
  font: 500 var(--yx-text-base) / 1.3 var(--yx-font-display);
}
.timeline__note {
  margin: 0.35rem 0 0;
  color: var(--yx-color-ink-soft);
  line-height: 1.6;
}
.timeline__delta {
  margin: 0.35rem 0 0;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-sage-strong);
}
</style>
