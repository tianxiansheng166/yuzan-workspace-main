<script setup lang="ts">
import { YxButton, YxStatus } from "@yuzan/ui";
import { useSession } from "~/features/session/composables/useSession";

useSeoMeta({
  title: "会话状态 | 语赞心声",
});

const { state, error, session, refresh, logout } = useSession();

async function onLogout(): Promise<void> {
  await logout();
  await navigateTo("/logout", { replace: true });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}
</script>

<template>
  <section class="session-page yx-shell">
    <div class="session-card">
      <header class="session-card__header">
        <p class="yx-kicker">STACKED_PROVISIONAL</p>
        <h1>Demo 会话状态</h1>
      </header>

      <p class="session-card__notice">
        GOV-002 尚未最终批准。本页仅展示本地 demo session，不代表真实认证状态。
      </p>

      <div v-if="state === 'loading'" class="session-state" role="status">
        正在读取 demo 会话……
      </div>

      <div v-else-if="state === 'error'" class="session-state session-state--error" role="alert">
        读取失败：{{ error?.message ?? "未知错误" }}
        <YxButton kind="secondary" @click="refresh">重试</YxButton>
      </div>

      <div v-else-if="session" class="session-state session-state--active">
        <YxStatus tone="success">已登录（demo）</YxStatus>

        <dl class="session-details">
          <div>
            <dt>用户</dt>
            <dd>{{ session.user.name }}</dd>
          </div>
          <div>
            <dt>角色</dt>
            <dd>{{ session.user.role }}</dd>
          </div>
          <div>
            <dt>登录时间</dt>
            <dd>{{ formatTime(session.createdAt) }}</dd>
          </div>
          <div>
            <dt>过期时间</dt>
            <dd>{{ formatTime(session.expiresAt) }}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd class="session-token">{{ session.token }}</dd>
          </div>
        </dl>

        <YxButton @click="onLogout">退出登录</YxButton>
      </div>

      <div v-else class="session-state session-state--empty">
        <YxStatus tone="neutral">未登录</YxStatus>
        <p>当前没有有效的 demo 会话，或会话已过期/不可用。</p>
        <NuxtLink to="/login">
          <YxButton>前往登录</YxButton>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.session-page {
  display: grid;
  place-items: start center;
  min-height: calc(100svh - 4.25rem);
  padding-block: clamp(2rem, 6vw, 5rem);
}

.session-card {
  width: min(100%, 32rem);
  padding: clamp(1.5rem, 5vw, 2.5rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.session-card__header {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.session-card h1 {
  margin: 0;
  font: 600 var(--yx-font-size-600) / 1.1 var(--yx-font-display);
}

.session-card__notice {
  margin: 0 0 1.5rem;
  padding: 0.75rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-warning-bg);
  color: var(--yx-warning-fg);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

.session-state {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.session-state--error {
  color: var(--yx-danger-fg);
}

.session-state--empty p {
  margin: 0;
  color: var(--yx-text-secondary);
  line-height: 1.7;
}

.session-details {
  display: grid;
  gap: 0.75rem;
  width: 100%;
  margin: 0.5rem 0 0;
}

.session-details div {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--yx-border-subtle);
}

.session-details dt {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.session-details dd {
  margin: 0;
  word-break: break-all;
}

.session-token {
  font-family: monospace;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
}

.session-state a {
  text-decoration: none;
}

@media (max-width: 30rem) {
  .session-details div {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
