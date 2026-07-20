<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";

import { YxStatus } from "@yuzan/ui";

import AssessmentPageShell from "./AssessmentPageShell.vue";
import { assessmentTitle } from "./assessment-content";
import { listAssessmentHistory } from "./assessment-gateway";
import { formatDuration } from "./assessment-helpers";
import type { AssessmentReport } from "./assessment-types";

type LoadState = "loading" | "empty" | "error" | "complete";

const loadState = ref<LoadState>("loading");
const historyItems = ref<AssessmentReport[]>([]);
const compareIds = ref<string[]>([]);
const compareHint = ref("最多选择 2 条记录进行对比。");
const errorMessage = ref("");
const statusRef = ref<HTMLElement | null>(null);

useHead({
  title: `${assessmentTitle} - 历史记录 | 语赞心声`,
});

const compareItems = computed(() =>
  compareIds.value
    .map(
      (reportId) =>
        historyItems.value.find((item) => item.reportId === reportId) ?? null,
    )
    .filter((item): item is AssessmentReport => Boolean(item)),
);

function focusStatusCard() {
  void nextTick(() => statusRef.value?.focus());
}

async function loadHistory() {
  loadState.value = "loading";
  errorMessage.value = "";

  try {
    const reports = await listAssessmentHistory();
    historyItems.value = reports;

    if (!reports.length) {
      loadState.value = "empty";
      compareIds.value = [];
    } else {
      loadState.value = "complete";
      compareIds.value = reports.slice(0, 2).map((report) => report.reportId);
      compareHint.value =
        reports.length > 1
          ? "已默认选中最近 2 次记录。"
          : "当前只有 1 次记录。";
    }
  } catch {
    errorMessage.value = "历史记录加载失败，请稍后重试。";
    loadState.value = "error";
  }

  focusStatusCard();
}

function toggleCompare(reportId: string, checked: boolean) {
  if (checked) {
    if (compareIds.value.includes(reportId)) {
      return;
    }

    if (compareIds.value.length >= 2) {
      compareHint.value = "最多同时对比 2 条记录，请先取消一条。";
      focusStatusCard();
      return;
    }

    compareIds.value = [...compareIds.value, reportId];
    compareHint.value = `已选择 ${compareIds.value.length} 条记录。`;
    return;
  }

  compareIds.value = compareIds.value.filter((item) => item !== reportId);
  compareHint.value = compareIds.value.length
    ? `当前选择 ${compareIds.value.length} 条记录。`
    : "请至少选择 1 条记录。";
}

onMounted(loadHistory);
</script>

