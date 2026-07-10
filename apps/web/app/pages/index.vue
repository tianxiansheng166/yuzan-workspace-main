<script setup lang="ts">
import {
  brandEntryLinks,
  brandPrinciples,
  brandValues,
} from "../features/brand/brand-content";

useSeoMeta({
  title: "语赞心声｜沿学习路径，看见每一步",
  description: brandValues.map((value) => value.summary).join(" "),
  ogDescription: brandPrinciples
    .map((principle) => principle.description)
    .join(" "),
});

const paths = [
  {
    step: "01",
    label: "学生",
    title: "从今日任务开始",
    description: "看清今天要学什么、先完成哪一步，再进入测评与回看。",
    to: "/student/today",
    action: "进入今日学习",
    status: "待接入",
  },
  {
    step: "02",
    label: "教师",
    title: "把支持送到关键处",
    description: "沿任务、提交与反馈路径工作，不用在分散页面里寻找线索。",
    to: "/teacher",
    action: "进入教师工作台",
    status: "demo",
  },
  {
    step: "03",
    label: "公共入口",
    title: "了解平台与学习工具",
    description: "查看产品方案与现有公共能力；尚未接入的服务会明确说明。",
    to: "/products",
    action: "查看产品方案",
    status: "unavailable 会明确标识",
  },
];

const secondaryBrandEntries = brandEntryLinks.filter(
  (entry) => entry.to !== "/products",
);
</script>

