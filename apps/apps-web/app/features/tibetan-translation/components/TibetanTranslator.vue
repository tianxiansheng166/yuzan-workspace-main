<script setup lang="ts">
import { watch } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import { LOCAL_PHRASE_LABEL } from "../Phrases";
import { useTranslation } from "../useTranslation";
import { useTranslationHistory } from "../useTranslationHistory";
import TranslationHistory from "./TranslationHistory.vue";

const config = useRuntimeConfig();
const {
  sourceText,
  direction,
  result,
  isLoading,
  error,
  copied,
  sourcePlaceholder,
  targetPlaceholder,
  commonPhrases,
  translate,
  clear,
  copyResult,
  swapDirection,
  usePhrase,
} = useTranslation({ apiBaseUrl: config.public.apiBase });

const {
  history,
  load,
  add,
  clear: clearHistory,
  remove,
} = useTranslationHistory();

watch(
  () => result.value,
  (value) => {
    if (value) {
      add(value);
    }
  },
  { immediate: false },
);

function retry() {
  void translate();
}

function selectHistory(item: { source: string; direction: string }) {
  sourceText.value = item.source;
  direction.value = item.direction as "zh-to-bo" | "bo-to-zh";
  void translate();
}

load();
</script>

<template>
  <div class="translator">
    <div class="translator__card">
      <div class="translator__header">
        <h1 class="translator__title">藏语翻译</h1>
        <YxButton
          kind="secondary"
          data-testid="swap-direction"
          @click="swapDirection"
        >
          {{ direction === "zh-to-bo" ? "中 → 藏" : "藏 → 中" }}
        </YxButton>
      </div>

      <div class="translator__panels">
        <div class="translator__panel">
          <label class="translator__label" for="source-input">
            {{ direction === "zh-to-bo" ? "中文" : "藏语" }}
          </label>
          <textarea
            id="source-input"
            v-model="sourceText"
            class="translator__textarea"
            rows="5"
            :placeholder="sourcePlaceholder"
            data-testid="source-input"
          />
          <div class="translator__actions translator__actions--inline">
            <YxButton
              kind="quiet"
              data-testid="voice-input"
              disabled
              :title="'语音输入待接入'"
            >
              语音输入（待接入）
            </YxButton>
            <YxButton kind="quiet" data-testid="clear" @click="clear">
              清空
            </YxButton>
          </div>
        </div>

        <div class="translator__panel translator__panel--output">
          <label class="translator__label" for="target-output">
            {{ direction === "zh-to-bo" ? "藏语" : "中文" }}
          </label>
          <textarea
            id="target-output"
            readonly
            class="translator__textarea translator__textarea--readonly"
            rows="5"
            :placeholder="targetPlaceholder"
            :value="result?.target ?? ''"
            data-testid="target-output"
          />
          <div
            v-if="result?.isLocalPhrase"
            class="translator__local-notice"
            data-testid="local-phrase-label"
          >
            <YxStatus tone="information">{{ LOCAL_PHRASE_LABEL }}</YxStatus>
          </div>
          <p
            v-if="error"
            class="translator__error"
            role="alert"
            data-testid="error-message"
          >
            {{ error }}
          </p>
          <div class="translator__actions translator__actions--inline">
            <YxButton
              kind="quiet"
              data-testid="speak-result"
              disabled
              :title="'朗读待接入'"
            >
              朗读（待接入）
            </YxButton>
            <YxButton
              kind="secondary"
              data-testid="copy-result"
              :disabled="!result"
              @click="copyResult"
            >
              {{ copied ? "已复制" : "复制" }}
            </YxButton>
          </div>
        </div>
      </div>

      <div class="translator__actions translator__actions--main">
        <YxButton
          data-testid="translate-button"
          :loading="isLoading"
          loading-label="翻译中"
          @click="translate"
        >
          翻译
        </YxButton>
        <YxButton
          v-if="error"
          kind="secondary"
          data-testid="retry-button"
          @click="retry"
        >
          重试
        </YxButton>
      </div>
    </div>

    <div class="translator__phrases">
      <h2 class="translator__subtitle">常用教学用语</h2>
      <ul class="translator__phrase-list">
        <li v-for="phrase in commonPhrases" :key="phrase.zh">
          <YxButton
            kind="secondary"
            data-testid="phrase-button"
            @click="usePhrase(direction === 'zh-to-bo' ? phrase.zh : phrase.bo)"
          >
            {{ phrase.label }}
          </YxButton>
        </li>
      </ul>
    </div>

    <TranslationHistory
      :history="history"
      @select="selectHistory"
      @remove="remove"
      @clear="clearHistory"
    />
  </div>
</template>

<style scoped>
.translator {
  padding-block: var(--yx-space-800);
}

.translator__card {
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-lg);
  padding: var(--yx-space-600);
}

.translator__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--yx-space-400);
  margin-bottom: var(--yx-space-600);
}

.translator__title {
  margin: 0;
  font: var(--yx-font-size-600) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.translator__panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--yx-space-500);
}

.translator__panel {
  display: grid;
  gap: var(--yx-space-300);
}

.translator__label {
  font-weight: var(--yx-font-weight-semibold);
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
}

.translator__textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: var(--yx-space-400);
  background: var(--yx-surface-default);
  font: inherit;
  line-height: var(--yx-line-height-relaxed);
}

.translator__textarea:focus-visible {
  outline: 3px solid var(--yx-focus-ring);
  outline-offset: 2px;
}

.translator__textarea--readonly {
  background: var(--yx-bg-muted);
}

.translator__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
  align-items: center;
}

.translator__actions--inline {
  justify-content: space-between;
}

.translator__actions--main {
  margin-top: var(--yx-space-600);
  justify-content: flex-start;
}

.translator__local-notice {
  display: flex;
  align-items: center;
  gap: var(--yx-space-200);
}

.translator__error {
  margin: 0;
  padding: var(--yx-space-300);
  border-radius: var(--yx-radius-md);
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
  font-size: var(--yx-font-size-200);
}

.translator__phrases {
  margin-top: var(--yx-space-800);
}

.translator__subtitle {
  margin: 0 0 var(--yx-space-400);
  font: var(--yx-font-size-400) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.translator__phrase-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

@media (max-width: 48rem) {
  .translator__panels {
    grid-template-columns: 1fr;
  }
}
</style>
