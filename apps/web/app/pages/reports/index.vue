<script setup lang="ts">
import {
  describeLiveFailure,
  type ReportSummary,
} from "~/features/live-core/gateway";
useSeoMeta({ title: "教学报告｜语赞心声" });
const gateway = useLiveCoreGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const reports = ref<ReportSummary[]>([]);
const school = ref("");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
async function load() {
  state.value = "loading";
  try {
    const result = await gateway.listReports();
    reports.value = result.items;
    school.value = result.context.schoolName;
    state.value = result.items.length ? "ready" : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}
await load();
</script>
<template>
  <section class="reports yx-shell" aria-labelledby="reports-title">
    <header>
      <div>
        <p class="yx-kicker">REPORTING · {{ school || "学校范围" }}</p>
        <h1 id="reports-title">只呈现已经生成的<br />真实报告记录。</h1>
      </div>
      <NuxtLink to="/teacher">返回教师工作台</NuxtLink>
    </header>
    <section v-if="state === 'loading'" class="state">
      <h2>正在读取报告……</h2>
    </section>
    <section v-else-if="state === 'error'" class="state" role="alert">
      <p class="yx-kicker">{{ failure?.code || failure?.kind }}</p>
      <h2>{{ failure?.message }}</h2>
      <div>
        <NuxtLink v-if="failure?.kind === 'permission'" to="/teacher"
          >返回教师工作台</NuxtLink
        ><button v-else @click="load">重试</button>
      </div>
    </section>
    <section v-else-if="state === 'empty'" class="state">
      <p class="yx-kicker">REAL EMPTY</p>
      <h2>当前学校还没有报告。</h2>
      <p>页面没有展示演示趋势、分数或成长结论。</p>
      <NuxtLink to="/teacher">返回教师工作台</NuxtLink>
    </section>
    <ol v-else>
      <li v-for="(item, index) in reports" :key="item.id">
        <b>{{ String(index + 1).padStart(2, "0") }}</b>
        <div>
          <p>{{ item.type }} · {{ item.status }}</p>
          <h2>{{ item.id }}</h2>
          <small>{{ item.periodStart }} → {{ item.periodEnd }}</small>
        </div>
        <div>
          <NuxtLink :to="`/reports/${item.id}`">读取详情</NuxtLink
          ><NuxtLink
            v-if="item.enrollmentId"
            :to="`/reports/students/${item.enrollmentId}?from=/reports`"
            >学生成长档案</NuxtLink
          >
        </div>
      </li>
    </ol>
  </section>
</template>
<style scoped>
.reports {
  padding-block: clamp(3rem, 7vw, 7rem);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid currentColor;
}
h1 {
  max-width: 16ch;
  margin: 0.5rem 0;
  font: 600 clamp(2.8rem, 7vw, 6.3rem)/0.92 var(--yx-font-display);
}
header a,
ol a {
  color: var(--yx-color-wine);
  font-weight: 700;
}
.state {
  min-height: 27rem;
  display: grid;
  align-content: center;
  justify-items: start;
}
.state h2 {
  font: 600 clamp(2rem, 4vw, 3.7rem) var(--yx-font-display);
}
.state button {
  border: 0;
  background: var(--yx-color-sage-strong);
  color: #fff;
  padding: 0.8rem 1rem;
}
ol {
  list-style: none;
  padding: 3rem 0 0;
  margin: 0;
}
li {
  display: grid;
  grid-template-columns: 4rem 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1.4rem 0;
  border-bottom: 1px solid var(--yx-color-line);
}
li > b {
  font: 600 1.5rem var(--yx-font-display);
  color: var(--yx-color-gold);
}
li p,
li h2,
li small {
  margin: 0.25rem 0;
}
li p,
li small {
  color: var(--yx-color-ink-soft);
}
li h2 {
  font: 600 1.4rem var(--yx-font-display);
  overflow-wrap: anywhere;
}
a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--yx-color-gold);
  outline-offset: 3px;
}
@media (max-width: 42rem) {
  header {
    align-items: start;
    flex-direction: column;
  }
  li {
    grid-template-columns: 2.5rem 1fr;
  }
  li a {
    grid-column: 2;
    width: max-content;
  }
}
</style>
