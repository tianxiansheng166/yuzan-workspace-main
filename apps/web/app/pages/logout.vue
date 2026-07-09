<script setup lang="ts">
import { onMounted } from "vue";
import { YxButton } from "@yuzan/ui";
import { useSession } from "~/features/session/composables/useSession";

useSeoMeta({
  title: "已退出 | 语赞心声",
});

const { state, session, logout } = useSession();

onMounted(() => {
  void logout();
});
</script>

<template>
  <section class="logout-page yx-shell">
    <div class="logout-card">
      <p class="yx-kicker">STACKED_PROVISIONAL</p>
      <h1>已退出</h1>

      <p v-if="state === 'loading'" role="status">正在清除 demo 会话……</p>
      <p v-else-if="state === 'error'" role="alert">
        清除会话时出错，请手动关闭浏览器标签。
      </p>
      <template v-else>
        <p>demo 会话已清除，本地 storage 中的临时登录状态已删除。</p>
        <p v-if="session" class="logout-card__warning">
          会话对象仍残留在内存中，刷新后将消失。
        </p>
      </template>

      <div class="logout-card__actions">
        <NuxtLink to="/login">
          <YxButton kind="secondary">重新登录</YxButton>
        </NuxtLink>
        <NuxtLink to="/">
          <YxButton kind="quiet">返回首页</YxButton>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.logout-page {
  display: grid;
  place-items: center;
  min-height: calc(100svh - 4.25rem);
  padding-block: clamp(2rem, 6vw, 5rem);
}

.logout-card {
  width: min(100%, 26rem);
  padding: clamp(1.5rem, 5vw, 2.5rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.logout-card h1 {
  margin: 0.5rem 0 1.25rem;
  font: 600 var(--yx-font-size-600) / 1.1 var(--yx-font-display);
}

.logout-card p {
  margin: 0 0 1rem;
  color: var(--yx-text-secondary);
  line-height: 1.7;
}

.logout-card__warning {
  color: var(--yx-warning-fg);
  font-size: var(--yx-font-size-200);
}

.logout-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.logout-card__actions a {
  text-decoration: none;
}
</style>
