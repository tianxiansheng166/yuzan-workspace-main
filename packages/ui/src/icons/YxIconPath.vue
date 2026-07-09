<script setup lang="ts">
import YxIconBase from "./YxIconBase.vue";

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
  <YxIconBase :size="size" :title="title">
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M8.65 16.35 15.35 9.65" />
    <path d="m15.35 16.35 5.3-5.3" />
  </YxIconBase>
</template>
