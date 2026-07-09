<script setup lang="ts">
import AssessmentPageShell from "./AssessmentPageShell.vue";
import { assessmentTitle, assessmentValuePoints } from "./assessment-content";

useHead({
  title: `${assessmentTitle} | 语赞心声`,
});
</script>

<template>
  <AssessmentPageShell
    :title="assessmentTitle"
    summary="从朗读录音到书面作答，再到报告与历史对比，学生端可以在一个闭环里完成完整测评体验。"
  >
    <template #actions>
      <NuxtLink
        class="assessment-link assessment-link--quiet"
        to="/assessment/history"
      >
        查看历史
      </NuxtLink>
    </template>

    <div class="landing-layout">
      <section class="landing-hero">
        <p class="landing-hero__eyebrow">五页闭环</p>
        <h2>先录音，再作答，最后查看报告与历史变化。</h2>
        <p>
          真实流程默认只保留提交状态，不生成 AI
          分数；如果需要联调完整报告样式，可以进入 demo
          流程查看显著标记的演示报告。
        </p>
        <div class="landing-hero__actions">
          <NuxtLink
            class="assessment-link assessment-link--primary"
            to="/assessment/reading"
          >
            开始真实流程
          </NuxtLink>
          <NuxtLink
            class="assessment-link assessment-link--secondary"
            to="/assessment/reading?mode=demo"
          >
            查看 demo 流程
          </NuxtLink>
        </div>
      </section>

      <section class="landing-flow" aria-label="测评流程说明">
        <ol>
          <li>
            <strong>1. 朗读</strong>
            使用浏览器真实录音，支持试听、重录和权限拒绝提示。
          </li>
          <li>
            <strong>2. 作答</strong>
            完成选择、判断、填空与简答，本地自动保存草稿。
          </li>
          <li>
            <strong>3. 报告</strong>
            查看 pending / unavailable 或 demo complete 状态。
          </li>
          <li>
            <strong>4. 历史</strong>
            每次提交生成新的记录，便于前后对比。
          </li>
        </ol>
      </section>

      <section class="landing-points" aria-labelledby="assessment-points-title">
        <h2 id="assessment-points-title">这次交付会重点覆盖</h2>
        <ul>
          <li v-for="point in assessmentValuePoints" :key="point">
            {{ point }}
          </li>
        </ul>
      </section>
    </div>
  </AssessmentPageShell>
</template>

<style scoped>
.landing-layout {
  display: grid;
  gap: var(--yx-space-800);
}

.landing-hero,
.landing-flow,
.landing-points {
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--yx-surface-raised) 96%, transparent),
    color-mix(in srgb, var(--yx-bg-canvas) 72%, var(--yx-surface-default))
  );
  box-shadow: var(--yx-shadow-100);
}

.landing-hero__eyebrow {
  margin: 0;
  color: var(--yx-text-accent);
  font-weight: var(--yx-font-weight-semibold);
}

.landing-hero h2,
.landing-points h2 {
  margin: var(--yx-space-300) 0 0;
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  line-height: var(--yx-line-height-tight);
}

.landing-hero p,
.landing-flow,
.landing-points ul {
  margin: var(--yx-space-400) 0 0;
  color: var(--yx-text-secondary);
}

.landing-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
  margin-top: var(--yx-space-600);
}

.landing-flow ol,
.landing-points ul {
  padding-left: 1.1rem;
}

.landing-flow li + li,
.landing-points li + li {
  margin-top: var(--yx-space-300);
}

.assessment-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.7rem 1.15rem;
  border-radius: var(--yx-radius-pill);
  border: 1px solid transparent;
  text-decoration: none;
  font-weight: var(--yx-font-weight-semibold);
  transition:
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    transform var(--yx-motion-duration-fast) var(--yx-motion-ease-standard);
}

.assessment-link:hover {
  text-decoration: none;
}

.assessment-link:active {
  transform: translateY(1px);
}

.assessment-link--primary {
  background: var(--yx-action-primary-bg);
  color: var(--yx-action-primary-fg);
  box-shadow: var(--yx-shadow-100);
}

.assessment-link--primary:hover {
  background: var(--yx-action-primary-bg-hover);
  color: var(--yx-action-primary-fg);
}

.assessment-link--secondary {
  border-color: var(--yx-action-secondary-border);
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
}

.assessment-link--secondary:hover {
  background: var(--yx-action-secondary-bg-hover);
  color: var(--yx-text-primary);
}

.assessment-link--quiet {
  color: var(--yx-action-link);
  padding-inline: 0;
  min-height: auto;
}

.assessment-link--quiet:hover {
  color: var(--yx-action-link-hover);
}

@media (max-width: 48rem) {
  .landing-hero__actions {
    flex-direction: column;
  }

  .assessment-link {
    width: 100%;
  }
}
</style>
