<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import ReviewFilterBar from "~/features/submission-review/components/ReviewFilterBar.vue";
import ReviewQueueTable from "~/features/submission-review/components/ReviewQueueTable.vue";
import { useReviewDashboard } from "~/features/submission-review/composables/useReviewDashboard";
import type { ReviewScenario } from "~/features/submission-review/types";

useSeoMeta({
  title: "提交复核｜语赞心声",
});

const route = useRoute();
const scenario = computed(
  () => (route.query.scenario as ReviewScenario | undefined) ?? "default",
);

const {
  state,
  generatedAt,
  permission,
  filters,
  filterOptions,
  filteredRows,
  errorMessage,
  load,
} = useReviewDashboard(scenario.value);

function updateFilters(value: (typeof filters)["value"]) {
  filters.value = value;
}

await load();
</script>

<template>
  <section class="review-list yx-shell">
    <header class="review-list__header">
      <div>
        <p class="yx-kicker">教师复核工作台</p>
        <h1>围绕风险、证据与教师判断组织待复核列表。</h1>
        <p class="review-list__lead">
          列表明确展示班级、学生、任务、提交类型、提交时间、待复核状态、已复核状态、需要关注状态、逾期状态、AI
          辅助状态与 demo / pending / unavailable 标记。
        </p>
      </div>
      <YxStatus
        :tone="permission === 'demo-teacher' ? 'information' : 'success'"
      >
        {{ permission === "demo-teacher" ? "DEMO TEACHER" : "TEACHER" }}
      </YxStatus>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载待复核列表……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取待复核列表，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'permission'" class="state-message">
      <p class="yx-kicker">permission denied</p>
      <p>
        当前场景为 {{ permission }}。unknown role 和 student role
        都不能进入教师复核页面，前端提示不等于服务端授权。
      </p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">服务 unavailable</p>
      <p>当前只能显示 unavailable 状态，不会伪造真实待复核结果。</p>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">empty</p>
      <p>当前没有待复核提交。后续学生提交、同步异常或人工干预会进入此列表。</p>
    </div>

    <template v-else>
      <section class="review-list__summary" aria-label="列表摘要">
        <p>生成时间：{{ generatedAt }}</p>
        <p>筛选后的提交数：{{ filteredRows.length }}</p>
        <p>所有结果均为 demo / pending / unavailable，不代表真实服务端状态。</p>
      </section>

      <ReviewFilterBar
        :filter-options="filterOptions"
        :filters="filters"
        @update:filters="updateFilters"
      />

      <ReviewQueueTable :rows="filteredRows" />
    </template>
  </section>
</template>

<style scoped>
.review-list {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.review-list__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.review-list h1 {
  margin: 0.5rem 0 0.75rem;
  max-width: 16ch;
  font: 600 clamp(1.9rem, 4vw, 3rem) / 1.08 var(--yx-font-display);
}

.review-list__lead,
.review-list__summary p {
  margin: 0;
  line-height: 1.7;
  color: var(--yx-text-muted);
}

.review-list__summary {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0 0.4rem;
}

.state-message {
  min-height: 16rem;
  display: grid;
  align-content: center;
  gap: 1rem;
  max-width: 42rem;
  text-align: center;
  margin-inline: auto;
  color: var(--yx-text-secondary);
}

.state-message--error {
  color: var(--yx-danger-fg);
}

@media (max-width: 48rem) {
  .review-list__header {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 24.375rem) {
  .review-list__summary {
    padding-top: 0.9rem;
  }
}
</style>
