<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    kind?: "primary" | "secondary" | "quiet";
    surface?: "default" | "contrast";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
    loadingLabel?: string;
  }>(),
  {
    kind: "primary",
    surface: "default",
    type: "button",
    disabled: false,
    loading: false,
    loadingLabel: "加载中",
  },
);

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    class="yx-button"
    :class="[
      `yx-button--${kind}`,
      `yx-button--surface-${surface}`,
      { 'is-loading': loading },
    ]"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span class="yx-button__content">
      <span class="yx-button__label"><slot /></span>
      <span v-if="loading" class="yx-button__meta">{{ loadingLabel }}</span>
    </span>
  </button>
</template>

<style scoped>
.yx-button {
  --yx-button-bg: var(--yx-action-primary-bg);
  --yx-button-bg-hover: var(--yx-action-primary-bg-hover);
  --yx-button-border: transparent;
  --yx-button-color: var(--yx-action-primary-fg);
  --yx-button-shadow: var(--yx-shadow-100);
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--yx-space-200);
  border: 1px solid var(--yx-button-border);
  border-radius: var(--yx-radius-pill);
  padding: 0.7rem 1.15rem;
  background: var(--yx-button-bg);
  color: var(--yx-button-color);
  box-shadow: var(--yx-button-shadow);
  cursor: pointer;
  transition:
    transform var(--yx-motion-duration-fast) var(--yx-motion-ease-standard),
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.yx-button__content {
  display: inline-flex;
  align-items: center;
  gap: var(--yx-space-200);
}

.yx-button__label {
  font-weight: var(--yx-font-weight-semibold);
}

.yx-button__meta {
  font-size: var(--yx-font-size-200);
  line-height: 1;
}

.yx-button:hover:not(:disabled) {
  background: var(--yx-button-bg-hover);
}

.yx-button:not(:disabled):active {
  transform: translateY(1px);
  box-shadow: none;
}

.yx-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  box-shadow: none;
}

.yx-button.is-loading {
  cursor: progress;
}

.yx-button--secondary {
  --yx-button-bg: var(--yx-action-secondary-bg);
  --yx-button-bg-hover: var(--yx-action-secondary-bg-hover);
  --yx-button-border: var(--yx-action-secondary-border);
  --yx-button-color: var(--yx-action-secondary-fg);
  --yx-button-shadow: none;
}

.yx-button--quiet {
  --yx-button-bg: transparent;
  --yx-button-bg-hover: color-mix(
    in srgb,
    var(--yx-action-link) 10%,
    transparent
  );
  --yx-button-border: transparent;
  --yx-button-color: var(--yx-action-link);
  --yx-button-shadow: none;
}

.yx-button--surface-contrast.yx-button--primary {
  --yx-button-shadow: none;
}

.yx-button--surface-contrast.yx-button--secondary {
  --yx-button-bg-hover: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 12%,
    transparent
  );
  --yx-button-border: var(--yx-border-contrast);
  --yx-button-color: var(--yx-text-contrast);
}

.yx-button--surface-contrast.yx-button--quiet {
  --yx-button-bg-hover: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 10%,
    transparent
  );
  --yx-button-color: var(--yx-text-contrast);
}
</style>
