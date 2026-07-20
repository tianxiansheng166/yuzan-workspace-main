<script setup lang="ts">
withDefaults(
  defineProps<{
    kicker: string;
    title: string;
    description: string;
    tone?: "neutral" | "danger" | "information";
  }>(),
  {
    tone: "neutral",
  },
);
</script>

<template>
  <section class="state-panel" :data-tone="tone">
    <p class="yx-kicker">{{ kicker }}</p>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.actions" class="state-panel__actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.state-panel {
  padding: clamp(2rem, 4vw, 3rem);
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-xl);
  background: var(--yx-surface-raised);
  box-shadow: var(--yx-shadow-100);
}

.state-panel[data-tone="information"] {
  background: color-mix(in srgb, var(--yx-information-bg) 38%, white);
}

.state-panel[data-tone="danger"] {
  background: color-mix(in srgb, var(--yx-danger-bg) 46%, white);
}

h2 {
  margin: 0.9rem 0;
  font: 600 var(--yx-text-xl) / 1.08 var(--yx-font-display);
}

p {
  max-width: 40rem;
  line-height: 1.8;
  color: var(--yx-color-ink-soft);
}

.state-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 1.5rem;
}
</style>
