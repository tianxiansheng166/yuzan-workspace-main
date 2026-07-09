<script setup lang="ts">
import { teacherToolsConfig } from "~/features/teacher-tools/config/teacher-tools.config";

const { mindMate } = teacherToolsConfig;

useSeoMeta({
  title: `${mindMate.title}｜教师工具`,
});

const webLinks = Object.values(mindMate.externalLinks).filter((link) =>
  link.href.startsWith("http"),
);
</script>

<template>
  <div class="tool-page">
    <div class="yx-shell">
      <NuxtLink class="back-link" to="/teacher-tools">← 返回教师工具</NuxtLink>

      <section class="hero">
        <p class="yx-kicker">
          TEACHER TOOL · {{ mindMate.title.toUpperCase() }}
        </p>
        <h1>{{ mindMate.title }}</h1>
        <p class="hero__subtitle">{{ mindMate.subtitle }}</p>
        <p class="hero__lead">{{ mindMate.description }}</p>
      </section>

      <div class="grid">
        <section class="panel" aria-labelledby="scenarios-title">
          <h2 id="scenarios-title">使用场景</h2>
          <ul class="scenario-list">
            <li v-for="scenario in mindMate.scenarios" :key="scenario.title">
              <strong>{{ scenario.title }}</strong>
              <p>{{ scenario.description }}</p>
            </li>
          </ul>
        </section>

        <section class="panel" aria-labelledby="login-title">
          <h2 id="login-title">登录说明</h2>
          <ol class="step-list">
            <li v-for="(step, index) in mindMate.loginSteps" :key="index">
              {{ step }}
            </li>
          </ol>
          <div class="invite-card">
            <span class="invite-card__label">学校邀请码</span>
            <code class="invite-card__code">{{ mindMate.inviteCode }}</code>
          </div>
        </section>
      </div>

      <section class="panel panel--wide" aria-labelledby="links-title">
        <h2 id="links-title">外部入口</h2>
        <p class="panel__note">
          以下链接将在新窗口打开，请确认域名与学校提供的入口一致。
        </p>
        <ul class="link-list">
          <li v-for="link in webLinks" :key="link.href">
            <a
              class="external-link"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>
      </section>

      <section class="guide" aria-labelledby="guide-title">
        <h2 id="guide-title">使用指南</h2>
        <div class="guide__grid">
          <article
            v-for="section in mindMate.guideSections"
            :key="section.title"
            class="guide__card"
          >
            <h3>{{ section.title }}</h3>
            <p>{{ section.body }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tool-page {
  padding-block: clamp(2rem, 5vw, 4rem);
}

.back-link {
  display: inline-flex;
  margin-bottom: 1.5rem;
  color: var(--yx-text-muted);
  text-decoration: none;
}

.back-link:hover {
  color: var(--yx-text-accent);
}

.hero {
  max-width: var(--yx-content-reading);
  margin-bottom: 3rem;
}

.hero h1 {
  margin: 0.75rem 0 0.5rem;
  font: 600 var(--yx-text-xl) / 1.15 var(--yx-font-display);
}

.hero__subtitle {
  font-size: var(--yx-font-size-500);
  color: var(--yx-text-secondary);
  margin: 0 0 1rem;
}

.hero__lead {
  line-height: 1.8;
  color: var(--yx-text-muted);
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--yx-space-600);
  margin-bottom: var(--yx-space-600);
}

.panel {
  padding: var(--yx-space-600);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.panel--wide {
  margin-bottom: var(--yx-space-600);
}

.panel h2 {
  margin: 0 0 1rem;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
}

.panel__note {
  margin: 0 0 1rem;
  color: var(--yx-text-muted);
}

.scenario-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-400);
}

.scenario-list li {
  padding: var(--yx-space-400);
  border-left: 3px solid var(--yx-text-accent);
  background: var(--yx-surface-subtle);
  border-radius: 0 var(--yx-radius-md) var(--yx-radius-md) 0;
}

.scenario-list strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--yx-text-primary);
}

.scenario-list p {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.step-list {
  margin: 0 0 var(--yx-space-500);
  padding-left: 1.25rem;
  display: grid;
  gap: var(--yx-space-300);
  color: var(--yx-text-secondary);
}

.invite-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--yx-space-400);
  padding: var(--yx-space-400) var(--yx-space-500);
  background: var(--yx-surface-subtle);
  border-radius: var(--yx-radius-md);
}

.invite-card__label {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.invite-card__code {
  font-size: var(--yx-font-size-500);
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-accent);
  background: transparent;
}

.link-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-400) var(--yx-space-600);
}

.external-link {
  color: var(--yx-text-accent);
  font-weight: var(--yx-font-weight-semibold);
  text-decoration-thickness: 0.08em;
}

.external-link:hover {
  color: var(--yx-primitive-color-wine-800);
  text-decoration-thickness: 0.12em;
}

.guide {
  padding-block: var(--yx-space-800);
  border-top: 1px solid var(--yx-border-default);
}

.guide h2 {
  margin: 0 0 var(--yx-space-500);
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
}

.guide__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--yx-space-500);
}

.guide__card {
  padding: var(--yx-space-500);
  border: 1px solid var(--yx-border-subtle);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}

.guide__card h3 {
  margin: 0 0 0.5rem;
  font: 600 var(--yx-font-size-300) / 1.25 var(--yx-font-display);
  color: var(--yx-text-accent);
}

.guide__card p {
  margin: 0;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
  line-height: 1.7;
}

@media (max-width: 64rem) {
  .grid,
  .guide__grid {
    grid-template-columns: 1fr;
  }
}
</style>
