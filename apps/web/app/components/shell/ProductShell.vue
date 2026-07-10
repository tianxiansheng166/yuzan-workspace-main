<script setup lang="ts">
import { ref, watch } from "vue";

import RolePathNavigation from "../navigation/RolePathNavigation.vue";

const route = useRoute();
const navigationOpen = ref(false);
const navigationId = "product-role-navigation";

watch(
  () => route.path,
  () => (navigationOpen.value = false),
);
</script>

<template>
  <div class="product-shell">
    <a class="product-shell__skip" href="#main">跳到主要内容</a>
    <header class="product-shell__header">
      <div class="yx-shell product-shell__bar">
        <NuxtLink class="product-shell__brand" to="/" aria-label="语赞心声首页">
          <span class="product-shell__mark" aria-hidden="true"
            ><i /><i /><i
          /></span>
          <span
            ><strong>语赞心声</strong
            ><small>沿学习路径，看见每一步</small></span
          >
        </NuxtLink>

        <nav class="product-shell__primary" aria-label="主要导航">
          <NuxtLink to="/student/today">今日学习</NuxtLink>
          <NuxtLink to="/assessment">学习测评</NuxtLink>
          <NuxtLink to="/teacher">教师工作台</NuxtLink>
          <NuxtLink to="/products">产品方案</NuxtLink>
        </nav>

        <button
          class="product-shell__toggle"
          type="button"
          :aria-expanded="navigationOpen"
          :aria-controls="navigationId"
          @click="navigationOpen = !navigationOpen"
        >
          <span aria-hidden="true" />
          {{ navigationOpen ? "收起导航" : "打开导航" }}
        </button>
      </div>

      <div
        v-if="navigationOpen"
        :id="navigationId"
        class="product-shell__panel"
      >
        <div class="yx-shell">
          <RolePathNavigation :current-path="route.path" />
        </div>
      </div>
    </header>

    <main id="main" class="product-shell__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.product-shell {
  min-height: 100svh;
  background: var(--yx-bg-canvas);
}
.product-shell__skip {
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 1000;
  padding: 0.75rem 1rem;
  background: #173f35;
  color: #fff;
  transform: translateY(-180%);
}
.product-shell__skip:focus {
  transform: none;
}
.product-shell__header {
  position: sticky;
  top: 0;
  z-index: var(--yx-z-sticky);
  border-bottom: 1px solid
    color-mix(in srgb, var(--yx-text-primary) 18%, transparent);
  background: var(--yx-bg-canvas);
}
.product-shell__bar {
  min-height: 4.75rem;
  display: flex;
  align-items: center;
  gap: clamp(1rem, 3vw, 3rem);
}
.product-shell__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--yx-text-primary);
  text-decoration: none;
  flex: 0 0 auto;
}
.product-shell__brand > span:last-child {
  display: grid;
}
.product-shell__brand strong {
  font: 700 1.05rem/1.2 var(--yx-font-display);
}
.product-shell__brand small {
  margin-top: 0.15rem;
  color: var(--yx-text-secondary);
  font-size: 0.72rem;
}
.product-shell__mark {
  position: relative;
  display: block;
  width: 2.6rem;
  height: 2.6rem;
  border: 2px solid #9c4b35;
  border-radius: 50%;
  overflow: hidden;
}
.product-shell__mark i {
  position: absolute;
  left: -0.2rem;
  width: 3rem;
  height: 0.55rem;
  border-top: 2px solid #345c4d;
  border-radius: 50%;
  transform: rotate(-9deg);
}
.product-shell__mark i:nth-child(1) {
  top: 0.8rem;
}
.product-shell__mark i:nth-child(2) {
  top: 1.25rem;
}
.product-shell__mark i:nth-child(3) {
  top: 1.7rem;
}
.product-shell__primary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(0.8rem, 2vw, 1.8rem);
  margin-left: auto;
}
.product-shell__primary a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  color: var(--yx-text-primary);
  font-weight: 650;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.product-shell__primary a:hover,
.product-shell__primary a.router-link-active {
  color: #8a3f2d;
  border-color: currentColor;
}
.product-shell__toggle {
  min-width: 7rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 1px solid #345c4d;
  border-radius: 999px;
  background: transparent;
  color: var(--yx-text-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.product-shell__toggle span {
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid currentColor;
  border-radius: 50%;
}
.product-shell__panel {
  border-top: 1px solid var(--yx-border-default);
  background: #f2ebdf;
  max-height: calc(100svh - 4.75rem);
  overflow: auto;
}
.product-shell__panel > div {
  padding-block: 1.25rem 1.75rem;
}
.product-shell__main {
  min-height: calc(100svh - 4.75rem);
  outline: none;
}
@media (max-width: 52rem) {
  .product-shell__primary {
    display: none;
  }
  .product-shell__bar {
    justify-content: space-between;
  }
  .product-shell__toggle {
    margin-left: auto;
  }
}
@media (max-width: 25rem) {
  .product-shell__brand small {
    display: none;
  }
  .product-shell__toggle {
    min-width: 2.75rem;
    font-size: 0;
  }
  .product-shell__toggle span {
    margin: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .product-shell__skip {
    transition: none;
  }
}
</style>
