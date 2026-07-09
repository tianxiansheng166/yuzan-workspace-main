<script setup lang="ts">
import { YxStatus } from "@yuzan/ui";

import { formatDateTime, formatTaskStatus } from "../formatters";
import type { AssessmentTask } from "../types";

defineProps<{
  tasks: AssessmentTask[];
}>();

function statusTone(status: AssessmentTask["status"]) {
  if (status === "live") {
    return "success";
  }

  if (status === "scheduled") {
    return "information";
  }

  return "warning";
}
</script>

<template>
  <div class="task-list">
    <article v-for="task in tasks" :key="task.id" class="task-card">
      <div class="task-card__eyebrow">
        <p class="yx-kicker">ASSESSMENT TASK</p>
        <YxStatus :tone="statusTone(task.status)">
          {{ formatTaskStatus(task.status) }}
        </YxStatus>
      </div>
      <h2>{{ task.title }}</h2>
      <p class="task-card__summary">{{ task.targetSummary }}</p>
      <dl class="task-card__meta">
        <div>
          <dt>开放时间</dt>
          <dd>{{ formatDateTime(task.opensAt) }}</dd>
        </div>
        <div>
          <dt>截止时间</dt>
          <dd>{{ formatDateTime(task.closesAt) }}</dd>
        </div>
        <div>
          <dt>匿名测评</dt>
          <dd>{{ task.anonymous ? "已开启" : "未开启" }}</dd>
        </div>
      </dl>
      <div class="task-card__progress">
        <strong>完成 {{ task.progress.completedLabel }}</strong>
        <strong>未完成 {{ task.progress.incompleteLabel }}</strong>
      </div>
      <p class="task-card__note">{{ task.progress.note }}</p>
      <div class="task-card__actions">
        <NuxtLink :to="`/teacher/assessments/${task.id}`"
          >查看任务详情</NuxtLink
        >
        <NuxtLink
          v-if="task.reportStudentIds.length > 0"
          :to="`/teacher/students/${task.reportStudentIds[0]}/assessment-reports`"
        >
          学生报告与历史对比
        </NuxtLink>
      </div>
    </article>
  </div>
</template>

<style scoped>
.task-list {
  display: grid;
  gap: 1.25rem;
}

.task-card {
  padding: 1.4rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background:
    linear-gradient(145deg, #fffefb 0%, #f8f1e7 56%, #edf2e9 100%),
    var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.task-card__eyebrow,
.task-card__actions,
.task-card__progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
}

h2 {
  margin: 0.6rem 0 0.9rem;
  font: 600 clamp(1.45rem, 2.5vw, 2rem) / 1.1 var(--yx-font-display);
}

.task-card__summary,
.task-card__note {
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.task-card__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 1.25rem 0;
}

.task-card__meta div {
  padding: 0.85rem;
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, white 64%, transparent);
}

dt {
  margin-bottom: 0.35rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}

dd {
  margin: 0;
}

.task-card__progress {
  justify-content: flex-start;
  gap: 1rem 1.4rem;
  padding-top: 0.5rem;
}

.task-card__actions a {
  text-decoration: none;
}

@media (max-width: 52rem) {
  .task-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
