<script setup lang="ts">
import { YxButton } from "@yuzan/ui";
import {
  getAvailableCategories,
  trainingCategories,
  type TrainingCategory,
} from "../data/training-categories";

const categories = trainingCategories;
const availableCount = getAvailableCategories(categories).length;

function entryLabel(category: TrainingCategory): string {
  return category.available ? "进入培训" : "暂不可用";
}
</script>

<template>
  <section class="training-hub yx-shell">
    <header class="training-hub__header">
      <div>
        <p class="yx-kicker">Training Hub</p>
        <h1>培训分类入口</h1>
        <p class="training-hub__lead">
          学生课程、教师培训与志愿者培训三类入口清晰分开；尚未接入的入口会明确标注
          unavailable，避免误入未完成页面。
        </p>
      </div>
      <div
        v-if="availableCount === 0"
        class="training-hub__status training-hub__status--unavailable"
        role="status"
      >
        当前没有可进入的培训入口
      </div>
      <div v-else class="training-hub__status" role="status">
        当前有 {{ availableCount }} 个入口可进入
      </div>
    </header>

    <ul class="training-hub__grid" role="list">
      <li
        v-for="category in categories"
        :key="category.id"
        class="training-hub__card"
        :class="{
          'training-hub__card--available': category.available,
          'training-hub__card--unavailable': !category.available,
        }"
      >
        <div class="training-hub__card-head">
          <h2>{{ category.title }}</h2>
          <span class="training-hub__audience">{{ category.audience }}</span>
        </div>
        <p class="training-hub__description">{{ category.description }}</p>

        <div class="training-hub__entry">
          <NuxtLink
            v-if="category.available && category.route"
            :to="category.route"
            class="training-hub__link"
          >
            <YxButton>{{ entryLabel(category) }}</YxButton>
          </NuxtLink>
          <YxButton v-else disabled>{{ entryLabel(category) }}</YxButton>

          <p
            v-if="!category.available && category.unavailableReason"
            class="training-hub__unavailable-reason"
          >
            {{ category.unavailableReason }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.training-hub {
  padding-block: clamp(3rem, 7vw, 7rem);
}

.training-hub__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: start;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.training-hub h1 {
  margin: 0.8rem 0;
  font: 600 clamp(2rem, 5vw, 4rem) / 1 var(--yx-font-display);
}

.training-hub__lead {
  max-width: 48rem;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.training-hub__status {
  padding: 0.75rem 1rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
  white-space: nowrap;
}

.training-hub__status--unavailable {
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
}

.training-hub__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1.5rem;
  list-style: none;
  margin: 2rem 0 0;
  padding: 0;
}

.training-hub__card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.training-hub__card--available {
  border-color: var(--yx-border-strong);
}

.training-hub__card--unavailable {
  background: var(--yx-surface-subtle);
  opacity: 0.92;
}

.training-hub__card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: baseline;
  justify-content: space-between;
}

.training-hub__card h2 {
  margin: 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
}

.training-hub__audience {
  padding: 0.35rem 0.65rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-bg-muted);
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-100);
}

.training-hub__description {
  flex: 1 1 auto;
  margin: 0;
  color: var(--yx-text-secondary);
  line-height: 1.7;
}

.training-hub__entry {
  display: grid;
  gap: 0.75rem;
  margin-top: auto;
}

.training-hub__link {
  display: inline-flex;
  text-decoration: none;
}

.training-hub__unavailable-reason {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

@media (max-width: 48rem) {
  .training-hub__header {
    grid-template-columns: 1fr;
  }

  .training-hub__status {
    justify-self: start;
  }

  .training-hub__grid {
    grid-template-columns: 1fr;
  }
}
</style>
