<script setup lang="ts">
const props = defineProps<{
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}>();
</script>

<template>
  <span class="status-pill" :data-tone="props.tone ?? 'neutral'">
    {{ props.label }}
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding-inline: 0.7rem;
  border-radius: var(--yx-radius-pill);
  border: 1px solid var(--yx-color-line);
  background: var(--yx-color-paper-strong);
  color: var(--yx-color-ink);
  font-size: var(--yx-text-sm);
}

.status-pill[data-tone="success"] {
  border-color: color-mix(in srgb, var(--yx-color-success) 30%, transparent);
  background: color-mix(in srgb, var(--yx-color-success) 18%, white);
  color: var(--yx-color-success);
}

.status-pill[data-tone="warning"] {
  border-color: color-mix(in srgb, var(--yx-color-gold) 36%, transparent);
  background: color-mix(in srgb, var(--yx-color-gold) 20%, white);
  color: #6f4814;
}

.status-pill[data-tone="danger"] {
  border-color: color-mix(in srgb, var(--yx-color-danger) 30%, transparent);
  background: color-mix(in srgb, var(--yx-color-danger) 16%, white);
  color: var(--yx-color-danger);
}
</style>
