<script setup lang="ts">
import { describeLiveFailure } from "~/features/live-core/gateway";
import type { ToolsOverview } from "~/features/entry-live/gateway";
useSeoMeta({ title: "教师工具｜语赞心声" });
const gateway = useEntryLiveGateway();
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const overview = ref<ToolsOverview | null>(null);
const failure = ref<ReturnType<typeof describeLiveFailure> | null>(null);
const graphTitle = ref("");
const sourceText = ref("");
const writing = ref<"graph" | "translation" | "">("");
const message = ref("");
async function load() {
  state.value = "loading";
  try {
    overview.value = await gateway.toolsOverview();
    state.value =
      overview.value.integrations.length ||
      overview.value.jobs.length ||
      overview.value.translations.length
        ? "ready"
        : "empty";
  } catch (error) {
    failure.value = describeLiveFailure(error);
    state.value = "error";
  }
}
async function createGraph() {
  if (!graphTitle.value.trim() || writing.value) return;
  writing.value = "graph";
  message.value = "";
  try {
    const job = await gateway.createMindGraphJob({
      title: graphTitle.value.trim(),
    });
    message.value = `MindGraph 任务 ${job.id} 已由服务器创建，当前状态 ${job.status}。`;
    graphTitle.value = "";
    await load();
  } catch (error) {
    message.value = describeLiveFailure(error).message;
  } finally {
    writing.value = "";
  }
}
async function translate() {
  if (!sourceText.value.trim() || writing.value) return;
  writing.value = "translation";
  message.value = "";
  try {
    const job = await gateway.createTranslation({
      sourceLanguage: "zh-CN",
      targetLanguage: "bo-CN",
      sourceText: sourceText.value.trim(),
    });
    message.value = `翻译任务 ${job.id} 已由服务器创建，当前状态 ${job.status}。`;
    sourceText.value = "";
    await load();
  } catch (error) {
    message.value = describeLiveFailure(error).message;
  } finally {
    writing.value = "";
  }
}
async function audit(item: { key: string; publicUrl: string | null }) {
  try {
    await gateway.auditToolClick(
      item.key,
      "OPEN_PUBLIC_URL",
      item.publicUrl || undefined,
    );
    message.value = `${item.key} 点击已审计。`;
  } catch (error) {
    message.value = describeLiveFailure(error).message;
  }
}
await load();
</script>
<template>
  <section class="tools" aria-labelledby="tools-title">
    <header class="tools__hero">
      <div class="yx-shell">
        <p class="yx-kicker">TEACHER TOOLS · AUDITABLE</p>
        <h1 id="tools-title">工具可以聪明，<br />结果必须可追溯。</h1>
        <p v-if="overview">
          {{ overview.context.schoolName }} · {{ overview.context.role }}
        </p>
      </div>
    </header>
    <div class="yx-shell tools__body">
      <nav class="tool-entries" aria-label="教师工具入口">
        <NuxtLink to="/teacher-tools/mindmate">
          <strong>MindMate</strong><span>进入助教工具</span>
        </NuxtLink>
        <NuxtLink to="/teacher-tools/mindgraph">
          <strong>MindGraph</strong><span>进入知识图谱工具</span>
        </NuxtLink>
        <NuxtLink to="/tools/tibetan-translation">
          <strong>藏汉翻译</strong><span>进入翻译工作台</span>
        </NuxtLink>
      </nav>
      <section v-if="state === 'loading'" class="state" aria-live="polite">
        <h2>正在读取工具、任务与术语表……</h2>
      </section>
      <section v-else-if="state === 'error'" class="state" role="alert">
        <p class="yx-kicker">{{ failure?.code || failure?.kind }}</p>
        <h2>{{ failure?.message }}</h2>
        <NuxtLink
          v-if="failure?.kind === 'unauthenticated'"
          to="/login?redirect=/teacher-tools"
          >重新登录</NuxtLink
        ><NuxtLink
          v-else-if="failure?.kind === 'permission'"
          to="/select-school"
          >切换学校</NuxtLink
        ><button v-else @click="load">重试</button>
      </section>
      <template v-else-if="overview"
        ><section class="status-line">
          <p>
            <strong>{{ overview.integrations.length }}</strong> 个集成配置
          </p>
          <p>
            <strong>{{ overview.jobs.length }}</strong> 个 MindGraph 任务
          </p>
          <p>
            <strong>{{ overview.translations.length }}</strong> 个翻译任务
          </p>
          <p>
            <strong>{{ overview.glossaryCount }}</strong> 条术语
          </p>
        </section>
        <section class="integrations">
          <p class="yx-kicker">01 · PROVIDER TRUTH</p>
          <h2>集成状态</h2>
          <p v-if="!overview.integrations.length">
            没有工具配置；页面不会默认启用提供方。
          </p>
          <ol>
            <li v-for="item in overview.integrations" :key="item.id">
              <div>
                <strong>{{ item.key }}</strong
                ><small
                  >{{ item.mode }} ·
                  {{ item.enabled ? "enabled" : "disabled" }}</small
                >
              </div>
              <span>{{ item.status }}</span
              ><button v-if="item.publicUrl" type="button" @click="audit(item)">
                记录访问
              </button>
            </li>
          </ol>
        </section>
        <section class="workbench">
          <form @submit.prevent="createGraph">
            <p class="yx-kicker">02 · MINDGRAPH</p>
            <h2>创建可审计任务</h2>
            <label
              >主题<input
                v-model="graphTitle"
                required
                maxlength="160" /></label
            ><button :disabled="!!writing" type="submit">
              {{ writing === "graph" ? "正在请求…" : "提交真实任务" }}
            </button>
            <ol>
              <li v-for="job in overview.jobs" :key="job.id">
                <strong>{{ job.status }}</strong
                ><code>{{ job.id }}</code
                ><small>{{ job.errorCode || "no error code" }}</small>
              </li>
            </ol>
          </form>
          <form @submit.prevent="translate">
            <p class="yx-kicker">03 · TRANSLATION</p>
            <h2>创建翻译任务</h2>
            <label
              >中文原文<textarea
                v-model="sourceText"
                required
                rows="4"
              ></textarea></label
            ><button :disabled="!!writing" type="submit">
              {{ writing === "translation" ? "正在请求…" : "提交真实任务" }}
            </button>
            <ol>
              <li v-for="job in overview.translations" :key="job.id">
                <strong>{{ job.status }}</strong
                ><code>{{ job.id }}</code>
              </li>
            </ol>
          </form>
        </section>
        <p class="message" aria-live="polite">
          {{
            message ||
            "PROVIDER_NOT_CONFIGURED 或 UNAVAILABLE 会原样显示，不会生成假结果。"
          }}
        </p></template
      >
    </div>
  </section>
