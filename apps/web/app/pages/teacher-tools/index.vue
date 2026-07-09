<script setup lang="ts">
import { teacherToolsConfig } from "~/features/teacher-tools/config/teacher-tools.config";

const tools = [
  {
    key: "mindmate" as const,
    title: teacherToolsConfig.mindMate.title,
    subtitle: teacherToolsConfig.mindMate.subtitle,
    description: teacherToolsConfig.mindMate.description,
    to: "/teacher-tools/mindmate",
  },
  {
    key: "mindgraph" as const,
    title: teacherToolsConfig.mindGraph.title,
    subtitle: teacherToolsConfig.mindGraph.subtitle,
    description: teacherToolsConfig.mindGraph.description,
    to: "/teacher-tools/mindgraph",
  },
];

useSeoMeta({
  title: "教师工具｜语赞心声",
});
</script>

<template>
  <div class="tools-index">
    <div class="yx-shell">
      <section class="hero">
        <p class="yx-kicker">TEACHER TOOLS</p>
        <h1>教师工具</h1>
        <p class="hero__lead">
          为教师提供的辅助入口。当前包含 MindMate 备课对话助手与 MindGraph
          结构化图示生成入口。
        </p>
      </section>

      <nav aria-label="教师工具导航">
        <ul class="tool-list">
          <li v-for="tool in tools" :key="tool.key" class="tool-card">
            <NuxtLink class="tool-card__link" :to="tool.to">
              <span class="tool-card__mark" aria-hidden="true">
                <svg v-if="tool.key === 'mindmate'" viewBox="0 0 48 48">
                  <path
                    d="M12 36c8-16 14 4 24-8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                  <circle cx="34" cy="18" r="5" fill="currentColor" />
                </svg>
                <svg v-else viewBox="0 0 48 48">
                  <circle cx="24" cy="14" r="6" fill="currentColor" />
                  <path
                    d="M24 20v8M18 34h12M16 28h-6M38 28h-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              <span class="tool-card__text">
                <span class="tool-card__title">{{ tool.title }}</span>
                <span class="tool-card__subtitle">{{ tool.subtitle }}</span>
                <span class="tool-card__description">{{
                  tool.description
                }}</span>
              </span>
              <span class="tool-card__action" aria-hidden="true">进入 →</span>
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.tools-index {
  padding-block: clamp(3rem, 7vw, 5rem);
}

.hero {
  max-width: var(--yx-content-reading);
  margin-bottom: var(--yx-space-800);
}

.hero h1 {
  margin: 0.75rem 0 1rem;
  font: 600 var(--yx-text-xl) / 1.15 var(--yx-font-display);
}

.hero__lead {
  line-height: 1.8;
  color: var(--yx-text-muted);
  margin: 0;
}

.tool-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-500);
}

.tool-card {
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-default);
  transition:
    transform var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--yx-shadow-200);
}

.tool-card__link {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--yx-space-600);
  padding: var(--yx-space-600);
  color: inherit;
  text-decoration: none;
}

.tool-card__mark {
  width: 3.5rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-subtle);
  color: var(--yx-text-accent);
}

.tool-card__mark svg {
  width: 1.6rem;
}

.tool-card__text {
  display: grid;
  gap: var(--yx-space-100);
}

.tool-card__title {
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
  color: var(--yx-text-primary);
}

.tool-card__subtitle {
  font-size: var(--yx-font-size-300);
  color: var(--yx-text-secondary);
}

.tool-card__description {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
  line-height: 1.6;
}

.tool-card__action {
  color: var(--yx-text-accent);
  font-weight: var(--yx-font-weight-semibold);
  white-space: nowrap;
}

@media (max-width: 40rem) {
  .tool-card__link {
    grid-template-columns: auto 1fr;
  }

  .tool-card__action {
    display: none;
  }
}
</style>
