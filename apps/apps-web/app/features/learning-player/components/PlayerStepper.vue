<script setup lang="ts">
import { playerSteps } from "../state/player-machine";
defineProps<{ stepIndex: number }>();
const labels = ["目标", "材料", "提示", "练习", "检查", "保存", "下一步"];
</script>

<template>
  <ol class="steps" aria-label="学习步骤">
    <li
      v-for="(step, index) in playerSteps"
      :key="step"
      :aria-current="index === stepIndex ? 'step' : undefined"
      :class="{ current: index === stepIndex }"
    >
      <span>{{ index + 1 }}</span
      ><span>{{ labels[index] }}</span>
    </li>
  </ol>
</template>

<style scoped>
.steps {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin: 0;
  padding: 0.75rem 0;
  list-style: none;
}
.steps li {
  flex: 0 0 auto;
  display: flex;
  gap: 0.4rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.4rem 0.7rem;
  border-bottom: 2px solid var(--yx-color-line);
  color: var(--yx-color-ink-soft);
}
.steps li.current {
  border-color: var(--yx-color-sage-strong);
  color: var(--yx-color-ink);
  font-weight: 700;
}
</style>
