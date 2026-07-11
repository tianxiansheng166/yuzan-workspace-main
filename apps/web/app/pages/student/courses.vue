<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createWaitingStudentCoursesAdapter } from "~/features/student-courses/core-adapter";
import { ensureOfflineGlobalStatus } from "~/features/offline/runtime/global-status";
useSeoMeta({ title: "我的课程｜语赞心声" });
const result = ref<Awaited<ReturnType<ReturnType<typeof createWaitingStudentCoursesAdapter>["listCourses"]>> | null>(null);
const network = ref("unknown");
onMounted(async()=>{ network.value=ensureOfflineGlobalStatus(window).network; result.value=await createWaitingStudentCoursesAdapter().listCourses(); });
</script>
<template>
  <main class="courses yx-shell">
    <header><p class="yx-kicker">MY LEARNING TRAIL · 我的课程</p><h1>沿着自己的节奏，<br><span>继续向前。</span></h1><p>这里只展示服务端确认的可选与已加入课程，不提供未经验证的推荐。</p></header>
    <div class="trail"><span aria-hidden="true">01</span><section aria-labelledby="enrolled"><p>ENROLLED</p><h2 id="enrolled">已加入课程</h2><div v-if="!result" class="course-state" role="status">正在读取课程与离线状态…</div><div v-else-if="result.status === 'WAITING_BACKEND'" class="course-state"><strong>课程服务尚未接通</strong><p>{{ result.message }}</p><code>WAITING_BACKEND · learning</code></div><p v-else-if="!result.data.filter(c=>c.enrollment==='enrolled').length" class="course-state">还没有已加入课程。</p><ol v-else><li v-for="course in result.data.filter(c=>c.enrollment==='enrolled')" :key="course.id"><h3>{{course.title}}</h3><progress :value="course.progress" max="100"/><NuxtLink v-if="course.activityId" :to="`/student/learning/${course.activityId}`">{{course.progress ? '继续学习':'开始学习'}}</NuxtLink></li></ol></section></div>
    <div class="trail"><span aria-hidden="true">02</span><section><p>AVAILABLE</p><h2>可选课程</h2><p class="course-state">推荐能力不可用时，不会用排序或文案伪装推荐结果。</p></section></div>
    <footer><strong>{{ network === 'offline' ? '当前离线' : '当前在线' }}</strong><p>离线下载必须显示未下载、下载中、已下载或需更新；后端未返回状态前不提供假下载按钮。</p><NuxtLink to="/student/today">返回今日学习</NuxtLink></footer>
  </main>
</template>
<style scoped>
.courses{padding-block:clamp(3rem,8vw,7rem);color:#34352d}.courses header{max-width:58rem;margin-bottom:5rem}.courses h1{font:600 clamp(3rem,8vw,7rem)/.92 var(--yx-font-display);margin:.8rem 0}.courses h1 span{color:#58705a}.courses header>p:last-child{max-width:42rem;line-height:1.8;color:#696b61}.trail{position:relative;display:grid;grid-template-columns:5rem 1fr;gap:clamp(1rem,4vw,4rem);max-width:65rem}.trail>span{display:grid;place-items:center;width:3.5rem;height:3.5rem;border:2px solid #a57a2e;border-radius:50%;background:#f7f2e8;font-weight:800}.trail:after{content:"";position:absolute;left:1.7rem;top:3.5rem;bottom:0;border-left:1px solid #a57a2e}.trail section{padding-bottom:4rem}.trail h2{font:600 clamp(2rem,5vw,4rem) var(--yx-font-display);margin:.2rem 0 1rem;border-bottom:2px solid #34352d}.course-state{padding:1.5rem 0;line-height:1.7;border-bottom:1px solid #c7bda9}.course-state strong{font:600 1.5rem var(--yx-font-display)}code{background:#e3d7b7;padding:.3rem .5rem}.courses ol{padding:0;list-style:none}.courses li{display:grid;grid-template-columns:1fr 12rem auto;align-items:center;gap:1rem;border-bottom:1px solid #c7bda9}.courses footer{max-width:60rem;margin-left:9rem;padding:1.5rem;border-left:4px solid #58705a;background:#ece5d6}.courses footer p{line-height:1.6}@media(max-width:48rem){.trail{grid-template-columns:3rem 1fr}.trail>span{width:2.5rem;height:2.5rem}.trail:after{left:1.2rem;top:2.5rem}.courses footer{margin-left:0}.courses li{grid-template-columns:1fr}}
</style>
