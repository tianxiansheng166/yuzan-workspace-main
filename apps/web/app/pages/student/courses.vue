<script setup lang="ts">
import { describeLiveFailure } from "~/features/live-core/gateway";
import type { CourseVersionSummary } from "~/lib/api/types";

useSeoMeta({ title: "我的课程｜语赞心声" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const courses = ref<CourseVersionSummary[]>([]);
const schoolName = ref("");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);

async function load() {
  state.value = "loading";
  try {
    const result = await gateway.listCourses();
    courses.value = result.items;
    schoolName.value = result.context.schoolName;
    state.value = result.items.length ? "ready" : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}
await load();
</script>

<template>
  <section class="courses yx-shell" aria-labelledby="course-title">
    <header>
      <p class="yx-kicker">MY LEARNING TRAIL · {{ schoolName || '学校课程' }}</p>
      <h1 id="course-title">沿着自己的节奏，<br><span>继续向前。</span></h1>
      <p>这里只展示当前学校服务端返回的已发布课程；没有未经验证的推荐或加入状态。</p>
    </header>

    <section v-if="state === 'loading'" class="course-state" aria-live="polite"><strong>正在读取课程……</strong></section>
    <section v-else-if="state === 'error'" class="course-state" role="alert">
      <code>{{ failure?.code || failure?.kind }}</code><strong>{{ failure?.message }}</strong>
      <NuxtLink v-if="failure?.kind === 'unauthenticated'" to="/login?redirect=/student/courses">重新登录</NuxtLink>
      <NuxtLink v-else-if="failure?.kind === 'permission'" to="/select-school">切换学校</NuxtLink>
      <button v-else type="button" @click="load">重试</button>
    </section>

    <div v-else class="trail">
      <span aria-hidden="true">01</span>
      <section aria-labelledby="published">
        <p>PUBLISHED</p><h2 id="published">已发布课程</h2>
        <p v-if="state === 'empty'" class="course-state">当前学校还没有向学生发布课程。这是真实空状态。</p>
        <ol v-else>
          <li v-for="course in courses" :key="course.id">
            <div><small>{{ course.gradeBand || '全年级' }} · v{{ course.version }}</small><h3>{{ course.title }}</h3></div>
            <span>{{ course.status }}</span>
            <NuxtLink to="/student/today">查看相关任务</NuxtLink>
          </li>
        </ol>
      </section>
    </div>

    <div class="trail trail--muted">
      <span aria-hidden="true">02</span>
      <section><p>RECOMMENDATION</p><h2>推荐保持安静</h2><p class="course-state">推荐服务尚未提供真实结果，因此这里不排序、不补写理由，也不显示虚构进度。</p></section>
    </div>

    <footer><strong>下一站：今日学习</strong><p>从真实作业进入活动后，完成状态才会由服务器确认。</p><NuxtLink to="/student/today">查看今日任务</NuxtLink></footer>
  </section>
</template>

<style scoped>
.courses{padding-block:clamp(3rem,8vw,7rem);color:var(--yx-color-ink)}.courses header{max-width:58rem;margin-bottom:5rem}.courses h1{font:600 clamp(3rem,8vw,7rem)/.92 var(--yx-font-display);margin:.8rem 0}.courses h1 span{color:var(--yx-color-sage-strong)}.courses header>p:last-child{max-width:42rem;line-height:1.8;color:var(--yx-color-ink-soft)}.trail{position:relative;display:grid;grid-template-columns:5rem 1fr;gap:clamp(1rem,4vw,4rem);max-width:65rem}.trail>span{display:grid;place-items:center;width:3.5rem;height:3.5rem;border:2px solid var(--yx-color-gold);border-radius:50%;background:var(--yx-color-paper);font-weight:800}.trail:after{content:"";position:absolute;left:1.7rem;top:3.5rem;bottom:0;border-left:1px solid var(--yx-color-gold)}.trail section{padding-bottom:4rem}.trail h2{font:600 clamp(2rem,5vw,4rem) var(--yx-font-display);margin:.2rem 0 1rem;border-bottom:2px solid currentColor}.trail--muted{opacity:.76}.course-state{display:grid;gap:.7rem;padding:1.5rem 0;line-height:1.7;border-bottom:1px solid var(--yx-color-line);max-width:56rem}.course-state strong{font:600 1.5rem var(--yx-font-display)}.course-state code{width:max-content;background:#e3d7b7;padding:.3rem .5rem}.course-state button{width:max-content;border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.7rem 1rem}.courses ol{padding:0;list-style:none}.courses li{display:grid;grid-template-columns:1fr 8rem auto;align-items:center;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--yx-color-line)}.courses h3{margin:.25rem 0;font:600 1.45rem var(--yx-font-display)}.courses small,.courses li>span{color:var(--yx-color-ink-soft)}.courses footer{max-width:60rem;margin-left:9rem;padding:1.5rem;border-left:4px solid var(--yx-color-sage-strong);background:var(--yx-color-paper)}.courses footer p{line-height:1.6}a:focus-visible,button:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:48rem){.trail{grid-template-columns:3rem 1fr}.trail>span{width:2.5rem;height:2.5rem}.trail:after{left:1.2rem;top:2.5rem}.courses footer{margin-left:0}.courses li{grid-template-columns:1fr}.courses li>a{width:max-content}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>