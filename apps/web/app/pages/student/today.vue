<script setup lang="ts">
import StudentStatusVisual from "../../features/student-brand/StudentStatusVisual.vue";
import {
  studentActionCards,
  studentStatusCopy,
  type StudentBrandState,
} from "../../features/student-brand/student-brand-content";

type PageState = StudentBrandState;

const state = ref<PageState>("preview");
const states: PageState[] = ["preview", "loading", "empty", "offline"];

const statusContent = computed(() => studentStatusCopy(state.value));
</script>

<template>
  <section class="today yx-shell">
    <header class="today__header">
      <div>
        <p class="yx-kicker">STUDENT BRAND · TODAY</p>
        <h1>先看清今天的学习状态，再决定下一步。</h1>
        <p>
          学生今日页现在和首页共用同一套品牌层级：路径、状态、入口和待接入说明都放在同一阅读节奏里。
        </p>
      </div>
      <label class="today__state">
        <span>预览状态</span>
        <select v-model="state">
          <option v-for="item in states" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>
    </header>

    <section class="today__hero" :data-offline="state === 'offline'">
      <div class="today__summary">
        <div class="status-chip">
          <span class="status-chip__marker" aria-hidden="true" />
          <strong>{{ statusContent.title }}</strong>
        </div>
        <p>{{ statusContent.description }}</p>
        <dl class="summary-grid">
          <div>
            <dt>学习状态</dt>
            <dd>{{ state === "offline" ? "离线预览" : "页面预览" }}</dd>
          </div>
          <div>
            <dt>结果展示</dt>
            <dd>不伪装正式学习成果</dd>
          </div>
          <div>
            <dt>推荐课程</dt>
            <dd>待接入并有明确文字说明</dd>
          </div>
        </dl>
      </div>
      <StudentStatusVisual :state="state" />
    </section>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      <p class="yx-kicker">LOADING</p>
      <h2>正在读取今日学习入口……</h2>
      <p>加载态保留明确文字，不用空白区域代替状态说明。</p>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">EMPTY</p>
      <h2>今天暂时没有新的学习任务。</h2>
      <p>你可以等待老师布置任务，或稍后回来查看新的测评与推荐课程入口。</p>
    </div>

    <template v-else>
      <nav class="today__support-links" aria-label="学生快捷入口">
        <NuxtLink to="/assessment">首测</NuxtLink>
        <NuxtLink to="/assessment">复测</NuxtLink>
        <NuxtLink to="/student/today">推荐课程</NuxtLink>
      </nav>

      <section class="action-section" aria-labelledby="student-actions-title">
        <div class="section-head">
          <div>
            <p class="yx-kicker">STUDENT ACTIONS</p>
            <h2 id="student-actions-title">
              首测、复测和推荐课程共用同一组视觉规则。
            </h2>
          </div>
          <p>
            每个入口都带有状态标签和说明文字；即使不看颜色，也能读懂是否可进入、用于对比，还是仍待接入。
          </p>
        </div>

        <div class="action-grid">
          <article
            v-for="card in studentActionCards"
            :key="card.id"
            class="action-card"
            :class="`action-card--${card.emphasis}`"
          >
            <p class="yx-kicker">{{ card.eyebrow }}</p>
            <div class="action-card__top">
              <h3>{{ card.title }}</h3>
              <span class="action-card__status">{{ card.statusLabel }}</span>
            </div>
            <p>{{ card.detail }}</p>
            <p class="action-card__note">{{ card.availabilityNote }}</p>
            <NuxtLink class="action-card__link" :to="card.to">
              {{ card.title }}
            </NuxtLink>
          </article>
        </div>
      </section>

      <section class="support-panel">
        <div>
          <p class="yx-kicker">STATE NOTE</p>
          <h2>待接入状态会直接说清楚，不会用“即将上线”代替真实说明。</h2>
        </div>
        <ul>
          <li>
            首测与复测入口已可进入测评页，但结果解释仍以 demo
            与真实流程区分为前提。
          </li>
          <li>
            推荐课程保留入口位置，但明确标注“待接入”，不伪造课程包或学习记录。
          </li>
          <li>离线预览只承诺“联网后同步”，不制造“已上传”的假象。</li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.today {
  display: grid;
  gap: 1.5rem;
  padding-block: clamp(3rem, 7vw, 6rem);
}

