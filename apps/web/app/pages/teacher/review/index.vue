<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useReviewDashboard } from "~/features/submission-review/composables/useReviewDashboard";
import type { ReviewDemoMode } from "~/features/submission-review/gateway/review.gateway";

const route = useRoute();
const mode = computed(
  () => (route.query.mode as ReviewDemoMode | undefined) ?? "default",
);
const selectedLane = computed(
  () =>
    (route.query.lane as
      "all" | "incomplete" | "low-confidence" | "sync-exception" | undefined) ??
    "all",
);

const {
  state,
  lanes,
  generatedAt,
  totalCount,
  laneCounts,
  activeRiskSummary,
  errorMessage,
  load,
} = useReviewDashboard(mode.value);

await load();

const visibleLanes = computed(() =>
  selectedLane.value === "all"
    ? lanes.value
    : lanes.value.filter((lane) => lane.lane === selectedLane.value),
);
</script>

<template>
  <section class="review-dashboard yx-shell">
    <header class="review-dashboard__header">
      <div>
        <p class="yx-kicker">教师复核工作台</p>
        <h1>按风险而不是按统计卡组织复核队列。</h1>
        <p class="review-dashboard__lead">
          教师先看到未完成、低置信度和同步异常，再进入原始证据、自动建议与教师结论并列的复核页。
          当前数据均为 demo / pending，未接 SUB-001 真实复核服务。
        </p>
      </div>
      <YxButton
        kind="secondary"
        disabled
        title="批量处理将在提交 API 与权限联调后开放"
      >
        批量处理
      </YxButton>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载教师复核队列……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取复核队列，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'permission'" class="state-message">
      <p class="yx-kicker">无权查看</p>
      <p>
        只有任教教师才能查看他人提交。当前页面保留权限占位，避免用“角色字符串”直接放开访问。
      </p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">服务不可用</p>
      <p>复核队列当前不可用。请稍后重试，或先处理本地已知同步异常。</p>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">当前没有待复核项</p>
      <p>
        当学生提交完成、同步异常或自动结果低置信度时，这里会自动进入风险队列。
      </p>
    </div>

    <template v-else>
      <section class="review-dashboard__summary" aria-label="复核摘要">
        <div>
          <p class="review-dashboard__summary-label">当前待处理</p>
          <p class="review-dashboard__summary-value">{{ totalCount }} 项</p>
        </div>
        <div>
          <p class="review-dashboard__summary-label">风险分布</p>
          <p class="review-dashboard__summary-copy">{{ activeRiskSummary }}</p>
        </div>
        <div>
          <p class="review-dashboard__summary-label">队列生成时间</p>
          <p class="review-dashboard__summary-copy">{{ generatedAt }}</p>
        </div>
      </section>

      <nav class="review-dashboard__filters" aria-label="风险筛选">
        <NuxtLink
          class="filter-chip"
          :class="{ 'is-active': selectedLane === 'all' }"
          :to="{ query: { ...route.query, lane: 'all' } }"
        >
          全部 {{ totalCount }}
        </NuxtLink>
        <NuxtLink
          class="filter-chip"
          :class="{ 'is-active': selectedLane === 'incomplete' }"
          :to="{ query: { ...route.query, lane: 'incomplete' } }"
        >
          未完成 {{ laneCounts.incomplete }}
        </NuxtLink>
        <NuxtLink
          class="filter-chip"
          :class="{ 'is-active': selectedLane === 'low-confidence' }"
          :to="{ query: { ...route.query, lane: 'low-confidence' } }"
        >
          低置信度 {{ laneCounts["low-confidence"] }}
        </NuxtLink>
        <NuxtLink
          class="filter-chip"
          :class="{ 'is-active': selectedLane === 'sync-exception' }"
          :to="{ query: { ...route.query, lane: 'sync-exception' } }"
        >
          同步异常 {{ laneCounts["sync-exception"] }}
        </NuxtLink>
      </nav>

      <section
        v-for="lane in visibleLanes"
        :key="lane.lane"
        class="lane-section"
        :aria-labelledby="`${lane.lane}-heading`"
      >
        <header class="lane-section__header">
          <div>
            <h2 :id="`${lane.lane}-heading`">{{ lane.title }}</h2>
            <p>{{ lane.description }}</p>
          </div>
          <YxStatus :tone="lane.items.length > 0 ? 'information' : 'neutral'">
            {{ lane.items.length }} 项
          </YxStatus>
        </header>

        <div v-if="lane.items.length === 0" class="empty-hint">
          <p>当前筛选下暂无项目。</p>
        </div>

        <ul v-else class="queue-list" role="list">
          <li v-for="item in lane.items" :key="item.id" class="queue-row">
            <NuxtLink
              :to="`/teacher/review/${item.id}`"
              class="queue-row__link"
            >
              <span class="yx-visually-hidden"
                >进入 {{ item.studentName }} 的复核详情</span
              >
            </NuxtLink>
            <div class="queue-row__identity">
              <div class="queue-row__title">
                <h3>{{ item.studentName }}</h3>
                <YxStatus :tone="item.laneTone">{{ item.laneLabel }}</YxStatus>
                <YxStatus :tone="item.statusTone">{{
                  item.statusLabel
                }}</YxStatus>
                <YxStatus :tone="item.syncTone">{{ item.syncLabel }}</YxStatus>
              </div>
              <p class="queue-row__meta">{{ item.meta }}</p>
            </div>

            <div class="queue-row__signals">
              <div>
                <dt>证据类型</dt>
                <dd>{{ item.evidenceLabel }}</dd>
              </div>
              <div>
                <dt>自动结果</dt>
                <dd>
                  <YxStatus :tone="item.confidenceTone">
                    {{ item.confidenceLabel }}
                  </YxStatus>
                </dd>
              </div>
            </div>

            <p class="queue-row__issue">{{ item.issueSummary }}</p>
          </li>
        </ul>
      </section>

      <p class="review-dashboard__note" aria-live="polite">
        复核项中的学生姓名、提交时间、模型版本和状态均为 demo /
        pending，用于展示教师在弱网与低置信度场景下的操作骨架。
      </p>
    </template>
  </section>
