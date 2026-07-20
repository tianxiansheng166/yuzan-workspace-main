<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { YxButton, YxInput, YxStatus } from "@yuzan/ui";

import AssessmentPageShell from "./AssessmentPageShell.vue";
import {
  assessmentTitle,
  assessmentWrittenQuestions,
} from "./assessment-content";
import {
  countAnsweredQuestions,
  createInitialWrittenAnswers,
  formatDuration,
  normalizeAssessmentMode,
} from "./assessment-helpers";
import { resolveAssessmentGateway } from "./assessment-gateway";
import {
  clearReadingAttemptMeta,
  clearWrittenDraft,
  readReadingAttemptMeta,
  readWrittenDraft,
  saveWrittenDraft,
} from "./assessment-storage";
import type { WrittenAnswers } from "./assessment-types";

type FormState =
  "initializing" | "ready" | "missing-reading" | "submitting" | "error";

const route = useRoute();
const mode = computed(() => normalizeAssessmentMode(route.query.mode));
const answers = ref<WrittenAnswers>(
  createInitialWrittenAnswers(assessmentWrittenQuestions),
);
const formState = ref<FormState>("initializing");
const draftMessage = ref("正在读取草稿。");
const errorMessage = ref("");
const readingMeta = ref(readReadingAttemptMeta());
const statusRef = ref<HTMLElement | null>(null);
const hasHydratedDraft = ref(false);

useHead({
  title: `${assessmentTitle} - 书面作答 | 语赞心声`,
});

const answeredCount = computed(() =>
  countAnsweredQuestions(assessmentWrittenQuestions, answers.value),
);

function focusStatusCard() {
  void nextTick(() => statusRef.value?.focus());
}

function mergeDraftAnswers(candidate: WrittenAnswers): WrittenAnswers {
  const baseline = createInitialWrittenAnswers(assessmentWrittenQuestions);

  for (const question of assessmentWrittenQuestions) {
    const incoming = candidate[question.id];

    if (
      typeof incoming === "string" &&
      typeof baseline[question.id] === "string"
    ) {
      baseline[question.id] = incoming;
    }

    if (
      question.kind === "fill-blank" &&
      incoming &&
      typeof incoming === "object" &&
      typeof baseline[question.id] === "object"
    ) {
      baseline[question.id] = {
        ...(baseline[question.id] as Record<string, string>),
        ...incoming,
      };
    }
  }

  return baseline;
}

function updateChoice(questionId: string, value: string) {
  answers.value = {
    ...answers.value,
    [questionId]: value,
  };
}

function updateBlank(questionId: string, blankId: string, value: string) {
  const current = answers.value[questionId];
  const next = typeof current === "object" && current ? current : {};

  answers.value = {
    ...answers.value,
    [questionId]: {
      ...next,
      [blankId]: value,
    },
  };
}

function updateShortAnswer(questionId: string, value: string) {
  answers.value = {
    ...answers.value,
    [questionId]: value,
  };
}

function blankValue(questionId: string, blankId: string) {
  const answer = answers.value[questionId];
  return typeof answer === "object" && answer ? (answer[blankId] ?? "") : "";
}

async function submitWrittenAssessment() {
  if (!readingMeta.value) {
    formState.value = "missing-reading";
    focusStatusCard();
    return;
  }

  formState.value = "submitting";
  errorMessage.value = "";

  try {
    const gateway = resolveAssessmentGateway(mode.value);
    const report = await gateway.submitAssessment({
      mode: mode.value,
      reading: readingMeta.value,
      answers: answers.value,
      totalQuestions: assessmentWrittenQuestions.length,
      answeredQuestions: answeredCount.value,
    });

    clearWrittenDraft(mode.value);
    clearReadingAttemptMeta();
    await navigateTo(`/assessment/report/${report.reportId}`);
  } catch {
    formState.value = "error";
    errorMessage.value = "提交失败，请稍后重试。";
    focusStatusCard();
  }
}