</template>
<style scoped>
.tool-entries {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 3rem;
  border-block: 2px solid currentColor;
}
.tool-entries a {
  display: grid;
  gap: 0.35rem;
  padding: 1.25rem;
  border-right: 1px solid var(--yx-color-line);
  color: inherit;
  text-decoration: none;
}
.tool-entries span {
  color: var(--yx-color-ink-soft);
}
.tools__hero {
  min-height: clamp(23rem, 44vw, 37rem);
  display: grid;
  align-items: end;
  color: #fff;
  background:
    linear-gradient(90deg, rgba(22, 31, 26, 0.9), rgba(22, 31, 26, 0.15)),
    url("/art/initial-product-002/tools-header-landscape.png") center/cover;
}
.tools__hero > div {
  width: 100%;
  padding-block: 3.5rem;
}
.tools h1 {
  max-width: 15ch;
  margin: 0.5rem 0;
  font: 600 clamp(3rem, 8vw, 7rem)/0.9 var(--yx-font-display);
}
.tools__body {
  padding-block: clamp(3rem, 7vw, 7rem);
}
.state {
  min-height: 25rem;
  display: grid;
  align-content: center;
  justify-items: start;
}
.state h2,
.integrations h2,
.workbench h2 {
  font: 600 clamp(2rem, 4vw, 3.5rem) var(--yx-font-display);
}
.state button,
.state a {
  border: 0;
  background: var(--yx-color-sage-strong);
  color: #fff;
  padding: 0.8rem 1rem;
  text-decoration: none;
}
.status-line {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 2px solid currentColor;
}
.status-line p {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  padding: 1rem 0;
  border-right: 1px solid var(--yx-color-line);
}
.status-line p + p {
  padding-left: 1rem;
}
.status-line strong {
  font: 600 2.3rem var(--yx-font-display);
}
.integrations {
  padding: 4rem 0;
}
.integrations ol,
.workbench ol {
  list-style: none;
  padding: 0;
}
.integrations li {
  display: grid;
  grid-template-columns: 1fr 12rem auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--yx-color-line);
}
.integrations li div {
  display: grid;
}
.integrations small {
  color: var(--yx-color-ink-soft);
}
.integrations button,
.workbench button {
  border: 0;
  background: var(--yx-color-sage-strong);
  color: #fff;
  padding: 0.75rem 1rem;
  font-weight: 700;
}
.workbench {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 6vw, 6rem);
  padding-top: 3rem;
  border-top: 2px solid currentColor;
}
.workbench form + form {
  border-left: 1px solid var(--yx-color-line);
  padding-left: 3rem;
}
.workbench label {
  display: grid;
  gap: 0.5rem;
  font-weight: 700;
}
.workbench input,
.workbench textarea {
  border: 0;
  border-bottom: 1px solid currentColor;
  background: transparent;
  padding: 0.8rem 0;
  font: inherit;
  color: inherit;
}
.workbench ol {
  margin-top: 2rem;
}
.workbench li {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--yx-color-line);
}
.workbench code {
  overflow-wrap: anywhere;
}
.workbench small,
.message {
  color: var(--yx-color-ink-soft);
}
.message {
  padding: 1rem 0;
  border-bottom: 1px solid var(--yx-color-gold);
}
a:focus-visible,
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--yx-color-gold);
  outline-offset: 3px;
}
@media (max-width: 52rem) {
  .tool-entries {
    grid-template-columns: 1fr;
  }
  .workbench {
    grid-template-columns: 1fr;
  }
  .workbench form + form {
    border-left: 0;
    border-top: 1px solid var(--yx-color-line);
    padding: 2rem 0 0;
  }
  .status-line {
    grid-template-columns: 1fr 1fr;
  }
  .integrations li {
    grid-template-columns: 1fr;
  }
  .tools__hero {
    min-height: 32rem;
    background-position: 62% center;
  }
}
@media (max-width: 32rem) {
  .status-line {
    grid-template-columns: 1fr;
  }
  .status-line p {
    border-right: 0;
  }
  .status-line p + p {
    padding-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
