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
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </YxIconBase>
</template>
