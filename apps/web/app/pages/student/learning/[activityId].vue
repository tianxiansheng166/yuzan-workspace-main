<script setup lang="ts">
import { describeLiveFailure, type Feedback, type LearningActivity, type Submission } from "~/features/live-core/gateway";

const route = useRoute();
const assignmentId = computed(() => String(route.params.activityId));
useSeoMeta({ title: "学习活动｜语赞心声" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const activities = ref<LearningActivity[]>([]);
const selectedId = ref("");
const schoolName = ref("");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const writeState = ref<"idle" | "writing" | "success" | "error">("idle");
const writeMessage = ref("");
const submission = ref<Submission | null>(null);
const feedback = ref<Feedback[]>([]);
const active = computed(() => activities.value.find((item) => item.activityId === selectedId.value) ?? activities.value[0]);
const enrollmentId = computed(() => active.value?.progress?.enrollmentId ?? activities.value.find((item) => item.progress?.enrollmentId)?.progress?.enrollmentId);

async function load() {
  state.value = "loading";
  try {
    const result = await gateway.getLearningTask(assignmentId.value);
    activities.value = result.items;
    schoolName.value = result.context.schoolName;
    selectedId.value = result.items[0]?.activityId ?? "";
    state.value = result.items.length ? "ready" : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}

async function completeActivity() {
  if (!active.value?.progress || writeState.value === "writing") return;
  writeState.value = "writing";
  writeMessage.value = "";
  try {
    const saved = await gateway.updateProgress(active.value.activityId, {
      enrollmentId: active.value.progress.enrollmentId,
      position: Math.max(active.value.progress.position, 1),
      completed: true,
      expectedRevision: active.value.progress.revision,
    });
    active.value.progress = saved;
    writeState.value = "success";
    writeMessage.value = "完成状态已由服务器确认。";
  } catch (error) {
    writeState.value = "error";
    writeMessage.value = describeLiveFailure(error).message;
  }
}

async function submitAssignment() {
  if (!enrollmentId.value || writeState.value === "writing") return;
  writeState.value = "writing";
  writeMessage.value = "";
  try {
    const key = globalThis.crypto?.randomUUID?.() ?? `${assignmentId.value}-${Date.now()}`;
    submission.value = await gateway.createAndSubmit(assignmentId.value, enrollmentId.value, key);
    writeState.value = "success";
    writeMessage.value = `第 ${submission.value.attemptNo} 次提交已由服务器接收。`;
  } catch (error) {
    writeState.value = "error";
    writeMessage.value = describeLiveFailure(error).message;
  }
}

async function refreshFeedback() {
  if (!submission.value) return;
  try {
    feedback.value = await gateway.getFeedback(submission.value.id);
    writeMessage.value = feedback.value.length ? "已重新读取教师反馈。" : "服务器尚未发布反馈。";
  } catch (error) {
    writeMessage.value = describeLiveFailure(error).message;
  }
}

await load();
</script>

<template>
  <section class="learning yx-shell" aria-labelledby="learning-title">
    <header class="learning__head"><div><p class="yx-kicker">LIVE LEARNING · {{ schoolName || '学校活动' }}</p><h1 id="learning-title">完成一项，确认一项。</h1></div><NuxtLink to="/student/today">返回今日学习</NuxtLink></header>

    <section v-if="state === 'loading'" class="state" aria-live="polite"><h2>正在读取任务活动……</h2></section>
    <section v-else-if="state === 'error'" class="state" role="alert"><p class="yx-kicker">{{ failure?.code || failure?.kind }}</p><h2>{{ failure?.message }}</h2><NuxtLink v-if="failure?.kind === 'unauthenticated'" :to="`/login?redirect=${route.fullPath}`">重新登录</NuxtLink><NuxtLink v-else-if="failure?.kind === 'permission'" to="/select-school">切换学校</NuxtLink><button v-else type="button" @click="load">重试</button></section>
    <section v-else-if="state === 'empty'" class="state"><p class="yx-kicker">REAL EMPTY</p><h2>这个任务当前没有可学习活动。</h2><p>页面不会补入演示材料或伪造活动。</p></section>

    <section v-else-if="active" class="learning__body">
      <nav aria-label="任务活动" class="steps"><p class="yx-kicker">ACTIVITIES</p><button v-for="(item,index) in activities" :key="item.activityId" type="button" :aria-current="item.activityId === active.activityId ? 'step' : undefined" @click="selectedId=item.activityId"><b>{{ String(index+1).padStart(2,'0') }}</b><span>{{ item.title }}</span><small>{{ item.progress?.completed ? '服务器已完成' : item.type }}</small></button></nav>

      <article class="activity">
        <p class="yx-kicker">{{ active.type }} · {{ active.required ? '必做' : '选做' }}</p>
        <h2>{{ active.title }}</h2>
        <p class="instruction">{{ active.instruction || '服务端没有返回活动说明。' }}</p>
        <dl><div><dt>当前位置</dt><dd>{{ active.progress?.position ?? '尚无记录' }}</dd></div><div><dt>同步状态</dt><dd>{{ active.progress?.completed ? '已完成' : active.progress ? '进行中' : '没有进度上下文' }}</dd></div><div><dt>修订号</dt><dd>{{ active.progress?.revision ?? '—' }}</dd></div></dl>

        <div v-if="active.progress" class="actions"><button type="button" :disabled="writeState === 'writing' || active.progress.completed" @click="completeActivity">{{ active.progress.completed ? '服务器已确认完成' : writeState === 'writing' ? '正在写入…' : '完成并真实上报' }}</button><button type="button" :disabled="writeState === 'writing'" @click="submitAssignment">提交本次作业</button></div>
        <aside v-else class="gap" role="status"><strong>首次进度写入暂不可用</strong><p>当前读取接口没有返回本人的 enrollmentId，后端也没有面向学生的 enrollment context 端点。为避免写到错误学生，页面按 fail-closed 处理。</p></aside>

        <p class="write-message" :data-state="writeState" aria-live="polite">{{ writeMessage || '写操作只在收到后端响应后显示成功。' }}</p>

        <section v-if="submission" class="receipt"><p class="yx-kicker">SUBMISSION RECEIPT</p><h3>{{ submission.status }} · 第 {{ submission.attemptNo }} 次</h3><code>{{ submission.id }}</code><button type="button" @click="refreshFeedback">重新读取反馈</button><ul v-if="feedback.length"><li v-for="item in feedback" :key="item.id"><strong>{{ item.decision }}</strong><p>{{ item.comment }}</p></li></ul></section>
      </article>
    </section>
  </section>
</template>

<style scoped>
.learning{padding-block:clamp(2rem,5vw,5rem)}.learning__head{display:flex;justify-content:space-between;align-items:end;gap:2rem;padding-bottom:1.5rem;border-bottom:2px solid currentColor}.learning__head h1{max-width:15ch;margin:.4rem 0;font:600 clamp(2.6rem,6vw,5.5rem)/.95 var(--yx-font-display)}.learning__head>a{font-weight:700;color:var(--yx-color-wine)}.state{min-height:30rem;display:grid;align-content:center;justify-items:start;max-width:48rem}.state h2{font:600 clamp(2rem,5vw,4rem)/1.05 var(--yx-font-display)}.state button,.state a{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1rem;text-decoration:none}.learning__body{display:grid;grid-template-columns:minmax(15rem,.55fr) minmax(0,1.45fr);gap:clamp(2rem,6vw,7rem);padding-top:4rem}.steps{border-right:1px solid var(--yx-color-line);padding-right:2rem}.steps button{width:100%;display:grid;grid-template-columns:3rem 1fr;text-align:left;gap:.2rem 1rem;padding:1rem 0;border:0;border-bottom:1px solid var(--yx-color-line);background:transparent;color:inherit}.steps button b{grid-row:1/3;color:var(--yx-color-gold);font:600 1.4rem var(--yx-font-display)}.steps button small{color:var(--yx-color-ink-soft)}.steps button[aria-current=step]{border-bottom-color:var(--yx-color-sage-strong)}.steps button[aria-current=step] span{font-weight:800}.activity h2{max-width:16ch;margin:.5rem 0;font:600 clamp(2.5rem,6vw,5.5rem)/.95 var(--yx-font-display)}.instruction{max-width:50rem;font-size:1.1rem;line-height:1.8;color:var(--yx-color-ink-soft);white-space:pre-wrap}.activity dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:3rem 0}.activity dl div{border-top:1px solid var(--yx-color-line);padding-top:.7rem}.activity dt{font-weight:700}.activity dd{margin:.3rem 0;color:var(--yx-color-ink-soft)}.actions{display:flex;flex-wrap:wrap;gap:1rem}.actions button,.receipt button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.9rem 1.1rem;font-weight:700}.actions button+button{background:var(--yx-color-wine)}button:disabled{opacity:.55}.gap{max-width:48rem;padding:1.2rem 0;border-block:1px solid var(--yx-color-gold)}.gap strong{font:600 1.4rem var(--yx-font-display)}.gap p{line-height:1.7;color:var(--yx-color-ink-soft)}.write-message{min-height:1.5rem;color:var(--yx-color-ink-soft)}.write-message[data-state=success]{color:var(--yx-color-sage-strong);font-weight:700}.write-message[data-state=error]{color:var(--yx-color-wine);font-weight:700}.receipt{margin-top:3rem;padding:2rem 0;border-top:2px solid currentColor}.receipt h3{font:600 1.8rem var(--yx-font-display)}.receipt code{display:block;margin-bottom:1rem;overflow-wrap:anywhere}.receipt ul{list-style:none;padding:0}.receipt li{border-top:1px solid var(--yx-color-line);padding-top:1rem}a:focus-visible,button:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:50rem){.learning__body{grid-template-columns:1fr}.steps{border-right:0;border-bottom:1px solid var(--yx-color-line);padding:0 0 2rem}.activity dl{grid-template-columns:1fr}.learning__head{align-items:start;flex-direction:column}.steps button{grid-template-columns:2.5rem 1fr}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>