<script setup lang="ts">
import { YxButton } from "@yuzan/ui";
import type { TranslationHistoryItem } from "../types";

defineProps<{
  history: TranslationHistoryItem[];
}>();

const emit = defineEmits<{
  select: [item: TranslationHistoryItem];
  remove: [id: string];
  clear: [];
}>();

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function directionLabel(direction: string): string {
  return direction === "zh-to-bo" ? "中 → 藏" : "藏 → 中";
}
</script>

<template>
  <section class="translation-history" aria-labelledby="history-title">
    <div class="translation-history__header">
      <h2 id="history-title" class="translation-history__title">翻译历史</h2>
      <YxButton
        v-if="history.length > 0"
        kind="quiet"
        data-testid="clear-history"
        @click="emit('clear')"
      >
        清空
      </YxButton>
    </div>

    <p v-if="history.length === 0" class="translation-history__empty">
      暂无历史记录
    </p>

    <ul v-else class="translation-history__list">
      <li
        v-for="item in history"
        :key="item.id"
        class="translation-history__item"
      >
        <button
          type="button"
          class="translation-history__button"
          @click="emit('select', item)"
        >
          <span class="translation-history__direction">
            {{ directionLabel(item.direction) }}
          </span>
          <span class="translation-history__source">{{ item.source }}</span>
          <span class="translation-history__target">{{ item.target }}</span>
          <span class="translation-history__time">
            {{ formatTime(item.createdAt) }}
          </span>
        </button>
        <YxButton
          kind="quiet"
          :aria-label="`删除 ${item.source}`"
          data-testid="remove-history-item"
          @click="emit('remove', item.id)"
        >
          删除
        </YxButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.translation-history {
  margin-top: var(--yx-space-800);
}

.translation-history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--yx-space-400);
}

.translation-history__title {
  margin: 0;
  font: var(--yx-font-size-400) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.translation-history__empty {
  margin: 0;
  padding: var(--yx-space-600);
  text-align: center;
  color: var(--yx-text-muted);
  background: var(--yx-surface-subtle);
  border-radius: var(--yx-radius-md);
}

.translation-history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-300);
}

.translation-history__item {
  display: flex;
  align-items: center;
  gap: var(--yx-space-200);
  padding: var(--yx-space-300);
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-md);
}

.translation-history__button {
  flex: 1;
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  gap: var(--yx-space-300);
  align-items: center;
  text-align: left;
  border: none;
  background: transparent;
  padding: var(--yx-space-200);
  cursor: pointer;
  color: inherit;
}

.translation-history__button:hover {
  background: var(--yx-surface-subtle);
  border-radius: var(--yx-radius-sm);
}

.translation-history__direction {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-accent);
  font-weight: var(--yx-font-weight-semibold);
}

.translation-history__source,
.translation-history__target {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.translation-history__target {
  color: var(--yx-text-muted);
}

.translation-history__time {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

@media (max-width: 48rem) {
  .translation-history__button {
    grid-template-columns: 1fr 1fr;
    gap: var(--yx-space-200);
  }

  .translation-history__direction,
  .translation-history__time {
    grid-column: 1 / -1;
  }
}
</style>
