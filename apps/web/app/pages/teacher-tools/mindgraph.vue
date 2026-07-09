<script setup lang="ts">
import { ref, computed } from "vue";
import { teacherToolsConfig } from "~/features/teacher-tools/config/teacher-tools.config";
import {
  useMindGraph,
  type MindGraphType,
} from "~/features/teacher-tools/composables/useMindGraph";

const { mindGraph } = teacherToolsConfig;

useSeoMeta({
  title: `${mindGraph.title}｜教师工具`,
});

const prompt = ref("");
const selectedType = ref<MindGraphType>(mindGraph.types[0].value);
const { status, result, errorMessage, generate, reset } = useMindGraph();

const isGenerateDisabled = computed(
  () => status.value === "loading" || !prompt.value.trim(),
);

async function onSubmit() {
  await generate(prompt.value, selectedType.value);
}

function onReset() {
  prompt.value = "";
  selectedType.value = mindGraph.types[0].value;
  reset();
}
</script>

<template>
  <div class="tool-page">
    <div class="yx-shell">
      <NuxtLink class="back-link" to="/teacher-tools">← 返回教师工具</NuxtLink>

      <section class="hero">
        <p class="yx-kicker">
          TEACHER TOOL · {{ mindGraph.title.toUpperCase() }}
        </p>
        <h1>{{ mindGraph.title }}</h1>
        <p class="hero__subtitle">{{ mindGraph.subtitle }}</p>
        <p class="hero__lead">{{ mindGraph.description }}</p>
      </section>

      <div class="workspace">
        <section class="panel" aria-labelledby="input-title">
          <h2 id="input-title">输入与类型</h2>
          <form class="form" @submit.prevent="onSubmit">
            <div class="text-field">
              <label class="text-field__label" for="mindgraph-prompt">
                主题或问题
                <span class="text-field__required">必填</span>
              </label>
              <p class="text-field__description">
                输入一个教学主题、问题或段落，建议控制在 500 字以内。
              </p>
              <input
                id="mindgraph-prompt"
                v-model="prompt"
                class="text-field__control"
                type="text"
                placeholder="例如：说明文“鲸”的主要说明方法"
                :maxlength="mindGraph.maxInputLength"
                required
              />
            </div>

            <div class="type-field">
              <label class="type-field__label" for="mindgraph-type">
                图示结构
              </label>
              <select
                id="mindgraph-type"
                v-model="selectedType"
                class="type-field__select"
              >
                <option
                  v-for="type in mindGraph.types"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </option>
              </select>
              <p class="type-field__hint">
                {{
                  mindGraph.types.find((t) => t.value === selectedType)
                    ?.description
                }}
              </p>
            </div>

            <div class="actions">
              <button
                class="button button--primary"
                type="submit"
                :disabled="isGenerateDisabled"
                :aria-busy="status === 'loading'"
              >
                <span
                  v-if="status === 'loading'"
                  class="spinner spinner--inline"
                  aria-hidden="true"
                />
                <span>{{ status === "loading" ? "生成中…" : "生成预览" }}</span>
              </button>
              <button
                class="button button--secondary"
                type="button"
                @click="onReset"
              >
                清空
              </button>
            </div>
          </form>
        </section>

        <section class="panel preview" aria-labelledby="preview-title">
          <h2 id="preview-title">预览</h2>

          <div v-if="status === 'idle'" class="state state--idle">
            <p>在左侧输入主题并选择结构后，点击“生成预览”。</p>
            <p class="state__meta">
              当前生成服务未接入，提交后将提示不可用，不会显示伪造结果。
            </p>
          </div>

          <div v-else-if="status === 'loading'" class="state state--loading">
            <span class="spinner" aria-hidden="true" />
            <p>正在请求生成服务…</p>
          </div>

          <div
            v-else-if="status === 'unavailable' || status === 'error'"
            class="state state--error"
          >
            <span class="status-badge status-badge--danger">服务暂不可用</span>
            <p>{{ errorMessage }}</p>
          </div>

          <div
            v-else-if="status === 'complete' && result"
            class="state state--complete"
          >
            <span class="status-badge status-badge--success">生成完成</span>
            <div class="result">
              <h3>{{ result.title }}</h3>
              <ul class="node-list">
                <li v-for="node in result.nodes" :key="node.id">
                  {{ node.label }}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section
        class="panel panel--wide actions-row"
        aria-labelledby="history-title"
      >
        <h2 id="history-title">历史与导出</h2>
        <div class="entry-group">
          <button
            class="button button--secondary"
            type="button"
            :disabled="status === 'unavailable' || status === 'error'"
          >
            {{ mindGraph.historyLabel }}
          </button>
          <button
            class="button button--secondary"
            type="button"
            :disabled="status !== 'complete'"
          >
            {{ mindGraph.exportLabel }}
          </button>
        </div>
        <p class="entry-hint">
          历史与导出功能将在生成服务接入后启用。当前阶段不提供伪造数据下载。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tool-page {
  padding-block: clamp(2rem, 5vw, 4rem);
}

