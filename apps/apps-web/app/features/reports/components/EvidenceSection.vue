<script setup lang="ts">
import type { EvidenceSection as EvidenceSectionType } from "../types";

defineProps<{
  section: EvidenceSectionType;
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN");
}
</script>

<template>
  <section class="evidence" :aria-labelledby="`evidence-${section.kind}-title`">
    <h2 :id="`evidence-${section.kind}-title`" class="section-title">
      {{ section.label }}
    </h2>

    <div v-if="section.items.length === 0" class="evidence__empty">
      暂无{{ section.label }}记录。
    </div>

    <ul v-else class="evidence__list">
      <li
        v-for="item in section.items"
        :key="item.id"
        class="evidence__item"
        :data-availability="item.availability"
      >
        <div class="evidence__meta">
          <h3 class="evidence__title">{{ item.title }}</h3>
          <span class="evidence__kind">{{ item.kind }}</span>
          <span class="evidence__date">{{ formatDate(item.recordedAt) }}</span>
        </div>
        <p class="evidence__summary">{{ item.summary }}</p>
        <p v-if="item.availability === 'unavailable'" class="evidence__badge">
          服务未接入
        </p>
        <p v-else-if="item.availability === 'pending'" class="evidence__badge">
          待处理
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.evidence {
  margin-top: 2rem;
}
.section-title {
  font: 500 var(--yx-text-xl) / 1.2 var(--yx-font-display);
  margin: 0 0 1.25rem;
}
.evidence__empty {
  padding: 1.5rem;
  border: 1px dashed var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  color: var(--yx-color-ink-soft);
}
.evidence__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}
.evidence__item {
  padding: 1rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
}
.evidence__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: baseline;
  margin-bottom: 0.75rem;
}
.evidence__title {
  margin: 0;
  font: 500 var(--yx-text-base) / 1.3 var(--yx-font-display);
}
.evidence__kind,
.evidence__date {
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.evidence__summary {
  margin: 0;
  line-height: 1.7;
  color: var(--yx-color-ink);
}
.evidence__badge {
  display: inline-block;
  margin: 0.75rem 0 0;
  padding: 0.25rem 0.6rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-gold-soft);
  color: var(--yx-color-ink);
  font-size: var(--yx-text-sm);
}
</style>
