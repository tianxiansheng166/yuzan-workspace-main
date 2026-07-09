<script setup lang="ts">
import { YxButton, YxInput, YxStatus } from "@yuzan/ui";
import { useReviewDetail } from "~/features/submission-review/composables/useReviewDetail";
import type { ReviewDemoMode } from "~/features/submission-review/gateway/review.gateway";

const route = useRoute();
const reviewId = route.params.reviewId as string;
const mode = computed(
  () => (route.query.mode as ReviewDemoMode | undefined) ?? "default",
);

const {
  state,
  detail,
  draftNote,
  errorMessage,
  actionInFlight,
  actionBanner,
  load,
  submitLocalDecision,
} = useReviewDetail(reviewId, mode.value);

await load();
</script>

<template>
  <section class="review-detail yx-shell">
    <header class="review-detail__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink to="/teacher/review" class="back-link"
            >← 返回复核队列</NuxtLink
          >
          · 教师复核工作台
        </p>
        <h1>{{ detail?.studentName ?? "复核详情" }}</h1>
        <p v-if="detail" class="review-detail__lead">
          {{ detail.className }} · {{ detail.assignmentTitle }} ·
          {{ detail.submittedAt }}
        </p>
      </div>
      <div v-if="detail" class="review-detail__statusline">
        <YxStatus :tone="detail.laneTone">{{ detail.laneLabel }}</YxStatus>
        <YxStatus :tone="detail.statusTone">{{ detail.statusLabel }}</YxStatus>
        <YxStatus :tone="detail.confidenceTone">{{
          detail.confidenceLabel
        }}</YxStatus>
        <YxStatus :tone="detail.syncTone">{{ detail.syncLabel }}</YxStatus>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载复核详情……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法读取复核详情，请稍后重试。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'permission'" class="state-message">
      <p class="yx-kicker">无权查看</p>
      <p>
        教师复核需要班级范围授权。当前仅展示权限状态骨架，不会用 demo
        数据绕过授权。
      </p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">证据不可用</p>
      <p>
        当前提交的原始证据链不完整。请先排查同步或上传问题，再返回继续复核。
      </p>
      <NuxtLink to="/teacher/review" class="back-link">返回复核队列</NuxtLink>
    </div>

    <template v-else-if="detail">
      <p v-if="actionBanner" class="review-detail__banner" aria-live="polite">
        {{ actionBanner }}
      </p>
      <p class="review-detail__meta-note">
        当前复核操作仅演示本地 demo / pending 流程，真实提交与审计写入将在
        SUB-001 接入后生效。
      </p>

      <section class="review-grid" aria-label="复核内容">
        <article class="review-panel" aria-labelledby="evidence-heading">
          <header class="panel-header">
            <p class="yx-kicker">原始证据</p>
            <h2 id="evidence-heading">先看题干、作答与原始材料。</h2>
          </header>
          <div class="review-copy">
            <p class="review-label">题干</p>
            <p>{{ detail.prompt }}</p>
          </div>
          <div class="review-copy">
            <p class="review-label">学生提交</p>
            <p>{{ detail.studentResponse }}</p>
          </div>
          <div class="review-copy">
            <p class="review-label">转写 / 文字记录</p>
            <p>{{ detail.transcript }}</p>
          </div>

          <ul class="artifact-list" role="list">
            <li
              v-for="artifact in detail.artifacts"
              :key="artifact.id"
              class="artifact-row"
            >
              <div>
                <p class="artifact-row__title">{{ artifact.label }}</p>
                <p class="artifact-row__note">{{ artifact.note }}</p>
              </div>
              <YxStatus
                :tone="
                  artifact.status === 'available'
                    ? 'success'
                    : artifact.status === 'pending'
                      ? 'warning'
                      : 'neutral'
                "
              >
                {{
                  artifact.status === "available"
                    ? "可查看"
                    : artifact.status === "pending"
                      ? "待同步"
                      : "不可用"
                }}
              </YxStatus>
            </li>
          </ul>
        </article>

        <article class="review-panel" aria-labelledby="auto-heading">
          <header class="panel-header">
            <p class="yx-kicker">自动结果</p>
            <h2 id="auto-heading">自动建议必须可复核、可推翻。</h2>
          </header>
          <dl class="signal-list">
            <div>
              <dt>模型版本</dt>
              <dd>{{ detail.modelVersion }}</dd>
            </div>
            <div>
              <dt>置信度</dt>
              <dd>{{ detail.confidenceScore }}</dd>
            </div>
            <div>
              <dt>系统建议</dt>
              <dd>{{ detail.recommendedOutcomeLabel }}</dd>
            </div>
          </dl>
          <div class="review-copy">
            <p class="review-label">自动建议</p>
            <p>{{ detail.autoSuggestion }}</p>
          </div>
          <div class="review-copy">
            <p class="review-label">建议理由</p>
            <p>{{ detail.autoRationale }}</p>
          </div>
        </article>

        <article class="review-panel" aria-labelledby="teacher-heading">
          <header class="panel-header">
            <p class="yx-kicker">教师结论</p>
            <h2 id="teacher-heading">人工结论与学生反馈要分开写清楚。</h2>
          </header>
          <p class="review-detail__decision">
            当前结论：<strong>{{ detail.decisionLabel }}</strong>
          </p>

          <div class="checklist-block">
            <div class="checklist-block__header">
              <h3>发布前检查</h3>
              <p>在接受、退回或安排线下辅导前，先确认每一项都有证据支撑。</p>
            </div>
            <ul class="checklist-list" role="list">
              <li
                v-for="item in detail.checklist"
                :key="item.id"
                class="checklist-row"
              >
                <div>
                  <p class="checklist-row__title">{{ item.label }}</p>
                  <p class="checklist-row__note">{{ item.note }}</p>
                </div>
                <YxStatus :tone="item.tone">
                  {{
                    item.status === "done"
                      ? "已确认"
                      : item.status === "attention"
                        ? "需关注"
                        : "待处理"
                  }}
                </YxStatus>
              </li>
            </ul>
          </div>

          <YxInput
            v-model="draftNote"
            label="教师批注"
            description="本地 demo 批注，仅用于说明教师如何记录依据与反馈。"
            :required="true"
            placeholder="例如：请学生重录第二句，注意句尾收音。"
          />

          <div class="decision-actions">
            <YxButton
              :loading="actionInFlight === 'accept'"
              loading-label="记录中"
              @click="submitLocalDecision('accept')"
            >
              接受
            </YxButton>
            <YxButton
              kind="secondary"
              :loading="actionInFlight === 'return'"
              loading-label="记录中"
              @click="submitLocalDecision('return')"
            >
              退回补充
            </YxButton>
            <YxButton
              kind="quiet"
              :loading="actionInFlight === 'offline-support'"
              loading-label="记录中"
              @click="submitLocalDecision('offline-support')"
            >
              线下辅导 / 排障
            </YxButton>
          </div>
        </article>
      </section>

      <section class="history-panel" aria-labelledby="history-heading">
        <header class="panel-header">
          <p class="yx-kicker">操作历史</p>
          <h2 id="history-heading">自动结果与教师最终处理要能追溯差异。</h2>
        </header>
        <ol class="history-list">
          <li
            v-for="entry in detail.history"
            :key="entry.id"
            class="history-row"
          >
            <div class="history-row__meta">
              <strong>{{ entry.actor }}</strong>
              <span>{{ entry.at }}</span>
            </div>
            <p class="history-row__action">{{ entry.action }}</p>
            <p class="history-row__detail">{{ entry.detail }}</p>
          </li>
        </ol>
      </section>
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
  gap: 1.5rem;
  align-items: end;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}