</template>

<style scoped>
.review-dashboard {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.review-dashboard__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}

.review-dashboard h1 {
  margin: 0.5rem 0 0.75rem;
  max-width: 14ch;
  font: 600 clamp(1.9rem, 4vw, 3rem) / 1.08 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.review-dashboard__lead {
  max-width: 56rem;
  margin: 0;
  line-height: 1.8;
  color: var(--yx-text-muted);
}

.review-dashboard__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 1rem 0 1.25rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.review-dashboard__summary-label {
  margin: 0 0 0.35rem;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.review-dashboard__summary-value {
  margin: 0;
  font: 600 clamp(1.5rem, 3vw, 2.2rem) / 1 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.review-dashboard__summary-copy {
  margin: 0;
  line-height: 1.6;
  color: var(--yx-text-secondary);
}

.review-dashboard__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-block: 1rem 1.5rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding-inline: 0.9rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-pill);
  color: var(--yx-text-secondary);
  text-decoration: none;
  background: var(--yx-surface-default);
}

.filter-chip.is-active,
.filter-chip:hover {
  border-color: var(--yx-border-strong);
  color: var(--yx-text-primary);
}

.lane-section {
  padding-block: 1rem 1.5rem;
  border-top: 1px solid var(--yx-border-muted);
}

.lane-section__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 1rem;
}

.lane-section__header h2 {
  margin: 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.lane-section__header p {
  margin: 0.35rem 0 0;
  color: var(--yx-text-muted);
  line-height: 1.7;
  max-width: 46rem;
}

.queue-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}

.queue-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(11rem, 0.7fr);
  gap: 1rem 1.5rem;
  padding: 1.25rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.queue-row:hover {
  border-color: var(--yx-border-strong);
  box-shadow: var(--yx-shadow-100);
}

.queue-row__link {
  position: absolute;
  inset: 0;
  text-decoration: none;
}

.queue-row__identity,
.queue-row__signals,
.queue-row__issue {
  position: relative;
  z-index: 1;
}

.queue-row__title {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.queue-row__title h3 {
  margin: 0;
  font: 600 var(--yx-font-size-400) / 1.25 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.queue-row__meta,
.queue-row__issue {
  margin: 0.45rem 0 0;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.queue-row__signals {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}

.queue-row__signals dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.queue-row__signals dd {
  margin: 0.2rem 0 0;
  color: var(--yx-text-secondary);
}

.review-dashboard__note,
.empty-hint p {
  margin: 1rem 0 0;
  color: var(--yx-text-muted);
  line-height: 1.7;
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

@media (max-width: 64rem) {
  .review-dashboard__summary {
    grid-template-columns: 1fr;
  }

  .queue-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .review-dashboard__header {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 24.375rem) {
  .review-dashboard h1 {
    max-width: none;
  }

  .queue-row {
    padding: 1rem;
  }
}
</style>
