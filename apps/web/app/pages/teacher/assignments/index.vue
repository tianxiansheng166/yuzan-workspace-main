<script setup lang="ts">
import { describeLiveFailure, type AssignmentSummary } from "~/features/live-core/gateway";

useSeoMeta({ title: "作业｜教师工作台" });
const gateway = useLiveCoreGateway();
const state = ref<"loading"|"ready"|"empty"|"error">("loading");
const assignments = ref<AssignmentSummary[]>([]);
const schoolName = ref("");
const failure = ref<ReturnType<typeof describeLiveFailure>|null>(null);
const writingId = ref("");
const message = ref("");
function date(value:string){return new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
async function load(){state.value='loading';try{const result=await gateway.listAssignments();assignments.value=result.items;schoolName.value=result.context.schoolName;state.value=result.items.length?'ready':'empty'}catch(error){failure.value=describeLiveFailure(error);state.value='error'}}
async function transition(item:AssignmentSummary,action:'open'|'close'){if(writingId.value)return;writingId.value=item.id;message.value='';try{const updated=await gateway.transitionAssignment(item,action);const index=assignments.value.findIndex(v=>v.id===item.id);if(index>=0)assignments.value[index]={...assignments.value[index]!,status:updated.status as AssignmentSummary['status'],revision:updated.revision,updatedAt:updated.updatedAt};message.value=`“${updated.title}”已由服务器${action==='open'?'开放':'关闭'}。`}catch(error){message.value=describeLiveFailure(error).message}finally{writingId.value=''}}
await load();
</script>

<template>
  <section class="assignments yx-shell" aria-labelledby="assignment-title">
    <header><div><p class="yx-kicker">ASSIGNMENTS · {{ schoolName || '实时学校范围' }}</p><h1 id="assignment-title">下发之前看清范围，<br>变更之后等待确认。</h1></div><nav><NuxtLink to="/teacher">工作台</NuxtLink><NuxtLink to="/teacher/assignments/new">创建真实作业</NuxtLink></nav></header>
    <section v-if="state==='loading'" class="state" aria-live="polite"><h2>正在读取任务……</h2></section>
    <section v-else-if="state==='error'" class="state" role="alert"><p class="yx-kicker">{{ failure?.code || failure?.kind }}</p><h2>{{ failure?.message }}</h2><button type="button" @click="load">重试</button></section>
    <section v-else class="ledger" aria-labelledby="ledger-title"><div class="ledger__meta"><p class="yx-kicker">SERVER LEDGER</p><h2 id="ledger-title">{{ assignments.length }} 项任务</h2><p>状态和修订号均来自后端；按钮不会先行乐观成功。</p></div><div class="ledger__list"><p v-if="state==='empty'" class="empty">当前学校没有作业。这里没有示例任务。</p><article v-for="(item,index) in assignments" :key="item.id"><b>{{ String(index+1).padStart(2,'0') }}</b><div><p>{{ item.status }} · revision {{ item.revision }}</p><h3>{{ item.title }}</h3><small>{{ date(item.startsAt) }} → {{ date(item.dueAt) }}</small></div><div class="actions"><NuxtLink :to="`/teacher/assignments/${item.id}`">详情</NuxtLink><button v-if="item.status==='DRAFT'||item.status==='SCHEDULED'" type="button" :disabled="!!writingId" @click="transition(item,'open')">{{ writingId===item.id?'请求中…':'真实开放' }}</button><button v-if="item.status==='OPEN'" type="button" :disabled="!!writingId" @click="transition(item,'close')">{{ writingId===item.id?'请求中…':'真实关闭' }}</button></div></article><p class="message" aria-live="polite">{{ message || '所有写操作等待服务器响应。' }}</p></div></section>
  </section>
</template>

<style scoped>
.assignments{padding-block:clamp(3rem,7vw,7rem)}.assignments>header{display:flex;justify-content:space-between;align-items:end;gap:2rem;padding-bottom:2rem;border-bottom:2px solid currentColor}.assignments h1{max-width:17ch;margin:.5rem 0;font:600 clamp(2.8rem,7vw,6.4rem)/.92 var(--yx-font-display)}.assignments header nav{display:flex;gap:1rem;flex-wrap:wrap}.assignments header a{color:var(--yx-color-wine);font-weight:700}.state{min-height:25rem;display:grid;align-content:center;justify-items:start}.state h2{font:600 clamp(2rem,4vw,3.5rem) var(--yx-font-display)}.state button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1rem}.ledger{display:grid;grid-template-columns:minmax(13rem,.55fr) minmax(0,1.45fr);gap:clamp(2rem,6vw,6rem);padding-top:4rem}.ledger__meta h2{font:600 clamp(2rem,4vw,3.7rem) var(--yx-font-display)}.ledger__meta p:last-child{line-height:1.7;color:var(--yx-color-ink-soft)}.ledger__list{border-top:1px solid var(--yx-color-line)}article{display:grid;grid-template-columns:3rem 1fr auto;gap:1rem;align-items:center;padding:1.3rem 0;border-bottom:1px solid var(--yx-color-line)}article>b{font:600 1.4rem var(--yx-font-display);color:var(--yx-color-gold)}article p,article h3,article small{margin:.2rem 0}article p,article small{color:var(--yx-color-ink-soft)}article h3{font:600 1.65rem var(--yx-font-display)}.actions{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;justify-content:end}.actions button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.7rem .9rem;font-weight:700}.actions a{color:var(--yx-color-wine);font-weight:700}.message,.empty{padding:1.2rem 0;color:var(--yx-color-ink-soft)}a:focus-visible,button:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:52rem){.assignments>header{align-items:start;flex-direction:column}.ledger{grid-template-columns:1fr}article{grid-template-columns:2.5rem 1fr}.actions{grid-column:2;justify-content:start}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>