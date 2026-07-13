<script setup lang="ts">
import type { ApiEnvelope } from "~/lib/api/types";
import {
  describeLiveFailure,
  type Paginated,
} from "~/features/live-core/gateway";

interface TrainingModuleItem {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  durationMinutes?: number;
}
interface TrainingProgramItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  modules: TrainingModuleItem[];
}
interface TrainingEnrollmentItem {
  id: string;
  programId: string;
  volunteerUserId: string;
  status: string;
  examReady: boolean;
}
interface TrainingProgressItem {
  id: string;
  enrollmentId: string;
  moduleId: string;
  completed: boolean;
  completedAt?: string;
}

const api = useProductApi();
const session = useProductSession();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const programs = ref<TrainingProgramItem[]>([]);
const enrollments = ref<TrainingEnrollmentItem[]>([]);
const progress = ref<Record<string, TrainingProgressItem[]>>({});
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const writing = ref<string | null>(null);
const message = ref("");

useSeoMeta({ title: "志愿者培训｜语赞心声" });

async function context() {
  await session.refresh();
  const user = session.state.value.user;
  const membership = session.activeMembership.value;
  if (!user?.activeSchoolId || !membership) throw new Error("请先选择学校。");
  return { schoolId: user.activeSchoolId, userId: user.id };
}

