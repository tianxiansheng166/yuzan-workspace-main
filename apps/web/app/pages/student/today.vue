<script setup lang="ts">
import TodayPath from "~/features/today/components/TodayPath.vue";
import V3TerrainArtwork from "~/components/yuzan-v3/V3TerrainArtwork.vue";
import { stateLabel } from "~/features/today/adapters/today.adapter";
import { useToday } from "~/features/today/composables/useToday";
import type { TodayScenario } from "~/features/today/types";
import { studentActionCards } from "~/features/student-brand/student-brand-content";

const route = useRoute();
const scenario = (route.query.scenario as TodayScenario | undefined) ?? "demo";
const { state, activities, primary, continuing, retests, completed, load } =
  useToday(scenario);

useHead({ title: "今日学习｜语赞心声" });
await load();
</script>

<template>
  <section class="today yx-shell" aria-labelledby="today-page-title">
    <header class="today__intro">
      <p class="yx-kicker">今天的学习 · DEMO</p>
      <h1 id="today-page-title">沿着今天的路径，先走最重要的一步。</h1>
      <p>
        每个任务都会说明为什么做、需要多久、怎样算完成，以及卡住时怎么继续。
      </p>
    </header>

    <V3TerrainArtwork
      src="/art/yuzan-v3/today-desktop-path.jpg"
      alt="沿山谷延伸的学习路径"
      position="bottom"
      tone="sage"
    />

    <section v-if="state === 'loading'" class="state" aria-live="polite">
      <h2>正在准备今天的学习……</h2>
    </section>
    <section v-else-if="state === 'permission'" class="state" role="alert">
      <h2>这个入口暂时不能打开。</h2>
      <p>请回到自己的学生账号，或请老师帮助确认。</p>
    </section>
    <section v-else-if="state === 'unavailable'" class="state" role="status">
      <h2>今日任务服务暂不可用。</h2>
      <p>稍后再试。页面不会把本机进度显示成已经同步。</p>
      <NuxtLink to="/assessment">前往现有测评入口</NuxtLink>
    </section>
    <section v-else-if="state === 'empty'" class="state">
      <h2>今天暂时没有新任务。</h2>
      <p>你可以回顾已经学过的内容，或稍后再来看看。</p>
      <NuxtLink to="/assessment">查看测评入口</NuxtLink>
    </section>

    <template v-else>
      <section v-if="primary" class="primary" aria-labelledby="primary-title">
        <div class="primary__line" aria-hidden="true" />
        <p class="yx-kicker">下一步 · {{ stateLabel(primary.state) }}</p>
        <h2 id="primary-title">{{ primary.title }}</h2>
        <p class="primary__reason">{{ primary.reason }}</p>
        <dl>
          <div>
            <dt>大约多久</dt>
            <dd>{{ primary.durationMinutes }} 分钟</dd>
          </div>
          <div>
            <dt>怎样算完成</dt>
            <dd>{{ primary.completion }}</dd>
          </div>
          <div>
            <dt>遇到困难</dt>
            <dd>{{ primary.help }}</dd>
          </div>
        </dl>
        <p v-if="primary.teacherAdvice" class="teacher-advice">
          <strong>老师的建议：</strong>{{ primary.teacherAdvice }}
        </p>
        <NuxtLink
          class="primary__action"
          :to="`/student/learning/${primary.id}`"
          >开始这一步</NuxtLink
        >
      </section>

      <nav class="support-links" aria-label="学生现有入口">
        <NuxtLink
          v-for="entry in studentActionCards"
          :key="entry.id"
          :to="entry.to"
        >
          {{ entry.title }}：{{ entry.availabilityNote }}
        </NuxtLink>
        <p>
          首测、复测与推荐课程保留真实入口；待接入能力会明确说明，不伪装正式学习成果。
        </p>
      </nav>

      <section aria-labelledby="path-title">
        <p class="yx-kicker">学习路径</p>
        <h2 id="path-title">看清当前位置，也知道接下来往哪里走。</h2>
        <TodayPath :activities="activities" />
      </section>

      <section
        v-if="continuing.length || retests.length"
        class="notes"
        aria-label="学习提醒"
      >
        <div>
          <h2>待继续</h2>
          <p>
            {{
              continuing.length
                ? `${continuing.length} 项内容可以接着完成。`
                : "没有暂停中的任务。"
            }}
          </p>
        </div>
        <div>
          <h2>复测提醒</h2>
          <p>
            {{
              retests.length
                ? `${retests.length} 项由老师建议复测。`
                : "今天没有复测提醒。"
            }}
          </p>
        </div>
      </section>

      <section v-if="completed.length" class="completed">
        <h2>已完成回顾</h2>
        <p>完成状态来自 demo 数据；正式服务接入前不代表服务器记录。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.today {
  display: grid;
  gap: clamp(2rem, 6vw, 5rem);
  padding-block: clamp(2.5rem, 7vw, 6rem);
}
.today__intro {
  max-width: 54rem;
}
h1,
h2 {
  font-family: var(--yx-font-display);
}
h1 {
  max-width: 13ch;
  margin: 0.7rem 0 1rem;
  font-size: clamp(2.35rem, 7vw, 5.8rem);
  line-height: 0.98;
}
h2 {
  margin: 0.5rem 0;
  font-size: clamp(1.5rem, 3.5vw, 2.5rem);
  line-height: 1.12;
}
.today p,
dd {
  color: var(--yx-color-ink-soft);
  line-height: 1.75;
}
.primary {
  position: relative;
  max-width: 62rem;
  padding: clamp(1.4rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem)
    clamp(1.5rem, 4vw, 2.5rem) clamp(1.5rem, 5vw, 4rem);
  border-left: 4px solid var(--yx-color-sage-strong);
  background: var(--yx-color-paper);
}
.primary__line {
  position: absolute;
  inset: 1rem 1rem auto auto;
  width: 28%;
  height: 3rem;
  border-top: 1px solid var(--yx-color-line);
  border-radius: 50%;
  transform: rotate(-6deg);
}
.primary__reason {
  max-width: 42rem;
  font-size: 1.1rem;
}
.primary dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 2rem 0;
}
.primary dl div {
  padding-top: 0.8rem;
  border-top: 1px solid var(--yx-color-line);
}
dt {
  font-weight: 700;
}
dd {
  margin: 0.35rem 0 0;
}
.teacher-advice {
  padding: 0.8rem 1rem;
  border-left: 2px solid var(--yx-color-gold);
}
.primary__action {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  padding: 0 1.15rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-sage-strong);
  color: white;
  font-weight: 700;
  text-decoration: none;
}
.primary__action:focus-visible,
a:focus-visible {
  outline: 3px solid var(--yx-color-gold);
  outline-offset: 3px;
}
.support-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--yx-color-line);
}
.support-links p {
  flex-basis: 100%;
  margin: 0;
}
.notes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding-block: 1.25rem;
  border-block: 1px solid var(--yx-color-line);
}
.state {
  min-height: 20rem;
  display: grid;
  align-content: center;
  justify-items: start;
  max-width: 42rem;
}
@media (max-width: 40rem) {
  .primary dl,
  .notes {
    grid-template-columns: 1fr;
  }
  .primary__line {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
