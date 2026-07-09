<script setup lang="ts">
import { computed } from "vue";
import type { IconName } from "../icon-types";
import { ICON_REGISTRY, UNKNOWN_ICON } from "../icons";

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number | string;
    title?: string;
    ariaHidden?: boolean;
  }>(),
  {
    size: 20,
    ariaHidden: false,
  },
);

const icon = computed(() => ICON_REGISTRY[props.name] ?? UNKNOWN_ICON);
const sizeValue = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size,
);
const labelledBy = computed(() =>
  props.title ? `yx-icon-title-${props.name}` : undefined,
);
</script>

<template>
  <svg
    class="yx-icon"
    :width="sizeValue"
    :height="sizeValue"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="ariaHidden ? 'true' : undefined"
    :role="title ? 'img' : undefined"
    :aria-labelledby="labelledBy"
  >
    <title v-if="title" :id="labelledBy">{{ title }}</title>
    <path v-for="(d, index) in icon.paths" :key="`${name}-${index}`" :d="d" />
  </svg>
</template>

<style scoped>
.yx-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
