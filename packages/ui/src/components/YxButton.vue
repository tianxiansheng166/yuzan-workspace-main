<script setup lang="ts">
withDefaults(
  defineProps<{
    kind?: "primary" | "secondary" | "quiet";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  { kind: "primary", type: "button", disabled: false },
);
</script>

<template>
  <button class="yx-button" :class="`yx-button--${kind}`" :type :disabled>
    <span class="yx-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.yx-button {
  min-height: 2.75rem;
  border: 1px solid transparent;
  border-radius: var(--yx-radius-pill);
  padding: 0.7rem 1.15rem;
  cursor: pointer;
  transition:
    transform var(--yx-duration-fast) var(--yx-ease-standard),
    background var(--yx-duration-base) var(--yx-ease-standard);
}
.yx-button:not(:disabled):active {
  transform: translateY(1px);
}
.yx-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.yx-button--primary {
  background: var(--yx-color-wine);
  color: white;
}
.yx-button--primary:hover:not(:disabled) {
  background: var(--yx-color-wine-strong);
}
.yx-button--secondary {
  background: transparent;
  border-color: var(--yx-color-line);
  color: var(--yx-color-ink);
}
.yx-button--secondary:hover:not(:disabled) {
  background: var(--yx-color-paper-strong);
}
.yx-button--quiet {
  background: transparent;
  color: var(--yx-color-wine);
}
</style>
