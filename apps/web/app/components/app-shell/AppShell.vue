<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { navigationRoutesForRole, routePatternMatches } from "../../routing/product-route-registry";

const route = useRoute();
const router = useRouter();
const api = useProductApi();
const session = useProductSession();
const navigationOpen = ref(false);
const activeRole = computed(() => session.activeMembership.value?.role);
const entries = computed(() => navigationRoutesForRole(activeRole.value));
const accessMessage = computed(() => route.query.accessReason === "role-mismatch"
  ? `当前身份不能访问 ${String(route.query.deniedRoute ?? "该页面")}，已返回所属产品端。`
  : null);
function active(path: string) { return routePatternMatches(path, route.path); }
async function logout() {
  try { await api.logout(); } finally { session.clear(); await router.push("/login"); }
}
watch(() => route.path, () => { navigationOpen.value = false; });
onMounted(() => session.refresh());
</script>

<template>
  <div class="new-product-shell">
    <a class="skip" href="#main">跳到主要内容</a>
    <header class="product-header">
      <div class="product-header__inner">
        <NuxtLink to="/" class="product-brand" aria-label="语赞心声首页">
          <img src="/art/pixel-v3/login-logo.png" alt="语赞心声" />
        </NuxtLink>
        <button class="mobile-toggle" type="button" :aria-expanded="navigationOpen" @click="navigationOpen = !navigationOpen">
          {{ navigationOpen ? "收起导航" : "展开导航" }}
        </button>
        <nav class="product-nav" :data-open="navigationOpen" aria-label="产品导航">
          <NuxtLink v-for="entry in entries" :key="entry.id" :to="entry.path" :aria-current="active(entry.path) ? 'page' : undefined">
            <span>{{ entry.label }}</span>
          </NuxtLink>
          <div class="account-actions">
            <NuxtLink v-if="session.state.value.status !== 'authenticated'" to="/login">登录</NuxtLink>
            <template v-else>
              <NuxtLink to="/select-school">切换学校</NuxtLink>
              <button type="button" @click="logout">退出登录</button>
            </template>
          </div>
        </nav>
      </div>
    </header>
    <p v-if="accessMessage" class="access-message" role="status">{{ accessMessage }}</p>
    <main id="main"><slot /></main>
  </div>
</template>

<style scoped>
.new-product-shell { min-height:100vh; background:#faf7f0; color:#1d292c; }
.skip { position:fixed; z-index:100; left:1rem; top:1rem; transform:translateY(-180%); padding:.7rem 1rem; background:#1d292c; color:#fff; }.skip:focus { transform:none; }
.product-header { position:relative; z-index:20; border-bottom:1px solid #e7e5e1; background:rgba(255,255,255,.97); }
.product-header__inner { max-width:96rem; min-height:5.8rem; margin:auto; padding:0 clamp(1.25rem,4vw,4rem); display:flex; align-items:center; gap:2rem; }
.product-brand { margin-right:auto; }.product-brand img { width:9.5rem; max-height:4.6rem; object-fit:contain; display:block; }
.product-nav { display:flex; align-items:stretch; min-width:0; }.product-nav > a { display:flex; align-items:center; padding:0 1.1rem; color:#334238; text-decoration:none; font-weight:750; border-left:1px solid #e7e5e1; }.product-nav > a[aria-current="page"] { color:#b90003; box-shadow:inset 0 -3px #b90003; }.account-actions { display:flex; align-items:center; gap:1rem; padding-left:1.2rem; }.account-actions a,.account-actions button { border:0; padding:0; background:none; color:#b90003; font:inherit; font-weight:750; text-decoration:none; cursor:pointer; }.mobile-toggle { display:none; border:1px solid #286640; background:#fff; padding:.65rem .85rem; color:#286640; font:inherit; }
.access-message { margin:0; padding:.75rem max(1.25rem,calc((100vw - 88rem)/2)); border-bottom:1px solid #d99b2f; background:#fff9e9; color:#4d4124; }
.product-nav a:focus-visible,.account-actions button:focus-visible,.account-actions a:focus-visible,.mobile-toggle:focus-visible { outline:3px solid #d99b2f; outline-offset:3px; }
@media (max-width:64rem) { .product-header__inner { flex-wrap:wrap; padding-block:.8rem; }.mobile-toggle { display:block; }.product-nav { display:none; flex-basis:100%; flex-direction:column; border-top:1px solid #e7e5e1; }.product-nav[data-open="true"] { display:flex; }.product-nav > a { min-height:3rem; padding:0; border:0; border-bottom:1px solid #e7e5e1; }.account-actions { padding:1rem 0 0; } }
@media (prefers-reduced-motion:reduce) { * { transition:none!important; } }
</style>
