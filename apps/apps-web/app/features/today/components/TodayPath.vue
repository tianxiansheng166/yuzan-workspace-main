<script setup lang="ts">
import { stateLabel } from "../adapters/today.adapter";
import type { TodayActivity } from "../types";

defineProps<{ activities: TodayActivity[] }>();
</script>

<template>
  <ol class="path" aria-label="今日学习路径">
    <li
      v-for="(activity, index) in activities"
      :key="activity.id"
      :class="`path__item path__item--${activity.state}`"
    >
      <span class="path__number" aria-hidden="true">{{ index + 1 }}</span>
      <div>
        <p class="path__state">{{ stateLabel(activity.state) }}</p>
        <h3>{{ activity.title }}</h3>
        <p>{{ activity.durationMinutes }} 分钟 · {{ activity.completion }}</p>
      </div>
      <NuxtLink
        v-if="activity.state !== 'unavailable'"
        :to="`/student/learning/${activity.id}`"
      >
        {{ activity.state === "completed" ? "回顾" : "进入" }}
      </NuxtLink>
    </li>
  </ol>
</template>

<style scoped>
.path {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.path__item {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem 0;
  border-top: 1px solid var(--yx-color-line);
}
.path__number {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 2px solid var(--yx-color-sage-strong);
  border-radius: 50%;
  font-weight: 700;
}
.path__item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 1.08rem;
  top: 3.5rem;
  bottom: -1rem;
  width: 2px;
  background: var(--yx-color-line);
}
.path h3,
.path p {
  margin: 0;
}
.path p {
  color: var(--yx-color-ink-soft);
  line-height: 1.6;
}
.path__state {
  font-size: var(--yx-text-sm);
  font-weight: 700;
}
.path a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  color: var(--yx-color-sage-strong);
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.2em;
}
@media (max-width: 30rem) {
  .path__item {
    grid-template-columns: auto 1fr;
  }
  .path a {
    grid-column: 2;
  }
}
</style>
