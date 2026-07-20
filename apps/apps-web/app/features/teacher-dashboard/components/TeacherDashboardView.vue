<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { YxButton, YxStatus } from "@yuzan/ui";

import { useTeacherDashboard } from "../composables/useTeacherDashboard";
import type {
  DashboardSource,
  TeacherDashboardAssignment,
  TeacherDashboardData,
  TeacherDashboardIntegration,
} from "../types";

const { result, error, isLoading, refresh } = useTeacherDashboard();
const isOnline = ref(true);

const dashboard = computed<TeacherDashboardData | undefined>(() =>
  result.value?.kind === "ready" ? result.value.dashboard : undefined,
);

const sortedAssignments = computed(() => {
  const source = dashboard.value?.assignments;
  if (!source || source.state !== "ready") return [];
  return [...source.data].sort(
    (left, right) =>
      new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
  );
});

const draftAssignments = computed(() =>
  sortedAssignments.value.filter((assignment) => assignment.status === "DRAFT"),
);

const openAssignments = computed(() =>
  sortedAssignments.value.filter((assignment) => assignment.status === "OPEN"),
);

const reviewCount = computed(() => {
  const source = dashboard.value?.reviews;
  return source?.state === "ready" ? source.data.length : null;
});

const primaryAction = computed(() => {
  const current = dashboard.value;
  if (!current) {
    return {
      eyebrow: "正在读取",
      title: "正在整理今天的教学路径",
      detail: "班级、任务和复核状态将分别加载。",
      to: "/teacher",
      label: "刷新页面",
      stage: "课程",
    };
  }

  if (current.reviews.state === "ready" && current.reviews.data.length > 0) {
    return {
      eyebrow: "最高优先级 · 需要人工判断",
      title: `先复核 ${current.reviews.data.length} 份已提交练习`,
      detail: "学生已经完成提交，及时反馈比继续创建新任务更重要。",
      to: "/teacher/review",
      label: "进入复核队列",
      stage: "复核",
    };
  }

  if (draftAssignments.value.length > 0) {
    return {
      eyebrow: "最高优先级 · 发布前检查",
      title: `有 ${draftAssignments.value.length} 个任务仍处于草稿状态`,
      detail: "确认目标班级、截止时间和离线要求后再发布。",
      to: "/teacher/assignments",
      label: "检查待发布任务",
      stage: "任务",
    };
  }

  if (openAssignments.value.length > 0) {
    const next = openAssignments.value[0];
    return {
      eyebrow: "今日进行中",
      title: next?.title ?? "查看进行中的教学任务",
      detail: next
        ? `截止时间 ${formatDateTime(next.dueAt)}，继续观察完成与提交情况。`
        : "继续观察完成与提交情况。",
      to: next ? `/teacher/assignments/${next.id}` : "/teacher/assignments",
      label: "查看任务进度",
      stage: "学习",
    };
  }

  if (current.classes.state === "empty") {
    return {
      eyebrow: "首次进入",
      title: "当前学校还没有分配给你的班级",
      detail: "请联系学校管理员完成班级与教师关系配置。",
      to: "/teacher/classes",
      label: "查看班级状态",
      stage: "课程",
    };
  }

  return {
    eyebrow: "今日路径已清理",
    title: "从班级情况开始安排下一次教学",
    detail: "当前没有可确认的待发布或待复核事项。",
    to: "/teacher/classes",
    label: "查看我的班级",
    stage: "课程",
  };
});

const pathStages = computed(() => {
  const current = dashboard.value;
  const assignments = current?.assignments;
  const classes = current?.classes;
  const reviews = current?.reviews;

  return [
    {
      label: "课程",
      detail: sourceCount(classes, "个班级", "等待班级数据"),
      to: "/studio",
      state: stageState(classes),
    },
    {
      label: "任务",
      detail: sourceCount(assignments, "个任务", "等待任务数据"),
      to: "/teacher/assignments",
      state: stageState(assignments),
    },
    {
      label: "测评",
      detail: "后端能力待接入",
      to: "/teacher/assessments",
      state: "blocked",
    },
    {
      label: "复核",
      detail:
        reviews?.state === "ready"
          ? `${reviews.data.length} 份待处理`
          : reviews?.state === "empty"
            ? "暂无待复核"
            : "队列暂不可用",
      to: "/teacher/review",
      state: stageState(reviews),
    },
    {
      label: "报告",
      detail: "进入学生成长证据",
      to: "/reports",
      state: "pending",
    },
  ];
});

