<script setup lang="ts">
defineProps<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' }>()
</script>
<template>
  <span class="yx-status" :data-tone="tone ?? 'neutral'"><slot /></span>
</template>
<style scoped>
.yx-status {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding-inline: .65rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-paper-strong);
  font-size: var(--yx-text-sm);
}
.yx-status[data-tone="success"] { color: var(--yx-color-success); background: #e3efe8; }
.yx-status[data-tone="warning"] { color: #724812; background: #f5e8cf; }
.yx-status[data-tone="danger"] { color: var(--yx-color-danger); background: #f6dfdf; }
</style>
