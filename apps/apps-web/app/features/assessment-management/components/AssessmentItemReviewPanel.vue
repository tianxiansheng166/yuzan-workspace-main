<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { YxButton } from "@yuzan/ui";

/**
 * 教师复核面板 - 播放学生录音、查看自动评分、修改分数、写评语
 */

interface ScoreResult {
  scorerVersion: string;
  transcript: string;
  confidence: number;
  scores: {
    accuracy: number;
    completeness: number;
    fluency: number;
    tone: number;
    overall: number;
  };
  errors: Array<{
    text: string;
    pinyin: string;
    startMs: number;
    endMs: number;
    type: string;
    score: number;
  }>;
  requiresReview: boolean;
}

const props = defineProps<{
  /** 测评项 ID */
  itemId: string;
  /** 会话 ID */
  sessionId: string;
  /** 学校 ID */
  schoolId: string;
  /** 自动评分结果 */
  autoResult: ScoreResult | null;
  /** 当前分数（可能是自动或教师修改后） */
  currentScore: number | null;
  /** 教师评语 */
  reviewerComment: string | null;
  /** 录音下载 URL */
  recordingDownloadUrl: string | null;
  /** 目标朗读文本 */
  targetText: string;
  /** 是否正在提交 */
  submitting?: boolean;
}>();

const emit = defineEmits<{
  /** 提交复核结果 */
  review: [data: { scoredScore: number; reviewerComment: string }];
}>();

// 教师修改的分数
const editedScore = ref<number>(0);
const editedComment = ref<string>("");

// 初始化：当有自动评分时，默认使用自动总分
watch(
  () => props.autoResult,
  (result) => {
    if (result) {
      editedScore.value = result.scores.overall;
    }
  },
  { immediate: true },
);

// 初始化评语
watch(
  () => props.reviewerComment,
  (comment) => {
    if (comment) {
      editedComment.value = comment;
    }
  },
  { immediate: true },
);

const isModified = computed(() => {
  if (!props.autoResult) return false;
  return editedScore.value !== props.autoResult.scores.overall || editedComment.value !== (props.reviewerComment ?? "");
});

const confidenceLevel = computed(() => {
  if (!props.autoResult) return "unknown";
  if (props.autoResult.confidence >= 0.9) return "high";
  if (props.autoResult.confidence >= 0.75) return "medium";
  return "low";
});

function submitReview() {
  emit("review", {
    scoredScore: editedScore.value,
    reviewerComment: editedComment.value,
  });
}
</script>

<template>
  <div class="review-panel">
    <!-- 目标文本 -->
    <section class="review-section">
      <h3 class="review-section__title">朗读目标</h3>
      <p class="review-target-text">{{ targetText }}</p>
    </section>

    <!-- 录音播放 -->
    <section v-if="recordingDownloadUrl" class="review-section">
      <h3 class="review-section__title">学生录音</h3>
      <audio :src="recordingDownloadUrl" controls preload="metadata" class="review-audio" />
    </section>

    <!-- 识别结果 -->
    <section v-if="autoResult" class="review-section">
      <h3 class="review-section__title">自动评分详情</h3>

      <div class="review-scores">
        <div class="review-scores__item">
          <span class="review-scores__dim">准确度</span>
          <span class="review-scores__val">{{ autoResult.scores.accuracy }}</span>
        </div>
        <div class="review-scores__item">
          <span class="review-scores__dim">完整度</span>
          <span class="review-scores__val">{{ autoResult.scores.completeness }}</span>
        </div>
        <div class="review-scores__item">
          <span class="review-scores__dim">流利度</span>
          <span class="review-scores__val">{{ autoResult.scores.fluency }}</span>
        </div>
        <div class="review-scores__item">
          <span class="review-scores__dim">声调</span>
          <span class="review-scores__val">{{ autoResult.scores.tone }}</span>
        </div>
        <div class="review-scores__item review-scores__item--overall">
          <span class="review-scores__dim">总分</span>
          <span class="review-scores__val">{{ autoResult.scores.overall }}</span>
        </div>
      </div>

      <div class="review-meta">
        <span class="review-meta__item">
          识别文本：<strong>{{ autoResult.transcript }}</strong>
        </span>
        <span class="review-meta__item">
          置信度：<strong :class="`review-confidence--${confidenceLevel}`">{{ (autoResult.confidence * 100).toFixed(1) }}%</strong>
        </span>
        <span class="review-meta__item">
          评分版本：{{ autoResult.scorerVersion }}
        </span>
      </div>

      <!-- 朗读错误明细 -->
      <div v-if="autoResult.errors.length" class="review-errors">
        <p class="review-errors__label">朗读错误：</p>
        <ul class="review-errors__list">
          <li v-for="(err, i) in autoResult.errors" :key="i">
            「{{ err.text }}」({{ err.pinyin }}) — {{ err.type }}（得分 {{ err.score }}）
          </li>
        </ul>
      </div>

      <p v-if="autoResult.requiresReview" class="review-needs-review">
        ⚠️ 自动评分置信度较低，建议复核。
      </p>
    </section>

    <!-- 教师复核操作 -->
    <section class="review-section">
      <h3 class="review-section__title">教师复核</h3>

      <div class="review-form">
        <label class="review-form__label" for="review-score">
          最终分数 <span v-if="isModified" class="review-form__modified">（已修改）</span>
        </label>
        <input
          id="review-score"
          v-model.number="editedScore"
          type="number"
          min="0"
          max="100"
          step="0.5"
          class="review-form__input"
        />

        <label class="review-form__label" for="review-comment">教师评语</label>
        <textarea
          id="review-comment"
          v-model="editedComment"
          rows="3"
          placeholder="填写对本次朗读的评语..."
          class="review-form__textarea"
        />

        <YxButton
          kind="primary"
          :loading="submitting"
          :disabled="!editedScore && editedScore !== 0"
          @click="submitReview"
        >
          提交复核结果
        </YxButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.review-panel {
  display: grid;
  gap: var(--yx-space-600);
}

