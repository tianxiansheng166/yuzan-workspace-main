<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useAssignmentDetail } from "~/features/assignment-builder/composables/useAssignmentDetail";

useSeoMeta({
  title: "任务详情｜语赞心声",
});

const route = useRoute();
const assignmentId = route.params.assignmentId as string;
const { state, detail, students, errorMessage, canManage, load } =
  useAssignmentDetail(assignmentId);
await load();

function studentInitials(name: string): string {
  const chars = name.replace(/[（(].*?[)）]/g, "").trim();
  return chars.slice(0, 2) || "学生";
}
</script>

<template>
  <section class="assignment-detail yx-shell">
    <header class="assignment-detail__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink to="/teacher/assignments" class="back-link"
            >← 任务列表</NuxtLink
          >
          · 教师工作台
        </p>
        <h1>{{ detail?.title ?? "任务详情" }}</h1>
        <p v-if="detail" class="assignment-detail__meta">
          {{ detail.typeLabel }} · {{ detail.className }} ·
          {{ detail.timeRange }}
        </p>
      </div>
      <div class="assignment-detail__badges">
        <YxStatus v-if="detail" :tone="detail.statusTone">{{
          detail.statusLabel
        }}</YxStatus>
        <YxStatus v-if="detail?.isDemo" tone="warning">DEMO</YxStatus>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载任务详情……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取任务详情，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">任务不可用</p>
      <p>该任务信息当前不可用，请检查网络连接或返回任务列表。</p>
      <NuxtLink to="/teacher/assignments" class="back-link"
        >返回任务列表</NuxtLink
      >
    </div>

    <template v-else-if="detail">
      <section class="detail-section" aria-labelledby="overview-heading">
        <h2 id="overview-heading" class="detail-section__title">任务概览</h2>
        <p class="detail-description">{{ detail.description }}</p>
        <dl class="overview-list">
          <div>
            <dt>状态</dt>
            <dd>
              <YxStatus :tone="detail.statusTone">{{
                detail.statusLabel
              }}</YxStatus>
            </dd>
          </div>
          <div>
            <dt>目标班级</dt>
            <dd>{{ detail.className }}</dd>
          </div>
          <div>
            <dt>时间安排</dt>
            <dd>{{ detail.timeRange }}</dd>
          </div>
          <div>
            <dt>任务配置</dt>
            <dd>{{ detail.configuration.join("、") }}</dd>
          </div>
        </dl>
      </section>

      <section class="detail-section" aria-labelledby="contents-heading">
        <h2 id="contents-heading" class="detail-section__title">内容结构</h2>
        <ul
          v-if="detail.selectedContents.length > 0"
          class="content-list"
          role="list"
        >
          <li
            v-for="content in detail.selectedContents"
            :key="content.id"
            class="content-item"
          >
            <span class="content-kind">{{ content.kind }}</span>
            <span class="content-title">{{ content.title }}</span>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无内容结构</p>
      </section>

      <section class="detail-section" aria-labelledby="students-heading">
        <h2 id="students-heading" class="detail-section__title">
          学生完成情况
        </h2>
        <div class="student-cards" role="list">
          <article
            v-for="student in students"
            :key="student.studentId"
            class="student-card"
            role="listitem"
          >
            <div class="student-card__identity">
              <span class="student-card__avatar" aria-hidden="true">{{
                studentInitials(student.displayName)
              }}</span>
              <div>
                <p class="student-card__name">
                  {{ student.displayName }}
                  <YxStatus v-if="student.isDemo" tone="warning">DEMO</YxStatus>
                </p>
              </div>
            </div>
            <dl class="student-card__status">
              <div>
                <dt>进度</dt>
                <dd>
                  <YxStatus :tone="student.progressTone">{{
                    student.progressLabel
                  }}</YxStatus>
                </dd>
              </div>
              <div>
                <dt>朗读</dt>
                <dd>{{ student.speechLabel }}</dd>
              </div>
              <div>
                <dt>书面</dt>
                <dd>{{ student.writtenLabel }}</dd>
              </div>
              <div>
                <dt>报告</dt>
                <dd>{{ student.reportLabel }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <div class="detail-actions">
        <YxButton kind="secondary" disabled title="复制任务功能尚未接入后端"
          >复制任务</YxButton
        >
        <YxButton kind="secondary" disabled title="停用任务功能尚未接入后端"
          >停用任务</YxButton
        >
      </div>

      <p class="detail-note" aria-live="polite">
        学生完成进度、朗读/书面练习状态与报告状态均为
        demo/pending/unavailable，未接入真实后端。
      </p>
    </template>
  </section>
</template>

<style scoped>
.assignment-detail {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.assignment-detail__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}
.assignment-detail h1 {
  margin: 0.5rem 0 0.25rem;
  font: 600 clamp(1.75rem, 4vw, 2.5rem) / 1.1 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.assignment-detail__meta {
  margin: 0;
  color: var(--yx-text-muted);
}
.assignment-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.back-link {
  color: var(--yx-text-accent);
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
.state-message {
  min-height: 14rem;
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
.detail-section {
  margin-bottom: 2rem;
}
.detail-section__title {
  margin: 0 0 0.75rem;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.detail-description {
  color: var(--yx-text-secondary);
  line-height: 1.7;
  margin: 0 0 1rem;
}
.overview-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
.overview-list div {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 1rem;
}
.overview-list dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.overview-list dd {
  margin: 0;
  color: var(--yx-text-primary);
}
.content-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}
.content-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.content-kind {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
  text-transform: uppercase;
}
.content-title {
  color: var(--yx-text-primary);
  font-weight: var(--yx-font-weight-medium);
}
.empty-hint {
  padding: 1.5rem;
  text-align: center;
  color: var(--yx-text-muted);
  border: 1px dashed var(--yx-border-default);
  border-radius: var(--yx-radius-md);
}
.student-cards {
  display: grid;
  gap: 0.75rem;
}
.student-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.student-card__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.student-card__avatar {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--yx-bg-canvas-strong);
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-semibold);
}
.student-card__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-primary);
}
.student-card__status {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 0.75rem 1.25rem;
  margin: 0;
}
.student-card__status div {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.student-card__status dt {
  font-size: var(--yx-font-size-100);
  color: var(--yx-text-muted);
}
.student-card__status dd {
  margin: 0;
  color: var(--yx-text-primary);
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.detail-note {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
@media (max-width: 64rem) {
  .student-card {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
@media (max-width: 48rem) {
  .overview-list div {
    grid-template-columns: 1fr;
  }
  .student-card__status {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 24.375rem) {
  .student-card__status {
    grid-template-columns: 1fr;
  }
}
</style>