const supportTools = computed(() => {
  const integrations = dashboard.value?.integrations;
  const source = integrations?.state === "ready" ? integrations.data : [];

  return [
    toolItem(
      source,
      "MINDMATE",
      "MindMate",
      "教学思路辅助",
      "/teacher-tools/mindmate",
    ),
    toolItem(
      source,
      "MINDGRAPH",
      "MindGraph",
      "课堂关系图谱",
      "/teacher-tools/mindgraph",
    ),
    toolItem(
      source,
      "TRANSLATION",
      "藏汉翻译",
      "术语与表达支持",
      "/tools/tibetan-translation",
    ),
  ];
});

const systemTone = computed(() => {
  if (!isOnline.value) return "warning" as const;
  const source = dashboard.value?.operations;
  if (!source || source.state !== "ready" || !source.data)
    return "neutral" as const;
  return source.data.status === "ok"
    ? ("success" as const)
    : ("warning" as const);
});

const systemLabel = computed(() => {
  if (!isOnline.value) return "离线只读";
  const source = dashboard.value?.operations;
  if (!source || source.state !== "ready" || !source.data) return "状态待确认";
  return source.data.status === "ok" ? "服务已连接" : "服务需检查";
});

function stageState(source?: DashboardSource<unknown>) {
  if (!source) return "pending";
  if (source.state === "ready") return "active";
  if (source.state === "empty") return "complete";
  if (source.state === "forbidden") return "blocked";
  return "interrupted";
}

