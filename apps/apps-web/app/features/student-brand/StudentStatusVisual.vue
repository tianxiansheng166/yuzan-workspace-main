<script setup lang="ts">
import type { StudentBrandState } from "./student-brand-content";

defineProps<{
  state: StudentBrandState;
}>();
</script>

<template>
  <figure class="status-visual" :data-state="state">
    <svg
      viewBox="0 0 640 420"
      role="img"
      aria-labelledby="student-visual-title student-visual-desc"
    >
      <title id="student-visual-title">学生学习状态视觉</title>
      <desc id="student-visual-desc">
        通过节点、路径和状态卡片表示首测、复测、推荐课程与同步状态的层级关系。
      </desc>
      <rect
        x="20"
        y="42"
        width="212"
        height="126"
        rx="28"
        class="panel panel--main"
      />
      <rect
        x="240"
        y="124"
        width="172"
        height="108"
        rx="28"
        class="panel panel--mid"
      />
      <rect
        x="422"
        y="214"
        width="192"
        height="120"
        rx="28"
        class="panel panel--tail"
      />
      <path class="route" d="M124 228c74-22 98 8 158-16s98-18 166 22" />
      <circle class="point point--done" cx="124" cy="228" r="16" />
      <circle class="point point--current" cx="320" cy="212" r="16" />
      <circle class="point point--next" cx="520" cy="250" r="16" />
      <g class="lines">
        <path d="M58 82h116" />
        <path d="M58 112h94" />
        <path d="M58 142h128" />
        <path d="M272 160h92" />
        <path d="M272 190h116" />
        <path d="M454 252h112" />
        <path d="M454 282h80" />
      </g>
      <g class="signals">
        <path d="M466 92c18-28 34 30 54 0s32 28 52 0" />
        <path d="M472 128c14-22 26 22 42 0s24 20 40 0" />
      </g>
    </svg>
    <figcaption>
      学习状态通过文字、节点形状和位置共同表达；即使不看颜色，也能区分当前步骤、下一步和待接入区域。
    </figcaption>
  </figure>
</template>

<style scoped>
.status-visual {
  margin: 0;
}

svg {
  width: min(100%, 38rem);
}

.panel {
  stroke: color-mix(in srgb, var(--yx-color-ink) 10%, transparent);
  stroke-width: 1.5;
}

.panel--main {
  fill: color-mix(in srgb, white 82%, var(--yx-color-gold));
}

.panel--mid {
  fill: color-mix(in srgb, white 80%, var(--yx-color-sage));
}

.panel--tail {
  fill: color-mix(in srgb, white 86%, var(--yx-color-paper));
}

.route {
  fill: none;
  stroke: var(--yx-color-ink);
  stroke-width: 3;
  stroke-dasharray: 8 12;
  stroke-linecap: round;
}

.point {
  stroke: var(--yx-color-paper);
  stroke-width: 8;
}

.point--done {
  fill: var(--yx-color-sage-strong);
}

.point--current {
  fill: var(--yx-color-wine);
}

.point--next {
  fill: var(--yx-color-gold);
}

.lines path,
.signals path {
  fill: none;
  stroke-linecap: round;
}

.lines path {
  stroke: color-mix(in srgb, var(--yx-color-ink) 38%, transparent);
  stroke-width: 10;
}

.signals path {
  stroke: var(--yx-color-wine);
  stroke-width: 5;
}

figcaption {
  max-width: 30rem;
  margin-top: 1rem;
  font-size: var(--yx-text-sm);
  line-height: 1.7;
  color: var(--yx-color-ink-soft);
}
</style>
