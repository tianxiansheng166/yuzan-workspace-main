<script setup lang="ts">
import BrandHeroVisual from "../features/brand/BrandHeroVisual.vue";
import {
  brandEntryLinks,
  brandPositioning,
  brandPrinciples,
  brandProductName,
  brandValues,
} from "../features/brand/brand-content";

useSeoMeta({
  title: `${brandProductName}｜弱网环境里的学习与支持路径`,
});
</script>

<template>
  <section class="home-hero">
    <div class="yx-shell home-hero__grid">
      <div class="home-hero__copy">
        <p class="yx-kicker">YUZAN NEXT · BRAND SYSTEM</p>
        <h1>
          {{ brandProductName }}
          <span>把 AI 测评、学习成长与教学支持放进同一条清楚的路径里。</span>
        </h1>
        <p class="home-hero__lead">
          {{ brandPositioning }}
        </p>

        <div class="home-hero__actions" aria-label="首页主入口">
          <NuxtLink
            v-for="entry in brandEntryLinks"
            :key="entry.to"
            class="cta-link"
            :class="`cta-link--${entry.tone}`"
            :to="entry.to"
          >
            <strong>{{ entry.label }}</strong>
            <span>{{ entry.description }}</span>
          </NuxtLink>
        </div>

        <nav class="home-hero__support-links" aria-label="更多入口">
          <NuxtLink to="/assessment">开始 AI 测评</NuxtLink>
          <NuxtLink to="/student/today">查看学生今日</NuxtLink>
          <NuxtLink to="/teacher">教师工作台</NuxtLink>
          <NuxtLink to="/teacher-tools">教师工具</NuxtLink>
          <NuxtLink to="/products">产品方案</NuxtLink>
        </nav>
      </div>

      <BrandHeroVisual />
    </div>
  </section>

  <section class="brand-values">
    <div class="yx-shell">
      <header class="section-head">
        <div>
          <p class="yx-kicker">CORE VALUE</p>
          <h2>四个价值，不用虚构指标来证明存在。</h2>
        </div>
        <p>
          首页只说明产品能力和入口，不展示虚构合作学校、用户数、奖项或机构背书。
        </p>
      </header>

      <div class="value-grid">
        <article
          v-for="value in brandValues"
          :key="value.id"
          class="value-card"
        >
          <p class="yx-kicker">{{ value.title }}</p>
          <h3>{{ value.title }}</h3>
          <p>{{ value.summary }}</p>
          <span class="value-card__proof">{{ value.proofLabel }}</span>
        </article>
      </div>
    </div>
  </section>

  <section class="brand-principles" aria-labelledby="brand-principles-title">
    <div class="yx-shell brand-principles__grid">
      <header>
        <p class="yx-kicker">BRAND PRINCIPLES</p>
        <h2 id="brand-principles-title">
          原创图形要服务信息，而不是盖住信息。
        </h2>
      </header>
      <ol>
        <li v-for="principle in brandPrinciples" :key="principle.index">
          <span>{{ principle.index }}</span>
          <strong>{{ principle.title }}</strong>
          <p>{{ principle.description }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  min-height: calc(100svh - 4.25rem);
  display: grid;
  align-items: center;
  overflow: clip;
}

.home-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
  align-items: center;
  gap: clamp(2rem, 7vw, 8rem);
  padding-block: clamp(4rem, 10vw, 8rem);
}

h1 {
  margin: 1rem 0 1.4rem;
  font: 600 clamp(2.8rem, 6vw, 5.8rem) / 0.98 var(--yx-font-display);
  letter-spacing: -0.045em;
}

h1 span {
  display: block;
  margin-top: 1rem;
  max-width: 10ch;
  color: var(--yx-color-wine);
  font-size: clamp(1.35rem, 2vw, 2rem);
  line-height: 1.15;
}

.home-hero__lead,
.section-head p,
.value-card p,
.brand-principles p {
  color: var(--yx-color-ink-soft);
  line-height: 1.8;
}

.home-hero__lead {
  max-width: 44rem;
  font-size: clamp(1.05rem, 1.5vw, 1.24rem);
}

.home-hero__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.home-hero__support-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem 1.4rem;
  margin-top: 1.15rem;
}

.home-hero__support-links a {
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
  text-decoration: none;
}

.home-hero__support-links a:hover {
  color: var(--yx-color-wine);
}

.cta-link {
  min-height: 8.5rem;
  display: grid;
  align-content: space-between;
  gap: 0.7rem;
  padding: 1.1rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  text-decoration: none;
  box-shadow: var(--yx-shadow-100);
  transition:
    transform var(--yx-duration-base) var(--yx-ease-standard),
    border-color var(--yx-duration-base) var(--yx-ease-standard);
}

.cta-link strong {
  font-family: var(--yx-font-display);
  font-size: clamp(1.2rem, 2vw, 1.45rem);
}

.cta-link span {
  font-size: var(--yx-text-sm);
  line-height: 1.65;
}

.cta-link:hover {
  transform: translateY(-0.15rem);
}

.cta-link--primary {
  background:
    linear-gradient(140deg, #fffaf2 0%, #f0e1d4 58%, #e9efe3 100%),
    var(--yx-surface-raised);
}

.cta-link--secondary {
  background: color-mix(in srgb, white 86%, var(--yx-color-sage));
}

.cta-link--quiet {
  background: color-mix(in srgb, white 92%, var(--yx-color-paper));
}

.brand-values,
.brand-principles {
  padding-block: var(--yx-space-24);
}

.section-head,
.brand-principles__grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: clamp(2rem, 7vw, 6rem);
}

.section-head h2,
.brand-principles h2,
.value-card h3 {
  margin: 0.7rem 0;
  font-family: var(--yx-font-display);
}

.section-head h2,
.brand-principles h2 {
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1.08;
}

.value-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.value-card {
  min-height: 15rem;
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background:
    linear-gradient(150deg, #fffdf8 0%, #f4ebde 58%, #edf1e8 100%),
    var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.value-card__proof {
  display: inline-flex;
  margin-top: 1rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--yx-radius-pill);
  background: color-mix(in srgb, var(--yx-color-gold) 18%, white);
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink);
}

.brand-principles {
  background: var(--yx-color-ink);
  color: var(--yx-color-paper);
}

.brand-principles p {
  color: #f7f2e8b8;
}

.brand-principles ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.brand-principles li {
  display: grid;
  grid-template-columns: 3rem 11rem 1fr;
  gap: 1rem;
  padding-block: 1.5rem;
  border-top: 1px solid #ffffff2b;
}

.brand-principles li span {
  color: var(--yx-color-gold);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 64rem) {
  .home-hero__actions,
  .value-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 54rem) {
  .home-hero__grid,
  .section-head,
  .brand-principles__grid {
    grid-template-columns: 1fr;
  }

  .brand-principles li {
    grid-template-columns: 2.5rem 1fr;
  }

  .brand-principles li p {
    grid-column: 2;
  }
}

@media (max-width: 30rem) {
  .home-hero__actions,
  .value-grid {
    grid-template-columns: 1fr;
  }
}
</style>