.review-detail h1 {
  margin: 0.5rem 0 0.35rem;
  font: 600 clamp(1.8rem, 4vw, 2.75rem) / 1.08 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.review-detail__lead {
  margin: 0;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.review-detail__statusline {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.back-link {
  color: var(--yx-text-accent);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.review-detail__banner {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--yx-information-border);
  border-radius: var(--yx-radius-md);
  background: var(--yx-information-bg);
  color: var(--yx-information-fg);
  line-height: 1.6;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.review-detail__meta-note {
  margin: 0 0 1rem;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.review-panel,
.history-panel {
  padding: 1.25rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.panel-header h2 {
  margin: 0.35rem 0 0;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.review-copy {
  margin-top: 1rem;
}

.review-copy p {
  margin: 0;
  line-height: 1.7;
  color: var(--yx-text-secondary);
}

.review-label {
  margin-bottom: 0.35rem !important;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted) !important;
}

.artifact-list,
.checklist-list,
.history-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: 0.85rem;
}

.artifact-row,
.checklist-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  padding-top: 0.85rem;
  border-top: 1px solid var(--yx-border-muted);
}

.artifact-row__title,
.checklist-row__title,
.history-row__action {
  margin: 0;
  color: var(--yx-text-primary);
  font-weight: var(--yx-font-weight-semibold);
}

.artifact-row__note,
.checklist-row__note,
.history-row__detail {
  margin: 0.3rem 0 0;
  color: var(--yx-text-muted);
  line-height: 1.6;
}

.signal-list {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0 0;
}

.signal-list dt {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.signal-list dd {
  margin: 0.2rem 0 0;
  color: var(--yx-text-secondary);
}

.review-detail__decision {
  margin: 1rem 0 0;
  color: var(--yx-text-secondary);
}

.checklist-block {
  margin-top: 1rem;
}

.checklist-block__header h3 {
  margin: 0;
  font: 600 var(--yx-font-size-300) / 1.2 var(--yx-font-display);
}

.checklist-block__header p {
  margin: 0.35rem 0 0;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.decision-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.history-panel {
  margin-top: 1rem;
}

.history-row {
  padding-left: 1rem;
  border-left: 2px solid var(--yx-border-default);
}

.history-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
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
  .review-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .review-detail__header {
    grid-template-columns: 1fr;
  }

  .review-detail__statusline {
    justify-content: flex-start;
  }
}

@media (max-width: 24.375rem) {
  .review-panel,
  .history-panel {
    padding: 1rem;
  }

  .artifact-row,
  .checklist-row {
    grid-template-columns: 1fr;
  }

  .decision-actions {
    flex-direction: column;
  }
}
</style>
