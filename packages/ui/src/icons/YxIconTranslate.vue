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
    <path d="m5 8 3 8" />
    <path d="m8 8-3 8" />
    <path d="M6.5 13h3" />
    <path d="m13 8 2.5 8 2.5-8" />
    <path d="M14 11h4" />
  </YxIconBase>
</template>
