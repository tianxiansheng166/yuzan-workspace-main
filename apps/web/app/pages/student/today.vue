<script setup lang="ts">
type PageState = "preview" | "loading" | "empty" | "offline";
const state = ref<PageState>("preview");
const states: PageState[] = ["preview", "loading", "empty", "offline"];
</script>

<template>
  <section class="today yx-shell">
    <header class="today__header">
      <div>
        <p class="yx-kicker">学生端 · 设计与状态预览</p>
        <h1>今天，先完成一件重要的事。</h1>
        <p>
          真实任务将在 LRN-001/LRN-002 接入 OpenAPI；此页不伪造数据库完成情况。
        </p>
      </div>
      <label>
        <span>预览状态</span>
        <select v-model="state">
          <option v-for="item in states" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      正在读取今日任务……
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">TODAY IS CLEAR</p>
      <h2>今天暂时没有新任务。</h2>
      <p>你可以继续上次的课程，或者等待老师布置新的学习任务。</p>
    </div>

    <div v-else class="journey" :data-offline="state === 'offline'">
      <div class="journey__status">
        <span class="dot" />
        {{
          state === "offline"
            ? "离线预览：完成内容会在联网后同步"
            : "设计预览：尚未连接真实任务 API"
        }}
      </div>
      <article class="journey__focus">
        <p class="yx-kicker">NEXT STEP</p>
        <h2>任务标题将来自发布后的课程版本</h2>
        <p>
          页面的视觉重心是下一步，而不是四张统计卡。完成规则、下载大小、截止时间和同步状态会在这里清楚说明。
        </p>
        <div class="route-line" aria-hidden="true">
          <span class="is-done" />
          <span class="is-current" />
          <span />
          <span />
        </div>
        <button type="button" disabled>等待真实 API 接入</button>
      </article>
      <aside class="journey__aside">
        <h3>系统状态</h3>
        <dl>
          <div>
            <dt>内容包</dt>
            <dd>未接入</dd>
          </div>
          <div>
            <dt>学习记录</dt>
            <dd>未接入</dd>
          </div>
          <div>
            <dt>同步</dt>
            <dd>{{ state === "offline" ? "等待网络" : "开发预览" }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.today {
  padding-block: clamp(3rem, 7vw, 7rem);
}
.today__header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: end;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
}
.today h1 {
  max-width: 15ch;
  margin: 0.8rem 0;
  font: 600 clamp(2.2rem, 6vw, 5.2rem)/1 var(--yx-font-display);
}
.today__header p {
  max-width: 46rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: var(--yx-text-sm);
}
select {
  min-height: 2.75rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-sm);
  background: var(--yx-color-surface);
  padding-inline: 0.75rem;
}
.journey {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.6fr);
  gap: clamp(2rem, 7vw, 7rem);
  padding-top: clamp(2rem, 6vw, 5rem);
}
.journey__status {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.65rem;
  align-items: center;
  color: var(--yx-color-ink-soft);
}
.dot {
  width: 0.65rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-sage-strong);
}
.journey[data-offline="true"] .dot {
  background: var(--yx-color-gold);
}
.journey__focus h2 {
  max-width: 15ch;
  font: 600 var(--yx-text-xl)/1.15 var(--yx-font-display);
}
.journey__focus p {
  max-width: 42rem;
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}
.route-line {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin: 3rem 0;
  position: relative;
}
.route-line::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--yx-color-ink-soft);
}
.route-line span {
  position: relative;
  width: 1.1rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-paper);
  border: 2px solid var(--yx-color-ink-soft);
}
.route-line .is-done {
  background: var(--yx-color-sage-strong);
  border-color: var(--yx-color-sage-strong);
}
.route-line .is-current {
  background: var(--yx-color-wine);
  border-color: var(--yx-color-wine);
  transform: scale(1.25);
}
button {
  min-height: 3rem;
  padding-inline: 1.2rem;
  border: 0;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-wine);
  color: white;
  opacity: 0.6;
}
.journey__aside {
  border-left: 1px solid var(--yx-color-line);
  padding-left: 2rem;
}
.journey__aside h3 {
  font-family: var(--yx-font-display);
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 1rem;
  border-top: 1px solid var(--yx-color-line);
}
dd {
  color: var(--yx-color-ink-soft);
}
.state-message {
  min-height: 24rem;
  display: grid;
  align-content: center;
  max-width: 42rem;
}
@media (max-width: 48rem) {
  .today__header,
  .journey {
    grid-template-columns: 1fr;
  }
  .journey__status {
    grid-column: auto;
  }
  .journey__aside {
    border-left: 0;
    border-top: 1px solid var(--yx-color-line);
    padding: 2rem 0 0;
  }
}
</style>
