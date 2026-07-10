<script setup lang="ts">
import { computed, ref } from "vue";
import LoginPanel from "../features/auth/components/LoginPanel.vue";
import { firstQueryValue } from "../features/auth/utils/redirect";
import { homeForRole } from "../features/auth/utils/session";
import { ApiError, ApiUnavailableError } from "../lib/api/client";

definePageMeta({
  middleware: ["login-session"],
});

useSeoMeta({
  title: "登录｜语赞心声",
});

const route = useRoute();
const auth = useAuthSession();
const identifier = ref("");
const password = ref("");
const status = ref<"unauthenticated" | "loading" | "error" | "unavailable">(
  "unauthenticated",
);
const message = ref<string>();
const redirectTo = computed(() => firstQueryValue(route.query.redirect));

async function submit() {
  if (status.value === "loading") return;
  status.value = "loading";
  message.value = undefined;
  try {
    const session = await auth.login(identifier.value.trim(), password.value);
    password.value = "";
    if (session.memberships.length === 0) {
      status.value = "error";
      message.value = "此账号没有可用学校，无法进入系统。";
      await auth.logout();
      return;
    }
    if (session.memberships.length > 1) {
      await navigateTo("/select-school");
      return;
    }
    const membership = session.memberships[0]!;
    await navigateTo(redirectTo.value ?? homeForRole(membership.role));
  } catch (error) {
    password.value = "";
    if (error instanceof ApiUnavailableError) {
      status.value = "unavailable";
      message.value = error.message;
    } else {
      status.value = "error";
      message.value =
        error instanceof ApiError && error.status === 401
          ? "账号或密码错误，请重新输入。"
          : "登录失败，请稍后重试。";
    }
  }
}
</script>

<template>
  <section class="login-page">
    <div class="yx-shell login-page__shell">
      <LoginPanel
        :status="status"
        service-mode="live"
        :identifier="identifier"
        :password="password"
        :redirect-to="redirectTo"
        :message="message"
        :submitting="status === 'loading'"
        @update:identifier="identifier = $event"
        @update:password="password = $event"
        @submit="submit"
      />
    </div>
  </section>
</template>

<style scoped>
.login-page {
  min-height: calc(100svh - 4.25rem);
  display: grid;
  align-items: center;
  padding-block: clamp(3rem, 8vw, 7rem);
  background:
    radial-gradient(
      circle at top left,
      color-mix(in srgb, var(--yx-color-gold) 12%, transparent),
      transparent 28%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--yx-color-sage-strong) 9%, white),
      var(--yx-color-paper)
    );
}

.login-page__shell {
  width: min(100%, 72rem);
}
</style>
