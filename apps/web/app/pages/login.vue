<script setup lang="ts">
import { computed, onMounted } from "vue";
import V3TerrainArtwork from "../components/yuzan-v3/V3TerrainArtwork.vue";
import { createBrowserSessionGateway } from "../features/auth/adapters/browser-session-gateway";
import { createUnavailableAuthGateway } from "../features/auth/adapters/unavailable-auth-gateway";
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

const loginState = createLoginPageState({
  authGateway: createUnavailableAuthGateway(),
  sessionGateway: createBrowserSessionGateway(),
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
      <V3TerrainArtwork
        class="login-page__art"
        src="/art/yuzan-v3/login-art-clean.jpg"
        tone="wine"
        position="bottom"
      >
        <p>从雪山到课堂，让每一次学习都能继续。</p>
      </V3TerrainArtwork>
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
  display: grid;
  grid-template-columns: minmax(16rem, 0.72fr) minmax(0, 1.28fr);
  gap: clamp(1.5rem, 5vw, 4rem);
  align-items: center;
}

.login-page__art { min-height: 34rem; }
.login-page__art p {
  max-width: 12ch;
  margin: 0;
  font: 600 clamp(1.5rem, 3vw, 2.5rem) / 1.15 var(--yx-font-display);
}

@media (max-width: 54rem) {
  .login-page__shell { grid-template-columns: 1fr; }
  .login-page__art { min-height: 16rem; }
}
</style>
