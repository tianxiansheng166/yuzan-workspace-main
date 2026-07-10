<script setup lang="ts">
import { computed, ref } from "vue";
import { homeForRole } from "../features/auth/utils/session";

definePageMeta({ middleware: ["auth-session"] });
useSeoMeta({ title: "选择学校｜语赞心声" });

const auth = useAuthSession();
const selected = ref<string>();
const memberships = computed(() => auth.session.value?.memberships ?? []);
const message = computed(() => {
  if (memberships.value.length === 0) return "此账号没有可用学校。";
  if (memberships.value.length === 1) return "正在进入你的学校。";
  return "当前后端尚未提供学校选择持久化接口，暂时无法安全切换学校。";
});

if (memberships.value.length === 1) {
  const membership = memberships.value[0]!;
  await navigateTo(homeForRole(membership.role));
}
</script>

<template>
  <main class="yx-shell school-page">
    <p class="yx-kicker">SCHOOL CONTEXT</p>
    <h1>选择学校</h1>
    <p role="status">{{ message }}</p>
    <div v-if="memberships.length > 1" class="school-list">
      <label v-for="membership in memberships" :key="membership.schoolId">
        <input v-model="selected" type="radio" :value="membership.schoolId" />
        <span>{{ membership.schoolName }}</span>
      </label>
    </div>
    <YxButton v-if="memberships.length > 1" disabled>进入学校</YxButton>
    <NuxtLink to="/login" @click="auth.logout">退出登录</NuxtLink>
  </main>
</template>

<style scoped>
.school-page {
  max-width: 42rem;
  padding-block: clamp(3rem, 8vw, 7rem);
}
.school-page h1 {
  font: 600 clamp(2.3rem, 6vw, 4rem) / 1 var(--yx-font-display);
}
.school-list {
  display: grid;
  gap: 0.75rem;
  margin-block: 2rem;
}
.school-list label {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
}
</style>
