<script setup lang="ts">
import { roleNavigationGroups } from "~/features/role-navigation/role-navigation.config";
import { isNavigationItemActive } from "~/features/role-navigation/role-navigation.helpers";

defineProps<{ currentPath: string }>();
</script>

<template>
  <nav class="role-path" aria-label="角色与产品入口">
    <header>
      <p class="yx-kicker">选择一条路径</p>
      <h2>从你今天要完成的事出发</h2>
      <p>
        当前为开发预览；demo、pending 与 unavailable
        均按真实可用状态标识，不代表已登录或已获授权。
      </p>
    </header>
    <div class="role-path__routes">
      <section v-for="(group, index) in roleNavigationGroups" :key="group.id">
        <p class="role-path__number" aria-hidden="true">0{{ index + 1 }}</p>
        <h3>{{ group.label }}</h3>
        <p>{{ group.summary }}</p>
        <ul>
          <li v-for="item in group.items" :key="item.id">
            <NuxtLink
              :to="item.to"
              :aria-current="
                isNavigationItemActive(item, currentPath) ? 'page' : undefined
              "
              ><strong>{{ item.label }}</strong
              ><span>{{ item.statusIds.join(" · ") }}</span></NuxtLink
            >
          </li>
        </ul>
      </section>
    </div>
  </nav>
</template>

<style scoped>
.role-path {
  display: grid;
  grid-template-columns: minmax(13rem, 0.7fr) minmax(0, 2fr);
  gap: clamp(1.5rem, 4vw, 4rem);
}
.role-path header h2 {
  margin: 0.4rem 0 0.75rem;
  font: 700 clamp(1.5rem, 2.5vw, 2.2rem)/1.15 var(--yx-font-display);
}
.role-path header > p:last-child,
.role-path section > p {
  color: var(--yx-text-secondary);
  line-height: 1.65;
}
.role-path__routes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-left: 1px solid #b6aa98;
}
.role-path section {
  padding-inline: clamp(1rem, 2.4vw, 2rem);
  border-right: 1px solid #b6aa98;
}
.role-path__number {
  margin: 0;
  color: #9c4b35 !important;
  font: 700 0.75rem/1 var(--yx-font-display);
  letter-spacing: 0.16em;
}
.role-path h3 {
  margin: 0.55rem 0 0.35rem;
  font: 700 1.1rem/1.2 var(--yx-font-display);
}
.role-path ul {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
}
.role-path a {
  min-height: 2.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px dashed #b6aa98;
  color: var(--yx-text-primary);
  text-decoration: none;
}
.role-path a span {
  color: #7f4534;
  font-size: 0.72rem;
  font-weight: 700;
  text-align: right;
}
.role-path a[aria-current="page"] strong::before {
  content: "当前 · ";
  color: #7f4534;
}
@media (max-width: 64rem) {
  .role-path {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 48rem) {
  .role-path__routes {
    grid-template-columns: 1fr;
    border: 0;
  }
  .role-path section {
    border-right: 0;
    border-top: 1px solid #b6aa98;
    padding: 1rem 0;
  }
}
</style>
