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
    <path d="M18 20V10" />
    <path d="M12 20V4" />
    <path d="M6 20v-6" />
  </YxIconBase>
</template>
