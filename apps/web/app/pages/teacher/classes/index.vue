<script setup lang="ts">
import { describeLiveFailure, type ClassSummary } from "~/features/live-core/gateway";

useSeoMeta({ title: "班级｜教师工作台" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const classes = ref<ClassSummary[]>([]);
const context = ref<Awaited<ReturnType<typeof gateway.context>> | null>(null);
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const form = reactive({ name: "", grade: "", termId: "" });
const writing = ref(false);
const writeMessage = ref("");
const canCreate = computed(() => context.value?.role === "SCHOOL_ADMIN" || context.value?.role === "PLATFORM_ADMIN");

async function load() {
  state.value = "loading";
  try {
    const result = await gateway.listClasses();
    classes.value = result.items;
    context.value = result.context;
    state.value = classes.value.length ? "ready" : "empty";
  } catch (error) { failure.value = describeLiveFailure(error); state.value = "error"; }
}
async function createClass() {
  if (!canCreate.value || writing.value) return;
  writing.value = true; writeMessage.value = "";
  try {
    const created = await gateway.createClass({ ...form });
    writeMessage.value = `班级“${created.name}”已由服务器创建。`;
    form.name = ""; form.grade = ""; form.termId = "";
    await load();
  } catch (error) { writeMessage.value = describeLiveFailure(error).message; }
  finally { writing.value = false; }
}
await load();
</script>

<template>
  <section class="classes yx-shell" aria-labelledby="classes-title">
    <header><div><p class="yx-kicker">SCHOOL ROSTER · {{ context?.schoolName || '实时学校范围' }}</p><h1 id="classes-title">班级不是数字，<br>是教学发生的边界。</h1></div><NuxtLink to="/teacher">返回工作台</NuxtLink></header>
    <section v-if="state==='loading'" class="state" aria-live="polite"><h2>正在读取班级……</h2></section>
    <section v-else-if="state==='error'" class="state" role="alert"><p class="yx-kicker">{{ failure?.code || failure?.kind }}</p><h2>{{ failure?.message }}</h2><button type="button" @click="load">重试</button></section>
    <template v-else>
      <section class="index"><div><p class="yx-kicker">VISIBLE CLASSES</p><strong>{{ classes.length }}</strong><span>个服务器可见班级</span></div><ol v-if="classes.length"><li v-for="(item,index) in classes" :key="item.id"><b>{{ String(index+1).padStart(2,'0') }}</b><div><h2>{{ item.name }}</h2><p>{{ item.grade }} · {{ item.studentCount }} 名已登记学生</p></div><NuxtLink :to="`/teacher/classes/${item.id}`">查看范围</NuxtLink></li></ol><div v-else class="empty"><h2>当前学校还没有班级。</h2><p>这是真实空状态，没有填入示例学生或人数。</p></div></section>
      <section class="create" aria-labelledby="create-class-title"><p class="yx-kicker">SERVER WRITE</p><h2 id="create-class-title">创建班级</h2><form v-if="canCreate" @submit.prevent="createClass"><label>班级名称<input v-model="form.name" required></label><label>年级<input v-model="form.grade" required></label><label>真实学期 ID<input v-model="form.termId" required pattern="[0-9a-fA-F-]{36}" aria-describedby="term-help"></label><p id="term-help">当前后端要求已有 termId；页面不会代填固定学期。</p><button :disabled="writing" type="submit">{{ writing ? '正在创建…' : '提交到后端' }}</button></form><div v-else class="permission"><strong>当前角色不可创建班级</strong><p>后端仅允许学校管理员或平台管理员写入。教师仍可读取自己负责的班级。</p></div><p aria-live="polite">{{ writeMessage }}</p></section>
    </template>
  </section>
</template>

<style scoped>
.classes{padding-block:clamp(3rem,7vw,7rem)}.classes>header{display:flex;justify-content:space-between;align-items:end;gap:2rem;padding-bottom:2rem;border-bottom:2px solid currentColor}.classes h1{max-width:16ch;margin:.5rem 0;font:600 clamp(2.8rem,7vw,6.5rem)/.92 var(--yx-font-display)}.classes>header a{color:var(--yx-color-wine);font-weight:700}.state{min-height:24rem;display:grid;align-content:center;justify-items:start}.state h2,.create h2,.empty h2{font:600 clamp(2rem,4vw,3.5rem) var(--yx-font-display)}.state button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.8rem 1rem}.index{display:grid;grid-template-columns:13rem 1fr;gap:clamp(2rem,6vw,6rem);padding:4rem 0}.index>div:first-child{display:grid;align-content:start}.index>div:first-child strong{font:600 6rem/.9 var(--yx-font-display);color:var(--yx-color-sage-strong)}.index>div:first-child span{color:var(--yx-color-ink-soft)}.index ol{list-style:none;padding:0;margin:0;border-top:1px solid var(--yx-color-line)}.index li{display:grid;grid-template-columns:3rem 1fr auto;gap:1rem;align-items:center;padding:1.2rem 0;border-bottom:1px solid var(--yx-color-line)}.index li>b{color:var(--yx-color-gold);font:600 1.3rem var(--yx-font-display)}.index li h2{margin:0;font:600 1.6rem var(--yx-font-display)}.index li p{margin:.3rem 0;color:var(--yx-color-ink-soft)}.index li a{color:var(--yx-color-wine);font-weight:700}.create{display:grid;grid-template-columns:minmax(12rem,.6fr) minmax(0,1.4fr);gap:2rem;padding-top:3rem;border-top:2px solid currentColor}.create>.yx-kicker,.create>h2{grid-column:1}.create h2{margin:.4rem 0}.create form,.permission{grid-column:2;grid-row:1/5;max-width:42rem}.create label{display:grid;gap:.4rem;margin-bottom:1.2rem;font-weight:700}.create input{border:0;border-bottom:1px solid currentColor;background:transparent;padding:.8rem 0;font:inherit}.create form p,.permission p{color:var(--yx-color-ink-soft);line-height:1.7}.create button{border:0;background:var(--yx-color-sage-strong);color:#fff;padding:.9rem 1.2rem;font-weight:700}.permission{padding:1rem 0;border-block:1px solid var(--yx-color-gold)}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--yx-color-gold);outline-offset:3px}@media(max-width:48rem){.classes>header{align-items:start;flex-direction:column}.index,.create{grid-template-columns:1fr}.create form,.permission{grid-column:1;grid-row:auto}.index li{grid-template-columns:2.5rem 1fr}.index li a{grid-column:2;width:max-content}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>