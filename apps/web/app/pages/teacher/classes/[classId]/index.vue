<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useClassDetail } from "~/features/classes/composables/useClassDetail";

const route = useRoute();
const classId = route.params.classId as string;
const { state, detail, students, assessments, errorMessage, canManage, load } =
  useClassDetail(classId);
await load();

function studentInitials(name: string): string {
  const chars = name.replace(/[（(].*?[)）]/g, "").trim();
  return chars.slice(0, 2) || "学生";
}
</script>

<template>
  <section class="class-detail yx-shell">
    <header class="class-detail__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink to="/teacher/classes" class="back-link"
            >← 班级列表</NuxtLink
          >
          · 教师工作台
        </p>
        <h1>{{ detail?.name ?? "班级详情" }}</h1>
        <p v-if="detail" class="class-detail__grade">{{ detail.grade }}</p>
      </div>
      <div v-if="canManage" class="class-detail__actions">
        <YxButton kind="secondary" disabled title="编辑班级信息尚未接入后端">
          编辑班级
        </YxButton>
        <YxButton
          kind="secondary"
          disabled
          title="邀请学生功能将在 ORG-001 对接后启用"
        >
          邀请学生
        </YxButton>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载班级详情……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取班级详情，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">班级不可用</p>
      <p>该班级信息当前不可用，请检查网络连接或返回班级列表。</p>
      <NuxtLink to="/teacher/classes" class="back-link">返回班级列表</NuxtLink>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">暂无数据</p>
      <p>该班级下还没有学生或测评任务。</p>
    </div>

    <template v-else>
      <section class="class-detail__section" aria-labelledby="students-heading">
        <div class="section-header">
          <h2 id="students-heading">学生列表</h2>
          <YxButton
            kind="quiet"
            :disabled="!canManage"
            title="批量导入尚未接入后端"
          >
            批量导入
          </YxButton>
        </div>

        <div class="student-cards" role="list">
          <article
            v-for="student in students"
            :key="student.id"
            class="student-card"
            role="listitem"
          >
            <div class="student-card__identity">
              <span class="student-card__avatar" aria-hidden="true">
                {{ studentInitials(student.displayName) }}
              </span>
              <div>
                <p class="student-card__name">
                  {{ student.displayName }}
                  <YxStatus v-if="student.isDemo" tone="warning">DEMO</YxStatus>
                </p>
                <p class="student-card__id">ID: {{ student.id }}</p>
              </div>
            </div>
            <dl class="student-card__status">
              <div>
                <dt>测评</dt>
                <dd>
                  <YxStatus :tone="student.assessmentTone">{{
                    student.assessmentLabel
                  }}</YxStatus>
                </dd>
              </div>
              <div>
                <dt>复测</dt>
                <dd>
                  <YxStatus :tone="student.retestTone">{{
                    student.retestLabel
                  }}</YxStatus>
                </dd>
              </div>
              <div>
                <dt>报告</dt>
                <dd>
                  <YxStatus :tone="student.reportTone">{{
                    student.reportLabel
                  }}</YxStatus>
                </dd>
              </div>
            </dl>
            <div class="student-card__actions">
              <YxButton kind="quiet" disabled title="查看学生报告尚未接入后端"
                >报告</YxButton
              >
              <YxButton kind="quiet" disabled title="移除学生尚未接入后端"
                >移除</YxButton
              >
            </div>
          </article>
        </div>
      </section>

      <section
        class="class-detail__section"
        aria-labelledby="assessments-heading"
      >
        <div class="section-header">
          <h2 id="assessments-heading">测评任务</h2>
          <YxButton
            kind="quiet"
            :disabled="!canManage"
            title="新建测评将在 ASN-001 完成后对接"
          >
            新建测评
          </YxButton>
        </div>

        <ul v-if="assessments.length > 0" class="assessment-list" role="list">
          <li
            v-for="assessment in assessments"
            :key="assessment.id"
            class="assessment-item"
          >
            <div>
              <h3 class="assessment-item__title">{{ assessment.title }}</h3>
              <p class="assessment-item__meta">
                {{ assessment.typeLabel }} · {{ assessment.statusLabel }} ·
                {{ assessment.dueLabel }}
              </p>
            </div>
            <div class="assessment-item__actions">
              <NuxtLink
                :to="`/teacher/classes/${classId}/assessments/${assessment.id}`"
                class="entry-link"
              >
                进入测评
              </NuxtLink>
              <NuxtLink
                :to="`/teacher/classes/${classId}/assessments/${assessment.id}/reports`"
                class="entry-link"
              >
                报告
              </NuxtLink>
            </div>
          </li>
        </ul>

        <div v-else class="empty-hint">
          <p>暂无测评任务。ASN-001 完成后可在此发布形成性/总结性测评。</p>
        </div>
      </section>

      <p class="class-detail__note" aria-live="polite">
        学生测评状态、复测状态与报告状态当前仅显示
        demo/pending/unavailable，未接入真实后端。
      </p>
    </template>
  </section>
</template>

<style scoped>
.class-detail {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.class-detail__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}
.class-detail h1 {
  margin: 0.5rem 0 0.25rem;
  font: 600 clamp(1.75rem, 4vw, 2.5rem) / 1.1 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.class-detail__grade {
  margin: 0;
  color: var(--yx-text-muted);
}
.class-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
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
.class-detail__section {
  margin-bottom: 2.5rem;
}
.section-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.section-header h2 {
  margin: 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.student-cards {
  display: grid;
  gap: 0.75rem;
}
.student-card {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.6fr) auto;
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
.student-card__id {
  margin: 0.15rem 0 0;
  font-size: var(--yx-font-size-100);
  color: var(--yx-text-muted);
}
.student-card__status {
  display: grid;
  grid-template-columns: repeat(3, auto);
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
}
.student-card__actions {
  display: flex;
  gap: 0.25rem;
}
.assessment-list {
  display: grid;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.assessment-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}
.assessment-item__title {
  margin: 0 0 0.25rem;
  font: 600 var(--yx-font-size-300) / 1.3 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.assessment-item__meta {
  margin: 0;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}
.assessment-item__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.entry-link {
  color: var(--yx-text-accent);
  text-decoration: none;
  font-weight: var(--yx-font-weight-medium);
  font-size: var(--yx-font-size-200);
}
.entry-link:hover {
  text-decoration: underline;
}
.empty-hint {
  padding: 2rem;
  text-align: center;
  color: var(--yx-text-muted);
  border: 1px dashed var(--yx-border-default);
  border-radius: var(--yx-radius-md);
}
.class-detail__note {
  margin-top: 1.5rem;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
@media (max-width: 64rem) {
  .student-card {
    grid-template-columns: 1fr 1fr;
  }
  .student-card__actions {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
@media (max-width: 48rem) {
  .class-detail__header {
    grid-template-columns: 1fr;
  }
  .student-card {
    grid-template-columns: 1fr;
  }
  .student-card__status {
    grid-template-columns: repeat(3, 1fr);
  }
  .student-card__actions {
    justify-self: start;
  }
  .assessment-item {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 24.375rem) {
  .student-card__status {
    grid-template-columns: 1fr;
  }
  .student-card__actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
