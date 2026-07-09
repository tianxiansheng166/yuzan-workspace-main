<script setup lang="ts">
import { ref } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";

import {
  formatDate,
  formatDateTime,
  formatStudentReportStatus,
  formatTaskStatus,
} from "../formatters";
import type { AssessmentTaskDetailData } from "../types";

const props = defineProps<{
  detail: AssessmentTaskDetailData;
  deactivating?: boolean;
}>();

const emit = defineEmits<{
  deactivate: [];
}>();

const copyMessage = ref("");

function taskTone() {
  if (props.detail.task.status === "live") {
    return "success";
  }

  if (props.detail.task.status === "scheduled") {
    return "information";
  }

  return "warning";
}

function reportTone(
  status: AssessmentTaskDetailData["reports"][number]["status"],
) {
  if (status === "ready") {
    return "success";
  }

  if (status === "in_progress") {
    return "information";
  }

  return "warning";
}

async function copyLink() {
  const url = props.detail.task.demoLink.url;

  if (typeof navigator === "undefined" || !navigator.clipboard) {
    copyMessage.value = "当前环境不支持自动复制，请手动复制 demo 链接。";
    return;
  }

  await navigator.clipboard.writeText(url);
  copyMessage.value = "demo 访问链接已复制。";
}
</script>

<template>
  <section class="detail-view">
    <header class="detail-hero">
      <div>
        <div class="detail-hero__eyebrow">
          <p class="yx-kicker">ASSESSMENT DETAIL</p>
          <YxStatus :tone="taskTone()">
            {{ formatTaskStatus(detail.task.status) }}
          </YxStatus>
        </div>
        <h1>{{ detail.task.title }}</h1>
        <p>{{ detail.task.targetSummary }}</p>
      </div>
      <div class="detail-hero__actions">
        <NuxtLink to="/teacher/assessments/new">继续创建新任务</NuxtLink>
        <NuxtLink to="/teacher/assessments">返回任务列表</NuxtLink>
      </div>
    </header>

    <div class="detail-grid">
      <article class="card card--link">
        <p class="yx-kicker">DEMO ACCESS</p>
        <h2>唯一 demo 访问链接</h2>
        <code>{{ detail.task.demoLink.url }}</code>
        <dl>
          <div>
            <dt>访问码</dt>
            <dd>{{ detail.task.demoLink.code }}</dd>
          </div>
          <div>
            <dt>开放窗口</dt>
            <dd>
              {{ formatDateTime(detail.task.opensAt) }} -
              {{ formatDateTime(detail.task.closesAt) }}
            </dd>
          </div>
          <div>
            <dt>匿名测评</dt>
            <dd>{{ detail.task.anonymous ? "已开启" : "未开启" }}</dd>
          </div>
        </dl>
        <div class="card__actions">
          <YxButton @click="copyLink">复制链接</YxButton>
          <button class="disabled-button" type="button" disabled>
            二维码生成待依赖批准
          </button>
        </div>
        <p class="card__meta">{{ detail.task.demoLink.qrReason }}</p>
        <p v-if="detail.task.demoLink.deactivatedAt" class="card__meta">
          已于 {{ formatDate(detail.task.demoLink.deactivatedAt) }} 停用 demo
          链接。
        </p>
        <p v-if="copyMessage" class="card__meta card__meta--strong">
          {{ copyMessage }}
        </p>
      </article>

      <article class="card">
        <p class="yx-kicker">CONTENT PAIR</p>
        <h2>朗读材料与书面任务</h2>
        <div class="pairing">
          <section>
            <h3>{{ detail.readingMaterial.title }}</h3>
            <p>{{ detail.readingMaterial.summary }}</p>
          </section>
          <section>
            <h3>{{ detail.writingTask.title }}</h3>
            <p>{{ detail.writingTask.summary }}</p>
          </section>
        </div>
      </article>

      <article class="card">
        <p class="yx-kicker">PROGRESS LABELS</p>
        <h2>完成状态说明</h2>
        <div class="progress-labels">
          <div>
            <strong>已完成</strong>
            <span>{{ detail.task.progress.completedLabel }}</span>
          </div>
          <div>
            <strong>未完成</strong>
            <span>{{ detail.task.progress.incompleteLabel }}</span>
          </div>
        </div>
        <p class="card__meta">{{ detail.task.progress.note }}</p>
      </article>

      <article class="card">
        <p class="yx-kicker">LIFECYCLE</p>
        <h2>任务操作</h2>
        <dl>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatDateTime(detail.task.createdAt) }}</dd>
          </div>
          <div>
            <dt>创建人</dt>
            <dd>{{ detail.task.createdBy }}</dd>
          </div>
        </dl>
        <YxButton
          kind="secondary"
          :disabled="detail.task.status === 'inactive'"
          :loading="deactivating"
          @click="emit('deactivate')"
        >
          {{ detail.task.status === "inactive" ? "已停用" : "停用 demo 链接" }}
        </YxButton>
      </article>
    </div>

    <section class="reports">
      <div class="reports__header">
        <div>
          <p class="yx-kicker">STUDENT REPORTS</p>
          <h2>学生报告与历史对比入口</h2>
        </div>
        <p>ready / in-progress / unavailable 都会明确展示，不伪造报告状态。</p>
      </div>
      <div class="reports__list">
        <article
          v-for="report in detail.reports"
          :key="report.studentId"
          class="report-card"
        >
          <div class="report-card__header">
            <div>
              <h3>{{ report.studentName }}</h3>
              <p>{{ report.schoolName }} · {{ report.className }}</p>
            </div>
            <YxStatus :tone="reportTone(report.status)">
              {{ formatStudentReportStatus(report.status) }}
            </YxStatus>
          </div>
          <p>{{ report.comparisonSummary }}</p>
          <NuxtLink
            class="report-card__link"
            :to="`/teacher/students/${report.studentId}/assessment-reports`"
          >
            查看学生报告与历史对比
          </NuxtLink>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.detail-view {
  display: grid;
  gap: 1.5rem;
}

