<script setup lang="ts">
import { computed } from "vue";
import { YxButton, YxInput, YxStatus } from "@yuzan/ui";

import type { AuthViewStatus, ServiceMode } from "../models";

const props = withDefaults(
  defineProps<{
    status: AuthViewStatus;
    serviceMode: ServiceMode;
    identifier: string;
    password: string;
    redirectTo?: string;
    message?: string;
    submitting?: boolean;
  }>(),
  {
    redirectTo: undefined,
    message: undefined,
    submitting: false,
  },
);

const emit = defineEmits<{
  "update:identifier": [value: string];
  "update:password": [value: string];
  submit: [];
}>();

const statusTone = computed(() => {
  switch (props.status) {
    case "authenticated":
      return "success";
    case "expired":
      return "warning";
    case "error":
      return "danger";
    case "unavailable":
      return "information";
    default:
      return "neutral";
  }
});

const statusLabel = computed(() => {
  switch (props.status) {
    case "loading":
      return "正在确认登录状态";
    case "unauthenticated":
      return "尚未登录";
    case "authenticated":
      return "已登录";
    case "expired":
      return "会话已过期";
    case "error":
      return "登录遇到问题";
    case "unavailable":
      return "服务暂不可用";
  }
});

const helperCopy = computed(() => {
  if (props.message) {
    return props.message;
  }

  if (props.status === "unavailable") {
    return "当前页面只展示边界与状态，不会伪造统一登录成功。";
  }

  return "角色权限只会根据服务返回结果决定，不接受前端自行提权。";
});
</script>

<template>
  <section class="login-panel" aria-labelledby="login-title">
    <div class="login-panel__copy">
      <p class="yx-kicker">IDENTITY WEB</p>
      <h1 id="login-title">统一登录与会话状态</h1>
      <p>
        登录页先建立明确边界：状态可见、回跳安全、会话可清理，等待真实 SSO
        与身份服务接入。
      </p>
      <div class="login-panel__meta">
        <YxStatus :tone="statusTone">{{ statusLabel }}</YxStatus>
        <YxStatus tone="neutral">模式：{{ serviceMode }}</YxStatus>
        <YxStatus v-if="redirectTo" tone="neutral">
          回跳：{{ redirectTo }}
        </YxStatus>
      </div>
    </div>

    <form class="login-panel__form" @submit.prevent="emit('submit')">
      <YxInput
        :model-value="identifier"
        label="账号"
        autocomplete="username"
        required
        autofocus
        :description="
          status === 'unavailable'
            ? '当前环境只展示占位边界，可先验证交互和错误处理。'
            : '请输入由统一身份系统分配的账号。'
        "
        @update:model-value="emit('update:identifier', $event)"
      />
      <YxInput
        :model-value="password"
        type="password"
        label="密码"
        autocomplete="current-password"
        required
        :error="status === 'error' ? helperCopy : undefined"
        :description="
          status === 'expired'
            ? helperCopy
            : '密码仅用于本次提交，不会写入 localStorage 或长期缓存。'
        "
        @update:model-value="emit('update:password', $event)"
      />

      <p
        v-if="
          status === 'unauthenticated' ||
          status === 'unavailable' ||
          status === 'loading'
        "
        class="login-panel__hint"
        :data-status="status"
      >
        {{ helperCopy }}
      </p>

      <p
        v-if="status === 'expired'"
        class="login-panel__hint login-panel__hint--warning"
        role="status"
      >
        {{ helperCopy }}
      </p>

      <YxButton
        type="submit"
        :loading="submitting"
        :disabled="status === 'loading' && !submitting"
        loading-label="正在提交"
      >
        登录
      </YxButton>
    </form>
  </section>
</template>

<style scoped>
.login-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 28rem);
  gap: clamp(2rem, 6vw, 6rem);
  align-items: start;
}

.login-panel__copy {
  max-width: 42rem;
}

.login-panel__copy h1 {
  margin: 0.9rem 0 1rem;
  font: 600 clamp(2.4rem, 6vw, 4.8rem) / 1 var(--yx-font-display);
  letter-spacing: -0.04em;
}

.login-panel__copy p {
  margin: 0;
  color: var(--yx-color-ink-soft);
  line-height: 1.75;
}

.login-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.login-panel__form {
  display: grid;
  gap: 1rem;
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-lg);
  background: color-mix(in srgb, var(--yx-color-paper) 92%, white);
  box-shadow: var(--yx-shadow-100);
}

.login-panel__hint {
  margin: 0;
  color: var(--yx-color-ink-soft);
  line-height: 1.6;
}

.login-panel__hint--warning {
  color: var(--yx-color-wine);
}

@media (max-width: 54rem) {
  .login-panel {
    grid-template-columns: 1fr;
  }
}
</style>
