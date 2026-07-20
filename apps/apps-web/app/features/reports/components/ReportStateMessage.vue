<script setup lang="ts">
import type { ReportDataStatus } from "../types";

defineProps<{
  status: ReportDataStatus;
  message: string;
}>();
</script>

<template>
  <div
    class="report-state"
    :data-status="status"
    role="status"
    aria-live="polite"
  >
    <p class="report-state__title">
      <template v-if="status === 'loading'">正在加载……</template>
      <template v-else-if="status === 'empty'">暂无数据</template>
      <template v-else-if="status === 'error'">加载失败</template>
      <template v-else-if="status === 'permission'">权限不足</template>
      <template v-else-if="status === 'unavailable'">服务未就绪</template>
      <template v-else>未知状态</template>
    </p>
    <p class="report-state__message">{{ message }}</p>
  </div>
</template>

<style scoped>
.report-state {
  min-height: 18rem;
  display: grid;
  align-content: center;
  gap: 0.75rem;
  max-width: 42rem;
  padding-block: clamp(3rem, 7vw, 6rem);
}
.report-state__title {
  margin: 0;
  font: 500 var(--yx-text-lg) / 1.3 var(--yx-font-display);
}
.report-state__message {
  margin: 0;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}
</style>
