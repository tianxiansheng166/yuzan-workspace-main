<script setup lang="ts">
import { describeLiveFailure, type TeacherOverview } from "~/features/live-core/gateway";

useSeoMeta({ title: "教师工作台｜语赞心声" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const overview = ref<TeacherOverview | null>(null);
const error = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const title = ref("");
const writing = ref(false);
const writeMessage = ref("");

async function load() {
  state.value = "loading";
  error.value = null;
  try {
    overview.value = await gateway.teacherOverview();
    state.value = overview.value.courses.length || overview.value.classes.length || overview.value.assignments.length ? "ready" : "empty";
  } catch (cause) {
    error.value = describeLiveFailure(cause);
    state.value = "error";
  }
}

async function createCourse() {
  if (!title.value.trim() || writing.value) return;
  writing.value = true;
  writeMessage.value = "";
  try {
    const created = await gateway.createCourse({ title: title.value.trim() });
    writeMessage.value = `课程草稿“${created.title}”已由服务器创建。`;
    title.value = "";
    await load();
  } catch (cause) {
    writeMessage.value = describeLiveFailure(cause).message;
  } finally {
    writing.value = false;
  }
}

await load();
</script>

<template>
  <section class="teacher yx-shell" aria-labelledby="teacher-title">
    <header class="teacher__mast">
      <p class="yx-kicker">TEACHING DESK · 实时学校范围</p>
      <h1 id="teacher-title">把今天要教、要发、要复核的事放在同一条线上。</h1>
      <p v-if="overview">{{ overview.context.schoolName }} · {{ overview.context.role }}</p>
    </header>

    <section v-if="state === 'loading'" class="state" aria-live="polite">
      <p class="yx-kicker">正在连接</p><h2>读取课程、班级、任务与报告……</h2>
    </section>
    <section v-else-if="state === 'error'" class="state" :data-kind="error?.kind" role="alert">
      <p class="yx-kicker">{{ error?.code || 'LIVE REQUEST' }}</p><h2>{{ error?.message }}</h2>
      <NuxtLink v-if="error?.kind === 'unauthenticated'" to="/login?redirect=/teacher">重新登录</NuxtLink>
      <NuxtLink v-else-if="error?.kind === 'permission'" to="/select-school">切换学校</NuxtLink>
      <button v-else type="button" @click="load">重试</button>
    </section>

    <template v-else-if="overview">
      <section class="pulse" aria-label="实时工作量">
        <div><strong>{{ overview.courses.length }}</strong><span>课程版本</span></div>
        <div><strong>{{ overview.classes.length }}</strong><span>可见班级</span></div>
        <div><strong>{{ overview.assignments.length }}</strong><span>学校任务</span></div>
        <div><strong>{{ overview.reports.length }}</strong><span>真实报告</span></div>
      </section>

      <section class="workspace">
        <div class="workspace__lead">
          <p class="yx-kicker">01 · 课程版本</p>
          <h2>先把教学内容立住。</h2>
          <form class="create" @submit.prevent="createCourse">
            <label for="course-title">新课程草稿名称</label>
            <div><input id="course-title" v-model="title" maxlength="160" required autocomplete="off"><button :disabled="writing" type="submit">{{ writing ? '创建中…' : '真实创建' }}</button></div>
            <p aria-live="polite">{{ writeMessage || '只有收到后端成功响应后，才会显示已创建。' }}</p>
          </form>
          <ol v-if="overview.courses.length" class="course-list">
            <li v-for="course in overview.courses.slice(0, 6)" :key="course.id">
              <span>{{ course.status }}</span><strong>{{ course.title }}</strong><small>v{{ course.version }} · {{ course.gradeBand || '未设置学段' }}</small>
            </li>
          </ol>
          <p v-else class="empty-line">当前学校还没有课程版本。可在上方创建第一份真实草稿。</p>
          <NuxtLink class="text-link" to="/studio">进入课程工作室</NuxtLink>
        </div>

        <nav class="workspace__rail" aria-label="教师工作入口">
          <p class="yx-kicker">02 · 组织与下发</p>
          <NuxtLink to="/teacher/classes"><strong>班级</strong><span>{{ overview.classes.length }} 个可见班级</span></NuxtLink>
          <NuxtLink to="/teacher/assignments"><strong>作业</strong><span>{{ overview.assignments.length }} 项真实任务</span></NuxtLink>
          <NuxtLink to="/teacher/review"><strong>复核</strong><span>按作业读取真实提交</span></NuxtLink>
          <NuxtLink to="/reports"><strong>报告</strong><span>{{ overview.reports.length }} 份服务端记录</span></NuxtLink>
          <NuxtLink to="/teacher/assessments"><strong>测评</strong><span>未接能力保持 pending / unavailable</span></NuxtLink>
          <NuxtLink to="/teacher-tools"><strong>教学工具</strong><span>提供方状态可追溯</span></NuxtLink>
        </nav>
      </section>

      <section v-if="state === 'empty'" class="empty-banner">
        <p class="yx-kicker">真实空状态</p><h2>这个学校还没有教学数据。</h2><p>页面没有填入示例人数、任务或报告。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.teacher{padding-block:clamp(2.5rem,7vw,7rem);color:var(--yx-color-ink)}.teacher__mast{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:2rem;border-bottom:2px solid currentColor;padding-bottom:2rem}.teacher__mast .yx-kicker,.teacher__mast h1{grid-column:1}.teacher__mast h1{max-width:18ch;margin:.5rem 0;font:600 clamp(2.7rem,6vw,6rem)/.98 var(--yx-font-display)}.teacher__mast>p:last-child{grid-column:2;grid-row:1/3;color:var(--yx-color-ink-soft)}.pulse{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--yx-color-line)}.pulse div{display:flex;align-items:baseline;gap:.7rem;padding:1.2rem 0;border-right:1px solid var(--yx-color-line)}.pulse div+div{padding-left:1.2rem}.pulse strong{font:600 2.3rem var(--yx-font-display)}.pulse span{color:var(--yx-color-ink-soft)}.workspace{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(18rem,.8fr);gap:clamp(2rem,6vw,7rem);padding-top:clamp(3rem,7vw,6rem)}.workspace h2,.state h2,.empty-banner h2{font:600 clamp(2rem,4vw,3.6rem)/1.06 var(--yx-font-display)}.create{margin:2rem 0 3rem}.create label{display:block;font-weight:700;margin-bottom:.6rem}.create div{display:flex;max-width:43rem;border-bottom:2px solid currentColor}.create input{flex:1;min-width:0;border:0;background:transparent;padding:.9rem .2rem;font:inherit}.create button,.state button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1.2rem;font-weight:700}.create p{color:var(--yx-color-ink-soft);min-height:1.5rem}.course-list{list-style:none;padding:0;margin:0 0 1.5rem;border-top:1px solid var(--yx-color-line)}.course-list li{display:grid;grid-template-columns:8rem 1fr auto;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--yx-color-line);align-items:baseline}.course-list span,.course-list small{color:var(--yx-color-ink-soft)}.workspace__rail{border-left:1px solid var(--yx-color-line);padding-left:2rem}.workspace__rail>a{display:grid;gap:.2rem;padding:1.2rem 0;border-bottom:1px solid var(--yx-color-line);text-decoration:none;color:inherit}.workspace__rail strong{font:600 1.5rem var(--yx-font-display)}.workspace__rail span{color:var(--yx-color-ink-soft)}.text-link,.state a{display:inline-flex;margin-top:1rem;color:var(--yx-color-wine);font-weight:700}.state{min-height:25rem;display:grid;align-content:center;justify-items:start;max-width:50rem}.state[data-kind=permission]{border-left:4px solid var(--yx-color-gold);padding-left:2rem}.empty-banner{margin-top:4rem;padding:2rem 0;border-block:1px solid var(--yx-color-line)}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:55rem){.teacher__mast{grid-template-columns:1fr}.teacher__mast>p:last-child{grid-column:1;grid-row:auto}.pulse{grid-template-columns:1fr 1fr}.workspace{grid-template-columns:1fr}.workspace__rail{border-left:0;border-top:1px solid var(--yx-color-line);padding:2rem 0 0}}@media(max-width:32rem){.pulse{grid-template-columns:1fr}.pulse div{border-right:0}.pulse div+div{padding-left:0}.course-list li{grid-template-columns:1fr}.create div{align-items:stretch}.create button{flex:0 0 auto}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>