<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { YxStatus } from "@yuzan/ui";

import AssessmentPageShell from "./AssessmentPageShell.vue";
import { assessmentTitle } from "./assessment-content";
import { getAssessmentReport } from "./assessment-gateway";
import { formatDuration } from "./assessment-helpers";
import type { AssessmentReport } from "./assessment-types";

type LoadState = "loading" | "empty" | "error" | "complete";

const route = useRoute();
const reportId = computed(() => String(route.params.reportId ?? ""));
const loadState = ref<LoadState>("loading");
const report = ref<AssessmentReport | null>(null);
const errorMessage = ref("");
const statusRef = ref<HTMLElement | null>(null);

useHead({
  title: `${assessmentTitle} - 报告 | 语赞心声`,
});

const reportStatusTone = computed(() => {
  if (!report.value) {
    return "neutral";
  }

  if (report.value.status === "complete") {
    return "success";
  }

  if (report.value.status === "unavailable") {
    return "danger";
  }

  return "warning";
});

async function loadReport() {
  loadState.value = "loading";
  errorMessage.value = "";
  report.value = null;

  try {
    const currentReport = await getAssessmentReport(reportId.value);

    if (!currentReport) {
      loadState.value = "empty";
    } else {
      report.value = currentReport;
      loadState.value = "complete";
    }
  } catch {
    errorMessage.value = "报告加载失败，请稍后再试。";
    loadState.value = "error";
  }

  await nextTick();
  statusRef.value?.focus();
}

onMounted(loadReport);
watch(reportId, loadReport);
</script>

<template>
  <AssessmentPageShell
    :title="`${assessmentTitle} · 测评报告`"
    summary="这里会显示本次提交的状态、摘要和历史入口。真实流程默认只保留 pending / unavailable。"
  >
    <template #actions>
      <NuxtLink class="text-link" to="/assessment/history">查看历史</NuxtLink>
      <NuxtLink
        class="text-link"
        :to="
          report?.mode === 'demo'
            ? '/assessment/reading?mode=demo'
            : '/assessment/reading'
        "
      >
        再测一次
      </NuxtLink>
    </template>

    <div
      v-if="loadState === 'loading'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="polite"
    >
      <YxStatus tone="information">加载中</YxStatus>
      <p>正在读取本次测评报告。</p>
    </div>

    <div
      v-else-if="loadState === 'empty'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="assertive"
    >
      <YxStatus tone="warning">报告不存在</YxStatus>
      <p>没有找到对应的报告编号，可能是本地记录已清空或尚未提交成功。</p>
      <NuxtLink class="text-link" to="/assessment">返回测评首页</NuxtLink>
    </div>

    <div
      v-else-if="loadState === 'error'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="assertive"
    >
      <YxStatus tone="danger">加载失败</YxStatus>
      <p>{{ errorMessage }}</p>
      <button class="inline-button" type="button" @click="loadReport">
        重试加载
      </button>
    </div>

    <div v-else-if="report" class="report-layout">
      <section ref="statusRef" class="report-main" tabindex="-1">
        <div class="report-card">
          <div class="report-card__top">
            <div>
              <p class="report-card__label">报告编号</p>
              <p class="report-card__id">{{ report.reportId }}</p>
            </div>
            <YxStatus :tone="reportStatusTone">
              {{ report.status }}
            </YxStatus>
          </div>

          <div v-if="report.isDemo" class="demo-banner" role="note">
            <strong>演示报告</strong>
            <span>以下分数与建议均为 demo 数据，不代表真实 AI 评测结果。</span>
          </div>

          <p class="report-summary">{{ report.summary }}</p>
          <p class="report-disclaimer">{{ report.disclaimer }}</p>

          <div class="dimension-list">
            <article
              v-for="dimension in report.dimensions"
              :key="dimension.key"
              class="dimension-card"
            >
              <div class="dimension-card__top">
                <h2>{{ dimension.label }}</h2>
                <span v-if="typeof dimension.score === 'number'">
                  {{ dimension.score }} 分
                </span>
              </div>
              <p>{{ dimension.summary }}</p>
            </article>
          </div>

          <div class="highlight-list">
            <h2>报告提示</h2>
            <ul>
              <li v-for="highlight in report.highlights" :key="highlight">
                {{ highlight }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <aside class="report-side">
        <section class="report-card">
          <h2>提交摘要</h2>
          <dl class="summary-list">
            <div>
              <dt>流程模式</dt>
              <dd>{{ report.mode === "demo" ? "演示流程" : "真实流程" }}</dd>
            </div>
            <div>
              <dt>提交时间</dt>
              <dd>{{ new Date(report.createdAt).toLocaleString("zh-CN") }}</dd>
            </div>
            <div>
              <dt>朗读时长</dt>
              <dd>{{ formatDuration(report.reading.durationMs) }}</dd>
            </div>
            <div>
              <dt>书面完成度</dt>
              <dd>
                {{ report.written.answeredQuestions }}/{{
                  report.written.totalQuestions
                }}
              </dd>
            </div>
            <div v-if="typeof report.overallScore === 'number'">
              <dt>演示总分</dt>
              <dd>{{ report.overallScore }} 分</dd>
            </div>
          </dl>
        </section>

        <section class="report-card">
          <h2>下一步</h2>
          <ul>
            <li>进入历史页对比新旧记录，旧报告会继续保留。</li>
            <li>如果你想验证完整完成态，请再走一次 demo 流程。</li>
          </ul>
        </section>
      </aside>
    </div>
  </AssessmentPageShell>
</template>

<style scoped>
.report-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.9fr);
  gap: var(--yx-space-800);
}

