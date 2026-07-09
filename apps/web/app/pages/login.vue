<script setup lang="ts">
import { computed } from "vue";
import { YxButton, YxInput, YxStatus } from "@yuzan/ui";
import { useAuthForm } from "~/features/auth/composables/useAuthForm";

definePageMeta({
  middleware: ["guest"],
});

useSeoMeta({
  title: "登录 | 语赞心声",
});

const {
  state,
  errorMessage,
  identifier,
  password,
  remember,
  login,
} = useAuthForm();

const isSubmittable = computed(
  () =>
    state.value !== "loading" &&
    identifier.value.trim().length > 0 &&
    password.value.length > 0,
);

async function onSubmit(): Promise<void> {
  const ok = await login();
  if (ok) {
    await navigateTo("/session", { replace: true });
  }
}
</script>

<template>
  <section class="login-page yx-shell">
    <div class="login-card">
      <header class="login-card__header">
        <p class="yx-kicker">STACKED_PROVISIONAL</p>
        <h1>登录</h1>
        <YxStatus tone="warning">Demo 会话，不接正式后端</YxStatus>
      </header>

      <p class="login-card__notice">
        GOV-002 尚未最终批准。本页面仅演示登录流程，不会提交真实密码到后端。
      </p>

      <form class="login-form" @submit.prevent="onSubmit">
        <YxInput
          v-model="identifier"
          label="邮箱或账号"
          type="text"
          autocomplete="username"
          required
          placeholder="demo@yuzan.example"
        />

        <YxInput
          v-model="password"
          label="密码"
          type="password"
          autocomplete="current-password"
          required
          placeholder="演示密码至少 4 位"
        />

        <label class="login-form__remember">
          <input v-model="remember" type="checkbox" />
          <span>保持登录状态 7 天（仅演示）</span>
        </label>

        <YxButton
          type="submit"
          :loading="state === 'loading'"
          :disabled="!isSubmittable"
        >
          登录
        </YxButton>
      </form>

      <div
        v-if="state === 'success'"
        class="login-result login-result--success"
        role="status"
      >
        登录成功，正在进入会话页面……
      </div>

      <div
        v-else-if="state === 'error'"
        class="login-result login-result--error"
        role="alert"
      >
        {{ errorMessage }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  min-height: calc(100svh - 4.25rem);
  padding-block: clamp(2rem, 6vw, 5rem);
}

.login-card {
  width: min(100%, 26rem);
  padding: clamp(1.5rem, 5vw, 2.5rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.login-card__header {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.login-card h1 {
  margin: 0;
  font: 600 var(--yx-font-size-600) / 1.1 var(--yx-font-display);
}

.login-card__notice {
  margin: 0 0 1.25rem;
  padding: 0.75rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-warning-bg);
  color: var(--yx-warning-fg);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

.login-form {
  display: grid;
  gap: 1rem;
}

.login-form__remember {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
}

.login-form__remember input {
  width: 1.1rem;
  height: 1.1rem;
}

.login-result {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: var(--yx-radius-md);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

.login-result--success {
  background: var(--yx-success-bg);
  color: var(--yx-success-fg);
}

.login-result--error {
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
}
</style>
