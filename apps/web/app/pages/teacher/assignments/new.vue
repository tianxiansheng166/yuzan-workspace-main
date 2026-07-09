<script setup lang="ts">
import { watch, nextTick } from "vue";
import { YxButton, YxInput, YxStatus } from "@yuzan/ui";
import { useAssignmentBuilder } from "~/features/assignment-builder/composables/useAssignmentBuilder";
import { getAssignmentTypeLabel } from "~/features/assignment-builder/adapters/assignment.adapter";
import type {
  AssignmentType,
  ContentKind,
} from "~/features/assignment-builder/types";

// Demo role source until auth integration.
const role: "teacher" | "unknown" = "teacher";
const {
  state,
  errors,
  firstErrorField,
  isSubmitting,
  lastResult,
  canEdit,
  addContent,
  removeContent,
  saveDraft,
  publish,
  fieldError,
} = useAssignmentBuilder(role);

const assignmentTypes: { value: AssignmentType; label: string }[] = [
  { value: "learning", label: getAssignmentTypeLabel("learning") },
  {
    value: "first-assessment",
    label: getAssignmentTypeLabel("first-assessment"),
  },
  { value: "retest", label: getAssignmentTypeLabel("retest") },
  {
    value: "speech-practice",
    label: getAssignmentTypeLabel("speech-practice"),
  },
  {
    value: "written-practice",
    label: getAssignmentTypeLabel("written-practice"),
  },
  { value: "composite", label: getAssignmentTypeLabel("composite") },
];

const demoClasses = [
  { id: "cls-demo-01", name: "三年级一班" },
  { id: "cls-demo-02", name: "三年级二班" },
];

const demoContents: { id: string; kind: ContentKind; title: string }[] = [
  { id: "cnt-demo-01", kind: "assessment", title: "第三单元形成性测评" },
  { id: "cnt-demo-02", kind: "course", title: "古诗三首精读" },
  { id: "cnt-demo-03", kind: "activity", title: "朗读：静夜思" },
  { id: "cnt-demo-04", kind: "activity", title: "书面练习：生字抄写" },
];

function selectContent(content: (typeof demoContents)[number]) {
  const exists = state.selectedContents.some((c) => c.id === content.id);
  if (!exists) {
    addContent(content.kind, content.title);
  }
}

watch(firstErrorField, async (field) => {
  if (!field) return;
  await nextTick();
  if (typeof globalThis === "undefined" || !("document" in globalThis)) return;
  const d = (globalThis as unknown as { document: Document }).document;
  const el = d.getElementById(`field-${field}`);
  if (el) el.focus();
});

async function handleSaveDraft() {
  await saveDraft();
}

async function handlePublish() {
  await publish();
}
</script>

