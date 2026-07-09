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
    <path
      d="m10.29 3.86-8.39 14.5A2 2 0 0 0 3.7 21h16.6a2 2 0 0 0 1.8-2.64l-8.39-14.5a2 2 0 0 0-3.42 0Z"
    />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </YxIconBase>
</template>
