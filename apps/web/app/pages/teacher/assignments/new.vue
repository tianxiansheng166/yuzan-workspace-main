<script setup lang="ts">
import { describeLiveFailure, type ClassSummary } from "~/features/live-core/gateway";
import type { CourseVersionSummary } from "~/lib/api/types";

useSeoMeta({ title: "创建作业｜教师工作台" });
const gateway=useLiveCoreGateway();
const state=ref<'loading'|'ready'|'error'>('loading');
const courses=ref<CourseVersionSummary[]>([]);const classes=ref<ClassSummary[]>([]);const failure=ref<ReturnType<typeof describeLiveFailure>|null>(null);
const form=reactive({title:'',courseVersionId:'',classId:'',startsAt:'',dueAt:'',offlineRequired:false});
const writing=ref(false);const message=ref('');const createdId=ref('');
async function load(){state.value='loading';try{const [courseResult,classResult]=await Promise.all([gateway.listCourses(),gateway.listClasses()]);courses.value=courseResult.items;classes.value=classResult.items;state.value='ready'}catch(error){failure.value=describeLiveFailure(error);state.value='error'}}
async function submit(){if(writing.value)return;writing.value=true;message.value='';createdId.value='';try{const created=await gateway.createAssignment({title:form.title.trim(),courseVersionId:form.courseVersionId,classId:form.classId,startsAt:new Date(form.startsAt).toISOString(),dueAt:new Date(form.dueAt).toISOString(),offlineRequired:form.offlineRequired});createdId.value=created.id;message.value=`作业“${created.title}”已由服务器创建为 ${created.status}。`}catch(error){message.value=describeLiveFailure(error).message}finally{writing.value=false}}
await load();
</script>

<template>
  <section class="builder yx-shell" aria-labelledby="builder-title">
    <header><p class="yx-kicker">ASSIGNMENT BUILDER · SERVER WRITE</p><h1 id="builder-title">用真实课程和班级，<br>下发一项可追踪的任务。</h1><NuxtLink to="/teacher/assignments">返回任务列表</NuxtLink></header>
    <section v-if="state==='loading'" class="state" aria-live="polite"><h2>正在读取课程与班级……</h2></section>
    <section v-else-if="state==='error'" class="state" role="alert"><p class="yx-kicker">{{failure?.code||failure?.kind}}</p><h2>{{failure?.message}}</h2><button type="button" @click="load">重试</button></section>
    <section v-else-if="!courses.length||!classes.length" class="state"><p class="yx-kicker">DEPENDENCY GAP</p><h2>还不能创建作业。</h2><p>需要至少一个真实课程版本和一个真实班级。页面不会代填 demo 选项。</p><div><NuxtLink v-if="!courses.length" to="/teacher">先创建课程</NuxtLink><NuxtLink v-if="!classes.length" to="/teacher/classes">查看班级</NuxtLink></div></section>
    <form v-else class="form" @submit.prevent="submit">
      <div class="form__intro"><p class="yx-kicker">01 · SCOPE</p><h2>先确定教学范围</h2><p>提交会写入当前学校。开始和截止时间将转换为 ISO 时间发送。</p></div>
      <div class="form__fields">
        <label>任务名称<input v-model="form.title" required maxlength="160"></label>
        <label>课程版本<select v-model="form.courseVersionId" required><option value="" disabled>请选择真实课程</option><option v-for="item in courses" :key="item.id" :value="item.id">{{item.title}} · {{item.status}}</option></select></label>
        <label>目标班级<select v-model="form.classId" required><option value="" disabled>请选择真实班级</option><option v-for="item in classes" :key="item.id" :value="item.id">{{item.name}} · {{item.grade}}</option></select></label>
        <div class="dates"><label>开始时间<input v-model="form.startsAt" type="datetime-local" required></label><label>截止时间<input v-model="form.dueAt" type="datetime-local" required></label></div>
        <label class="check"><input v-model="form.offlineRequired" type="checkbox">要求离线包</label>
        <button type="submit" :disabled="writing">{{writing?'正在等待服务器…':'创建真实草稿'}}</button>
        <p class="message" aria-live="polite">{{message||'不会在请求完成前显示成功。'}}</p>
        <NuxtLink v-if="createdId" :to="`/teacher/assignments/${createdId}`">查看服务器返回的任务</NuxtLink>
      </div>
    </form>
  </section>
</template>

<style scoped>
.builder{padding-block:clamp(3rem,7vw,7rem)}.builder>header{position:relative;padding-bottom:2rem;border-bottom:2px solid currentColor}.builder h1{max-width:18ch;margin:.5rem 0;font:600 clamp(2.8rem,7vw,6.3rem)/.92 var(--yx-font-display)}.builder>header>a{position:absolute;right:0;bottom:2rem;color:var(--yx-color-wine);font-weight:700}.state{min-height:26rem;display:grid;align-content:center;justify-items:start;max-width:50rem}.state h2,.form h2{font:600 clamp(2rem,4vw,3.7rem) var(--yx-font-display)}.state p{line-height:1.7;color:var(--yx-color-ink-soft)}.state div{display:flex;gap:1rem}.state a,.state button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1rem;text-decoration:none}.form{display:grid;grid-template-columns:minmax(14rem,.65fr) minmax(0,1.35fr);gap:clamp(2rem,7vw,7rem);padding-top:4rem}.form__intro p:last-child{line-height:1.7;color:var(--yx-color-ink-soft)}.form__fields{max-width:50rem}.form__fields>label,.dates label{display:grid;gap:.45rem;margin-bottom:1.3rem;font-weight:700}.form input,.form select{width:100%;border:0;border-bottom:1px solid currentColor;background:transparent;padding:.85rem .1rem;font:inherit;color:inherit}.dates{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}.form .check{display:flex;align-items:center;gap:.7rem}.form .check input{width:auto}.form button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.9rem 1.2rem;font-weight:700}.message{min-height:1.5rem;color:var(--yx-color-ink-soft)}.form__fields>a{color:var(--yx-color-wine);font-weight:700}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:48rem){.builder>header>a{position:static}.form{grid-template-columns:1fr}.dates{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>