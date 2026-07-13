<script setup lang="ts">
import {
  describeLiveFailure,
  type ReportDetail,
} from "~/features/live-core/gateway";

const route = useRoute();
const gateway = useLiveCoreGateway();
const report = ref<ReportDetail | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);

useSeoMeta({ title: "报告详情｜语赞心声" });

async function load() {
  state.value = "loading";
  failure.value = null;
  try {
    report.value = (
      await gateway.getReport(String(route.params.reportId))
    ).item;
    state.value = "ready";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}

await load();
</script>

<template>
  <article class="report-detail yx-shell">
    <nav aria-label="报告面包屑">
      <NuxtLink to="/teacher">教师工作台</NuxtLink><span>/</span
      ><NuxtLink to="/reports">报告</NuxtLink>
    </nav>
    <section v-if="state === 'loading'" class="state">
      <h1>正在读取报告详情……</h1>
    </section>
    <section v-else-if="state === 'error'" class="state" role="alert">
      <p class="yx-kicker">{{ failure?.code || failure?.kind }}</p>
      <h1>{{ failure?.message }}</h1>
      <p>报告不存在、不可见或暂不可用时，不会显示替代数据。</p>
      <div>
        <NuxtLink to="/reports">返回报告列表</NuxtLink
        ><button type="button" @click="load">重试</button>
      </div>
    </section>
    <template v-else-if="report">
      <header>
        <div>
          <p class="yx-kicker">{{ report.type }} · {{ report.status }}</p>
          <h1>报告 {{ report.id }}</h1>
          <p>{{ report.periodStart }} → {{ report.periodEnd }}</p>
        </div>
        <NuxtLink
          v-if="report.enrollmentId"
          :to="`/reports/students/${report.enrollmentId}?from=/reports/${report.id}`"
          >进入学生成长档案</NuxtLink
        >
      </header>
      <dl>
        <div>
          <dt>数据完整度</dt>
          <dd>{{ Math.round((report.dataCompleteness || 0) * 100) }}%</dd>
        </div>
        <div>
          <dt>生成时间</dt>
          <dd>{{ report.generatedAt || "尚未生成" }}</dd>
        </div>
        <div>
          <dt>提供方披露</dt>
          <dd>{{ report.providerDisclosure || "未配置" }}</dd>
        </div>
        <div>
          <dt>修订</dt>
          <dd>{{ report.revision || 1 }}</dd>
        </div>
      </dl>
      <section class="evidence">
        <h2>服务器报告数据</h2>
        <p v-if="!report.data">
          该报告当前没有已生成数据。请返回列表查看状态。
        </p>
        <pre v-else>{{ JSON.stringify(report.data, null, 2) }}</pre>
      </section>
    </template>
  </article>
</template>

<style scoped>
.report-detail {
  padding-block: clamp(2rem, 6vw, 6rem);
}
nav {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
nav a,
header > a,
.state a {
  color: var(--yx-color-wine);
  font-weight: 700;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  align-items: end;
  padding-block: 2rem;
  border-block: 2px solid currentColor;
}
h1 {
  margin: 0.5rem 0;
  font: 600 clamp(2.2rem, 6vw, 5.5rem)/0.96 var(--yx-font-display);
  overflow-wrap: anywhere;
}
dl {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  border-bottom: 1px solid var(--yx-color-line);
}
dl div {
  padding: 1.5rem;
  border-right: 1px solid var(--yx-color-line);
}
dt {
  color: var(--yx-color-ink-soft);
}
dd {
  margin: 0.5rem 0 0;
  font-weight: 700;
}
.evidence {
  padding-top: 3rem;
}
.evidence h2 {
  font: 600 clamp(1.8rem, 4vw, 3rem) var(--yx-font-display);
}
pre {
  max-width: 100%;
  overflow: auto;
  padding: 1.25rem;
  background: var(--yx-color-paper);
  border: 1px solid var(--yx-color-line);
  white-space: pre-wrap;
}
.state {
  min-height: 26rem;
  display: grid;
  align-content: center;
  justify-items: start;
}
.state div {
  display: flex;
  gap: 1rem;
}
.state button {
  border: 0;
  background: var(--yx-color-sage-strong);
  color: #fff;
  padding: 0.8rem 1rem;
}
@media (max-width: 48rem) {
  header {
    align-items: start;
    flex-direction: column;
  }
  dl {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 28rem) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
