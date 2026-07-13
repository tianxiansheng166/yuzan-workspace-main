<script setup lang="ts">
import { describeLiveFailure, type LearningTask } from "~/features/live-core/gateway";

useSeoMeta({ title: "今日学习｜语赞心声" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const tasks = ref<LearningTask[]>([]);
const schoolName = ref("");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);

function dueLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function load() {
  state.value = "loading";
  try {
    const result = await gateway.listLearningTasks();
    tasks.value = result.items;
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
  <section class="today yx-shell" aria-labelledby="today-title">
    <header class="intro">
      <p class="yx-kicker">TODAY · {{ schoolName || '实时学习任务' }}</p>
      <h1 id="today-title">先看清今天，<br>再走出下一步。</h1>
      <p>任务来自当前学校的学习服务。页面不会把本地动作提前标记为已同步。</p>
    </header>

    <section v-if="state === 'loading'" class="state" aria-live="polite"><p class="yx-kicker">CONNECTING</p><h2>正在读取学校任务……</h2></section>
    <section v-else-if="state === 'error'" class="state" role="alert"><p class="yx-kicker">{{ failure?.code || failure?.kind }}</p><h2>{{ failure?.message }}</h2><NuxtLink v-if="failure?.kind === 'unauthenticated'" to="/login?redirect=/student/today">重新登录</NuxtLink><NuxtLink v-else-if="failure?.kind === 'permission'" to="/select-school">选择可用学校</NuxtLink><button v-else type="button" @click="load">重试</button></section>
    <section v-else-if="state === 'empty'" class="state"><p class="yx-kicker">REAL EMPTY</p><h2>今天暂时没有下发给你的任务。</h2><p>这里没有示例任务。你仍可查看已发布课程或稍后刷新。</p><div><NuxtLink to="/student/courses">查看课程</NuxtLink><button type="button" @click="load">重新读取</button></div></section>

    <template v-else>
      <section class="next" aria-labelledby="next-title">
        <p class="yx-kicker">NEXT · {{ tasks[0]?.status }}</p>
        <div class="next__number" aria-hidden="true">01</div>
        <div>
          <h2 id="next-title">{{ tasks[0]?.title }}</h2>
          <p>{{ tasks[0]?.courseTitle || '课程标题未返回' }}</p>
          <dl><div><dt>截止时间</dt><dd>{{ dueLabel(tasks[0]!.dueAt) }}</dd></div><div><dt>服务端状态</dt><dd>{{ tasks[0]?.status }}</dd></div></dl>
          <NuxtLink :to="`/student/learning/${tasks[0]!.assignmentId}`">打开真实活动</NuxtLink>
        </div>
      </section>

      <section class="queue" aria-labelledby="queue-title">
        <header><p class="yx-kicker">LEARNING QUEUE</p><h2 id="queue-title">其余任务</h2><span>{{ Math.max(tasks.length - 1, 0) }} 项</span></header>
        <ol v-if="tasks.length > 1"><li v-for="(task,index) in tasks.slice(1)" :key="task.assignmentId"><b>{{ String(index + 2).padStart(2, '0') }}</b><div><strong>{{ task.title }}</strong><small>{{ task.courseTitle || '课程标题未返回' }} · {{ dueLabel(task.dueAt) }}</small></div><span>{{ task.status }}</span><NuxtLink :to="`/student/learning/${task.assignmentId}`">打开</NuxtLink></li></ol>
        <p v-else>没有更多任务。完成状态只在服务端确认后更新。</p>
      </section>
    </template>
    <nav class="student-entries" aria-label="学生其他入口"><NuxtLink to="/student/courses">课程</NuxtLink><NuxtLink to="/assessment">测评</NuxtLink><NuxtLink to="/assessment/history">测评历史</NuxtLink><p>尚未接通的测评能力会保留 pending / unavailable，不伪装正式学习成果。</p></nav>
  </section>
</template>

<style scoped>
.today{padding-block:clamp(3rem,8vw,7rem)}.intro{display:grid;grid-template-columns:1fr minmax(16rem,.45fr);align-items:end;gap:3rem;padding-bottom:2rem;border-bottom:2px solid var(--yx-color-ink)}.intro h1{margin:.6rem 0 0;font:600 clamp(3rem,8vw,7rem)/.9 var(--yx-font-display)}.intro>p:last-child{grid-column:2;grid-row:1/3;color:var(--yx-color-ink-soft);line-height:1.8}.state{min-height:28rem;display:grid;align-content:center;justify-items:start;max-width:48rem}.state h2,.queue h2{font:600 clamp(2rem,4vw,3.5rem) var(--yx-font-display)}.state div{display:flex;gap:1rem}.state button,.state a{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1rem;text-decoration:none}.next{position:relative;display:grid;grid-template-columns:11rem minmax(0,1fr);gap:3rem;padding:clamp(3rem,7vw,6rem) 0;border-bottom:1px solid var(--yx-color-line)}.next__number{font:600 clamp(6rem,15vw,13rem)/.72 var(--yx-font-display);color:var(--yx-color-sage-strong);opacity:.42}.next h2{max-width:18ch;margin:.5rem 0;font:600 clamp(2.4rem,5vw,5rem)/1 var(--yx-font-display)}.next p{color:var(--yx-color-ink-soft)}.next dl{display:flex;gap:3rem;margin:2rem 0}.next dl div{border-top:1px solid var(--yx-color-line);padding-top:.5rem;min-width:10rem}.next dt{font-weight:700}.next dd{margin:.25rem 0;color:var(--yx-color-ink-soft)}.next a{display:inline-flex;padding:.8rem 1.1rem;background:var(--yx-color-sage-strong);color:#fff;text-decoration:none;font-weight:700}.queue{padding-top:4rem}.student-entries{display:flex;flex-wrap:wrap;gap:1rem;margin-top:4rem;padding-top:1.5rem;border-top:1px solid var(--yx-color-line)}.student-entries p{flex-basis:100%;color:var(--yx-color-ink-soft)}.queue>header{display:grid;grid-template-columns:1fr auto;align-items:end;border-bottom:2px solid currentColor}.queue>header .yx-kicker,.queue h2{grid-column:1}.queue h2{margin:.2rem 0 1rem}.queue>header span{grid-column:2;grid-row:1/3;font:600 2rem var(--yx-font-display)}.queue ol{list-style:none;padding:0;margin:0}.queue li{display:grid;grid-template-columns:4rem 1fr 8rem auto;gap:1rem;align-items:center;padding:1.2rem 0;border-bottom:1px solid var(--yx-color-line)}.queue li b{font:600 1.5rem var(--yx-font-display);color:var(--yx-color-gold)}.queue li div{display:grid}.queue li small,.queue li>span{color:var(--yx-color-ink-soft)}a:focus-visible,button:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:48rem){.intro{grid-template-columns:1fr}.intro>p:last-child{grid-column:1;grid-row:auto}.next{grid-template-columns:1fr;gap:1rem}.next__number{font-size:5rem}.queue li{grid-template-columns:3rem 1fr}.queue li>span,.queue li>a{grid-column:2;width:max-content}.next dl{display:grid;gap:1rem}.next dl div{min-width:0}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>