<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "neutral" | "success" | "warning" | "danger" | "information";
    surface?: "default" | "contrast";
  }>(),
  {
    tone: "neutral",
    surface: "default",
  },
);
</script>

<template>
  <span class="yx-status" :data-tone="tone" :data-surface="surface">
    <slot />
  </span>
</template>

<style scoped>
.yx-status {
  --yx-status-bg: var(--yx-bg-canvas-strong);
  --yx-status-border: var(--yx-border-default);
  --yx-status-color: var(--yx-text-secondary);
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding-inline: 0.7rem;
  border: 1px solid var(--yx-status-border);
  border-radius: var(--yx-radius-pill);
  background: var(--yx-status-bg);
  color: var(--yx-status-color);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-medium);
  line-height: 1.3;
}

.yx-status[data-tone="success"] {
  --yx-status-bg: var(--yx-success-bg);
  --yx-status-border: var(--yx-success-border);
  --yx-status-color: var(--yx-success-fg);
}

.yx-status[data-tone="warning"] {
  --yx-status-bg: var(--yx-warning-bg);
  --yx-status-border: var(--yx-warning-border);
  --yx-status-color: var(--yx-warning-fg);
}

.yx-status[data-tone="danger"] {
  --yx-status-bg: var(--yx-danger-bg);
  --yx-status-border: var(--yx-danger-border);
  --yx-status-color: var(--yx-danger-fg);
}

.yx-status[data-tone="information"] {
  --yx-status-bg: var(--yx-information-bg);
  --yx-status-border: var(--yx-information-border);
  --yx-status-color: var(--yx-information-fg);
}

.yx-status[data-surface="contrast"][data-tone="neutral"] {
  --yx-status-bg: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 10%,
    transparent
  );
  --yx-status-border: var(--yx-border-contrast);
  --yx-status-color: var(--yx-text-contrast);
}
</style>