function sourceCount<T>(
  source: DashboardSource<T[]> | undefined,
  unit: string,
  unavailable: string,
) {
  if (!source) return unavailable;
  if (source.state === "ready") return `${source.data.length} ${unit}`;
  if (source.state === "empty") return `0 ${unit}`;
  return source.message ?? unavailable;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLoadedAt(value?: string) {
  if (!value) return "尚未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "同步时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function toolItem(
  source: TeacherDashboardIntegration[],
  key: string,
  label: string,
  detail: string,
  to: string,
) {
  const integration = source.find((item) =>
    item.key.toUpperCase().includes(key),
  );
  return {
    key,
    label,
    detail,
    to,
    enabled: Boolean(integration?.enabled),
    status: integration?.status ?? "UNAVAILABLE",
  };
}

function updateOnlineState() {
  isOnline.value = navigator.onLine;
}

onMounted(() => {
  updateOnlineState();
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
});

onBeforeUnmount(() => {
  window.removeEventListener("online", updateOnlineState);
  window.removeEventListener("offline", updateOnlineState);
});
</script>

<template>
  <main id="main" class="teacher-dashboard">
    <header class="teacher-dashboard__topbar">
      <NuxtLink
        to="/"
        class="teacher-dashboard__brand"
        aria-label="返回语赞心声首页"
      >
        <span class="teacher-dashboard__brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M5 31c10-15 17 8 27-8 4-6 7-8 11-7" />
            <path d="M7 37c11-9 18 4 31-9" />
          </svg>
        </span>
        <span>
          <strong>语赞心声</strong>
          <small>教师课程工作台</small>
        </span>
      </NuxtLink>

      <div class="teacher-dashboard__school">
        <span class="teacher-dashboard__label">当前教学范围</span>
        <strong>{{ dashboard?.schoolName ?? "正在确认学校" }}</strong>
        <span>{{ dashboard ? "本学期" : "身份与学校范围读取中" }}</span>
      </div>

      <div class="teacher-dashboard__top-meta">
        <YxStatus :tone="systemTone">{{ systemLabel }}</YxStatus>
        <span>更新于 {{ formatLoadedAt(dashboard?.loadedAt) }}</span>
        <strong>{{ dashboard?.user.displayName ?? "教师" }}</strong>
      </div>
    </header>

    <section
      v-if="isLoading"
      class="teacher-dashboard__loading"
      aria-live="polite"
    >
      <p class="teacher-dashboard__eyebrow">正在读取真实教学状态</p>
      <h1>把班级、任务和复核队列放回同一条工作路径</h1>
      <div class="teacher-dashboard__loading-line" />
      <p>每个数据源独立加载；暂时不可用的区域不会被演示数据填充。</p>
    </section>

    <section
      v-else-if="error || result?.kind === 'unavailable'"
      class="teacher-dashboard__state teacher-dashboard__state--error"
      aria-live="assertive"
    >
      <p class="teacher-dashboard__eyebrow">教师工作台暂不可用</p>
      <h1>没有用假数据掩盖连接问题</h1>
      <p>
        {{ result?.kind === "unavailable" ? result.message : error?.message }}
      </p>
      <YxButton @click="() => refresh()">重新读取</YxButton>
    </section>

    <section
      v-else-if="result?.kind === 'no-school'"
      class="teacher-dashboard__state"
    >
      <p class="teacher-dashboard__eyebrow">需要选择学校</p>
      <h1>{{ result.user.displayName }}，当前会话没有活动学校</h1>
      <p>教师工作台只展示当前学校范围内的班级、任务和学生信息。</p>
      <NuxtLink class="teacher-dashboard__action-link" to="/login">
        返回身份与学校入口
      </NuxtLink>
    </section>

    <section
      v-else-if="result?.kind === 'forbidden'"
      class="teacher-dashboard__state"
    >
      <p class="teacher-dashboard__eyebrow">当前角色不能进入</p>
      <h1>这个工作台只面向教师和学校管理员</h1>
      <p>
        当前角色：{{
          result.activeRole ?? "未识别"
        }}。系统不会展示不属于该角色的学生和班级数据。
      </p>
      <NuxtLink class="teacher-dashboard__action-link" to="/">
        返回角色入口
      </NuxtLink>
    </section>

    <div v-else-if="dashboard" class="teacher-dashboard__workspace">
      <aside class="teacher-path" aria-label="教学工作路径">
        <div class="teacher-path__intro">
          <p class="teacher-dashboard__eyebrow">Teaching Path</p>
          <h1>今天沿路径推进</h1>
          <p>优先处理阻塞学生学习的节点，而不是先看统计数字。</p>
        </div>

        <nav>
          <ol class="teacher-path__list">
            <li
              v-for="(stage, index) in pathStages"
              :key="stage.label"
              class="teacher-path__item"
              :class="`teacher-path__item--${stage.state}`"
            >
              <NuxtLink :to="stage.to">
                <span class="teacher-path__index">{{
                  String(index + 1).padStart(2, "0")
                }}</span>
                <span>
                  <strong>{{ stage.label }}</strong>
                  <small>{{ stage.detail }}</small>
                </span>
              </NuxtLink>
            </li>
          </ol>
        </nav>

        <div class="teacher-path__footer">
          <span class="teacher-path__ridge" aria-hidden="true" />
          <p>路径断点代表真实不可用或待处理状态，不只依赖颜色。</p>
        </div>
      </aside>

      <section class="teacher-workflow">
        <header class="teacher-workflow__heading">
          <div>
            <p class="teacher-dashboard__eyebrow">今日教学工作流</p>
            <h2>从判断开始，不从卡片墙开始</h2>
          </div>
          <button
            class="teacher-workflow__refresh"
            type="button"
            @click="() => refresh()"
          >
            重新同步
          </button>
        </header>

        <article class="teacher-priority">
          <div class="teacher-priority__marker" aria-hidden="true">
            <span />
          </div>
          <div class="teacher-priority__content">
            <p>{{ primaryAction.eyebrow }}</p>
            <h3>{{ primaryAction.title }}</h3>
            <span>{{ primaryAction.detail }}</span>
          </div>
          <NuxtLink class="teacher-priority__action" :to="primaryAction.to">
            {{ primaryAction.label }}
          </NuxtLink>
        </article>

        <section class="teacher-timeline" aria-labelledby="timeline-title">
          <div class="teacher-timeline__axis" aria-hidden="true" />
          <h3 id="timeline-title" class="sr-only">今日工作节点</h3>

          <article class="teacher-timeline__node">
            <span class="teacher-timeline__time">现在</span>
            <div>
              <p>班级入口</p>
              <strong>
                {{
                  dashboard.classes.state === "ready"
                    ? `${dashboard.classes.data.length} 个班级可进入`
                    : dashboard.classes.state === "empty"
                      ? "尚未分配班级"
                      : "班级数据出现断点"
                }}
              </strong>
              <NuxtLink to="/teacher/classes">查看班级范围</NuxtLink>
            </div>
          </article>

          <article class="teacher-timeline__node">
            <span class="teacher-timeline__time">发布</span>
            <div>
              <p>任务准备</p>
              <strong>
                {{
                  dashboard.assignments.state === "ready"
                    ? `${draftAssignments.length} 个草稿，${openAssignments.length} 个进行中`
                    : dashboard.assignments.state === "empty"
                      ? "当前没有任务"
                      : "任务数据出现断点"
                }}
              </strong>
              <NuxtLink to="/teacher/assignments">管理教学任务</NuxtLink>
            </div>
          </article>

          <article class="teacher-timeline__node">
            <span class="teacher-timeline__time">复核</span>
            <div>
              <p>人工反馈</p>
              <strong>
                {{
                  reviewCount === null
                    ? "待复核队列暂不可确认"
                    : reviewCount === 0
                      ? "当前没有已提交待复核内容"
                      : `${reviewCount} 份提交等待处理`
                }}
              </strong>
              <NuxtLink to="/teacher/review">进入复核队列</NuxtLink>
            </div>
          </article>

          <article
            class="teacher-timeline__node teacher-timeline__node--blocked"
          >
            <span class="teacher-timeline__time">测评</span>
            <div>
              <p>能力断点</p>
              <strong>测评持久化尚未接入当前产品基线</strong>
              <NuxtLink to="/teacher/assessments">查看真实可用状态</NuxtLink>
            </div>
          </article>
        </section>

        <section class="teacher-evidence" aria-label="班级成长与人工关注">
          <article class="teacher-evidence__classes">
            <header>
              <p class="teacher-dashboard__eyebrow">班级成长入口</p>
              <NuxtLink to="/teacher/classes">全部班级</NuxtLink>
            </header>

            <ul v-if="dashboard.classes.state === 'ready'">
              <li
                v-for="classItem in dashboard.classes.data.slice(0, 4)"
                :key="classItem.id"
              >
                <NuxtLink :to="`/teacher/classes/${classItem.id}`">
                  <span>
                    <strong>{{ classItem.name }}</strong>
                    <small>{{ classItem.grade }}</small>
                  </span>
                  <span>{{ classItem.studentCount }} 名学生</span>
                </NuxtLink>
              </li>
            </ul>

            <div v-else class="teacher-evidence__source-state">
              <strong>
                {{
                  dashboard.classes.state === "empty"
                    ? "当前没有班级"
                    : "班级成长数据暂不可用"
                }}
              </strong>
              <p>
                {{
                  dashboard.classes.message ?? "不会生成示例班级或学生姓名。"
                }}
              </p>
            </div>
          </article>

          <article class="teacher-evidence__attention">
            <p class="teacher-dashboard__eyebrow">需要人工关注</p>
            <h3>不根据缺失数据生成学生诊断</h3>
            <p>
              学生关注列表需要报告与成长证据。当前首页尚未建立可靠的跨班级聚合，因此保留明确入口，不显示虚构薄弱发音或姓名。
            </p>
            <NuxtLink to="/reports">进入报告与成长证据</NuxtLink>
          </article>
        </section>
      </section>

      <aside class="teacher-support" aria-label="教学支持工具">
        <header>
          <p class="teacher-dashboard__eyebrow">按需支持</p>
          <h2>工具在需要时进入</h2>
          <p>不自动弹窗，不把 AI 建议伪装成教师结论。</p>
        </header>

        <nav>
          <ul class="teacher-support__tools">
            <li v-for="tool in supportTools" :key="tool.key">
              <NuxtLink :to="tool.to">
                <span class="teacher-support__tool-mark" aria-hidden="true" />
                <span>
                  <strong>{{ tool.label }}</strong>
                  <small>{{ tool.detail }}</small>
                </span>
                <em>{{ tool.enabled ? "已接入" : "待接入" }}</em>
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <section class="teacher-support__status">
          <p>服务与同步</p>
          <dl>
            <div>
              <dt>浏览器网络</dt>
              <dd>{{ isOnline ? "在线" : "离线" }}</dd>
            </div>
            <div>
              <dt>后端服务</dt>
              <dd>{{ systemLabel }}</dd>
            </div>
            <div>
              <dt>测评能力</dt>
              <dd>持久化待接入</dd>
            </div>
          </dl>
        </section>

        <section
          v-if="dashboard.integrations.state !== 'ready'"
          class="teacher-support__notice"
        >
          <strong>工具接入状态无法完整读取</strong>
          <p>
            {{ dashboard.integrations.message ?? "当前显示保守的待接入状态。" }}
          </p>
        </section>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  --teacher-ink: #242722;
  --teacher-ink-soft: #6d716a;
  --teacher-wine: #b74735;
  --teacher-wine-deep: #873528;
  --teacher-barley: #c2a56c;
  --teacher-green: #667868;
  --teacher-blue: #2f4948;
  --teacher-paper: #f4f0e7;
  --teacher-line: rgb(36 39 34 / 15%);
  min-height: 100vh;
  color: var(--teacher-ink);
  background:
    radial-gradient(circle at 41% 12%, rgb(194 165 108 / 14%), transparent 31rem),
    repeating-radial-gradient(
      ellipse at 12% 76%,
      transparent 0 28px,
      rgb(36 39 34 / 4%) 29px 30px,
      transparent 31px 52px
    ),
    var(--teacher-paper);
}

.teacher-dashboard__topbar {
  min-height: 5.4rem;
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) minmax(15rem, 1.15fr) auto;
  align-items: center;
  gap: 2rem;
  padding: 1rem clamp(1rem, 3vw, 3.5rem);
  border-bottom: 1px solid var(--teacher-line);
  background: rgb(250 248 242 / 94%);
  backdrop-filter: blur(12px);
}

