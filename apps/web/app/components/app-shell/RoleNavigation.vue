<script setup lang="ts">
import { computed } from "vue";

import { YxStatus } from "@yuzan/ui";

import {
  roleNavigationGroups,
  roleNavigationStatuses,
} from "~/features/role-navigation/role-navigation.config";
import {
  getStatusDefinition,
  isNavigationItemActive,
} from "~/features/role-navigation/role-navigation.helpers";

const props = defineProps<{
  currentPath: string;
  compact?: boolean;
}>();

function groupIsActive(groupId: string) {
  const group = roleNavigationGroups.find((entry) => entry.id === groupId);

  return (
    group?.items.some((item) =>
      isNavigationItemActive(item, props.currentPath),
    ) ?? false
  );
}

const statusLegend = computed(() => roleNavigationStatuses);
</script>

<template>
  <nav
    class="role-navigation"
    :class="{ 'role-navigation--compact': compact }"
    aria-label="角色分组导航"
  >
    <div class="role-navigation__intro">
      <div>
        <p class="yx-kicker">Role Navigation</p>
        <h2>统一应用壳导航</h2>
      </div>
      <p>
        当前只基于仓库内已存在的页面组织入口，不接真实鉴权，也不伪造真实用户角色。
      </p>
    </div>

    <div class="role-navigation__groups">
      <section
        v-for="group in roleNavigationGroups"
        :key="group.id"
        class="role-navigation__group"
        :data-active="groupIsActive(group.id) ? 'true' : 'false'"
      >
        <div class="role-navigation__group-header">
          <div>
            <h3>{{ group.label }}</h3>
            <p>{{ group.summary }}</p>
          </div>
          <YxStatus :tone="groupIsActive(group.id) ? 'information' : 'neutral'">
            {{ groupIsActive(group.id) ? "当前分组" : "可访问入口" }}
          </YxStatus>
        </div>

        <ul class="role-navigation__item-list">
          <li v-for="item in group.items" :key="item.id">
            <NuxtLink
              class="role-navigation__item"
              :class="{
                'is-active': isNavigationItemActive(item, currentPath),
              }"
              :to="item.to"
              :aria-current="
                isNavigationItemActive(item, currentPath) ? 'page' : undefined
              "
            >
              <span class="role-navigation__item-title">{{ item.label }}</span>
              <span class="role-navigation__item-description">
                {{ item.description }}
              </span>
              <span class="role-navigation__item-status-text">
                {{ item.routeStatusText }}
              </span>
              <span class="role-navigation__item-statuses">
                <YxStatus
                  v-for="statusId in item.statusIds"
                  :key="statusId"
                  :tone="getStatusDefinition(statusId).tone"
                >
                  {{ getStatusDefinition(statusId).label }}
                </YxStatus>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>

    <section
      class="role-navigation__legend"
      aria-labelledby="role-navigation-legend-title"
    >
      <h3 id="role-navigation-legend-title">状态说明</h3>
      <ul class="role-navigation__legend-list">
        <li v-for="status in statusLegend" :key="status.id">
          <YxStatus :tone="status.tone">{{ status.label }}</YxStatus>
          <span>{{ status.description }}</span>
        </li>
      </ul>
    </section>
  </nav>
</template>

<style scoped>
.role-navigation {
  display: grid;
  gap: var(--yx-space-500);
}

.role-navigation__intro,
.role-navigation__group,
.role-navigation__legend {
  padding: clamp(1rem, 2vw, 1.35rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: color-mix(
    in srgb,
    var(--yx-surface-default) 92%,
    var(--yx-bg-canvas)
  );
}

.role-navigation__intro {
  display: flex;
  justify-content: space-between;
  gap: var(--yx-space-500);
  align-items: start;
}

.role-navigation__intro h2,
.role-navigation__group-header h3,
.role-navigation__legend h3 {
  margin: 0;
  font-family: var(--yx-font-display);
}

.role-navigation__intro p:last-child,
.role-navigation__group-header p,
.role-navigation__item-description,
.role-navigation__item-status-text,
.role-navigation__legend-list span {
  color: var(--yx-text-secondary);
}

.role-navigation__intro p:last-child {
  margin: 0;
  max-width: 34rem;
}

.role-navigation__groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--yx-space-500);
}

.role-navigation__group[data-active="true"] {
  border-color: var(--yx-information-border);
  box-shadow: var(--yx-shadow-100);
}

.role-navigation__group-header {
  display: flex;
  justify-content: space-between;
  gap: var(--yx-space-300);
  align-items: start;
}

.role-navigation__group-header p {
  margin: 0.35rem 0 0;
}

.role-navigation__item-list,
.role-navigation__legend-list {
  list-style: none;
  padding: 0;
  margin: var(--yx-space-500) 0 0;
}

.role-navigation__item-list {
  display: grid;
  gap: var(--yx-space-300);
}

.role-navigation__item {
  display: grid;
  gap: var(--yx-space-200);
  padding: var(--yx-space-400);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
  text-decoration: none;
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    transform var(--yx-motion-duration-fast) var(--yx-motion-ease-standard);
}

.role-navigation__item:hover {
  border-color: var(--yx-border-strong);
  background: var(--yx-bg-muted);
}

.role-navigation__item:active {
  transform: translateY(1px);
}

.role-navigation__item.is-active {
  border-color: var(--yx-information-border);
  background: color-mix(
    in srgb,
    var(--yx-information-bg) 48%,
    var(--yx-surface-default)
  );
}

.role-navigation__item-title {
  font-weight: var(--yx-font-weight-semibold);
}

.role-navigation__item-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-200);
}

.role-navigation__legend-list {
  display: grid;
  gap: var(--yx-space-300);
}

.role-navigation__legend-list li {
  display: flex;
  gap: var(--yx-space-300);
  align-items: start;
}

.role-navigation--compact .role-navigation__intro {
  flex-direction: column;
}

@media (max-width: 80rem) {
  .role-navigation__groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .role-navigation__intro,
  .role-navigation__group-header,
  .role-navigation__legend-list li {
    flex-direction: column;
  }
}
</style>
