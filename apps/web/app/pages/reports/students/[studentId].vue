<script setup lang="ts">
import {
  describeLiveFailure,
  type StudentGrowthProfile,
} from "~/features/live-core/gateway";

const route = useRoute();
const gateway = useLiveCoreGateway();
const profile = ref<StudentGrowthProfile | null>(null);
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const source = computed(() => {
  const value =
    typeof route.query.from === "string" ? route.query.from : "/reports";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/reports";
});

useSeoMeta({ title: "学生成长报告｜语赞心声" });

async function load() {
  state.value = "loading";
  try {
    profile.value = (
      await gateway.getStudentGrowth(String(route.params.studentId))
    ).item;
    state.value = Object.keys(profile.value.data ?? {}).length
      ? "ready"
      : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}

await load();
</script>

<template>
  <article class="growth yx-shell">
    <nav aria-label="成长报告面包屑">
      <NuxtLink :to="source">返回来源</NuxtLink><span>/</span
      ><NuxtLink to="/reports">报告列表</NuxtLink>
    </nav>
    <section v-if="state === 'loading'" class="state">
      <h1>正在读取学生成长档案……</h1>
    </section>
    <section v-else-if="state === 'error'" class="state" role="alert">
      <p class="yx-kicker">{{ failure?.code || failure?.kind }}</p>
      <h1>{{ failure?.message }}</h1>
      <p>请返回来源页面选择当前学校真实可见的学生报告。</p>
      <div>
        <NuxtLink :to="source">返回来源</NuxtLink
        ><button type="button" @click="load">重试</button>
      </div>
    </section>
    <template v-else-if="profile">
      <header>
        <div>
          <p class="yx-kicker">STUDENT GROWTH · LIVE</p>
          <h1>学生成长档案</h1>
          <p>登记标识 {{ profile.enrollmentId }}</p>
        </div>
        <strong
          >{{ Math.round(profile.dataCompleteness * 100) }}%<small
            >数据完整度</small
          ></strong
        >
      </header>
      <section v-if="state === 'empty'" class="state">
        <h2>该学生当前没有可呈现的成长证据。</h2>
        <p>这是服务端真实空状态，没有使用演示趋势或分数。</p>
        <NuxtLink :to="source">返回来源</NuxtLink>
      </section>
      <template v-else
        ><dl>
          <div>
            <dt>统计周期</dt>
            <dd>{{ profile.periodStart }} → {{ profile.periodEnd }}</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{{ profile.generatedAt }}</dd>
          </div>
          <div>
            <dt>提供方披露</dt>
            <dd>{{ profile.providerDisclosure || "未配置" }}</dd>
          </div>
        </dl>
        <section class="evidence">
          <h2>可追溯成长数据</h2>
          <pre>{{ JSON.stringify(profile.data, null, 2) }}</pre>
        </section></template
      >
    </template>
  </article>
</template>

<style scoped>
.growth {
  padding-block: clamp(2rem, 6vw, 6rem);
}
nav {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
nav a,
.state a {
  color: var(--yx-color-wine);
  font-weight: 700;
}
header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: end;
  padding-block: 2rem;
  border-block: 2px solid currentColor;
}
h1 {
  margin: 0.5rem 0;
  font: 600 clamp(2.5rem, 7vw, 6rem)/0.92 var(--yx-font-display);
}
header > strong {
  font: 600 clamp(2.5rem, 7vw, 5rem) var(--yx-font-display);
}
header > strong small {
  display: block;
  font: 400 0.8rem var(--yx-font-body);
  color: var(--yx-color-ink-soft);
}
dl {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  margin: 0;
  border-bottom: 1px solid var(--yx-color-line);
}
dl div {
  padding: 1.5rem;
  border-right: 1px solid var(--yx-color-line);
}
dd {
  margin: 0.4rem 0 0;
}
.evidence {
  padding-top: 3rem;
}
.evidence h2,
.state h2 {
  font: 600 clamp(1.8rem, 4vw, 3rem) var(--yx-font-display);
}
pre {
  overflow: auto;
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  background: var(--yx-color-paper);
  white-space: pre-wrap;
}
.state {
  min-height: 25rem;
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
    grid-template-columns: 1fr;
  }
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
