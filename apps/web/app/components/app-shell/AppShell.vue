<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { YxButton, YxStatus } from "@yuzan/ui";

import { getAppShellContext } from "~/features/app-shell/app-shell-content";

const route = useRoute();
const navigationOpen = ref(false);
const navigationPanelId = "app-shell-role-navigation";

const shellContext = computed(() => getAppShellContext(route.path));
const currentRoleText = computed(
  () =>
    `当前分组：${shellContext.value.roleLabel} · 当前区域：${shellContext.value.areaLabel}`,
);

function closeNavigation() {
  navigationOpen.value = false;
}

watch(
  () => route.path,
  () => {
    closeNavigation();
  },
);
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div class="yx-shell app-shell__masthead">
        <NuxtLink to="/" class="app-shell__brand" aria-label="语赞心声首页">
          <span class="app-shell__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 44 44">
              <path d="M5 29c9-14 15 7 24-7 4-6 7-8 10-7" />
              <path d="M7 35c10-8 17 3 28-8" />
            </svg>
          </span>
          <span>语赞心声</span>
        </NuxtLink>

        <div class="app-shell__context">
          <p class="yx-kicker">Unified App Shell</p>
          <p class="app-shell__context-line">{{ currentRoleText }}</p>
          <p class="app-shell__context-summary">
            {{ shellContext.contextSummary }}
          </p>
        </div>

        <div class="app-shell__meta">
          <YxStatus tone="information">开发预览</YxStatus>
          <p>当前仅展示统一导航分组，不代表真实登录状态或真实权限。</p>
        </div>

        <YxButton
          class="app-shell__toggle"
          kind="secondary"
          :aria-expanded="navigationOpen ? 'true' : 'false'"
          :aria-controls="navigationPanelId"
          @click="navigationOpen = !navigationOpen"
        >
          {{ navigationOpen ? "收起角色导航" : "展开角色导航" }}
        </YxButton>
      </div>

      <div
        class="yx-shell app-shell__navigation app-shell__navigation--desktop"
      >
        <RoleNavigation :current-path="route.path" />
      </div>

      <div
        v-show="navigationOpen"
        :id="navigationPanelId"
        class="yx-shell app-shell__navigation app-shell__navigation--mobile"
      >
        <RoleNavigation :current-path="route.path" compact />
      </div>
    </header>

    <main id="main" class="app-shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-shell__header {
  position: sticky;
  top: 0;
  z-index: var(--yx-z-sticky);
  border-bottom: 1px solid var(--yx-border-default);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--yx-surface-raised) 96%, transparent),
    color-mix(in srgb, var(--yx-bg-canvas) 92%, transparent)
  );
  backdrop-filter: blur(18px);
}

.app-shell__masthead {
  display: grid;
  grid-template-columns: auto minmax(0, 1.4fr) minmax(16rem, 0.9fr) auto;
  gap: var(--yx-space-500);
  align-items: start;
  min-height: 5rem;
  padding-block: var(--yx-space-500);
}

.app-shell__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--yx-text-primary);
  text-decoration: none;
  font-family: var(--yx-font-display);
  font-weight: var(--yx-font-weight-bold);
}

.app-shell__brand-mark {
  width: 2.2rem;
  color: var(--yx-text-accent);
}

.app-shell__brand-mark svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.app-shell__context-line,
.app-shell__context-summary,
.app-shell__meta p {
  margin: 0;
}

.app-shell__context-line {
  font-weight: var(--yx-font-weight-semibold);
}

.app-shell__context-summary,
.app-shell__meta p {
  margin-top: var(--yx-space-200);
  color: var(--yx-text-secondary);
}

.app-shell__meta {
  display: grid;
  gap: var(--yx-space-200);
  justify-items: start;
}

.app-shell__toggle {
  display: none;
}

.app-shell__navigation {
  padding-bottom: var(--yx-space-500);
}

.app-shell__navigation--mobile {
  display: none;
}

.app-shell__main {
  min-height: calc(100vh - 5rem);
}

@media (max-width: 80rem) {
  .app-shell__masthead {
    grid-template-columns: auto 1fr auto;
  }

  .app-shell__meta {
    grid-column: 2 / 4;
  }
}

@media (max-width: 64rem) {
  .app-shell__masthead {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .app-shell__brand {
    grid-column: 1;
  }

  .app-shell__context,
  .app-shell__meta {
    grid-column: 1 / -1;
  }

  .app-shell__toggle {
    display: inline-flex;
  }

  .app-shell__navigation--desktop {
    display: none;
  }

  .app-shell__navigation--mobile {
    display: block;
  }
}

@media (max-width: 48rem) {
  .app-shell__masthead {
    gap: var(--yx-space-400);
  }

  .app-shell__toggle :deep(button),
  .app-shell__toggle {
    width: 100%;
  }
}
</style>