.teacher-dashboard__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  color: inherit;
  text-decoration: none;
}

.teacher-dashboard__brand-mark {
  width: 2.7rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--teacher-wine);
  background: rgb(183 71 53 / 9%);
}

.teacher-dashboard__brand-mark svg {
  width: 2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
}

.teacher-dashboard__brand > span:last-child,
.teacher-dashboard__school,
.teacher-dashboard__top-meta {
  display: grid;
  gap: 0.15rem;
}

.teacher-dashboard__brand strong,
.teacher-dashboard__school strong,
.teacher-dashboard__top-meta strong {
  font-family: var(--yx-font-display);
}

.teacher-dashboard__brand small,
.teacher-dashboard__school span,
.teacher-dashboard__top-meta span {
  color: var(--teacher-ink-soft);
  font-size: 0.78rem;
}

.teacher-dashboard__label,
.teacher-dashboard__eyebrow {
  margin: 0;
  color: var(--teacher-wine);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.teacher-dashboard__top-meta {
  grid-template-columns: auto auto;
  align-items: center;
  justify-items: end;
  column-gap: 0.75rem;
}

.teacher-dashboard__top-meta strong {
  grid-column: 1 / -1;
}

.teacher-dashboard__workspace {
  min-height: calc(100vh - 5.4rem);
  display: grid;
  grid-template-columns: minmax(13.5rem, 15%) minmax(38rem, 1fr) minmax(
      17rem,
      19%
    );
}

.teacher-path {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(1.6rem, 2.7vw, 3.2rem) 1.25rem 1.5rem;
  border-right: 1px solid var(--teacher-line);
  background:
    linear-gradient(180deg, rgb(250 248 242 / 78%), rgb(224 230 220 / 72%)),
    repeating-linear-gradient(
      115deg,
      transparent 0 36px,
      rgb(183 71 53 / 4%) 37px 38px
    );
}

.teacher-path::after {
  content: "";
  position: absolute;
  inset: auto -25% -7rem -18%;
  height: 18rem;
  background:
    linear-gradient(
      143deg,
      transparent 0 42%,
      rgb(102 120 104 / 15%) 43% 48%,
      transparent 49%
    ),
    linear-gradient(
      155deg,
      transparent 0 48%,
      rgb(183 71 53 / 14%) 49% 54%,
      transparent 55%
    );
  transform: rotate(-4deg);
  pointer-events: none;
}

.teacher-path__intro {
  position: relative;
  z-index: 1;
}

.teacher-path__intro h1,
.teacher-workflow__heading h2,
.teacher-support h2,
.teacher-dashboard__state h1,
.teacher-dashboard__loading h1 {
  margin: 0.45rem 0 0;
  font-family: var(--yx-font-display);
  font-weight: 650;
  letter-spacing: -0.025em;
}

.teacher-path__intro h1 {
  max-width: 9ch;
  font-size: clamp(1.75rem, 2.4vw, 2.6rem);
  line-height: 1.08;
}

.teacher-path__intro > p:last-child,
.teacher-support header > p:last-child {
  color: var(--teacher-ink-soft);
  font-size: 0.85rem;
  line-height: 1.65;
}

.teacher-path nav {
  position: relative;
  z-index: 1;
  flex: 1;
  margin-top: 2rem;
}

.teacher-path__list {
  position: relative;
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.teacher-path__list::before {
  content: "";
  position: absolute;
  left: 1.15rem;
  top: 1.4rem;
  bottom: 1.4rem;
  width: 1px;
  background: var(--teacher-line);
}

.teacher-path__item a {
  position: relative;
  display: grid;
  grid-template-columns: 2.35rem 1fr;
  gap: 0.75rem;
  align-items: center;
  min-height: 4.25rem;
  padding: 0.55rem 0.35rem;
  color: inherit;
  text-decoration: none;
}

.teacher-path__index {
  position: relative;
  z-index: 1;
  width: 2.35rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--teacher-line);
  border-radius: 50%;
  background: var(--teacher-paper);
  color: var(--teacher-ink-soft);
  font-size: 0.68rem;
  font-weight: 750;
}

.teacher-path__item strong,
.teacher-path__item small {
  display: block;
}

.teacher-path__item small {
  margin-top: 0.15rem;
  color: var(--teacher-ink-soft);
  font-size: 0.71rem;
  line-height: 1.35;
}

.teacher-path__item--active .teacher-path__index {
  border-color: var(--teacher-wine);
  color: white;
  background: var(--teacher-wine);
}

.teacher-path__item--complete .teacher-path__index {
  border-color: var(--teacher-green);
  color: white;
  background: var(--teacher-green);
}

.teacher-path__item--blocked .teacher-path__index,
.teacher-path__item--interrupted .teacher-path__index {
  border-style: dashed;
  border-color: var(--teacher-wine);
  color: var(--teacher-wine);
}

.teacher-path__item a:hover strong,
.teacher-path__item a:focus-visible strong {
  color: var(--teacher-wine);
}

.teacher-path__footer {
  position: relative;
  z-index: 1;
  color: var(--teacher-ink-soft);
  font-size: 0.72rem;
  line-height: 1.5;
}

.teacher-path__ridge {
  display: block;
  height: 1.8rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgb(102 120 104 / 55%);
  clip-path: polygon(
    0 65%,
    13% 38%,
    29% 61%,
    46% 20%,
    64% 58%,
    82% 31%,
    100% 54%,
    100% 100%,
    0 100%
  );
  background: rgb(102 120 104 / 12%);
}

.teacher-workflow {
  min-width: 0;
  padding: clamp(1.8rem, 3vw, 3.5rem) clamp(1.5rem, 3.5vw, 4.5rem) 3rem;
}

.teacher-workflow__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
}

