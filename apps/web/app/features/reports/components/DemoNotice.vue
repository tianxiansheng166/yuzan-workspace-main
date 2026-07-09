<script setup lang="ts">
defineProps<{
  notice: string;
}>();
</script>

<template>
  <div class="demo-notice" role="note">
    <span class="demo-notice__badge">演示数据</span>
    <p class="demo-notice__text">{{ notice }}</p>
  </div>
</template>

<style scoped>
.demo-notice {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem;
  border: 1px dashed var(--yx-color-gold);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-gold-soft);
  margin-bottom: 1.5rem;
}
.demo-notice__badge {
  padding: 0.25rem 0.6rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-gold);
  color: var(--yx-color-ink);
  font-size: var(--yx-text-sm);
  font-weight: 500;
}
.demo-notice__text {
  margin: 0;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
</style>
