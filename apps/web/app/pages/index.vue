<script setup lang="ts">
useSeoMeta({
  title: "语赞心声｜弱网也能持续的语言学习",
});
</script>

<template>
  <section class="hero">
    <div class="yx-shell hero__grid">
      <div class="hero__copy">
        <p class="yx-kicker">YUZAN NEXT · PRODUCT REBUILD</p>
        <h1>让每一次学习，<br /><em>在断网之后仍然继续。</em></h1>
        <p class="hero__lead">
          面向西藏农牧区学校的弱网与离线优先国通语教与学平台。
          课程、任务、学习、反馈和同步成为一条真实可运行的链，而不是一组演示页面。
        </p>
        <div class="hero__actions">
          <NuxtLink class="primary-link" to="/student/today"
            >查看学生今日页</NuxtLink
          >
          <a href="#architecture">阅读重建原则</a>
        </div>
      </div>
      <div class="hero__art" aria-hidden="true">
        <svg viewBox="0 0 680 720" role="presentation">
          <path
            class="terrain terrain--1"
            d="M-20 580C80 420 130 700 260 500S410 250 720 380"
          />
          <path
            class="terrain terrain--2"
            d="M-20 640C120 470 180 740 340 530S500 340 720 440"
          />
          <path
            class="wave"
            d="M80 350c55-85 92 95 150 0s96 95 154 0 98 92 160 0"
          />
          <circle cx="237" cy="350" r="11" />
          <circle cx="384" cy="350" r="8" />
          <path
            class="route"
            d="M120 588c84-54 137 42 207-26 57-55 99-6 150-71"
          />
          <circle class="route-point" cx="120" cy="588" r="12" />
          <circle class="route-point" cx="327" cy="562" r="9" />
          <circle class="route-point" cx="477" cy="491" r="13" />
        </svg>
        <span class="hero__note"
          >路径不是装饰，它将成为课程、进度与同步的共同语言。</span
        >
      </div>
    </div>
  </section>

  <section id="architecture" class="principles">
    <div class="yx-shell principles__grid">
      <header>
        <p class="yx-kicker">NOT A PAGE FACTORY</p>
        <h2>成熟产品从闭环开始，不从页面数量开始。</h2>
      </header>
      <ol>
        <li>
          <span>01</span><strong>真实业务</strong>
          <p>课程版本、班级任务、学生提交和教师反馈进入同一数据链。</p>
        </li>
        <li>
          <span>02</span><strong>弱网恢复</strong>
          <p>离线完成、幂等同步和冲突可见，不把 Service Worker 当作全部。</p>
        </li>
        <li>
          <span>03</span><strong>AI 可复核</strong>
          <p>自动语音建议带置信度、模型版本和原始证据，教师保留最终判断。</p>
        </li>
        <li>
          <span>04</span><strong>艺术与任务统一</strong>
          <p>高原地形与声波成为信息结构，而不是铺在旧模板上的背景。</p>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.hero {
  min-height: calc(100svh - 4.25rem);
  display: grid;
  align-items: center;
  overflow: clip;
}
.hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
  align-items: center;
  gap: clamp(2rem, 7vw, 8rem);
  padding-block: clamp(4rem, 10vw, 9rem);
}
h1 {
  margin: 1rem 0 1.75rem;
  font: 600 var(--yx-text-display)/0.98 var(--yx-font-display);
  letter-spacing: -0.045em;
}
h1 em {
  color: var(--yx-color-wine);
  font-style: normal;
}
.hero__lead {
  max-width: 42rem;
  font-size: clamp(1.05rem, 1.5vw, 1.28rem);
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}
.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: center;
  margin-top: 2rem;
}
.primary-link {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-wine);
  color: white;
  text-decoration: none;
}
.hero__art {
  position: relative;
  min-height: 36rem;
}
.hero__art svg {
  width: min(100%, 42rem);
  color: var(--yx-color-wine);
}
.hero__art svg circle {
  fill: var(--yx-color-gold);
  stroke: var(--yx-color-paper);
  stroke-width: 8;
}
.terrain {
  fill: none;
  stroke: var(--yx-color-sage-strong);
  stroke-width: 1.2;
  opacity: 0.42;
}
.terrain--2 {
  opacity: 0.25;
}
.wave {
  fill: none;
  stroke: var(--yx-color-wine);
  stroke-width: 5;
  stroke-linecap: round;
}
.route {
  fill: none;
  stroke: var(--yx-color-ink);
  stroke-width: 2;
  stroke-dasharray: 3 11;
  stroke-linecap: round;
}
.route-point {
  fill: var(--yx-color-wine) !important;
}
.hero__note {
  position: absolute;
  right: 0;
  bottom: 3rem;
  max-width: 17rem;
  padding-left: 1rem;
  border-left: 1px solid var(--yx-color-wine);
  font-size: var(--yx-text-sm);
  line-height: 1.6;
  color: var(--yx-color-ink-soft);
}
.principles {
  padding-block: var(--yx-space-24);
  background: var(--yx-color-ink);
  color: var(--yx-color-paper);
}
.principles__grid {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: clamp(3rem, 9vw, 10rem);
}
.principles h2 {
  max-width: 12ch;
  font: 500 var(--yx-text-xl)/1.15 var(--yx-font-display);
}
.principles ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.principles li {
  display: grid;
  grid-template-columns: 3rem 10rem 1fr;
  gap: 1rem;
  padding-block: 1.5rem;
  border-top: 1px solid #ffffff2b;
}
.principles li span {
  color: var(--yx-color-gold);
  font-variant-numeric: tabular-nums;
}
.principles li p {
  margin: 0;
  color: #f7f2e8b8;
  line-height: 1.7;
}
@media (max-width: 54rem) {
  .hero__grid,
  .principles__grid {
    grid-template-columns: 1fr;
  }
  .hero__art {
    min-height: 25rem;
    margin-top: -2rem;
  }
  .hero__note {
    bottom: 0;
  }
  .principles li {
    grid-template-columns: 2.5rem 1fr;
  }
  .principles li p {
    grid-column: 2;
  }
}
</style>