<template>
  <section class="assignment-new yx-shell">
    <header class="assignment-new__header">
      <div>
        <p class="yx-kicker">
          <NuxtLink to="/teacher/assignments" class="back-link"
            >← 任务列表</NuxtLink
          >
          · 教师工作台
        </p>
        <h1>新建任务</h1>
      </div>
      <YxStatus v-if="!canEdit" tone="warning">当前角色不可创建任务</YxStatus>
      <YxStatus v-else tone="warning">DEMO 模式</YxStatus>
    </header>

    <form class="assignment-form" @submit.prevent>
      <fieldset class="form-section" :disabled="!canEdit">
        <legend class="form-section__title">基本信息</legend>

        <YxInput
          id="field-title"
          v-model="state.title"
          label="任务标题"
          placeholder="例如：第三单元综合测评"
          required
          :error="fieldError('title')"
          :disabled="!canEdit"
        />

        <div class="form-row">
          <div
            class="form-field"
            :class="{ 'has-error': fieldError('classId') }"
          >
            <label
              id="field-classId"
              for="classId-select"
              class="form-field__label"
            >
              目标班级 <span class="required">必填</span>
            </label>
            <select
              id="classId-select"
              v-model="state.classId"
              :disabled="!canEdit"
            >
              <option value="" disabled>请选择班级</option>
              <option v-for="c in demoClasses" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <p
              v-if="fieldError('classId')"
              class="form-field__error"
              role="alert"
            >
              {{ fieldError("classId") }}
            </p>
          </div>

          <div class="form-field" :class="{ 'has-error': fieldError('type') }">
            <label id="field-type" for="type-select" class="form-field__label">
              任务类型 <span class="required">必填</span>
            </label>
            <select id="type-select" v-model="state.type" :disabled="!canEdit">
              <option
                v-for="t in assignmentTypes"
                :key="t.value"
                :value="t.value"
              >
                {{ t.label }}
              </option>
            </select>
            <p v-if="fieldError('type')" class="form-field__error" role="alert">
              {{ fieldError("type") }}
            </p>
          </div>
        </div>

        <div class="form-field">
          <label for="description-textarea" class="form-field__label"
            >任务说明</label
          >
          <textarea
            id="description-textarea"
            v-model="state.description"
            rows="3"
            placeholder="补充任务说明（可选）"
            :disabled="!canEdit"
          />
        </div>
      </fieldset>

      <fieldset class="form-section" :disabled="!canEdit">
        <legend class="form-section__title">内容与测评</legend>
        <p class="form-section__hint">点击下方 demo 内容添加到当前任务。</p>

        <div class="content-palette" role="list">
          <button
            v-for="content in demoContents"
            :key="content.id"
            type="button"
            class="content-chip"
            :disabled="
              !canEdit ||
              state.selectedContents.some((c) => c.id === content.id)
            "
            @click="selectContent(content)"
          >
            + {{ content.title }}
          </button>
        </div>

        <div
          id="field-contents"
          class="selected-contents"
          :class="{ 'has-error': fieldError('contents') }"
          tabindex="-1"
        >
          <p class="form-field__label">已选内容</p>
          <ul v-if="state.selectedContents.length > 0" role="list">
            <li
              v-for="content in state.selectedContents"
              :key="content.id"
              class="selected-content"
            >
              <span
                >{{ content.title }} <small>({{ content.kind }})</small></span
              >
              <YxButton
                kind="quiet"
                type="button"
                :disabled="!canEdit"
                @click="removeContent(content.id)"
              >
                移除
              </YxButton>
            </li>
          </ul>
          <p v-else class="empty-contents">尚未选择任何内容</p>
          <p
            v-if="fieldError('contents')"
            class="form-field__error"
            role="alert"
          >
            {{ fieldError("contents") }}
          </p>
        </div>
      </fieldset>

      <fieldset class="form-section" :disabled="!canEdit">
        <legend class="form-section__title">时间安排</legend>

        <div class="form-row">
          <div
            class="form-field"
            :class="{ 'has-error': fieldError('startsAt') }"
          >
            <label
              id="field-startsAt"
              for="startsAt-input"
              class="form-field__label"
            >
              开始时间 <span class="required">必填</span>
            </label>
            <input
              id="startsAt-input"
              v-model="state.startsAt"
              type="datetime-local"
              :disabled="!canEdit"
            />
            <p
              v-if="fieldError('startsAt')"
              class="form-field__error"
              role="alert"
            >
              {{ fieldError("startsAt") }}
            </p>
          </div>

          <div class="form-field" :class="{ 'has-error': fieldError('dueAt') }">
            <label id="field-dueAt" for="dueAt-input" class="form-field__label">
              截止时间 <span class="required">必填</span>
            </label>
            <input
              id="dueAt-input"
              v-model="state.dueAt"
              type="datetime-local"
              :disabled="!canEdit"
            />
            <p
              v-if="fieldError('dueAt')"
              class="form-field__error"
              role="alert"
            >
              {{ fieldError("dueAt") }}
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-section" :disabled="!canEdit">
        <legend class="form-section__title">任务配置</legend>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="state.allowRetest"
              type="checkbox"
              :disabled="!canEdit"
            />
            允许复测
          </label>
          <label class="checkbox-label">
            <input
              v-model="state.includeSpeech"
              type="checkbox"
              :disabled="!canEdit"
            />
            包含朗读练习
          </label>
          <label class="checkbox-label">
            <input
              v-model="state.includeWritten"
              type="checkbox"
              :disabled="!canEdit"
            />
            包含书面练习
          </label>
          <label class="checkbox-label">
            <input
              v-model="state.recommendNextCourse"
              type="checkbox"
              :disabled="!canEdit"
            />
            完成后推荐下一课程
          </label>
        </div>
      </fieldset>

      <fieldset class="form-section preview-section">
        <legend class="form-section__title">任务预览</legend>
        <dl class="preview-list">
          <div>
            <dt>标题</dt>
            <dd>{{ state.title || "未填写" }}</dd>
          </div>
          <div>
            <dt>班级</dt>
            <dd>
              {{
                demoClasses.find((c) => c.id === state.classId)?.name ??
                "未选择"
              }}
            </dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{{ getAssignmentTypeLabel(state.type) }}</dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>{{ state.startsAt }} 至 {{ state.dueAt }}</dd>
          </div>
          <div>
            <dt>已选内容</dt>
            <dd>
              {{
                state.selectedContents.map((c) => c.title).join("、") || "无"
              }}
            </dd>
          </div>
          <div>
            <dt>配置</dt>
            <dd>
              {{
                [
                  state.allowRetest ? "允许复测" : "",
                  state.includeSpeech ? "包含朗读" : "",
                  state.includeWritten ? "包含书面" : "",
                  state.recommendNextCourse ? "推荐课程" : "",
                ]
                  .filter(Boolean)
                  .join("、") || "无"
              }}
            </dd>
          </div>
        </dl>
      </fieldset>

      <div v-if="lastResult" class="result-banner" role="status">
        <p>{{ lastResult.message }}</p>
      </div>

      <div class="form-actions">
        <YxButton
          kind="secondary"
          type="button"
          :disabled="!canEdit || isSubmitting"
          @click="handleSaveDraft"
        >
          保存草稿
        </YxButton>
        <YxButton
          kind="primary"
          type="button"
          :disabled="!canEdit || isSubmitting"
          @click="handlePublish"
        >
          发布任务
        </YxButton>
      </div>

      <p class="form-note" aria-live="polite">
        当前为 demo 模式（ASN-001
        完成后将接入真实发布流程）。保存的草稿仅存在于本地预览，发布不会真正下发给学生。
      </p>
    </form>
  </section>
