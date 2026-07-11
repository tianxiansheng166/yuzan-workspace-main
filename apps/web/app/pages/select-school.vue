<script setup lang="ts">
import { computed, onMounted } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import { createBrowserSessionGateway } from "~/features/auth/adapters/browser-session-gateway";
import { createBrowserSchoolSelectionGateway } from "~/features/school-selection/browser-gateway";
import { createSchoolSelectionState } from "~/features/school-selection/state";
import type { SchoolMembership } from "~/features/school-selection/types";

useSeoMeta({ title: "选择学校｜语赞心声" });
const router = useRouter();
const config = useRuntimeConfig();
const gateway = createBrowserSchoolSelectionGateway(config.public.apiBase);
const selection = createSchoolSelectionState(gateway, async (to) => {
  await router.replace(to);
});
const busy = computed(
  () =>
    selection.state.status === "SELECTING" ||
    selection.state.status === "LOADING_MEMBERSHIPS",
);

function available(item: SchoolMembership) {
  return (
    item.membershipStatus !== "inactive" &&
    item.membershipStatus !== "deleted" &&
    item.schoolStatus !== "inactive" &&
    item.schoolStatus !== "deleted"
  );
}
function roleLabel(role: string) {
  return (
    (
      {
        STUDENT: "学生",
        TEACHER: "教师",
        VOLUNTEER: "志愿者",
        SCHOOL_ADMIN: "学校管理员",
        PLATFORM_ADMIN: "平台管理员",
        RESEARCHER: "研究人员",
      } as Record<string, string>
    )[role] ?? "未知角色"
  );
}
async function logout() {
  gateway.clearActiveSchool();
  await createBrowserSessionGateway().clear();
  await router.replace("/login");
}
onMounted(selection.load);
</script>

