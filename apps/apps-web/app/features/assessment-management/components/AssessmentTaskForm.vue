<script setup lang="ts">
import { computed, reactive } from "vue";
import { YxButton } from "@yuzan/ui";

import type {
  CreateAssessmentTaskInput,
  MaterialOption,
  TargetOption,
} from "../types";

const props = defineProps<{
  readingMaterials: MaterialOption[];
  writingTasks: MaterialOption[];
  targets: TargetOption[];
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CreateAssessmentTaskInput];
}>();

const form = reactive<CreateAssessmentTaskInput>({
  title: "",
  readingMaterialId: "",
  writingTaskId: "",
  opensAt: "",
  closesAt: "",
  targetIds: [],
  anonymous: false,
});

const errors = reactive<Record<string, string>>({});

const groupedTargets = computed(() => ({
  school: props.targets.filter((target) => target.kind === "school"),
  class: props.targets.filter((target) => target.kind === "class"),
  student: props.targets.filter((target) => target.kind === "student"),
}));

function validate() {
  errors.title = form.title.trim() ? "" : "请输入测评任务名称。";
  errors.readingMaterialId = form.readingMaterialId ? "" : "请选择朗读材料。";
  errors.writingTaskId = form.writingTaskId ? "" : "请选择书面任务。";
  errors.opensAt = form.opensAt ? "" : "请选择开放开始时间。";
  errors.closesAt = form.closesAt ? "" : "请选择开放结束时间。";
  errors.targetIds =
    form.targetIds.length > 0 ? "" : "至少选择一个学校、班级或学生目标。";

  if (form.opensAt && form.closesAt) {
    errors.closesAt =
      new Date(form.closesAt).getTime() > new Date(form.opensAt).getTime()
        ? ""
        : "结束时间必须晚于开始时间。";
  }

  return Object.values(errors).every((value) => !value);
}

function toggleTarget(targetId: string, checked: boolean) {
  form.targetIds = checked
    ? Array.from(new Set([...form.targetIds, targetId]))
    : form.targetIds.filter((item) => item !== targetId);
}

function onSubmit() {
  if (!validate()) {
    return;
  }

  emit("submit", {
    title: form.title.trim(),
    readingMaterialId: form.readingMaterialId,
    writingTaskId: form.writingTaskId,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    targetIds: [...form.targetIds],
    anonymous: form.anonymous,
  });
}
</script>

<template>
  <form class="task-form" @submit.prevent="onSubmit">
    <div class="task-form__hero">
      <div>
        <p class="yx-kicker">NEW DEMO WORKFLOW</p>
        <h2>创建教师测评任务</h2>
        <p>
          该流程只演示任务管理，不伪造真实到班到人的完成数据；访问链接、停用和报告入口都可以在详情页继续操作。
        </p>
      </div>
      <label class="switch">
        <span>匿名测评</span>
        <input v-model="form.anonymous" type="checkbox" />
      </label>
    </div>

    <div class="task-form__grid">
      <label class="field">
        <span>测评任务名称</span>
        <input
          v-model="form.title"
          type="text"
          placeholder="例如：七月朗读与书面表达测评"
        />
        <small v-if="errors.title" role="alert">{{ errors.title }}</small>
      </label>

      <label class="field">
        <span>开放开始时间</span>
        <input v-model="form.opensAt" type="datetime-local" />
        <small v-if="errors.opensAt" role="alert">{{ errors.opensAt }}</small>
      </label>

      <label class="field">
        <span>开放结束时间</span>
        <input v-model="form.closesAt" type="datetime-local" />
        <small v-if="errors.closesAt" role="alert">{{ errors.closesAt }}</small>
      </label>

      <label class="field">
        <span>朗读材料</span>
        <select v-model="form.readingMaterialId">
          <option value="">请选择朗读材料</option>
          <option
            v-for="material in readingMaterials"
            :key="material.id"
            :value="material.id"
          >
            {{ material.title }} · {{ material.level }} ·
            {{ material.estimatedMinutes }} 分钟
          </option>
        </select>
        <small v-if="errors.readingMaterialId" role="alert">
          {{ errors.readingMaterialId }}
        </small>
      </label>

      <label class="field">
        <span>书面任务</span>
        <select v-model="form.writingTaskId">
          <option value="">请选择书面任务</option>
          <option v-for="task in writingTasks" :key="task.id" :value="task.id">
            {{ task.title }} · {{ task.level }} ·
            {{ task.estimatedMinutes }} 分钟
          </option>
        </select>
        <small v-if="errors.writingTaskId" role="alert">
          {{ errors.writingTaskId }}
        </small>
      </label>
    </div>

    <section class="targets">
      <div class="targets__header">
        <div>
          <p class="yx-kicker">TARGETS</p>
          <h3>学校 / 班级 / 学生目标</h3>
        </div>
        <p>可以组合选择，用于演示学校、班级和单个学生三层目标配置。</p>
      </div>
      <div class="targets__groups">
        <div
          v-for="(items, key) in groupedTargets"
          :key="key"
          class="target-group"
        >
          <h4>
            {{
              key === "school"
                ? "学校目标"
                : key === "class"
                  ? "班级目标"
                  : "学生目标"
            }}
          </h4>
          <label v-for="target in items" :key="target.id" class="target-option">
            <input
              :checked="form.targetIds.includes(target.id)"
              type="checkbox"
              @change="
                toggleTarget(
                  target.id,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <span>
              <strong>{{ target.name }}</strong>
              <small>{{ target.description }}</small>
            </span>
          </label>
        </div>
      </div>
      <small v-if="errors.targetIds" class="targets__error" role="alert">
        {{ errors.targetIds }}
      </small>
    </section>

    <div class="task-form__footer">
      <p>
        创建后会立即生成唯一 demo
        访问链接；二维码本任务范围内保持禁用，不新增依赖、不展示伪二维码。
      </p>
      <YxButton type="submit" :loading="submitting"
        >生成 demo 测评任务</YxButton
      >
    </div>
  </form>
</template>

<style scoped>
.task-form {
  display: grid;
  gap: 1.5rem;
  padding: clamp(1.4rem, 3vw, 2rem);
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.task-form__hero,
.targets__header,
.task-form__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}

h2,
h3,
h4 {
  margin: 0.5rem 0;
  font-family: var(--yx-font-display);
}

.task-form__hero p,
.targets__header p,
.task-form__footer p {
  max-width: 42rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: var(--yx-radius-pill);
  background: color-mix(in srgb, var(--yx-color-sage) 28%, white);
}

.task-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field {
  display: grid;
  gap: 0.45rem;
}

.field span {
  font-weight: 600;
}

.field input,
.field select {
  min-height: 2.9rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: white;
  padding: 0.8rem 0.9rem;
}

small {
  color: var(--yx-color-danger);
}

.targets {
  padding: 1rem;
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, var(--yx-color-sage) 12%, white);
}

.targets__groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.target-group {
  display: grid;
  gap: 0.8rem;
}

.target-option {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  align-items: start;
  padding: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--yx-color-line) 88%, white);
  border-radius: var(--yx-radius-lg);
  background: white;
}

.target-option span {
  display: grid;
  gap: 0.2rem;
}

.target-option small {
  color: var(--yx-color-ink-soft);
}

.targets__error {
  display: block;
  margin-top: 0.85rem;
}

@media (max-width: 60rem) {
  .task-form__grid,
  .targets__groups {
    grid-template-columns: 1fr;
  }
}
</style>
