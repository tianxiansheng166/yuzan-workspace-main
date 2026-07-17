<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createLiveAuthGateway } from "../features/auth/adapters/live-auth-gateway";
import { createLiveSessionGateway } from "../features/auth/adapters/live-session-gateway";
import { createLoginPageState } from "../features/auth/state/login-page-state";
import { firstQueryValue } from "../features/auth/utils/redirect";

definePageMeta({ layout: "landing", middleware: ["login-session"] });
useSeoMeta({ title: "登录｜语赞心声" });

const route = useRoute();
const router = useRouter();
const api = useProductApi();
const passwordVisible = ref(false);
const loginState = createLoginPageState({
  authGateway: createLiveAuthGateway(api),
  sessionGateway: createLiveSessionGateway(api),
  navigate: async (to) => {
    await router.push(to);
  },
  redirectTo: firstQueryValue(route.query.redirect),
  expired: firstQueryValue(route.query.reason) === "expired" || firstQueryValue(route.query.expired) === "1",
});
const messageTone = computed(() => loginState.state.status === "error" ? "error" : "info");
onMounted(() => loginState.initialize());
</script>

<template>
  <main class="login-design">
    <section class="login-art" aria-label="语赞心声品牌视觉">
      <NuxtLink to="/" class="login-logo" aria-label="返回首页">
        <img src="/art/pixel-v3/login-logo.png" alt="语赞心声" />
      </NuxtLink>
      <p class="art-kicker">语赞心声 · 学习支持平台</p>
      <h1>让每一次发声，<br /><strong>沿着高原的学习路径被听见。</strong></h1>
      <p class="art-caption">登录后继续你的学习、教学或志愿支持路径。</p>
    </section>

    <section class="login-panel" aria-labelledby="login-title">
      <div class="form-wrap">
        <p class="kicker">身份验证</p>
        <h2 id="login-title">欢迎回来</h2>
        <p class="subtitle">使用学校或平台已开通的账号登录。</p>
        <form @submit.prevent="loginState.submit">
          <label for="identifier">账号</label>
          <input id="identifier" v-model.trim="loginState.state.identifier" class="field" autocomplete="username" required autofocus placeholder="输入账号" />
          <label for="password">密码</label>
          <div class="password-box">
            <input id="password" v-model="loginState.state.password" class="field" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" required placeholder="输入密码" />
            <button type="button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible">{{ passwordVisible ? '隐藏' : '显示' }}</button>
          </div>
          <p v-if="loginState.state.message" class="form-message" :data-tone="messageTone" role="status">{{ loginState.state.message }}</p>
          <button class="submit" type="submit" :disabled="loginState.state.submitting">
            {{ loginState.state.submitting ? '正在验证…' : '登录' }}
          </button>
        </form>
        <p class="account-help">没有账号？<strong>请联系学校管理员或平台管理员开通。</strong> 当前后端未提供用户自助注册接口，因此这里不会伪造注册成功。</p>
      </div>
      <footer class="network-note">当前网络较弱时，登录仍会明确反馈连接状态；账号凭据不会写入本地长期缓存。</footer>
    </section>
  </main>
</template>

<style scoped>
.login-design { min-height:100svh; display:grid; grid-template-columns:minmax(0,1.85fr) minmax(25rem,1fr); background:#fff; color:#202b2b; font-family:"Noto Sans SC","Microsoft YaHei",sans-serif; }
.login-art { position:relative; min-height:100svh; overflow:hidden; padding:3rem clamp(2.5rem,6vw,6rem); color:#fff; background:#f7f2e9 url('/art/pixel-v3/login-art-clean.jpg') center/cover no-repeat; }
.login-art:after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(14,35,30,.17),rgba(14,35,30,.03) 70%,rgba(255,255,255,.35)); pointer-events:none; }
.login-logo,.art-kicker,.login-art h1,.art-caption { position:relative; z-index:1; }.login-logo img { width:14rem; display:block; }.art-kicker { margin:clamp(8rem,20vh,15rem) 0 1rem; color:#e5af3b; font-weight:800; letter-spacing:.15em; font-size:.78rem; }.login-art h1 { margin:0; font-family:"Noto Serif SC","Songti SC",serif; font-size:clamp(2.4rem,4.1vw,4.5rem); line-height:1.45; letter-spacing:.02em; }.login-art h1 strong { color:#e32a2b; }.art-caption { max-width:28rem; margin-top:1.8rem; color:#edf1e9; font-size:1.05rem; line-height:1.8; }
.login-panel { min-height:100svh; position:relative; display:grid; align-items:center; background:linear-gradient(120deg,#fff 0%,#fffdfa 88%,#f8f2e7); }.form-wrap { width:min(26.75rem,calc(100% - 4rem)); margin:auto; }.kicker { margin:0 0 .9rem; color:#b67a16; font-weight:800; font-size:.78rem; letter-spacing:.16em; }.form-wrap h2 { margin:0; font-family:"Noto Serif SC","Songti SC",serif; font-size:clamp(2.25rem,3.4vw,3.25rem); letter-spacing:.05em; }.subtitle { margin:1rem 0 2.2rem; color:#70736e; }.form-wrap label { display:block; margin:1.25rem 0 .55rem; font-size:.9rem; font-weight:750; }.field { width:100%; height:3.5rem; padding:0 1rem; border:1px solid #d7d7d2; border-radius:.25rem; background:#fff; color:#202b2b; font:inherit; box-sizing:border-box; }.field:focus { outline:0; border:1.5px solid #17613a; box-shadow:0 0 0 3px rgba(23,97,58,.11); }.password-box { position:relative; }.password-box .field { padding-right:4.5rem; }.password-box button { position:absolute; top:.45rem; right:.4rem; border:0; background:transparent; color:#17613a; font:inherit; font-weight:750; cursor:pointer; }.form-message { margin:1.1rem 0 0; line-height:1.55; color:#49604f; }.form-message[data-tone="error"] { color:#b90003; }.submit { width:100%; min-height:3.7rem; margin-top:1.4rem; border:0; border-radius:.25rem; color:#fff; background:linear-gradient(180deg,#cc1013,#b90003); font:750 1.1rem inherit; cursor:pointer; box-shadow:0 7px 18px rgba(159,0,0,.14); }.submit:disabled { opacity:.65; cursor:wait; }.account-help { margin:1.75rem 0 0; color:#6c706b; font-size:.86rem; line-height:1.7; }.account-help strong { color:#374b3a; }.network-note { position:absolute; inset:auto 0 0; padding:1.8rem 2rem; border-top:1px dashed #dfd8ce; color:#777; font-size:.78rem; line-height:1.6; }
@media (max-width:54rem) { .login-design { grid-template-columns:1fr; }.login-art { min-height:21rem; padding:2rem 1.5rem; }.login-logo img { width:10rem; }.art-kicker { margin:3.5rem 0 .55rem; }.login-art h1 { font-size:clamp(1.9rem,8vw,3rem); line-height:1.35; }.art-caption { display:none; }.login-panel { min-height:auto; padding:3.5rem 0 7.5rem; }.form-wrap { width:min(26.75rem,calc(100% - 2.5rem)); }.network-note { padding:1.2rem; } }
</style>