<template>
  <section class="home-intro" aria-labelledby="home-title">
    <div class="home-intro__texture" aria-hidden="true" />
    <div class="yx-shell home-intro__layout">
      <div class="home-intro__copy">
        <p class="yx-kicker">学习路径 · 语言成长</p>
        <h1 id="home-title">让每一次开口，<span>都有下一步。</span></h1>
        <p class="home-intro__lead">
          语赞心声把学习、测评与教学支持连成一条看得懂的路径。先找到今天的位置，再继续向前。
        </p>
        <div class="home-intro__actions">
          <NuxtLink class="home-intro__primary" to="/student/today"
            >开始今日学习 <span aria-hidden="true">→</span></NuxtLink
          >
          <NuxtLink class="home-intro__secondary" to="/teacher"
            >我是教师</NuxtLink
          >
        </div>
        <p class="home-intro__truth">
          <strong>开发预览</strong
          ><span>入口不代表真实登录、权限或业务完成状态。</span>
        </p>
      </div>

      <div
        class="route-figure"
        aria-label="从听见、练习到获得反馈的学习路径示意"
      >
        <p class="route-figure__eyebrow">今天的位置</p>
        <ol>
          <li><span>听见</span><small>辨认语言的节奏</small></li>
          <li><span>练习</span><small>留下自己的声音</small></li>
          <li><span>反馈</span><small>看见可行动的下一步</small></li>
        </ol>
      </div>
    </div>
  </section>

  <section class="pathways" aria-labelledby="pathways-title">
    <div class="yx-shell">
      <header class="pathways__head">
        <p class="yx-kicker">从角色出发</p>
        <h2 id="pathways-title">三条入口，共用一条清楚的学习主线</h2>
        <p>
          页面只呈现仓库中已经存在的入口；演示、等待与不可用状态不会被包装成完成。
        </p>
      </header>
      <ol class="pathways__list">
        <li v-for="path in paths" :key="path.step">
          <p class="pathways__step">{{ path.step }} · {{ path.label }}</p>
          <div>
            <h3>{{ path.title }}</h3>
            <p>{{ path.description }}</p>
          </div>
          <p class="pathways__status">
            <span aria-hidden="true" />状态：{{ path.status }}
          </p>
          <NuxtLink :to="path.to"
            >{{ path.action }} <span aria-hidden="true">→</span></NuxtLink
          >
        </li>
      </ol>
    </div>
  </section>

  <section class="voice-band" aria-labelledby="voice-title">
    <div class="yx-shell voice-band__inner">
      <div>
        <p class="yx-kicker">语言与声波</p>
        <h2 id="voice-title">不是给学习贴标签，而是让反馈更可行动。</h2>
      </div>
      <p>
        自动处理结果只作为可复核的学习线索。真实结果尚未返回时，页面保持
        pending；下游服务不可用时，明确显示 unavailable。
      </p>
      <NuxtLink to="/assessment">了解学习测评</NuxtLink>
    </div>
  </section>

  <nav class="home-directory" aria-label="更多产品入口">
    <div class="yx-shell">
      <span>继续探索</span>
      <NuxtLink to="/teacher-tools">教师工具</NuxtLink>
      <NuxtLink to="/products">产品方案</NuxtLink>
      <NuxtLink
        v-for="entry in secondaryBrandEntries"
        :key="entry.to"
        :to="entry.to"
      >
        {{ entry.label }}
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.home-intro {
  position: relative;
  min-height: min(48rem, calc(100svh - 4.75rem));
  overflow: clip;
  background: #f4ede2;
}
.home-intro__texture {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, #f4ede2 0 35%, transparent 72%),
    url("/art/acc-ui-001-learning-terrain.svg") center/cover no-repeat;
  opacity: 0.48;
}
.home-intro__layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(19rem, 0.75fr);
  align-items: center;
  gap: clamp(2rem, 8vw, 8rem);
  min-height: inherit;
  padding-block: clamp(3.5rem, 8vw, 7rem);
}
.home-intro__copy {
  max-width: 47rem;
}
.home-intro h1 {
  max-width: 11ch;
  margin: 0.8rem 0 1.4rem;
  font: 750 clamp(3rem, 7vw, 6.6rem)/0.94 var(--yx-font-display);
  letter-spacing: -0.055em;
}
.home-intro h1 span {
  color: #8c402f;
}
.home-intro__lead {
  max-width: 38rem;
  color: #41514a;
  font-size: clamp(1.05rem, 1.7vw, 1.28rem);
  line-height: 1.75;
}
.home-intro__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 2rem;
}
.home-intro__actions a {
  min-height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.75rem 1.2rem;
  border: 1px solid #214b3e;
  border-radius: 999px;
  font-weight: 750;
  text-decoration: none;
}
.home-intro__primary {
  background: #214b3e;
  color: #fff;
}
.home-intro__secondary {
  color: #214b3e;
  background: #f4ede2;
}
.home-intro__truth {
  display: flex;
  gap: 0.7rem;
  align-items: baseline;
  margin-top: 1.2rem;
  color: #596861;
  font-size: 0.82rem;
}
.home-intro__truth strong {
  color: #8c402f;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.route-figure {
  align-self: end;
  margin-bottom: clamp(0rem, 5vw, 3rem);
  padding: 1.5rem 0;
  border-block: 1px solid rgba(32, 62, 52, 0.45);
}
.route-figure__eyebrow {
  margin: 0 0 1rem;
  color: #8c402f;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}
.route-figure ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
.route-figure li {
  position: relative;
  display: grid;
  grid-template-columns: 5rem 1fr;
  gap: 1rem;
  padding: 0.65rem 0 0.65rem 1.5rem;
}
.route-figure li::before {
  content: "";
  position: absolute;
  left: 0.1rem;
  top: 1.1rem;
  width: 0.55rem;
  height: 0.55rem;
  border: 2px solid #8c402f;
  border-radius: 50%;
  background: #f4ede2;
}
.route-figure li:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 0.44rem;
  top: 1.75rem;
  bottom: -0.4rem;
  border-left: 1px dashed #8c402f;
}
.route-figure span {
  font-weight: 800;
}
.route-figure small {
  color: #46564f;
  font-size: 0.85rem;
}
.pathways {
  padding-block: clamp(4rem, 8vw, 7rem);
  background: #fcfaf5;
}
.pathways__head {
  display: grid;
  grid-template-columns: 0.45fr 1fr 1fr;
  gap: 2rem;
  align-items: start;
  border-bottom: 1px solid #bdb2a2;
  padding-bottom: 2rem;
}
.pathways__head h2 {
  margin: 0;
  font: 700 clamp(2rem, 3.5vw, 3.2rem)/1.08 var(--yx-font-display);
}
.pathways__head > p:last-child {
  margin: 0;
  color: #58645f;
  line-height: 1.7;
}
.pathways__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.pathways__list li {
  display: grid;
  grid-template-columns: 0.55fr 1.4fr 0.85fr auto;
  gap: clamp(1rem, 3vw, 3rem);
  align-items: center;
  padding: 1.7rem 0;
  border-bottom: 1px solid #d1c8bb;
}
.pathways__step {
  color: #8c402f;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.pathways h3 {
  margin: 0 0 0.35rem;
  font: 700 1.35rem/1.2 var(--yx-font-display);
}
.pathways li p {
  line-height: 1.55;
}
.pathways li div p {
  margin: 0;
  color: #59645f;
}
.pathways__status {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 700;
}
.pathways__status span {
  flex: 0 0 0.6rem;
  width: 0.6rem;
  height: 0.6rem;
  border: 2px solid #9c4b35;
  border-radius: 50%;
}
.pathways li > a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  color: #214b3e;
  font-weight: 800;
}
.voice-band {
  position: relative;
  overflow: hidden;
  padding-block: clamp(3.5rem, 7vw, 6rem);
  background: #173f35;
  color: #fff;
}
.voice-band::after {
  content: "";
  position: absolute;
  inset: 20% -5% auto 40%;
  height: 7rem;
  opacity: 0.35;
  background: repeating-radial-gradient(
    ellipse at center,
    transparent 0 10px,
    #d7a84a 11px 12px,
    transparent 13px 22px
  );
}
.voice-band__inner {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.2fr 1fr auto;
  gap: clamp(2rem, 6vw, 6rem);
  align-items: center;
}
.voice-band h2 {
  max-width: 20ch;
  margin: 0.6rem 0 0;
  font: 700 clamp(2rem, 3.5vw, 3.5rem)/1.08 var(--yx-font-display);
}
.voice-band p {
  line-height: 1.75;
  color: #e6e0d3;
}
.voice-band a {
  min-height: 3rem;
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1rem;
  border: 1px solid #e9c77b;
  border-radius: 999px;
  color: #fff;
  font-weight: 800;
  white-space: nowrap;
}
.home-directory {
  border-top: 1px solid #d1c8bb;
  background: #fcfaf5;
}
.home-directory > div {
  min-height: 4.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.8rem;
}
.home-directory span {
  color: #8c402f;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.home-directory a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  color: #214b3e;
  font-weight: 750;
}
@media (max-width: 64rem) {
  .home-intro__layout {
    grid-template-columns: 1fr 0.65fr;
  }
  .pathways__head {
    grid-template-columns: 1fr 1fr;
  }
  .pathways__head .yx-kicker {
    grid-column: 1/-1;
  }
  .pathways__list li {
    grid-template-columns: 0.45fr 1.5fr 1fr;
  }
  .pathways li > a {
    grid-column: 2;
  }
  .voice-band__inner {
    grid-template-columns: 1fr 1fr;
  }
  .voice-band a {
    grid-column: 2;
    justify-self: start;
  }
}
@media (max-width: 48rem) {
  .home-intro__texture {
    background-position: 65% center;
    opacity: 0.24;
  }
  .home-intro__layout {
    grid-template-columns: 1fr;
  }
  .home-intro h1 {
    font-size: clamp(3rem, 15vw, 4.8rem);
  }
  .route-figure {
    align-self: auto;
  }
  .pathways__head,
  .voice-band__inner {
    grid-template-columns: 1fr;
  }
  .pathways__head .yx-kicker,
  .voice-band a {
    grid-column: auto;
  }
  .pathways__list li {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .pathways li > a {
    grid-column: auto;
    margin-top: 0.4rem;
  }
  .voice-band::after {
    inset: auto -20% 5% 10%;
  }
  .home-intro__truth {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .home-intro *,
  .pathways * {
    scroll-behavior: auto;
    transition: none !important;
    animation: none !important;
  }
}
</style>
