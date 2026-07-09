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
    <path d="M22 10v6" />
    <path d="M2 10l10-5 10 5-10 5Z" />
    <path d="m6 12 5.8 2.9a2 2 0 0 0 1.79 0l.41-.2" />
    <path d="M22 16v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2" />
  </YxIconBase>
</template>
