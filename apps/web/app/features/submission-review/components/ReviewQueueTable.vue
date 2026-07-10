<script setup lang="ts">
import { YxStatus } from "@yuzan/ui";
import type { SubmissionSummaryViewModel } from "~/features/submission-review/adapters/review.adapter";

defineProps<{
  rows: SubmissionSummaryViewModel[];
}>();
</script>

<template>
  <div class="queue-table" role="list">
    <article
      v-for="row in rows"
      :key="row.id"
      class="queue-row"
      role="listitem"
    >
      <div class="queue-row__primary">
        <div class="queue-row__heading">
          <h3>{{ row.studentDisplayName }}</h3>
          <YxStatus :tone="row.reviewStatusTone">{{
            row.reviewStatusLabel
          }}</YxStatus>
          <YxStatus :tone="row.aiAssistTone">{{ row.aiAssistLabel }}</YxStatus>
          <YxStatus :tone="row.markerTone">{{ row.markerLabel }}</YxStatus>
        </div>
        <p class="queue-row__meta">
          班级：{{ row.className }} · 任务：{{ row.assignmentTitle }} · 类型：{{
            row.submissionTypeLabel
          }}
        </p>
        <p class="queue-row__meta">
          提交时间：{{ row.submittedAt }} · {{ row.attentionLabel }} ·
          {{ row.overdueLabel }}
        </p>
      </div>

      <NuxtLink :to="`/teacher/review/${row.id}`" class="queue-row__link">
        进入复核详情
      </NuxtLink>
    </article>
  </div>
</template>

<style scoped>
.queue-table {
  display: grid;
  gap: 1rem;
}

.queue-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}

.queue-row__heading {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.queue-row__heading h3 {
  margin: 0;
  font: 600 var(--yx-font-size-400) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.queue-row__meta {
  margin: 0.45rem 0 0;
  line-height: 1.6;
  color: var(--yx-text-muted);
}

.queue-row__link {
  white-space: nowrap;
}

@media (max-width: 48rem) {
  .queue-row {
    grid-template-columns: 1fr;
  }
}
</style>