.back-link {
  display: inline-flex;
  margin-bottom: 1.5rem;
  color: var(--yx-text-muted);
  text-decoration: none;
}

.back-link:hover {
  color: var(--yx-text-accent);
}

.hero {
  max-width: var(--yx-content-reading);
  margin-bottom: 3rem;
}

.hero h1 {
  margin: 0.75rem 0 0.5rem;
  font: 600 var(--yx-text-xl) / 1.15 var(--yx-font-display);
}

.hero__subtitle {
  font-size: var(--yx-font-size-500);
  color: var(--yx-text-secondary);
  margin: 0 0 1rem;
}

.hero__lead {
  line-height: 1.8;
  color: var(--yx-text-muted);
  margin: 0;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: var(--yx-space-600);
  margin-bottom: var(--yx-space-600);
}

.panel {
  padding: var(--yx-space-600);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.panel--wide {
  margin-bottom: var(--yx-space-600);
}

.panel h2 {
  margin: 0 0 1rem;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
}

.form {
  display: grid;
  gap: var(--yx-space-500);
}

.text-field {
  display: grid;
  gap: var(--yx-space-200);
}

.text-field__label {
  display: inline-flex;
  align-items: center;
  gap: var(--yx-space-200);
  font-weight: var(--yx-font-weight-semibold);
  line-height: var(--yx-line-height-tight);
}

.text-field__required {
  color: var(--yx-text-accent);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-medium);
}

.text-field__description {
  margin: 0;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.text-field__control {
  min-height: 2.75rem;
  width: 100%;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.text-field__control:hover:not(:disabled) {
  border-color: var(--yx-border-strong);
}

.text-field__control::placeholder {
  color: var(--yx-text-muted);
}

.button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--yx-space-200);
  border: 1px solid transparent;
  border-radius: var(--yx-radius-pill);
  padding: 0.7rem 1.15rem;
  font-weight: var(--yx-font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--yx-motion-duration-fast) var(--yx-motion-ease-standard),
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.button--primary {
  background: var(--yx-action-primary-bg);
  color: var(--yx-action-primary-fg);
  box-shadow: var(--yx-shadow-100);
}

.button--primary:hover:not(:disabled) {
  background: var(--yx-action-primary-bg-hover);
}

.button--secondary {
  background: var(--yx-action-secondary-bg);
  color: var(--yx-action-secondary-fg);
  border-color: var(--yx-action-secondary-border);
}

.button--secondary:hover:not(:disabled) {
  background: var(--yx-action-secondary-bg-hover);
}

.button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  box-shadow: none;
}

.button:not(:disabled):active {
  transform: translateY(1px);
  box-shadow: none;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding-inline: 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--yx-radius-pill);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-medium);
  line-height: 1.3;
}

.status-badge--danger {
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
  border-color: var(--yx-danger-border);
}

.status-badge--success {
  background: var(--yx-success-bg);
  color: var(--yx-success-fg);
  border-color: var(--yx-success-border);
}

.spinner--inline {
  width: 1rem;
  border-width: 1.5px;
}

.type-field {
  display: grid;
  gap: var(--yx-space-200);
}

.type-field__label {
  font-weight: var(--yx-font-weight-semibold);
  line-height: var(--yx-line-height-tight);
}

.type-field__select {
  min-height: 2.75rem;
  width: 100%;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.type-field__select:hover:not(:disabled) {
  border-color: var(--yx-border-strong);
}

.type-field__select:focus-visible {
  outline: 3px solid var(--yx-focus-ring);
  outline-offset: 3px;
  box-shadow: var(--yx-focus-shadow);
}

.type-field__hint {
  margin: 0;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

.preview {
  min-height: 24rem;
  display: flex;
  flex-direction: column;
}

.state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--yx-space-300);
  padding: var(--yx-space-500);
  border-radius: var(--yx-radius-md);
}

.state--idle {
  background: var(--yx-surface-subtle);
  color: var(--yx-text-muted);
}

.state--idle p {
  margin: 0;
}

.state__meta {
  font-size: var(--yx-font-size-200);
}

.state--loading {
  background: var(--yx-surface-subtle);
  color: var(--yx-text-secondary);
}

.state--loading p {
  margin: 0;
}

.spinner {
  width: 1.5rem;
  aspect-ratio: 1;
  border: 2px solid var(--yx-border-default);
  border-top-color: var(--yx-text-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.state--error {
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
}

.state--error p {
  margin: 0;
  line-height: 1.7;
}

.state--complete {
  background: var(--yx-success-bg);
  color: var(--yx-success-fg);
}

.result {
  width: 100%;
}

.result h3 {
  margin: 0 0 0.75rem;
  font: 600 var(--yx-font-size-400) / 1.2 var(--yx-font-display);
}

.node-list {
  margin: 0;
  padding-left: 1.25rem;
  display: grid;
  gap: var(--yx-space-200);
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--yx-space-400) var(--yx-space-600);
}

.actions-row h2 {
  margin: 0;
  flex: 1 0 100%;
}

.entry-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

.entry-hint {
  margin: 0;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
  flex: 1 1 18rem;
}

@media (max-width: 64rem) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .actions-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
