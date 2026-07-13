<script setup lang="ts">
import { computed, onMounted } from "vue";
import { createLiveAuthGateway } from "../features/auth/adapters/live-auth-gateway";
import { createLiveSessionGateway } from "../features/auth/adapters/live-session-gateway";
import LoginPanel from "../features/auth/components/LoginPanel.vue";
import { createLoginPageState } from "../features/auth/state/login-page-state";
import { firstQueryValue } from "../features/auth/utils/redirect";

definePageMeta({
  middleware: ["login-session"],
});

useSeoMeta({
  title: "登录｜语赞心声",
});

const route = useRoute();
const router = useRouter();
const api = useProductApi();

const loginState = createLoginPageState({
  authGateway: createLiveAuthGateway(api),
  sessionGateway: createLiveSessionGateway(api),
  navigate: async (to) => {
    await router.push(to);
  },
  redirectTo: firstQueryValue(route.query.redirect),
  expired:
    firstQueryValue(route.query.reason) === "expired" ||
    firstQueryValue(route.query.expired) === "1",
});

const panelMessage = computed(() => loginState.state.message);

onMounted(async () => {
  await loginState.initialize();
});
</script>

<template>
  <section class="login-page">
    <div class="yx-shell login-page__shell">
      <LoginPanel
        :status="loginState.state.status"
        :service-mode="loginState.state.serviceMode"
        :identifier="loginState.state.identifier"
        :password="loginState.state.password"
        :redirect-to="loginState.state.redirectTo"
        :message="panelMessage"
        :submitting="loginState.state.submitting"
        @update:identifier="loginState.state.identifier = $event"
        @update:password="loginState.state.password = $event"
        @submit="loginState.submit"
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
