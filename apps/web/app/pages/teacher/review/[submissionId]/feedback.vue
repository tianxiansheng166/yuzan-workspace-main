<script setup lang="ts">
import { YxButton } from "@yuzan/ui";
import ReviewFeedbackForm from "~/features/submission-review/components/ReviewFeedbackForm.vue";
import { useReviewDetail } from "~/features/submission-review/composables/useReviewDetail";
import { useTeacherFeedback } from "~/features/submission-review/composables/useTeacherFeedback";
import { defaultTeacherFeedbackDraft } from "~/features/submission-review/gateway/review.gateway";
import type { ReviewScenario } from "~/features/submission-review/types";

useSeoMeta({
  title: "教师反馈｜语赞心声",
});

const route = useRoute();
const submissionId = route.params.submissionId as string;
const scenario = computed(
  () => (route.query.scenario as ReviewScenario | undefined) ?? "default",
);

const { state, permission, detail, errorMessage, load } = useReviewDetail(
  submissionId,
  scenario.value,
);
await load();

const feedback = useTeacherFeedback(
  defaultTeacherFeedbackDraft(submissionId),
  scenario.value,
);
const { draft, issues, lastMessage, actionState, saveDraft, submitFeedback } =
  feedback;

const issueMessages = computed(() => issues.value.map((item) => item.message));

function updateDraft(value: (typeof draft)["value"]) {
  draft.value = value;
}
</script>

<template>
  <section class="review-feedback yx-shell">
    <header class="review-feedback__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink :to="`/teacher/review/${submissionId}`" class="back-link">
            ← 返回提交详情
          </NuxtLink>
          · 教师反馈
        </p>
        <h1>{{ detail?.studentDisplayName ?? "教师反馈" }}</h1>
        <p v-if="detail" class="review-feedback__lead">
          {{ detail.className }} · {{ detail.assignmentTitle }} ·
          {{ detail.reviewStatusLabel }}
        </p>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p>正在加载教师反馈上下文……</p>
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p class="yx-kicker">加载失败</p>
      <p>{{ errorMessage || "无法加载教师反馈上下文。" }}</p>
      <YxButton kind="secondary" @click="load">重试</YxButton>
    </div>

    <div v-else-if="state === 'permission'" class="state-message">
      <p class="yx-kicker">permission denied</p>
      <p>当前权限为 {{ permission }}，不能进入反馈编辑页。</p>
    </div>

    <div v-else-if="state === 'unavailable'" class="state-message">
      <p class="yx-kicker">unavailable</p>
      <p>反馈上下文 unavailable，不能伪造正式保存成功。</p>
    </div>

    <template v-else-if="detail">
      <section class="review-feedback__summary">
        <p>保存草稿：只会返回 demo 状态。</p>
        <p>提交反馈：默认返回 unavailable，直到 SUB-001 接入真实服务。</p>
        <p>不会生成随机评价，也不会声称正式写入服务器。</p>
      </section>

      <ReviewFeedbackForm
        :draft="draft"
        :saving="actionState === 'saving'"
        :submitting="actionState === 'submitting'"
        :issues="issueMessages"
        @update:draft="updateDraft"
        @save="saveDraft"
        @submit="submitFeedback"
      />

      <p v-if="lastMessage" class="review-feedback__message" aria-live="polite">
        {{ lastMessage }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.review-feedback {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.review-feedback__header {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.review-feedback h1 {
  margin: 0.5rem 0 0.35rem;
  font: 600 clamp(1.8rem, 4vw, 2.5rem) / 1.08 var(--yx-font-display);
}

.review-feedback__lead,
.review-feedback__summary p,
.review-feedback__message {
  margin: 0;
  line-height: 1.7;
  color: var(--yx-text-muted);
}

.review-feedback__summary {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0;
}

.review-feedback__message {
  margin-top: 1rem;
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

@media (max-width: 24.375rem) {
  .review-feedback__summary {
    padding-top: 0.9rem;
  }
}
</style>
