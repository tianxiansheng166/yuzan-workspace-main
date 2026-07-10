<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useClasses } from "~/features/classes/composables/useClasses";

const { state, classes, errorMessage, canManage, load } = useClasses();
await load();
</script>

<template>
  <section class="class-list yx-shell">
    <header class="class-list__header">
      <div>
        <p class="yx-kicker">教师工作台</p>
        <h1>我的班级</h1>
        <p class="class-list__lead">
          管理班级学生、查看测评进度与报告。学生数据当前为 demo
          标记，未接入真实后端。
        </p>
      </div>
      <YxButton
        v-if="canManage"
        kind="secondary"
        disabled
        title="邀请学生功能将在 ORG-001 对接后启用"
      >
        邀请学生
      </YxButton>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载班级列表……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取班级列表，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">暂无班级</p>
      <p>你还没有被分配到任何班级。请联系管理员或稍后再试。</p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">服务不可用</p>
      <p>班级服务当前不可用，请检查网络连接或稍后重试。</p>
    </div>

    <ul v-else class="class-list__items" role="list">
      <li v-for="item in classes" :key="item.id" class="class-card">
        <NuxtLink :to="`/teacher/classes/${item.id}`" class="class-card__link">
          <span class="visually-hidden">进入 {{ item.name }}</span>
        </NuxtLink>
        <div class="class-card__content">
          <div class="class-card__title-row">
            <h2 class="class-card__name">{{ item.name }}</h2>
            <YxStatus :tone="item.syncTone">{{ item.syncLabel }}</YxStatus>
          </div>
          <p class="class-card__meta">{{ item.meta }}</p>
          <p class="class-card__grade">{{ item.grade }}</p>
        </div>
        <div class="class-card__actions" @click.stop>
          <YxButton
            kind="quiet"
            :disabled="!canManage"
            title="编辑班级信息尚未接入后端"
          >
            编辑
          </YxButton>
        </div>
      </li>
    </ul>

    <p v-if="state === 'ready'" class="class-list__note" aria-live="polite">
      所有学生姓名与进度均为 demo 数据，仅用于界面预览。
    </p>
  </section>
</template>

<style scoped>
.class-list {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.class-list__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}
.class-list h1 {
  margin: 0.5rem 0 0.75rem;
  font: 600 clamp(1.75rem, 4vw, 2.5rem) / 1.1 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.class-list__lead {
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
.class-list__items {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.class-card {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  transition:
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}
.class-card:hover {
  border-color: var(--yx-border-strong);
  box-shadow: var(--yx-shadow-100);
}
.class-card__link {
  position: absolute;
  inset: 0;
  text-decoration: none;
}
.class-card__link:focus-visible {
  outline: 0.2rem solid var(--yx-focus-ring);
  outline-offset: 0.15rem;
  border-radius: var(--yx-radius-md);
}
.class-card__content {
  display: grid;
  gap: 0.4rem;
}
.class-card__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.class-card__name {
  margin: 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.class-card__meta,
.class-card__grade {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.class-card__actions {
  position: relative;
  z-index: 1;
}
.class-list__note {
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
@media (max-width: 48rem) {
  .class-list__header {
    grid-template-columns: 1fr;
  }
  .class-card {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .class-card__actions {
    justify-self: start;
  }
}
@media (max-width: 24.375rem) {
  .class-list__header {
    gap: 1rem;
  }
  .class-card__title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