.today__header,
.today__hero,
.section-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem 2rem;
}

.today__header {
  align-items: end;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
}

h1,
h2,
h3 {
  margin: 0.8rem 0;
  font-family: var(--yx-font-display);
}

h1 {
  max-width: 12ch;
  font-size: clamp(2.4rem, 6vw, 5.4rem);
  line-height: 0.98;
}

h2 {
  font-size: clamp(1.7rem, 3vw, 2.5rem);
  line-height: 1.08;
}

.today__header p,
.today__summary p,
.section-head p,
.action-card p,
.support-panel li,
.state-message p {
  color: var(--yx-color-ink-soft);
  line-height: 1.75;
}

.today__state {
  display: grid;
  gap: 0.4rem;
  font-size: var(--yx-text-sm);
}

select {
  min-height: 2.75rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  padding-inline: 0.8rem;
}

.today__hero {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.95fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
  padding: clamp(1.35rem, 4vw, 2rem);
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background:
    radial-gradient(circle at top right, #f3dfc4 0%, transparent 22%),
    linear-gradient(150deg, #fffefb 0%, #f4eadf 52%, #edf1e8 100%);
  box-shadow: var(--yx-shadow-100);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.4rem;
  padding: 0.55rem 0.85rem;
  border-radius: var(--yx-radius-pill);
  background: color-mix(in srgb, white 74%, var(--yx-color-paper));
}

.status-chip__marker {
  width: 0.8rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-sage-strong);
}

.today__hero[data-offline="true"] .status-chip__marker {
  background: var(--yx-color-gold);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.summary-grid div,
.action-card,
.support-panel {
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-raised);
}

.summary-grid div {
  padding: 0.95rem;
}

dt {
  margin-bottom: 0.3rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}

dd {
  margin: 0;
}

.action-section {
  display: grid;
  gap: 1.25rem;
}

.today__support-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.2rem;
}

.today__support-links a {
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
  text-decoration: none;
}

.today__support-links a:hover {
  color: var(--yx-color-wine);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.action-card {
  display: grid;
  gap: 0.8rem;
  min-height: 18rem;
  padding: 1.2rem;
  box-shadow: var(--yx-shadow-100);
}

.action-card--primary {
  background:
    linear-gradient(145deg, #fff8ef 0%, #f2e0d2 56%, #edf2e9 100%),
    var(--yx-surface-raised);
}

.action-card--secondary {
  background: color-mix(in srgb, white 84%, var(--yx-color-sage));
}

.action-card--muted {
  background: color-mix(in srgb, white 92%, var(--yx-color-paper));
}

.action-card__top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.action-card__status {
  display: inline-flex;
  min-height: 1.9rem;
  align-items: center;
  padding-inline: 0.7rem;
  border-radius: var(--yx-radius-pill);
  border: 1px solid color-mix(in srgb, var(--yx-color-ink) 12%, transparent);
  background: color-mix(in srgb, white 74%, transparent);
  font-size: var(--yx-text-sm);
}

.action-card__note {
  margin-top: auto;
}

.action-card__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.8rem;
  text-decoration: none;
  font-weight: 600;
}

.support-panel {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 1.5rem 2rem;
  padding: 1.3rem;
}

.support-panel ul {
  margin: 0;
  padding-left: 1rem;
}

.state-message {
  min-height: 20rem;
  display: grid;
  align-content: center;
  padding: 1.5rem;
  border-radius: var(--yx-radius-xl);
  background: color-mix(in srgb, white 84%, var(--yx-color-paper));
}

@media (max-width: 64rem) {
  .today__hero,
  .support-panel,
  .action-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .today__header,
  .section-head {
    grid-template-columns: 1fr;
  }
}
</style>
