<script setup lang="ts">
import { YxButton } from "@yuzan/ui";
import type { TeacherFeedbackDraft } from "~/features/submission-review/types";

const props = defineProps<{
  draft: TeacherFeedbackDraft;
  saving: boolean;
  submitting: boolean;
  issues: string[];
}>();

const emit = defineEmits<{
  "update:draft": [value: TeacherFeedbackDraft];
  save: [];
  submit: [];
}>();

function updateDraft<K extends keyof TeacherFeedbackDraft>(
  key: K,
  value: TeacherFeedbackDraft[K],
) {
  emit("update:draft", {
    ...props.draft,
    [key]: value,
  });
}

function toggleFocusArea(area: string, checked: boolean) {
  const next = checked
    ? [...props.draft.focusAreas, area]
    : props.draft.focusAreas.filter((item) => item !== area);
  updateDraft("focusAreas", next);
}
</script>

<template>
  <form class="feedback-form" @submit.prevent="emit('submit')">
    <label class="feedback-form__field">
      <span>做得好的地方</span>
      <textarea
        :value="draft.strengths"
        rows="3"
        @input="
          updateDraft('strengths', ($event.target as HTMLTextAreaElement).value)
        "
      />
    </label>

    <label class="feedback-form__field">
      <span>当前最重要的问题</span>
      <textarea
        :value="draft.priorityIssue"
        rows="3"
        @input="
          updateDraft(
            'priorityIssue',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>

    <label class="feedback-form__field">
      <span>一个明确的下一步动作</span>
      <textarea
        :value="draft.nextAction"
        rows="3"
        required
        @input="
          updateDraft(
            'nextAction',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>

    <label class="feedback-form__field">
      <span>分项反馈</span>
      <textarea
        :value="draft.sectionFeedback"
        rows="3"
        @input="
          updateDraft(
            'sectionFeedback',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>

    <label class="feedback-form__field">
      <span>总结</span>
      <textarea
        :value="draft.summary"
        rows="3"
        @input="
          updateDraft('summary', ($event.target as HTMLTextAreaElement).value)
        "
      />
    </label>

    <label class="feedback-form__field">
      <span>复核状态</span>
      <select
        :value="draft.reviewStatus"
        @change="
          updateDraft(
            'reviewStatus',
            ($event.target as HTMLSelectElement)
              .value as TeacherFeedbackDraft['reviewStatus'],
          )
        "
      >
        <option value="reviewed">已复核</option>
        <option value="returned">退回补充</option>
        <option value="unavailable">unavailable</option>
      </select>
    </label>

    <label class="feedback-form__checkbox">
      <input
        type="checkbox"
        :checked="draft.needsRedo"
        @change="
          updateDraft('needsRedo', ($event.target as HTMLInputElement).checked)
        "
      />
      <span>是否需要重做</span>
    </label>

    <label v-if="draft.needsRedo" class="feedback-form__field">
      <span>退回修改原因</span>
      <textarea
        :value="draft.returnReason"
        rows="3"
        required
        @input="
          updateDraft(
            'returnReason',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>

    <label class="feedback-form__checkbox">
      <input
        type="checkbox"
        :checked="draft.retestRecommended"
        @change="
          updateDraft(
            'retestRecommended',
            ($event.target as HTMLInputElement).checked,
          )
        "
      />
      <span>是否建议复测</span>
    </label>

    <label v-if="draft.retestRecommended" class="feedback-form__field">
      <span>复测目标</span>
      <textarea
        :value="draft.retestGoal"
        rows="3"
        required
        @input="
          updateDraft(
            'retestGoal',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>

    <fieldset class="feedback-form__focus">
      <legend>重点关注项</legend>
      <label class="feedback-form__checkbox">
        <input
          type="checkbox"
          :checked="draft.focusAreas.includes('句尾收音')"
          @change="
            toggleFocusArea(
              '句尾收音',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        <span>句尾收音</span>
      </label>
      <label class="feedback-form__checkbox">
        <input
          type="checkbox"
          :checked="draft.focusAreas.includes('同步排障')"
          @change="
            toggleFocusArea(
              '同步排障',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        <span>同步排障</span>
      </label>
      <label class="feedback-form__checkbox">
        <input
          type="checkbox"
          :checked="draft.focusAreas.includes('书面表达')"
          @change="
            toggleFocusArea(
              '书面表达',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        <span>书面表达</span>
      </label>
    </fieldset>

    <ul v-if="issues.length > 0" class="feedback-form__issues" role="alert">
      <li v-for="issue in issues" :key="issue">{{ issue }}</li>
    </ul>

    <div class="feedback-form__actions">
      <YxButton
        kind="secondary"
        type="button"
        :disabled="saving || submitting"
        :loading="saving"
        loading-label="保存中"
        @click="emit('save')"
      >
        保存草稿
      </YxButton>
      <YxButton
        type="submit"
        :disabled="saving || submitting"
        :loading="submitting"
        loading-label="提交中"
      >
        提交反馈
      </YxButton>
    </div>
  </form>
</template>

<style scoped>
.feedback-form {
  display: grid;
  gap: 1rem;
}

.feedback-form__field {
  display: grid;
  gap: 0.45rem;
}

.feedback-form__field span,
.feedback-form__focus legend {
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-primary);
}

.feedback-form textarea,
.feedback-form select,
.feedback-form input[type="text"] {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
}

.feedback-form textarea {
  resize: vertical;
}

.feedback-form__checkbox {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  color: var(--yx-text-secondary);
}

.feedback-form__focus {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.feedback-form__issues {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--yx-danger-fg);
}

.feedback-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (max-width: 24.375rem) {
  .feedback-form__actions {
    flex-direction: column;
  }
}
</style>
