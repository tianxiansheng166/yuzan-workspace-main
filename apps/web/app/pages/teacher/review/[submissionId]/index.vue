<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useReviewDetail } from "~/features/submission-review/composables/useReviewDetail";
import type { ReviewScenario } from "~/features/submission-review/types";

useSeoMeta({
  title: "提交详情｜语赞心声",
});

const route = useRoute();
const submissionId = route.params.submissionId as string;
const scenario = computed(
  () => (route.query.scenario as ReviewScenario | undefined) ?? "default",
);

const { state, permission, detail, rawDetail, errorMessage, load } =
  useReviewDetail(submissionId, scenario.value);

await load();
</script>

<template>
  <section class="review-detail yx-shell">
    <header class="review-detail__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink to="/teacher/review" class="back-link"
            >← 返回待复核列表</NuxtLink
          >
          · 教师复核工作台
        </p>
        <h1>{{ detail?.studentDisplayName ?? "提交详情" }}</h1>
        <p v-if="detail" class="review-detail__lead">
          {{ detail.className }} · {{ detail.assignmentTitle }} ·
          {{ detail.submittedAt }}
        </p>
      </div>
      <div v-if="detail" class="review-detail__tags">
        <YxStatus :tone="detail.reviewStatusTone">{{
          detail.reviewStatusLabel
        }}</YxStatus>
        <YxStatus :tone="detail.aiAssistTone">{{
          detail.aiAssistLabel
        }}</YxStatus>
        <YxStatus :tone="detail.markerTone">{{ detail.markerLabel }}</YxStatus>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载提交详情……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取提交详情，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'permission'" class="state-message">
      <p class="yx-kicker">permission denied</p>
      <p>
        当前权限为 {{ permission }}。student role 与 unknown role
        不允许查看他人提交。
      </p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">unavailable</p>
      <p>证据链当前 unavailable。不会生成不存在的音频、波形或 AI 分析。</p>
    </div>

    <template v-else-if="detail && rawDetail">
      <p class="review-detail__notice">
        当前详情仅展示 demo 元数据和 unavailable
        占位，真实录音地址、真实学生资料和正式 AI 结果均未接入。
      </p>

      <div class="review-grid">
        <article class="detail-panel">
          <h2>学生与班级基础信息</h2>
          <p>{{ detail.studentDisplayName }} · {{ detail.className }}</p>
          <p>{{ detail.schoolScopedLabel }}</p>
          <p>教师复核状态：{{ detail.teacherReviewLabel }}</p>
        </article>

        <article class="detail-panel">
          <h2>任务说明</h2>
          <p>{{ detail.taskDescription }}</p>
          <p>文本名称：{{ detail.readingTextTitle }}</p>
          <p>提交类型：{{ detail.submissionTypeLabel }}</p>
        </article>

        <article class="detail-panel">
          <h2>朗读提交元数据</h2>
          <p>{{ detail.recordingLabel }}</p>
          <p>录音状态：{{ rawDetail.audioMetadata.fileStatus }}</p>
          <p>AI 处理状态：{{ detail.aiProcessingLabel }}</p>
          <p>采集入口：{{ rawDetail.audioMetadata.captureDevice }}</p>
        </article>

        <article class="detail-panel">
          <h2>书面练习内容</h2>
          <ul class="text-list">
            <li v-for="entry in rawDetail.writtenExercises" :key="entry.prompt">
              <strong>{{ entry.prompt }}</strong>
              <p>{{ entry.answer }}</p>
              <p>完成状态：{{ entry.completionState }}</p>
              <p>教师评语：{{ entry.teacherComment }}</p>
              <p>重做建议：{{ entry.redoSuggestion }}</p>
            </li>
          </ul>
        </article>

        <article class="detail-panel">
          <h2>学习过程证据</h2>
          <ul class="text-list">
            <li v-for="entry in rawDetail.learningEvidence" :key="entry.id">
              <strong>{{ entry.label }}</strong>
              <p>{{ entry.detail }}</p>
              <p>状态：{{ entry.status }}</p>
            </li>
          </ul>
        </article>

        <article class="detail-panel">
          <h2>首测 / 复测关联</h2>
          <p>{{ detail.previousSubmissionLabel }}</p>
          <p>历史记录入口状态：{{ rawDetail.attempt.historyEntryState }}</p>
          <p>提交时间：{{ detail.submittedAt }}</p>
        </article>

        <article class="detail-panel">
          <h2>报告与推荐课程状态</h2>
          <p>{{ detail.reportLabel }}</p>
          <p>{{ detail.recommendationSummary }}</p>
          <p>推荐只允许前端 demo 接受、调整或待确认，不写入真实后端。</p>
        </article>

        <article class="detail-panel">
          <h2>历史提交与教师复核</h2>
          <ul class="text-list">
            <li v-for="entry in rawDetail.reviewHistory" :key="entry.id">
              <strong>{{ entry.actorLabel }} · {{ entry.action }}</strong>
              <p>{{ entry.at }} · {{ entry.note }}</p>
            </li>
          </ul>
          <NuxtLink
            :to="`/teacher/review/${submissionId}/feedback`"
            class="detail-panel__link"
          >
            进入教师反馈
          </NuxtLink>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.review-detail {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.review-detail__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.review-detail h1 {
  margin: 0.5rem 0 0.35rem;
  font: 600 clamp(1.8rem, 4vw, 2.7rem) / 1.08 var(--yx-font-display);
}

.review-detail__lead,
.review-detail__notice,
.detail-panel p {
  margin: 0;
  line-height: 1.7;
  color: var(--yx-text-muted);
}

.review-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.review-detail__notice {
  padding-top: 1rem;
}

.detail-panel {
  padding: 1rem 1.1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}

.detail-panel h2 {
  margin: 0 0 0.75rem;
  font: 600 var(--yx-font-size-400) / 1.2 var(--yx-font-display);
}

.detail-panel__link {
  display: inline-block;
  margin-top: 0.75rem;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  padding-top: 1rem;
}

.text-list {
  display: grid;
  gap: 0.9rem;
  padding-left: 1.1rem;
  margin: 0;
}

.back-link {
  color: var(--yx-text-accent);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
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
  .review-detail__header,
  .review-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 24.375rem) {
  .detail-panel {
    padding: 1rem;
  }
}
</style>