.teacher-workflow__heading h2 {
  max-width: 17ch;
  font-size: clamp(1.8rem, 3vw, 3.15rem);
  line-height: 1.04;
}

.teacher-workflow__refresh {
  border: 0;
  border-bottom: 1px solid currentColor;
  padding: 0.25rem 0;
  color: var(--teacher-wine);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.teacher-priority {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1.25rem;
  align-items: center;
  margin-top: 2.2rem;
  padding: clamp(1.2rem, 2.4vw, 2rem) 0;
  border-block: 1px solid var(--teacher-line);
}

.teacher-priority__marker {
  width: 3.6rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid rgb(183 71 53 / 35%);
  border-radius: 50%;
}

.teacher-priority__marker span {
  width: 0.75rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--teacher-wine);
  box-shadow: 0 0 0 0.55rem rgb(183 71 53 / 10%);
}

.teacher-priority__content p,
.teacher-priority__content h3,
.teacher-priority__content span {
  margin: 0;
}

.teacher-priority__content p {
  color: var(--teacher-wine);
  font-size: 0.75rem;
  font-weight: 720;
}

.teacher-priority__content h3 {
  margin-top: 0.35rem;
  font-family: var(--yx-font-display);
  font-size: clamp(1.3rem, 2vw, 2rem);
  font-weight: 650;
}