async function load() {
  state.value = "loading";
  failure.value = null;
  try {
    const { schoolId } = await context();
    const [programResponse, enrollmentResponse] = await Promise.all([
      api.request<ApiEnvelope<Paginated<TrainingProgramItem>>>(
        `/schools/${schoolId}/training?status=PUBLISHED&limit=50`,
      ),
      api.request<ApiEnvelope<Paginated<TrainingEnrollmentItem>>>(
        `/schools/${schoolId}/training/enrollments/me?limit=50`,
      ),
    ]);
    programs.value = programResponse.data.items;
    enrollments.value = enrollmentResponse.data.items;
    progress.value = {};
    await Promise.all(
      enrollments.value.map(async (enrollment) => {
        const response = await api.request<ApiEnvelope<TrainingProgressItem[]>>(
          `/schools/${schoolId}/training/${enrollment.id}/progress`,
        );
        progress.value[enrollment.id] = response.data;
      }),
    );
    state.value = programs.value.length ? "ready" : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}

function enrollmentFor(programId: string) {
  return enrollments.value.find((item) => item.programId === programId);
}

function moduleCompleted(enrollmentId: string, moduleId: string) {
  return (
    progress.value[enrollmentId]?.some(
      (item) => item.moduleId === moduleId && item.completed,
    ) ?? false
  );
}

async function enroll(program: TrainingProgramItem) {
  if (writing.value) return;
  writing.value = program.id;
  message.value = "";
  try {
    const { schoolId, userId } = await context();
    await api.request<ApiEnvelope<TrainingEnrollmentItem>>(
      `/schools/${schoolId}/training/${program.id}/enroll`,
      {
        method: "POST",
        body: JSON.stringify({ volunteerUserId: userId }),
      },
    );
    message.value = "报名已由服务器保存。";
    await load();
  } catch (error) {
    message.value = describeLiveFailure(error).message;
  } finally {
    writing.value = null;
  }
}

async function saveProgress(
  enrollment: TrainingEnrollmentItem,
  module: TrainingModuleItem,
) {
  if (writing.value) return;
  writing.value = module.id;
  message.value = "";
  try {
    const { schoolId } = await context();
    await api.request<ApiEnvelope<TrainingProgressItem>>(
      `/schools/${schoolId}/training/${enrollment.id}/progress`,
      {
        method: "POST",
        body: JSON.stringify({ moduleId: module.id, completed: true }),
      },
    );
    message.value = `“${module.title}”的完成进度已由服务器保存。`;
    await load();
  } catch (error) {
    message.value = describeLiveFailure(error).message;
  } finally {
    writing.value = null;
  }
}

await load();
</script>

<template>
  <section class="training yx-shell" aria-labelledby="training-title">
    <nav aria-label="志愿者培训面包屑">
      <NuxtLink to="/volunteer">志愿者工作台</NuxtLink><span>/</span
      ><strong>培训中心</strong>
    </nav>
    <header>
      <div>
        <p class="yx-kicker">VOLUNTEER TRAINING · POSTGRESQL</p>
        <h1 id="training-title">继续培训，<br />每一步都有记录。</h1>
      </div>
      <NuxtLink to="/volunteer">返回志愿者工作台</NuxtLink>
    </header>

    <section v-if="state === 'loading'" class="state">
      <h2>正在读取培训与进度……</h2>
    </section>
    <section v-else-if="state === 'error'" class="state" role="alert">
      <p class="yx-kicker">{{ failure?.code || failure?.kind }}</p>
      <h2>{{ failure?.message }}</h2>
      <div>
        <NuxtLink to="/volunteer">返回工作台</NuxtLink
        ><button type="button" @click="load">重试</button>
      </div>
    </section>
    <section v-else-if="state === 'empty'" class="state">
      <p class="yx-kicker">REAL EMPTY</p>
      <h2>当前学校还没有已发布培训。</h2>
      <p>请联系教师或学校管理员发布培训项目。</p>
      <NuxtLink to="/volunteer">返回志愿者工作台</NuxtLink>
    </section>

    <ol v-else class="programs">
      <li v-for="(program, index) in programs" :key="program.id">
        <div class="program-head">
          <b>{{ String(index + 1).padStart(2, "0") }}</b>
          <div>
            <p>{{ program.status }}</p>
            <h2>{{ program.title }}</h2>
            <span>{{ program.description || "后端未提供培训说明。" }}</span>
          </div>
        </div>
        <template v-if="enrollmentFor(program.id)">
          <ol class="modules">
            <li v-for="module in program.modules" :key="module.id">
              <div>
                <strong>{{ module.title }}</strong
                ><span
                  >{{
                    module.durationMinutes
                      ? `${module.durationMinutes} 分钟`
                      : "未配置时长"
                  }}
                  · {{ module.required ? "必修" : "选修" }}</span
                >
              </div>
              <button
                v-if="
                  !moduleCompleted(enrollmentFor(program.id)!.id, module.id)
                "
                type="button"
                :disabled="!!writing"
                @click="saveProgress(enrollmentFor(program.id)!, module)"
              >
                {{ writing === module.id ? "正在保存…" : "完成并保存" }}</button
              ><em v-else>已由服务器保存</em>
            </li>
          </ol>
        </template>
        <button
          v-else
          class="enroll"
          type="button"
          :disabled="!!writing"
          @click="enroll(program)"
        >
          {{ writing === program.id ? "正在报名…" : "报名这项培训" }}
        </button>
      </li>
    </ol>
    <p class="message" role="status">
      {{ message || "进度只在服务器确认后显示为已完成。" }}
    </p>
    <footer>
      <NuxtLink to="/volunteer">完成本次学习，返回志愿者工作台</NuxtLink>
    </footer>
  </section>
</template>

<style scoped>
.training {
  padding-block: clamp(2rem, 6vw, 6rem);
}
nav {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 2rem;
}
nav a,
header > a,
.state a,
footer a {
  color: var(--yx-color-wine);
  font-weight: 700;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  align-items: end;
  padding-bottom: 2rem;
  border-bottom: 2px solid currentColor;
}
h1 {
  margin: 0.5rem 0;
  font: 600 clamp(3rem, 8vw, 7rem)/0.9 var(--yx-font-display);
}
.state {
  min-height: 24rem;
  display: grid;
  align-content: center;
  justify-items: start;
}
.state h2 {
  font: 600 clamp(2rem, 4vw, 3.5rem) var(--yx-font-display);
}
.state div {
  display: flex;
  gap: 1rem;
}
.state button,
.enroll,
.modules button {
  border: 0;
  padding: 0.8rem 1rem;
  background: var(--yx-color-sage-strong);
  color: #fff;
  font-weight: 700;
}
.programs,
.modules {
  list-style: none;
  padding: 0;
  margin: 0;
}
.programs > li {
  padding: 3rem 0;
  border-bottom: 2px solid currentColor;
}
.program-head {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: 1rem;
}
.program-head > b {
  font: 600 2rem var(--yx-font-display);
  color: var(--yx-color-gold);
}
.program-head p,
.program-head h2 {
  margin: 0.25rem 0;
}
.program-head h2 {
  font: 600 clamp(2rem, 5vw, 4rem) var(--yx-font-display);
}
.program-head span,
.modules span {
  color: var(--yx-color-ink-soft);
}
.modules {
  margin: 2rem 0 0 5rem;
}
.modules li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1.15rem 0;
  border-top: 1px solid var(--yx-color-line);
}
.modules li > div {
  display: grid;
  gap: 0.25rem;
}
.modules em {
  color: var(--yx-color-sage-strong);
  font-style: normal;
  font-weight: 700;
}
.enroll {
  margin: 2rem 0 0 5rem;
}
.message {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--yx-color-gold);
  color: var(--yx-color-ink-soft);
}
footer {
  padding-top: 2rem;
}
@media (max-width: 48rem) {
  header {
    align-items: start;
    flex-direction: column;
  }
  .program-head {
    grid-template-columns: 2.5rem 1fr;
  }
  .modules {
    margin-left: 0;
  }
  .modules li {
    align-items: flex-start;
    flex-direction: column;
  }
  .enroll {
    margin-left: 0;
    width: 100%;
  }
}
</style>
