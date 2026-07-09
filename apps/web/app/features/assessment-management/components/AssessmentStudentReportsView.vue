<script setup lang="ts">
import { computed } from "vue";
import { YxStatus } from "@yuzan/ui";

import {
  formatDate,
  formatDateTime,
  formatStudentReportStatus,
  formatTaskStatus,
} from "../formatters";
import type { StudentAssessmentReportsData } from "../types";

const props = defineProps<{
  data: StudentAssessmentReportsData;
}>();

const latest = computed(() => props.data.report.latest);
const previous = computed(() => props.data.report.history[1] ?? null);

function reportTone() {
  if (props.data.report.status === "ready") {
    return "success";
  }

  if (props.data.report.status === "in_progress") {
    return "information";
  }

  return "warning";
}

function taskTone(
  status: StudentAssessmentReportsData["relatedTasks"][number]["status"],
) {
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
  <section class="reports-page">
    <header class="reports-hero">
      <div>
        <div class="reports-hero__eyebrow">
          <p class="yx-kicker">STUDENT REPORT</p>
          <YxStatus :tone="reportTone()">
            {{ formatStudentReportStatus(data.report.status) }}
          </YxStatus>
        </div>
        <h1>{{ data.report.studentName }} 的测评报告</h1>
        <p>{{ data.report.schoolName }} · {{ data.report.className }}</p>
      </div>
      <NuxtLink to="/teacher/assessments">返回教师测评管理</NuxtLink>
    </header>

    <div class="reports-grid">
      <article class="panel panel--summary">
        <p class="yx-kicker">LATEST SUMMARY</p>
        <h2>最近一次测评结果</h2>
        <template v-if="latest">
          <div class="score-grid">
            <div>
              <strong>{{ latest.fluencyScore }}</strong>
              <span>朗读流利度</span>
            </div>
            <div>
              <strong>{{ latest.expressionScore }}</strong>
              <span>口头表达力</span>
            </div>
            <div>
              <strong>{{ latest.writingScore }}</strong>
              <span>书面任务</span>
            </div>
          </div>
          <p>{{ latest.summary }}</p>
          <ul>
            <li v-for="item in latest.strengths" :key="item">{{ item }}</li>
          </ul>
          <p class="reports-page__next-step">下一步：{{ latest.nextStep }}</p>
        </template>
        <template v-else>
          <p>{{ data.report.comparisonSummary }}</p>
        </template>
      </article>

      <article class="panel">
        <p class="yx-kicker">HISTORY ENTRY</p>
        <h2>历史对比入口</h2>
        <p>{{ data.report.comparisonSummary }}</p>
        <template v-if="latest && previous">
          <a :href="`#${previous.id}`"
            >与 {{ formatDate(previous.assessedAt) }} 对比</a
          >
        </template>
        <template v-else>
          <p class="reports-page__muted">当前暂无可对比的历史记录。</p>
        </template>
      </article>
    </div>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="yx-kicker">RELATED TASKS</p>
          <h2>相关测评任务</h2>
        </div>
      </div>
      <div class="task-grid">
        <article
          v-for="task in data.relatedTasks"
          :key="task.id"
          class="task-card"
        >
          <div class="task-card__header">
            <h3>{{ task.title }}</h3>
            <YxStatus :tone="taskTone(task.status)">
              {{ formatTaskStatus(task.status) }}
            </YxStatus>
          </div>
          <p>开放时间：{{ formatDateTime(task.opensAt) }}</p>
          <NuxtLink :to="`/teacher/assessments/${task.id}`"
            >查看所属任务</NuxtLink
          >
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="yx-kicker">REPORT HISTORY</p>
          <h2>测评历史</h2>
        </div>
      </div>
      <div v-if="data.report.history.length > 0" class="history-list">
        <article
          v-for="snapshot in data.report.history"
          :id="snapshot.id"
          :key="snapshot.id"
          class="history-card"
        >
          <div class="history-card__header">
            <h3>{{ formatDate(snapshot.assessedAt) }}</h3>
            <span
              >{{ snapshot.fluencyScore }}/{{ snapshot.expressionScore }}/{{
                snapshot.writingScore
              }}</span
            >
          </div>
          <p>{{ snapshot.summary }}</p>
          <p class="reports-page__next-step">下一步：{{ snapshot.nextStep }}</p>
        </article>
      </div>
      <p v-else class="reports-page__muted">当前没有可展示的历史记录。</p>
    </section>
  </section>
</template>

<style scoped>
.reports-page {
  display: grid;
  gap: 1.25rem;
}

.reports-hero,
.reports-hero__eyebrow,
.task-card__header,
.history-card__header,
.section-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.85rem;
}

.reports-hero {
  padding: clamp(1.4rem, 4vw, 2.3rem);
  border-radius: var(--yx-radius-xl);
  background:
    radial-gradient(circle at top left, #f2e0c4 0%, transparent 26%),
    linear-gradient(155deg, #fffefb 0%, #f7ecdd 48%, #e8efe1 100%);
  box-shadow: var(--yx-shadow-200);
}

h1,
h2,
h3 {
  margin: 0.5rem 0;
  font-family: var(--yx-font-display);
}

h1 {
  font-size: clamp(2rem, 4vw, 3.2rem);
}

.reports-hero p,
.panel p,
.task-card p,
.reports-page__muted {
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel,
.task-card,
.history-card {
  padding: 1.2rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.score-grid,
.task-grid,
.history-list {
  display: grid;
  gap: 1rem;
}

.score-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 1rem 0;
}

.score-grid div {
  padding: 1rem;
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, var(--yx-color-sage) 15%, white);
}

.score-grid strong {
  display: block;
  font-size: clamp(1.7rem, 3vw, 2.4rem);
  font-family: var(--yx-font-display);
}

ul {
  padding-left: 1rem;
}

.reports-page__next-step {
  color: var(--yx-color-wine);
}

@media (max-width: 56rem) {
  .reports-grid,
  .score-grid {
    grid-template-columns: 1fr;
  }
}
</style>