.teacher-priority__content span {
  display: block;
  margin-top: 0.35rem;
  color: var(--teacher-ink-soft);
  line-height: 1.55;
}

.teacher-priority__action,
.teacher-dashboard__action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.8rem;
  border-radius: 999px;
  padding: 0.7rem 1rem;
  color: white;
  background: var(--teacher-wine);
  text-decoration: none;
  font-weight: 720;
}

.teacher-timeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.15rem;
  margin-top: 2.5rem;
  padding-top: 1.25rem;
}

.teacher-timeline__axis {
  position: absolute;
  left: 0;
  right: 0;
  top: 0.38rem;
  height: 1px;
  background: linear-gradient(
    90deg,
    var(--teacher-green),
    var(--teacher-barley),
    var(--teacher-wine)
  );
}

.teacher-timeline__node {
  position: relative;
  min-width: 0;
}

.teacher-timeline__node::before {
  content: "";
  position: absolute;
  top: -1.1rem;
  left: 0;
  width: 0.72rem;
  aspect-ratio: 1;
  border: 2px solid var(--teacher-paper);
  border-radius: 50%;
  background: var(--teacher-green);
  box-shadow: 0 0 0 1px var(--teacher-green);
}

.teacher-timeline__node--blocked::before {
  border-radius: 0;
  background: var(--teacher-wine);
  transform: rotate(45deg);
}

.teacher-timeline__time {
  color: var(--teacher-ink-soft);
  font-size: 0.7rem;
}