.review-section {
  padding: var(--yx-space-500);
  border: 1px solid var(--yx-border-default);
  border-radius: 0.75rem;
  background: var(--yx-surface-default);
}

.review-section__title {
  margin: 0 0 var(--yx-space-400);
  font-size: var(--yx-font-size-500);
  font-weight: var(--yx-font-weight-semibold);
}

.review-target-text {
  margin: 0;
  line-height: var(--yx-line-height-relaxed);
  color: var(--yx-text-secondary);
}

.review-audio {
  width: 100%;
}

/* 评分网格 */
.review-scores {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--yx-space-300);
  text-align: center;
  margin-bottom: var(--yx-space-400);
}

.review-scores__item {
  display: grid;
  gap: var(--yx-space-100);
  padding: var(--yx-space-300);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
}

.review-scores__item--overall {
  background: color-mix(in srgb, var(--yx-surface-default) 85%, #4a90d9);
}

.review-scores__dim {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
}

.review-scores__val {
  font-family: var(--yx-font-display);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: var(--yx-font-weight-bold);
}

/* 元信息 */
.review-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-400);
  margin-bottom: var(--yx-space-300);
  font-size: var(--yx-font-size-300);
  color: var(--yx-text-secondary);
}

.review-confidence--high { color: #16a34a; }
.review-confidence--medium { color: #ca8a04; }
.review-confidence--low { color: #dc2626; }

/* 错误列表 */
.review-errors {
  margin-bottom: var(--yx-space-300);
}

.review-errors__label {
  margin: 0 0 var(--yx-space-200);
  font-weight: var(--yx-font-weight-semibold);
  font-size: var(--yx-font-size-300);
}

.review-errors__list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: var(--yx-font-size-300);
  color: var(--yx-text-secondary);
}

.review-needs-review {
  margin: 0;
  padding: var(--yx-space-200) var(--yx-space-300);
  border-radius: var(--yx-radius-md);
  background: color-mix(in srgb, var(--yx-surface-default) 90%, #d4a030);
  color: #8b6914;
  font-size: var(--yx-font-size-300);
}

/* 复核表单 */
.review-form {
  display: grid;
  gap: var(--yx-space-400);
}

.review-form__label {
  font-weight: var(--yx-font-weight-semibold);
  font-size: var(--yx-font-size-400);
}

.review-form__modified {
  color: var(--yx-text-accent);
  font-size: var(--yx-font-size-200);
}

.review-form__input,
.review-form__textarea {
  width: 100%;
  padding: var(--yx-space-300);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  font-size: var(--yx-font-size-400);
  font-family: inherit;
  background: var(--yx-bg-muted);
}

.review-form__textarea {
  resize: vertical;
}

@media (max-width: 48rem) {
  .review-scores {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