watch(
  answers,
  (value) => {
    if (!hasHydratedDraft.value || formState.value !== "ready") {
      return;
    }

    const updatedAt = new Date().toISOString();
    saveWrittenDraft(mode.value, {
      answers: value,
      updatedAt,
    });
    draftMessage.value = `草稿已自动保存于 ${new Date(
      updatedAt,
    ).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  },
  { deep: true },
);

onMounted(() => {
  readingMeta.value = readReadingAttemptMeta();

  if (!readingMeta.value) {
    formState.value = "missing-reading";
    draftMessage.value = "未检测到朗读录音，请先完成上一页。";
    focusStatusCard();
    return;
  }

  const draft = readWrittenDraft(mode.value);

  if (draft) {
    answers.value = mergeDraftAnswers(draft.answers);
    draftMessage.value = `已恢复 ${new Date(draft.updatedAt).toLocaleString("zh-CN")} 的草稿。`;
  } else {
    draftMessage.value = "本页会自动保存书面作答草稿。";
  }

  hasHydratedDraft.value = true;
  formState.value = "ready";
});
</script>

<template>
  <AssessmentPageShell
    :title="`${assessmentTitle} · 书面作答`"
    summary="完成选择、判断、填空和简答。作答会自动保存到本地草稿，提交后进入报告页。"
    :mode="mode"
  >
    <template #actions>
      <NuxtLink
        class="text-link"
        :to="
          mode === 'demo'
            ? '/assessment/reading?mode=demo'
            : '/assessment/reading'
        "
      >
        返回朗读页
      </NuxtLink>
      <NuxtLink class="text-link" to="/assessment/history">历史记录</NuxtLink>
    </template>

    <div
      v-if="formState === 'initializing'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="polite"
    >
      <YxStatus tone="information">正在准备书面作答</YxStatus>
      <p>正在读取朗读结果与本地草稿。</p>
    </div>

    <div
      v-else-if="formState === 'missing-reading'"
      ref="statusRef"
      class="state-card"
      tabindex="-1"
      aria-live="assertive"
    >
      <YxStatus tone="warning">缺少朗读录音</YxStatus>
      <p>请先完成真实录音，再进入书面作答页面。</p>
      <NuxtLink
        class="state-card__link"
        :to="
          mode === 'demo'
            ? '/assessment/reading?mode=demo'
            : '/assessment/reading'
        "
      >
        返回朗读页
      </NuxtLink>
    </div>

    <form
      v-else
      class="written-layout"
      @submit.prevent="submitWrittenAssessment"
    >
      <section class="written-main">
        <div
          ref="statusRef"
          class="draft-banner"
          tabindex="-1"
          :aria-live="formState === 'error' ? 'assertive' : 'polite'"
        >
          <YxStatus :tone="formState === 'error' ? 'danger' : 'information'">
            {{ formState === "error" ? "提交失败" : "草稿状态" }}
          </YxStatus>
          <p>{{ formState === "error" ? errorMessage : draftMessage }}</p>
        </div>

        <section
          v-for="question in assessmentWrittenQuestions"
          :key="question.id"
          class="question-card"
        >
          <fieldset class="question-fieldset">
            <legend>
              <span class="question-tag">{{ question.helperText }}</span>
              <span class="question-prompt">{{ question.prompt }}</span>
            </legend>

            <div
              v-if="question.kind === 'choice' || question.kind === 'judgement'"
              class="option-list"
            >
              <label
                v-for="option in question.options"
                :key="option.value"
                class="option-item"
              >
                <input
                  :name="question.id"
                  type="radio"
                  :value="option.value"
                  :checked="answers[question.id] === option.value"
                  @change="updateChoice(question.id, option.value)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>

            <div v-else-if="question.kind === 'fill-blank'" class="blank-grid">
              <YxInput
                v-for="blank in question.blanks"
                :key="blank.id"
                :label="blank.label"
                :model-value="blankValue(question.id, blank.id)"
                :placeholder="blank.placeholder"
                @update:model-value="updateBlank(question.id, blank.id, $event)"
              />
            </div>

            <label
              v-else-if="question.kind === 'short-answer'"
              class="textarea-field"
            >
              <span class="yx-visually-hidden">{{ question.prompt }}</span>
              <textarea
                :value="String(answers[question.id] ?? '')"
                :placeholder="question.placeholder"
                rows="6"
                @input="
                  updateShortAnswer(
                    question.id,
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
              <small>
                建议至少写 {{ question.minLength }} 个字，目前已填写
                {{ String(answers[question.id] ?? "").trim().length }} 个字。
              </small>
            </label>
          </fieldset>
        </section>

        <div class="submit-bar">
          <div class="submit-bar__text">
            <strong
              >已完成 {{ answeredCount }}/{{
                assessmentWrittenQuestions.length
              }}
              题</strong
            >
            <span>提交后会保留历史记录，不会覆盖旧报告。</span>
          </div>
          <YxButton
            type="submit"
            :loading="formState === 'submitting'"
            loading-label="提交中"
          >
            提交测评
          </YxButton>
        </div>
      </section>

      <aside class="written-side">
        <section class="written-side__card">
          <h2>朗读摘要</h2>
          <dl>
            <div>
              <dt>录音材料</dt>
              <dd>{{ readingMeta?.promptTitle }}</dd>
            </div>
            <div>
              <dt>录音时长</dt>
              <dd>{{ formatDuration(readingMeta?.durationMs ?? 0) }}</dd>
            </div>
          </dl>
        </section>

        <section class="written-side__card">
          <h2>当前模式</h2>
          <p>
            {{
              mode === "demo"
                ? "演示流程会生成明显标记的 demo 报告。"
                : "真实流程只显示 pending / unavailable 状态。"
            }}
          </p>
        </section>
      </aside>
    </form>
  </AssessmentPageShell>
</template>

<style scoped>
.written-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.9fr);
  gap: var(--yx-space-800);
}

.written-main {
  display: grid;
  gap: var(--yx-space-600);
}

.draft-banner,
.question-card,
.written-side__card,
.state-card {
  padding: clamp(1.15rem, 3vw, 1.6rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
  box-shadow: var(--yx-shadow-100);
}

.draft-banner {
  display: grid;
  gap: var(--yx-space-200);
}

.draft-banner p,
.state-card p,
.written-side__card p {
  margin: 0;
  color: var(--yx-text-secondary);
}

.question-fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: var(--yx-space-400);
}

legend {
  width: 100%;
  padding: 0;
}

.question-tag {
  display: inline-flex;
  margin-bottom: var(--yx-space-300);
  color: var(--yx-text-accent);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-semibold);
}

.question-prompt {
  display: block;
  font-size: var(--yx-font-size-400);
  line-height: var(--yx-line-height-body);
}

.option-list {
  display: grid;
  gap: var(--yx-space-300);
}

.option-item {
  display: flex;
  gap: var(--yx-space-300);
  align-items: start;
  padding: var(--yx-space-400);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: color-mix(
    in srgb,
    var(--yx-surface-default) 92%,
    var(--yx-bg-canvas)
  );
}

.option-item input {
  margin-top: 0.2rem;
}

.blank-grid {
  display: grid;
  gap: var(--yx-space-400);
}

.textarea-field {
  display: grid;
  gap: var(--yx-space-300);
}

.textarea-field textarea {
  width: 100%;
  min-height: 10rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
  resize: vertical;
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.textarea-field textarea:hover {
  border-color: var(--yx-border-strong);
}

.textarea-field small {
  color: var(--yx-text-muted);
}

.submit-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--yx-space-400);
  padding: clamp(1rem, 2.5vw, 1.35rem) clamp(1.15rem, 3vw, 1.6rem);
  border-radius: var(--yx-radius-lg);
  border: 1px solid var(--yx-border-default);
  background: var(--yx-bg-muted);
}

.submit-bar__text {
  display: grid;
  gap: var(--yx-space-100);
}

.submit-bar__text span,
.written-side__card dd {
  color: var(--yx-text-secondary);
}

.written-side {
  display: grid;
  gap: var(--yx-space-500);
  align-content: start;
}

.written-side__card h2 {
  margin: 0 0 var(--yx-space-400);
  font-size: var(--yx-font-size-500);
}

.written-side__card dl {
  margin: 0;
  display: grid;
  gap: var(--yx-space-300);
}

.written-side__card dt {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.written-side__card dd {
  margin: 0.15rem 0 0;
}

.state-card {
  display: grid;
  gap: var(--yx-space-300);
}

.state-card__link,
.text-link {
  color: var(--yx-action-link);
}

@media (max-width: 72rem) {
  .written-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .submit-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .submit-bar :deep(button) {
    width: 100%;
  }
}
</style>
