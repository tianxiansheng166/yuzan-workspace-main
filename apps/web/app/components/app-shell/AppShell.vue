<script setup lang="ts">
import { ref, watch } from "vue";
const route = useRoute();
const navigationOpen = ref(false);
watch(
  () => route.path,
  () => {
    navigationOpen.value = false;
  },
);
const entries = [
  {
    to: "/",
    label: "公共",
    note: "首页与套餐",
    routes: ["/", "/login", "/plans"],
  },
  {
    to: "/student/today",
    label: "学生",
    note: "课程与学习",
    routes: ["/student", "/assessment"],
  },
  {
    to: "/teacher",
    label: "教师",
    note: "教学与复核",
    routes: ["/teacher", "/studio", "/reports"],
  },
  {
    to: "/volunteer",
    label: "运营服务",
    note: "管理·志愿·教研",
    routes: ["/volunteer", "/admin", "/research"],
  },
];
function active(routes: string[]) {
  return routes.some((path) =>
    path === "/"
      ? route.path === path
      : route.path === path || route.path.startsWith(`${path}/`),
  );
}
</script>
<template>
  <div class="app-shell">
    <a class="skip" href="#main">跳到主要内容</a>
    <header class="mast">
      <div class="yx-shell mast__inner">
        <NuxtLink to="/" class="brand" aria-label="语赞心声首页"
          ><svg viewBox="0 0 44 44" aria-hidden="true">
            <path d="M5 29c9-14 15 7 24-7 4-6 7-8 10-7" />
            <path d="M7 35c10-8 17 3 28-8" /></svg
          ><span
            ><strong>语赞心声</strong><small>援藏教育协作平台</small></span
          ></NuxtLink
        ><button
          class="toggle"
          type="button"
          :aria-expanded="navigationOpen"
          aria-controls="product-navigation"
          @click="navigationOpen = !navigationOpen"
        >
          {{ navigationOpen ? "收起导航" : "展开导航" }}
        </button>
        <nav
          id="product-navigation"
          :data-open="navigationOpen"
          aria-label="四个主要产品入口"
        >
          <NuxtLink
            v-for="entry in entries"
            :key="entry.to"
            :to="entry.to"
            :aria-current="active(entry.routes) ? 'page' : undefined"
            ><strong>{{ entry.label }}</strong
            ><small>{{ entry.note }}</small></NuxtLink
          >
          <div class="account">
            <NuxtLink to="/plans">套餐</NuxtLink>
            <NuxtLink to="/select-school">切换学校</NuxtLink
            ><NuxtLink to="/login">登录</NuxtLink>
          </div>
        </nav>
      </div>
    </header>
    <main id="main"><slot /></main>
  </div>
</template>
<style scoped>
.app-shell {
  min-height: 100vh;
}
.skip {
  position: fixed;
  z-index: 100;
  left: 1rem;
  top: 1rem;
  transform: translateY(-180%);
  background: #fff;
  color: #111;
  padding: 0.7rem 1rem;
}
.skip:focus {
  transform: none;
}
.mast {
  position: relative;
  z-index: 20;
  border-bottom: 1px solid var(--yx-color-line);
  background: var(--yx-color-paper);
}
.mast__inner {
  min-height: 5.5rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(2rem, 6vw, 7rem);
  align-items: center;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  color: inherit;
  text-decoration: none;
}
.brand svg {
  width: 2.5rem;
  fill: none;
  stroke: var(--yx-color-wine);
  stroke-width: 2.3;
  stroke-linecap: round;
}
.brand span {
  display: grid;
}
.brand strong {
  font: 600 1.25rem var(--yx-font-display);
}
.brand small {
  font-size: 0.72rem;
  color: var(--yx-color-ink-soft);
}
nav {
  display: flex;
  align-items: stretch;
  justify-content: end;
  min-width: 0;
}
nav > a {
  position: relative;
  display: grid;
  align-content: center;
  gap: 0.15rem;
  min-width: 7rem;
  padding: 1rem;
  border-left: 1px solid var(--yx-color-line);
  color: inherit;
  text-decoration: none;
}
nav > a:after {
  content: "";
  position: absolute;
  inset: auto 1rem 0;
  height: 3px;
  background: var(--yx-color-wine);
  transform: scaleX(0);
  transform-origin: left;
}
nav > a[aria-current="page"]:after {
  transform: scaleX(1);
}
nav > a small {
  color: var(--yx-color-ink-soft);
}
.account {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-left: 1rem;
}
.account a {
  color: var(--yx-color-wine);
  font-weight: 700;
}
.toggle {
  display: none;
  border: 1px solid var(--yx-color-line);
  background: transparent;
  padding: 0.7rem 1rem;
}
main {
  min-height: calc(100vh - 5.5rem);
}
a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--yx-color-gold);
  outline-offset: 3px;
}
@media (max-width: 64rem) {
  .mast__inner {
    grid-template-columns: 1fr auto;
    padding-block: 1rem;
  }
  .toggle {
    display: inline-flex;
  }
  nav {
    display: none;
    grid-column: 1/-1;
    flex-direction: column;
    border-top: 1px solid var(--yx-color-line);
  }
  nav[data-open="true"] {
    display: flex;
  }
  nav > a {
    border-left: 0;
    border-bottom: 1px solid var(--yx-color-line);
    padding: 1rem 0;
  }
  .account {
    padding: 1rem 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