.report-main,
.report-side {
  min-width: 0;
}

.report-side {
  display: grid;
  gap: var(--yx-space-500);
  align-content: start;
}

.report-card,
.state-card {
  padding: clamp(1.15rem, 3vw, 1.75rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
  box-shadow: var(--yx-shadow-100);
}

.report-card__top,
.dimension-card__top {
  display: flex;
  justify-content: space-between;
  gap: var(--yx-space-400);
  align-items: start;
  flex-wrap: wrap;
}

.report-card__label,
.report-summary,
.report-disclaimer,
.state-card p,
.dimension-card p,
.summary-list dd,
.summary-list dt {
  margin: 0;
}

.report-card__label {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.report-card__id {
  margin: 0.2rem 0 0;
  font-family: var(--yx-font-display);
  word-break: break-all;
}

.demo-banner {
  display: grid;
  gap: var(--yx-space-100);
  margin-top: var(--yx-space-500);
  padding: var(--yx-space-400);
  border-radius: var(--yx-radius-md);
  border: 1px solid var(--yx-information-border);
  background: var(--yx-information-bg);
  color: var(--yx-information-fg);
}

.report-summary {
  margin-top: var(--yx-space-500);
  font-size: var(--yx-font-size-400);
}

.report-disclaimer {
  margin-top: var(--yx-space-300);
  color: var(--yx-text-secondary);
}

.dimension-list,
.highlight-list {
  margin-top: var(--yx-space-600);
}

.dimension-list {
  display: grid;
  gap: var(--yx-space-400);
}

.dimension-card {
  padding: var(--yx-space-400);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
}

.dimension-card h2,
.highlight-list h2,
.report-card h2 {
  margin: 0 0 var(--yx-space-300);
  font-size: var(--yx-font-size-500);
}

.highlight-list ul,
.report-card ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--yx-text-secondary);
}

.highlight-list li + li,
.report-card li + li {
  margin-top: var(--yx-space-200);
}

.summary-list {
  margin: 0;
  display: grid;
  gap: var(--yx-space-300);
}

.summary-list dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.summary-list dd {
  margin-top: 0.12rem;
  color: var(--yx-text-secondary);
}

.state-card,
.inline-button {
  display: grid;
  gap: var(--yx-space-300);
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
  .report-layout {
    grid-template-columns: 1fr;
  }
}
</style>
