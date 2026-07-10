<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useAssignments } from "~/features/assignment-builder/composables/useAssignments";

useSeoMeta({
  title: "教学任务｜语赞心声",
});

const { state, assignments, errorMessage, canCreate, load } = useAssignments();
await load();
</script>

<template>
  <section class="assignment-list yx-shell">
    <header class="assignment-list__header">
      <div>
        <p class="yx-kicker">教师工作台</p>
        <h1>任务编排</h1>
        <p class="assignment-list__lead">
          为班级创建、管理和跟踪学习任务与测评。当前数据均为
          demo，不会真正下发给学生。
        </p>
      </div>
      <NuxtLink
        v-if="canCreate"
        to="/teacher/assignments/new"
        class="create-link"
      >
        新建任务
      </NuxtLink>
      <YxButton
        v-else
        kind="primary"
        disabled
        title="当前角色没有创建任务的权限"
      >
        新建任务
      </YxButton>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载任务列表……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取任务列表，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">暂无任务</p>
      <p>还没有创建任何任务。点击右上角新建任务开始编排。</p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">服务不可用</p>
      <p>任务编排服务当前不可用，请检查网络连接或稍后重试。</p>
    </div>

    <ul v-else class="assignment-list__items" role="list">
      <li v-for="item in assignments" :key="item.id" class="assignment-card">
        <NuxtLink
          :to="`/teacher/assignments/${item.id}`"
          class="assignment-card__link"
        >
          <span class="visually-hidden">进入 {{ item.title }}</span>
        </NuxtLink>
        <div class="assignment-card__content">
          <div class="assignment-card__title-row">
            <h2 class="assignment-card__title">{{ item.title }}</h2>
            <YxStatus :tone="item.statusTone">{{ item.statusLabel }}</YxStatus>
          </div>
          <p class="assignment-card__meta">
            {{ item.typeLabel }} · {{ item.className }} · {{ item.timeRange }}
          </p>
          <p class="assignment-card__completion">{{ item.completionText }}</p>
          <YxStatus v-if="item.isDemo" tone="warning">DEMO</YxStatus>
        </div>
      </li>
    </ul>

    <p
      v-if="state === 'ready'"
      class="assignment-list__note"
      aria-live="polite"
    >
      所有任务状态（draft、scheduled、active、completed、unavailable）、完成进度和学生数据均为
      demo/pending/unavailable，未接入真实后端。
    </p>
  </section>
</template>

<style scoped>
.assignment-list {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.assignment-list__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}
.assignment-list h1 {
  margin: 0.5rem 0 0.75rem;
  font: 600 clamp(1.75rem, 4vw, 2.5rem) / 1.1 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.assignment-list__lead {
  max-width: 48rem;
  color: var(--yx-text-muted);
  line-height: 1.7;
}
.state-message {
  min-height: 18rem;
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
.assignment-list__items {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.assignment-card {
  position: relative;
  padding: 1.25rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  transition:
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}
.assignment-card:hover {
  border-color: var(--yx-border-strong);
  box-shadow: var(--yx-shadow-100);
}
.assignment-card__link {
  position: absolute;
  inset: 0;
  text-decoration: none;
}
.assignment-card__link:focus-visible {
  outline: 0.2rem solid var(--yx-focus-ring);
  outline-offset: 0.15rem;
  border-radius: var(--yx-radius-md);
}
.assignment-card__content {
  display: grid;
  gap: 0.4rem;
}
.assignment-card__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.assignment-card__title {
  margin: 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.assignment-card__meta,
.assignment-card__completion {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.assignment-list__note {
  margin-top: 1.5rem;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.create-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.7rem 1.15rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-action-primary-bg);
  color: var(--yx-action-primary-fg);
  font-weight: var(--yx-font-weight-semibold);
  text-decoration: none;
  box-shadow: var(--yx-shadow-100);
}
.create-link:hover {
  background: var(--yx-action-primary-bg-hover);
}
@media (max-width: 48rem) {
  .assignment-list__header {
    grid-template-columns: 1fr;
  }
}
</style>
