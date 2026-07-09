<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
    title?: string;
  }>(),
  {
    size: 24,
  },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="title ? undefined : 'true'"
    :role="title ? 'img' : undefined"
    :aria-label="title"
  >
    <title v-if="title">{{ title }}</title>
    <slot />
  </svg>
</template>