.teacher-timeline__node p,
.teacher-timeline__node strong,
.teacher-timeline__node a {
  display: block;
  margin: 0;
}

.teacher-timeline__node p {
  margin-top: 0.55rem;
  color: var(--teacher-wine);
  font-size: 0.72rem;
  font-weight: 720;
}

.teacher-timeline__node strong {
  min-height: 3.2rem;
  margin-top: 0.3rem;
  line-height: 1.45;
}

.teacher-timeline__node a {
  margin-top: 0.55rem;
  color: var(--teacher-ink);
  font-size: 0.76rem;
  text-underline-offset: 0.22rem;
}

.teacher-evidence {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(15rem, 0.85fr);
  gap: clamp(1.2rem, 3vw, 3rem);
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--teacher-line);
}

.teacher-evidence__classes header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.teacher-evidence__classes header a,
.teacher-evidence__attention a {
  color: var(--teacher-wine);
  text-underline-offset: 0.25rem;
}

.teacher-evidence__classes ul {
  display: grid;
  gap: 0;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.teacher-evidence__classes li {
  border-top: 1px solid var(--teacher-line);
}

.teacher-evidence__classes li:last-child {
  border-bottom: 1px solid var(--teacher-line);
}

.teacher-evidence__classes li a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
  color: inherit;
  text-decoration: none;
}

.teacher-evidence__classes li strong,
.teacher-evidence__classes li small {
  display: block;
}

.teacher-evidence__classes li small,
.teacher-evidence__classes li > a > span:last-child {
  color: var(--teacher-ink-soft);
  font-size: 0.74rem;
}

.teacher-evidence__attention {
  position: relative;
  padding-left: 1.35rem;
  border-left: 2px solid var(--teacher-barley);
}

.teacher-evidence__attention h3 {
  margin: 0.55rem 0;
  font-family: var(--yx-font-display);
  font-size: 1.3rem;
}

.teacher-evidence__attention > p:not(.teacher-dashboard__eyebrow),
.teacher-evidence__source-state p {
  color: var(--teacher-ink-soft);
  line-height: 1.65;
}

.teacher-evidence__source-state {
  margin-top: 1rem;
  padding-block: 1rem;
  border-block: 1px dashed var(--teacher-line);
}

.teacher-support {
  display: flex;
  flex-direction: column;
  padding: clamp(1.8rem, 2.7vw, 3.25rem) 1.45rem 2rem;
  color: #edf2f0;
  background:
    radial-gradient(
      circle at 85% 16%,
      rgb(181 138 67 / 20%),
      transparent 13rem
    ),
    repeating-linear-gradient(
      125deg,
      transparent 0 42px,
      rgb(255 255 255 / 3%) 43px 44px
    ),
    var(--teacher-blue);
}

.teacher-support .teacher-dashboard__eyebrow {
  color: #dbb66f;
}

.teacher-support h2 {
  max-width: 10ch;
  font-size: clamp(1.7rem, 2.3vw, 2.6rem);
  line-height: 1.08;
}

.teacher-support header > p:last-child {
  color: rgb(237 242 240 / 68%);
}

.teacher-support nav {
  margin-top: 2rem;
}

.teacher-support__tools {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.teacher-support__tools li {
  border-top: 1px solid rgb(255 255 255 / 13%);
}

.teacher-support__tools li:last-child {
  border-bottom: 1px solid rgb(255 255 255 / 13%);
}

.teacher-support__tools a {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem 0;
  color: inherit;
  text-decoration: none;
}

.teacher-support__tool-mark {
  width: 1.6rem;
  aspect-ratio: 1;
  border: 1px solid rgb(219 182 111 / 58%);
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    transparent 45%,
    rgb(219 182 111 / 80%) 46% 52%,
    transparent 53%
  );
}

.teacher-support__tools strong,
.teacher-support__tools small {
  display: block;
}

.teacher-support__tools small,
.teacher-support__tools em {
  color: rgb(237 242 240 / 62%);
  font-size: 0.7rem;
  font-style: normal;
}

.teacher-support__status {
  margin-top: auto;
  padding-top: 2rem;
}

.teacher-support__status > p {
  color: #dbb66f;
  font-size: 0.72rem;
  font-weight: 720;
  letter-spacing: 0.08em;
}

.teacher-support__status dl {
  margin: 0;
}

.teacher-support__status dl > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgb(255 255 255 / 10%);
  font-size: 0.75rem;
}

.teacher-support__status dd {
  margin: 0;
  color: rgb(237 242 240 / 68%);
  text-align: right;
}

