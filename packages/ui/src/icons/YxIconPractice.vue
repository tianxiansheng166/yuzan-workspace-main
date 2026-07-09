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
    <path d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H6" />
    <path d="m18 9-3-4H9L6 9" />
    <path d="m15 14-3 3-3-3" />
    <path d="M12 11v6" />
  </YxIconBase>
</template>