<template>
  <AssessmentPageShell
    :title="`${assessmentTitle} · 历史记录`"
    summary="每次测评都会生成新的报告编号，历史页会保留旧记录，方便对比最近两次表现与状态。"
  >
    <template #actions>
      <NuxtLink class="text-link" to="/assessment">返回测评首页</NuxtLink>
      <NuxtLink class="text-link" to="/assessment/reading">再测一次</NuxtLink>
    </template>

    <div
      v-if="loadState === 'loading'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="polite"
    >
      <YxStatus tone="information">加载中</YxStatus>
      <p>正在读取历史记录。</p>
    </div>

    <div
      v-else-if="loadState === 'empty'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="assertive"
    >
      <YxStatus tone="warning">暂无记录</YxStatus>
      <p>还没有测评历史，完成一次朗读与作答后会在这里看到报告。</p>
      <NuxtLink class="text-link" to="/assessment/reading">去开始测评</NuxtLink>
    </div>

    <div
      v-else-if="loadState === 'error'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="assertive"
    >
      <YxStatus tone="danger">读取失败</YxStatus>
      <p>{{ errorMessage }}</p>
      <button class="inline-button" type="button" @click="loadHistory">
        重试
      </button>
    </div>

    <div v-else class="history-layout">
      <section class="history-list">
        <div
          ref="statusRef"
          class="selection-banner"
          tabindex="-1"
          aria-live="polite"
        >
          <YxStatus tone="information">对比选择</YxStatus>
          <p>{{ compareHint }}</p>
        </div>

        <article
          v-for="item in historyItems"
          :key="item.reportId"
          class="history-card"
        >
          <div class="history-card__top">
            <label class="history-card__select">
              <input
                type="checkbox"
                :checked="compareIds.includes(item.reportId)"
                @change="
                  toggleCompare(
                    item.reportId,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span>加入对比</span>
            </label>
            <YxStatus
              :tone="
                item.isDemo
                  ? 'information'
                  : item.status === 'complete'
                    ? 'success'
                    : 'warning'
              "
            >
              {{ item.isDemo ? "demo 报告" : item.status }}
            </YxStatus>
          </div>

          <div class="history-card__body">
            <div>
              <p class="history-card__time">
                {{ new Date(item.createdAt).toLocaleString("zh-CN") }}
              </p>
              <p class="history-card__summary">{{ item.summary }}</p>
            </div>
            <dl class="history-card__meta">
              <div>
                <dt>朗读时长</dt>
                <dd>{{ formatDuration(item.reading.durationMs) }}</dd>
              </div>
              <div>
                <dt>书面完成</dt>
                <dd>
                  {{ item.written.answeredQuestions }}/{{
                    item.written.totalQuestions
                  }}
                </dd>
              </div>
              <div>
                <dt>报告编号</dt>
                <dd>{{ item.reportId }}</dd>
              </div>
            </dl>
          </div>

          <NuxtLink
            class="text-link"
            :to="`/assessment/report/${item.reportId}`"
          >
            查看报告
          </NuxtLink>
        </article>
      </section>

      <aside class="compare-panel">
        <section class="compare-card">
          <h2>对比面板</h2>
          <p v-if="!compareItems.length">
            选择至少 1 条记录后，这里会显示摘要对比。
          </p>
          <div v-else class="compare-grid">
            <article
              v-for="item in compareItems"
              :key="item.reportId"
              class="compare-grid__item"
            >
              <h3>
                {{ item.isDemo ? "Demo" : "真实" }} ·
                {{ new Date(item.createdAt).toLocaleDateString("zh-CN") }}
              </h3>
              <ul>
                <li>状态：{{ item.status }}</li>
                <li>朗读：{{ formatDuration(item.reading.durationMs) }}</li>
                <li>
                  书面：{{ item.written.answeredQuestions }}/{{
                    item.written.totalQuestions
                  }}
                </li>
                <li v-if="typeof item.overallScore === 'number'">
                  演示总分：{{ item.overallScore }}
                </li>
              </ul>
            </article>
          </div>
        </section>
      </aside>
    </div>
  </AssessmentPageShell>
</template>

<style scoped>
.history-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.9fr);
  gap: var(--yx-space-800);
}

.history-list,
.compare-panel {
  min-width: 0;
}

.history-list {
  display: grid;
  gap: var(--yx-space-500);
}

.selection-banner,
.history-card,
.compare-card,
.state-card {
  padding: clamp(1.1rem, 3vw, 1.6rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
  box-shadow: var(--yx-shadow-100);
}

.selection-banner,
.state-card {
  display: grid;
  gap: var(--yx-space-200);
}

.selection-banner p,
.state-card p,
.compare-card p,
.history-card__summary,
.history-card__time {
  margin: 0;
  color: var(--yx-text-secondary);
}

.history-card {
  display: grid;
  gap: var(--yx-space-400);
}

.history-card__top,
.history-card__body {
  display: flex;
  justify-content: space-between;
  gap: var(--yx-space-500);
  align-items: start;
}

.history-card__select {
  display: inline-flex;
  align-items: center;
  gap: var(--yx-space-200);
}

.history-card__time {
  font-size: var(--yx-font-size-200);
}

.history-card__summary {
  margin-top: var(--yx-space-200);
}

.history-card__meta {
  min-width: 14rem;
  margin: 0;
  display: grid;
  gap: var(--yx-space-300);
}

.history-card__meta dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.history-card__meta dd {
  margin: 0.12rem 0 0;
  word-break: break-all;
}

.compare-card h2,
.compare-grid__item h3 {
  margin: 0 0 var(--yx-space-300);
}

.compare-grid {
  display: grid;
  gap: var(--yx-space-400);
}

.compare-grid__item {
  padding: var(--yx-space-400);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
}

.compare-grid__item ul {
  margin: 0;
  padding-left: 1rem;
  color: var(--yx-text-secondary);
}

.compare-grid__item li + li {
  margin-top: var(--yx-space-200);
}

.text-link,
.inline-button {
  color: var(--yx-action-link);
}

.inline-button {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

@media (max-width: 72rem) {
  .history-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .history-card__top,
  .history-card__body {
    flex-direction: column;
  }

  .history-card__meta {
    min-width: 0;
    width: 100%;
  }
}
</style>