.teacher-support__notice {
  margin-top: 1.25rem;
  padding: 0.9rem;
  border: 1px dashed rgb(219 182 111 / 46%);
  color: rgb(237 242 240 / 77%);
  font-size: 0.74rem;
  line-height: 1.55;
}

.teacher-support__notice p {
  margin-bottom: 0;
}

.teacher-dashboard__loading,
.teacher-dashboard__state {
  width: min(52rem, calc(100% - 2rem));
  min-height: calc(100vh - 5.4rem);
  display: grid;
  align-content: center;
  justify-items: start;
  margin: 0 auto;
  padding-block: 4rem;
}

.teacher-dashboard__loading h1,
.teacher-dashboard__state h1 {
  max-width: 15ch;
  font-size: clamp(2.5rem, 6vw, 5.8rem);
  line-height: 0.98;
}

.teacher-dashboard__loading > p:last-child,
.teacher-dashboard__state > p {
  max-width: 45rem;
  color: var(--teacher-ink-soft);
  line-height: 1.7;
}

.teacher-dashboard__loading-line {
  width: min(28rem, 75vw);
  height: 2px;
  margin: 2rem 0 1rem;
  overflow: hidden;
  background: var(--teacher-line);
}

.teacher-dashboard__loading-line::after {
  content: "";
  display: block;
  width: 32%;
  height: 100%;
  background: var(--teacher-wine);
  animation: teacher-loading 1.4s ease-in-out infinite alternate;
}

.teacher-dashboard__state--error {
  border-left: 2px solid var(--teacher-wine);
  padding-left: clamp(1rem, 3vw, 3rem);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes teacher-loading {
  to {
    transform: translateX(210%);
  }
}

@media (max-width: 76rem) {
  .teacher-dashboard__workspace {
    grid-template-columns: 12.5rem minmax(0, 1fr);
  }

  .teacher-support {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(14rem, 0.7fr) minmax(0, 1.3fr) minmax(
        13rem,
        0.7fr
      );
    gap: 2rem;
  }

  .teacher-support nav,
  .teacher-support__status {
    margin-top: 0;
  }

  .teacher-support__notice {
    grid-column: 1 / -1;
  }

  .teacher-timeline {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 2.25rem;
  }

  .teacher-timeline__axis {
    display: none;
  }

  .teacher-timeline__node {
    padding-top: 1rem;
    border-top: 1px solid var(--teacher-line);
  }

  .teacher-timeline__node::before {
    top: -0.42rem;
  }
}

@media (max-width: 54rem) {
  .teacher-dashboard__topbar {
    grid-template-columns: 1fr auto;
  }

  .teacher-dashboard__school {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .teacher-dashboard__workspace {
    display: block;
  }

  .teacher-path {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--teacher-line);
  }

  .teacher-path__intro h1 {
    max-width: none;
  }

  .teacher-path__list {
    grid-template-columns: repeat(5, minmax(8.5rem, 1fr));
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .teacher-path__list::before,
  .teacher-path__footer {
    display: none;
  }

  .teacher-evidence {
    grid-template-columns: 1fr;
  }

  .teacher-support {
    grid-template-columns: 1fr 1fr;
  }

  .teacher-support > header {
    grid-column: 1 / -1;
  }
}

@media (max-width: 34rem) {
  .teacher-dashboard__topbar {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 0.8rem 1rem;
  }

  .teacher-dashboard__school,
  .teacher-dashboard__top-meta {
    display: none;
  }

  .teacher-workflow {
    padding: 1.5rem 1rem 2.5rem;
  }

  .teacher-workflow__heading {
    align-items: start;
  }

  .teacher-workflow__heading h2 {
    font-size: 2.15rem;
  }

  .teacher-priority {
    grid-template-columns: auto 1fr;
  }

  .teacher-priority__action {
    grid-column: 1 / -1;
    width: 100%;
  }

  .teacher-timeline {
    grid-template-columns: 1fr;
  }

  .teacher-timeline__node strong {
    min-height: auto;
  }

  .teacher-evidence__classes li a {
    align-items: start;
  }

  .teacher-support {
    display: block;
    padding: 2rem 1rem;
  }

  .teacher-support nav,
  .teacher-support__status,
  .teacher-support__notice {
    margin-top: 1.5rem;
  }

  .teacher-path {
    padding: 1.25rem 1rem;
  }

  .teacher-path__list {
    grid-template-columns: 1fr;
    overflow: visible;
    margin-top: 1rem;
  }

  .teacher-path__item a {
    min-height: 3.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .teacher-dashboard__loading-line::after {
    animation: none;
  }
}
</style>