</template>

<style scoped>
.assignment-new {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.assignment-new__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--yx-border-default);
  margin-bottom: 1.5rem;
}
.assignment-new h1 {
  margin: 0.5rem 0 0;
  font: 600 clamp(1.75rem, 4vw, 2.5rem) / 1.1 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.back-link {
  color: var(--yx-text-accent);
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
.assignment-form {
  display: grid;
  gap: 1.5rem;
  max-width: 52rem;
}
.form-section {
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 1.25rem;
  background: var(--yx-surface-default);
}
.form-section__title {
  padding: 0 0.5rem;
  margin: 0 0 1rem;
  font: 600 var(--yx-font-size-400) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}
.form-section__hint {
  margin: 0 0 0.75rem;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-field {
  display: grid;
  gap: 0.4rem;
}
.form-field__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-primary);
}
.required {
  color: var(--yx-text-accent);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-medium);
}
.form-field__error {
  margin: 0;
  color: var(--yx-danger-fg);
  font-size: var(--yx-font-size-200);
}
select,
input[type="datetime-local"],
textarea {
  min-height: 2.75rem;
  width: 100%;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
  font: inherit;
}
textarea {
  min-height: 5rem;
  resize: vertical;
}
select:disabled,
input:disabled,
textarea:disabled,
fieldset:disabled select,
fieldset:disabled input,
fieldset:disabled textarea {
  opacity: 0.64;
  cursor: not-allowed;
}
.form-field.has-error select,
.form-field.has-error input,
.selected-contents.has-error {
  border-color: var(--yx-danger-fg);
}
.content-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.content-chip {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-pill);
  background: var(--yx-bg-canvas-strong);
  color: var(--yx-text-secondary);
  cursor: pointer;
  font: inherit;
}
.content-chip:hover:not(:disabled) {
  border-color: var(--yx-border-strong);
}
.content-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.selected-contents {
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem;
}
.selected-contents ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: grid;
  gap: 0.5rem;
}
.selected-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.empty-contents {
  margin: 0.5rem 0 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.checkbox-group {
  display: grid;
  gap: 0.75rem;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.checkbox-label input {
  width: 1.1rem;
  height: 1.1rem;
}
.preview-section {
  background: var(--yx-bg-canvas);
}
.preview-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
.preview-list div {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 1rem;
}
.preview-list dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
.preview-list dd {
  margin: 0;
  color: var(--yx-text-primary);
}
.result-banner {
  padding: 1rem;
  border: 1px solid var(--yx-border-strong);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-canvas-strong);
  color: var(--yx-text-secondary);
}
.result-banner p {
  margin: 0;
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.form-note {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}
@media (max-width: 48rem) {
  .form-row {
    grid-template-columns: 1fr;
  }
  .preview-list div {
    grid-template-columns: 1fr;
  }
}
</style>
