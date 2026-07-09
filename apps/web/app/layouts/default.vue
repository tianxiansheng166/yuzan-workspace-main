<script setup lang="ts">
const route = useRoute();
const items = [
  { to: "/", label: "项目" },
  { to: "/assessment", label: "AI 测评" },
  { to: "/student/today", label: "学生今日" },
  { to: "/teacher", label: "教师工作台" },
  { to: "/teacher-tools", label: "教师工具" },
  { to: "/training", label: "培训" },
  { to: "/products", label: "产品方案" },
];
</script>

<template>
  <header class="site-header">
    <div class="yx-shell site-header__inner">
      <NuxtLink to="/" class="brand" aria-label="语赞心声首页">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 44 44">
            <path d="M5 29c9-14 15 7 24-7 4-6 7-8 10-7" />
            <path d="M7 35c10-8 17 3 28-8" />
          </svg>
        </span>
        <span>语赞心声</span>
      </NuxtLink>
      <nav aria-label="主导航">
        <ul class="nav-list">
          <li v-for="item in items" :key="item.to">
            <NuxtLink
              :to="item.to"
              :aria-current="route.path === item.to ? 'page' : undefined"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
      <div class="network-state" aria-live="polite">
        <span class="network-state__dot" aria-hidden="true" />
        开发预览
      </div>
    </div>
  </header>
  <main id="main">
    <slot />
  </main>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--yx-color-line);
  background: color-mix(in srgb, var(--yx-color-paper) 88%, transparent);
  backdrop-filter: blur(14px);
}
.site-header__inner {
  min-height: 4.25rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--yx-space-8);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-family: var(--yx-font-display);
  font-weight: 700;
  text-decoration: none;
}
.brand__mark {
  width: 2.15rem;
  color: var(--yx-color-wine);
}
.brand__mark svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}
.nav-list {
  display: flex;
  gap: var(--yx-space-6);
  list-style: none;
  padding: 0;
  margin: 0;
}
.nav-list a {
  text-decoration: none;
  color: var(--yx-color-ink-soft);
}
.nav-list a[aria-current="page"] {
  color: var(--yx-color-wine);
}
.network-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.network-state__dot {
  width: 0.55rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-sage-strong);
}
@media (max-width: 52rem) {
  .site-header__inner {
    grid-template-columns: 1fr auto;
  }
  nav {
    grid-column: 1 / -1;
    overflow-x: auto;
    padding-bottom: 0.75rem;
  }
  .network-state {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