<template>
  <section class="school-page" aria-labelledby="school-title">
    <div class="school-page__landscape" aria-hidden="true" />
    <div class="yx-shell school-page__layout">
      <header class="school-page__intro">
        <p class="yx-kicker">学习旅程 · 学校入口</p>
        <h1 id="school-title">选择你今天要进入的学校</h1>
        <p>
          我们会在进入前重新确认成员身份。学校选择只改变当前学校范围，不会改变你的登录身份。
        </p>
        <div class="school-page__identity">
          <span>当前账号</span>
          <strong>{{
            selection.state.user?.displayName ?? "正在确认身份"
          }}</strong>
        </div>
      </header>

      <main class="school-path" :aria-busy="busy">
        <div class="school-path__line" aria-hidden="true" />
        <div
          v-if="selection.state.status === 'LOADING_MEMBERSHIPS'"
          class="school-state"
          role="status"
          aria-live="polite"
        >
          <span class="school-state__pulse" aria-hidden="true" />
          <h2>正在读取学校成员身份</h2>
          <p>请稍候，我们不会自动创建或选择演示学校。</p>
        </div>

        <div
          v-else-if="selection.state.status === 'NO_SCHOOL'"
          class="school-state"
          role="status"
        >
          <YxStatus tone="warning">尚未加入学校</YxStatus>
          <h2>你的学习路径还没有连接到学校</h2>
          <p>请联系学校管理员或项目运营为当前账号添加成员身份。</p>
          <div class="school-state__actions">
            <NuxtLink to="/login">返回登录</NuxtLink
            ><YxButton kind="secondary" @click="logout">退出登录</YxButton>
          </div>
        </div>

        <div
          v-else-if="
            ['SESSION_EXPIRED', 'NETWORK_ERROR'].includes(
              selection.state.status,
            )
          "
          class="school-state"
          role="alert"
        >
          <YxStatus
            :tone="
              selection.state.status === 'SESSION_EXPIRED'
                ? 'warning'
                : 'danger'
            "
            >{{
              selection.state.status === "SESSION_EXPIRED"
                ? "会话已过期"
                : "网络连接失败"
            }}</YxStatus
          >
          <h2>{{ selection.state.message }}</h2>
          <div class="school-state__actions">
            <YxButton
              v-if="selection.state.status === 'NETWORK_ERROR'"
              @click="selection.load"
              >重试</YxButton
            ><YxButton kind="secondary" @click="logout">重新登录</YxButton>
          </div>
        </div>

        <template v-else>
          <p class="school-path__message" role="status" aria-live="polite">
            {{ selection.state.message }}
          </p>
          <ol class="school-list" aria-label="可访问学校">
            <li
              v-for="(membership, index) in selection.state.memberships"
              :key="`${membership.schoolId}-${membership.role}`"
              class="school-node"
              :class="{
                'school-node--inactive': !available(membership),
                'school-node--selected':
                  selection.state.selectedId === membership.schoolId,
              }"
            >
              <span class="school-node__index" aria-hidden="true">{{
                String(index + 1).padStart(2, "0")
              }}</span>
              <div class="school-node__body">
                <div class="school-node__heading">
                  <div>
                    <p>{{ membership.region || "学校成员身份" }}</p>
                    <h2>{{ membership.schoolName }}</h2>
                  </div>
                  <YxStatus
                    :tone="available(membership) ? 'success' : 'neutral'"
                    >{{ available(membership) ? "可进入" : "不可用" }}</YxStatus
                  >
                </div>
                <dl>
                  <div>
                    <dt>当前角色</dt>
                    <dd>{{ roleLabel(membership.role) }}</dd>
                  </div>
                  <div v-if="membership.schoolType">
                    <dt>学校类型</dt>
                    <dd>{{ membership.schoolType }}</dd>
                  </div>
                  <div v-if="membership.lastUsedAt">
                    <dt>最近使用</dt>
                    <dd>
                      {{
                        new Date(membership.lastUsedAt).toLocaleDateString(
                          "zh-CN",
                        )
                      }}
                    </dd>
                  </div>
                </dl>
                <YxButton
                  :disabled="busy || !available(membership)"
                  :loading="
                    selection.state.status === 'SELECTING' &&
                    selection.state.selectedId === membership.schoolId
                  "
                  @click="selection.select(membership)"
                  >{{
                    !available(membership)
                      ? "当前不可进入"
                      : selection.state.memberships.length === 1
                        ? "确认并进入"
                        : "进入这所学校"
                  }}</YxButton
                >
              </div>
            </li>
          </ol>
          <div
            v-if="
              [
                'SELECTION_FAILED',
                'MEMBERSHIP_INACTIVE',
                'SCHOOL_INACTIVE',
                'UNKNOWN_ROLE',
              ].includes(selection.state.status)
            "
            class="school-error"
            role="alert"
          >
            <strong>暂时无法进入</strong
            ><span>{{ selection.state.message }}</span
            ><YxButton kind="secondary" @click="selection.load"
              >重新读取学校列表</YxButton
            >
          </div>
        </template>
      </main>

      <aside class="school-help" aria-label="账号与安全说明">
        <p class="yx-kicker">安全提示</p>
        <h2>只进入你有权访问的学校</h2>
        <p>
          切换学校会重新验证成员身份，并清除旧学校的活动上下文。不会提升角色权限。
        </p>
        <NuxtLink to="/">返回平台首页</NuxtLink
        ><button type="button" @click="logout">退出登录</button>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.school-page {
  position: relative;
  min-height: calc(100svh - 5rem);
  overflow: clip;
  background: #f7f2e8;
  color: var(--yx-text-primary);
}
.school-page__landscape {
  position: absolute;
  inset: 0 0 auto;
  height: min(34rem, 62vh);
  background:
    linear-gradient(180deg, transparent 35%, #f7f2e8 96%),
    url("/art/yuzan-v3/select-art-clean.jpg") center 58% / cover;
  opacity: 0.9;
}
.school-page__layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(15rem, 0.72fr) minmax(25rem, 1.5fr) minmax(
      14rem,
      0.62fr
    );
  gap: clamp(1.5rem, 4vw, 4rem);
  padding-block: clamp(4rem, 9vw, 8rem);
}
.school-page__intro {
  align-self: start;
  padding-top: 1rem;
  text-shadow: 0 1px 18px rgba(247, 242, 232, 0.75);
}
.school-page__intro h1 {
  max-width: 8ch;
  margin: 0.7rem 0 1rem;
  font: 700 clamp(2.5rem, 5vw, 5.3rem)/0.96 var(--yx-font-display);
}
.school-page__intro > p {
  max-width: 28rem;
  line-height: 1.75;
}
.school-page__identity {
  display: grid;
  gap: 0.25rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid currentColor;
}
.school-path {
  position: relative;
  margin-top: clamp(10rem, 22vw, 19rem);
}
.school-path__line {
  position: absolute;
  inset: 0 auto 0 1.5rem;
  width: 2px;
  background: linear-gradient(#bd8b2f, #527a5b 70%, transparent);
}
.school-path__message {
  position: relative;
  margin: 0 0 1rem 4rem;
  color: var(--yx-text-secondary);
}
.school-list {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.school-node {
  position: relative;
  display: grid;
  grid-template-columns: 3rem 1fr;
  gap: 1rem;
}
.school-node__index {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border: 2px solid #bd8b2f;
  border-radius: 50%;
  background: #f7f2e8;
  color: #7a2d27;
  font-weight: 800;
}
.school-node__body,
.school-state,
.school-error {
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid color-mix(in srgb, #527a5b 32%, transparent);
  background: color-mix(in srgb, #fffdf7 94%, transparent);
  box-shadow: 0 1.2rem 3rem rgba(62, 49, 36, 0.09);
}
.school-node__heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}
.school-node h2,
.school-state h2,
.school-help h2 {
  margin: 0.25rem 0;
  font-family: var(--yx-font-display);
}
.school-node p {
  margin: 0;
  color: var(--yx-text-secondary);
}
.school-node dl {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  margin: 1rem 0;
}
.school-node dt {
  font-size: 0.8rem;
  color: var(--yx-text-muted);
}
.school-node dd {
  margin: 0.1rem 0 0;
}
.school-node--inactive {
  filter: saturate(0.45);
  opacity: 0.7;
}
.school-node--selected .school-node__index {
  background: #527a5b;
  color: white;
  border-color: #527a5b;
}
.school-state {
  position: relative;
  margin-left: 4rem;
  min-height: 13rem;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.75rem;
}
.school-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.school-state__pulse {
  width: 2rem;
  height: 2rem;
  border: 3px solid #527a5b;
  border-right-color: transparent;
  border-radius: 50%;
  animation: turn 0.9s linear infinite;
}
.school-error {
  display: grid;
  gap: 0.5rem;
  margin: 1rem 0 0 4rem;
  border-left: 0.35rem solid #8d332b;
}
.school-help {
  align-self: end;
  margin-top: 20rem;
  padding-left: 1.25rem;
  border-left: 1px solid #bd8b2f;
}
.school-help p {
  line-height: 1.65;
  color: var(--yx-text-secondary);
}
.school-help a,
.school-help button {
  display: block;
  margin-top: 0.75rem;
  color: #7a2d27;
}
.school-help button {
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 64rem) {
  .school-page__layout {
    grid-template-columns: 1fr 1.5fr;
  }
  .school-help {
    grid-column: 1/-1;
    margin-top: 0;
  }
  .school-path {
    margin-top: 14rem;
  }
}
@media (max-width: 48rem) {
  .school-page__landscape {
    height: 22rem;
  }
  .school-page__layout {
    grid-template-columns: 1fr;
    padding-block: 2.5rem;
  }
  .school-page__intro h1 {
    font-size: clamp(2.4rem, 13vw, 4rem);
  }
  .school-path {
    margin-top: 8rem;
  }
  .school-path__message,
  .school-state,
  .school-error {
    margin-left: 3.25rem;
  }
  .school-node {
    grid-template-columns: 2.5rem 1fr;
    gap: 0.75rem;
  }
  .school-node__index {
    width: 2.5rem;
    height: 2.5rem;
  }
  .school-path__line {
    left: 1.25rem;
  }
  .school-node__heading {
    flex-direction: column;
  }
  .school-node dl {
    display: grid;
    gap: 0.65rem;
  }
  .school-node :deep(button) {
    width: 100%;
    min-height: 3rem;
  }
  .school-help {
    margin-top: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .school-state__pulse {
    animation: none;
    border-right-color: #527a5b;
  }
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
