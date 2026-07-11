<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createWaitingTeacherCoreAdapter, WAITING_BACKEND } from "~/features/teacher/core-adapter";
import { ensureOfflineGlobalStatus } from "~/features/offline/runtime/global-status";

useSeoMeta({ title: "教师工作台｜语赞心声" });
const adapter = createWaitingTeacherCoreAdapter();
const loading = ref(true);
const assignments = ref<Awaited<ReturnType<typeof adapter.listAssignments>> | null>(null);
const submissions = ref<Awaited<ReturnType<typeof adapter.listSubmissions>> | null>(null);
const network = ref("unknown");
const unavailable = computed(() => assignments.value?.status === WAITING_BACKEND);
const unavailableMessage = computed(() => assignments.value?.status === WAITING_BACKEND ? assignments.value.message : "");
onMounted(async () => {
  network.value = ensureOfflineGlobalStatus(window).network;
  [assignments.value, submissions.value] = await Promise.all([adapter.listAssignments(), adapter.listSubmissions()]);
  loading.value = false;
});
</script>

<template>
  <main class="teacher-core">
    <header class="teacher-core__mast yx-shell">
      <div><p class="yx-kicker">TEACHING FIELD NOTES · 教学工作台</p><h1>把今天的教学，<br><em>接回完整闭环。</em></h1></div>
      <dl><div><dt>学校范围</dt><dd>由服务端会话确认</dd></div><div><dt>网络</dt><dd>{{ network === 'offline' ? '离线 · 等待同步' : '在线' }}</dd></div></dl>
    </header>

    <div class="teacher-core__body yx-shell" :aria-busy="loading">
      <nav aria-label="教师核心任务"><NuxtLink to="/studio">课程草稿 <span>进入编辑</span></NuxtLink><NuxtLink to="/teacher/assignments">作业管理 <span>查看既有入口</span></NuxtLink><NuxtLink to="/teacher/review">提交复核 <span>查看既有入口</span></NuxtLink></nav>
      <section aria-labelledby="loop-title">
        <div class="section-head"><div><p>01 / TEACHING LOOP</p><h2 id="loop-title">作业与反馈</h2></div><span v-if="unavailable" class="state">WAITING_BACKEND</span></div>
        <div v-if="loading" class="notice" role="status">正在确认教学服务状态…</div>
        <div v-else-if="unavailable" class="notice" role="status"><strong>教学闭环接口等待后端契约</strong><p>{{ unavailableMessage }}</p><p>当前不生成演示作业、提交或反馈；课程草稿、离线提示与未保存离开保护仍可使用。</p></div>
        <div v-else-if="assignments?.status === 'ready' && !assignments.data.length" class="notice"><strong>还没有作业</strong><p>创建第一份作业后，状态会按草稿、计划、进行中、已结束呈现。</p></div>
        <ol v-else-if="assignments?.status === 'ready'" class="assignment-list"><li v-for="item in assignments.data" :key="item.id"><span>{{ item.state }}</span><strong>{{ item.title }}</strong></li></ol>
      </section>
      <aside><p>02 / SYNC DESK</p><h2>离线与同步</h2><p v-if="network === 'offline'">当前离线。可继续处理本地草稿；写操作应进入 outbox，恢复网络后再由服务端确认。</p><p v-else>连接正常。只有服务端确认的写操作才会显示成功。</p><NuxtLink to="/studio">检查课程草稿</NuxtLink></aside>
    </div>
  </main>
</template>

<style scoped>
.teacher-core{min-height:calc(100svh - 5rem);background:#f4efe4;color:#392f27}.teacher-core__mast{display:grid;grid-template-columns:1.6fr .7fr;gap:4rem;padding-block:clamp(4rem,9vw,8rem);border-bottom:1px solid #b9aa90;background:radial-gradient(circle at 80% 20%,rgba(184,139,58,.15),transparent 30%)}h1{margin:.7rem 0 0;font:600 clamp(3rem,7vw,7rem)/.93 var(--yx-font-display)}h1 em{color:#7a332b;font-style:normal}.teacher-core__mast dl{align-self:end;margin:0;border-top:2px solid #4e7058}.teacher-core__mast dl div{display:flex;justify-content:space-between;padding:.8rem 0;border-bottom:1px solid #b9aa90}.teacher-core__mast dd{margin:0;font-weight:700}.teacher-core__body{display:grid;grid-template-columns:.65fr 1.5fr .7fr;gap:clamp(1.5rem,4vw,4rem);padding-block:4rem}.teacher-core nav{display:grid;align-content:start}.teacher-core nav a{display:flex;justify-content:space-between;padding:1rem 0;border-bottom:1px solid #b9aa90;color:inherit;text-decoration:none}.teacher-core nav span{font-size:.78rem;color:#74685d}.section-head{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #392f27}.section-head h2,aside h2{font:600 clamp(2rem,4vw,3.5rem)/1 var(--yx-font-display);margin:.3rem 0 1rem}.state{padding:.35rem .55rem;background:#dccb9d;font:700 .7rem monospace}.notice{margin-top:2rem;padding:2rem 0;border-bottom:1px solid #b9aa90;line-height:1.7}.notice strong{font:600 1.4rem var(--yx-font-display)}aside{padding-left:1.25rem;border-left:1px solid #b9aa90}aside p{line-height:1.7}aside a{color:#7a332b}.assignment-list{padding:0;list-style:none}.assignment-list li{display:grid;grid-template-columns:7rem 1fr;padding:1rem 0;border-bottom:1px solid #b9aa90}@media(max-width:60rem){.teacher-core__body{grid-template-columns:1fr 1.6fr}.teacher-core__body aside{grid-column:1/-1}}@media(max-width:48rem){.teacher-core__mast,.teacher-core__body{grid-template-columns:1fr;gap:2rem}.teacher-core__mast{padding-block:3rem}.teacher-core__body{padding-block:2rem}aside{grid-column:auto!important}}
</style>
