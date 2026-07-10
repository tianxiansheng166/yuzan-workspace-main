<script setup lang="ts">
import { computed } from "vue";
import type { Question, AnswerValue } from "../types.js";
import SingleChoiceQuestion from "./SingleChoiceQuestion.vue";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion.vue";
import FillBlankQuestion from "./FillBlankQuestion.vue";
import ShortAnswerQuestion from "./ShortAnswerQuestion.vue";
import OrderingQuestion from "./OrderingQuestion.vue";
import MatchingQuestion from "./MatchingQuestion.vue";

const props = defineProps<{
  question: Question;
  modelValue?: AnswerValue | undefined;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AnswerValue];
}>();

function update(value: AnswerValue) {
  emit("update:modelValue", value);
}

const answerForKind = computed(() => {
  if (!props.modelValue || props.modelValue.kind !== props.question.kind) {
    return undefined;
  }
  return props.modelValue as unknown as Record<string, unknown>;
});
</script>

<template>
  <div class="question-card">
    <SingleChoiceQuestion
      v-if="question.kind === 'SINGLE_CHOICE'"
      :question="question"
      :model-value="answerForKind as { optionId: string }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
    <MultipleChoiceQuestion
      v-else-if="question.kind === 'MULTIPLE_CHOICE'"
      :question="question"
      :model-value="answerForKind as { optionIds: string[] }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
    <FillBlankQuestion
      v-else-if="question.kind === 'FILL_BLANK'"
      :question="question"
      :model-value="answerForKind as { values: string[] }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
    <ShortAnswerQuestion
      v-else-if="question.kind === 'SHORT_ANSWER'"
      :question="question"
      :model-value="answerForKind as { text: string }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
    <OrderingQuestion
      v-else-if="question.kind === 'ORDERING'"
      :question="question"
      :model-value="answerForKind as { order: string[] }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
    <MatchingQuestion
      v-else-if="question.kind === 'MATCHING'"
      :question="question"
      :model-value="answerForKind as { matches: Record<string, string> }"
      :disabled="disabled"
      :read-only="readOnly"
      @update:model-value="update($event)"
    />
  </div>
</template>

<style scoped>
.question-card {
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}
</style>