.detail-hero,
.detail-hero__eyebrow,
.detail-hero__actions,
.card__actions,
.reports__header,
.report-card__header,
.progress-labels {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.9rem;
}

.detail-hero {
  padding: clamp(1.5rem, 4vw, 2.75rem);
  border-radius: var(--yx-radius-xl);
  background:
    radial-gradient(circle at top right, #d9e6d3 0%, transparent 25%),
    linear-gradient(145deg, #fffefb 0%, #f3e7d8 50%, #e8efe1 100%);
  box-shadow: var(--yx-shadow-200);
}

h1,
h2,
h3 {
  margin: 0.55rem 0;
  font-family: var(--yx-font-display);
}

h1 {
  font-size: clamp(2rem, 4.4vw, 3.6rem);
  line-height: 0.98;
}

.detail-hero p,
.card p,
.report-card p,
.card__meta {
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.card,
.report-card {
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.card--link code {
  display: block;
  padding: 0.95rem;
  border-radius: var(--yx-radius-lg);
  background: var(--yx-color-ink);
  color: white;
  overflow-wrap: anywhere;
}

dl {
  display: grid;
  gap: 0.8rem;
  margin: 1rem 0;
}

dt {
  margin-bottom: 0.25rem;
  font-size: var(--yx-text-sm);
}

dd {
  margin: 0;
}

.disabled-button {
  min-height: 2.75rem;
  padding-inline: 1.15rem;
  border: 1px dashed var(--yx-color-line);
  border-radius: var(--yx-radius-pill);
  background: transparent;
  color: var(--yx-color-ink-soft);
}

.card__meta--strong {
  color: var(--yx-color-wine);
}

.pairing {
  display: grid;
  gap: 0.8rem;
}

.pairing section {
  padding: 0.9rem;
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, var(--yx-color-sage) 18%, white);
}

.progress-labels div {
  flex: 1 1 14rem;
  padding: 1rem;
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, white 82%, var(--yx-color-sage));
}

.progress-labels strong,
.progress-labels span {
  display: block;
}

.progress-labels span {
  margin-top: 0.4rem;
  font-size: clamp(1.5rem, 4vw, 2.3rem);
  font-family: var(--yx-font-display);
}

.reports {
  display: grid;
  gap: 1rem;
}

.reports__list {
  display: grid;
  gap: 1rem;
}

.report-card__link {
  text-decoration: none;
}

@media (max-width: 60rem) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
