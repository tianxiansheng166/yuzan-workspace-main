<script setup lang="ts">
import { computed } from "vue";
import type { IconName } from "../icon-types";
import YxIcon from "./YxIcon.vue";

const props = withDefaults(
  defineProps<{
    icon: IconName;
    label: string;
    size?: number | string;
    disabled?: boolean;
  }>(),
  {
    size: 20,
    disabled: false,
  },
);

const emit = defineEmits<{
  click: [];
}>();

const isDisabled = computed(() => props.disabled);
</script>

<template>
  <button
    type="button"
    class="yx-icon-button"
    :disabled="isDisabled"
    :aria-label="label"
    @click="emit('click')"
  >
    <YxIcon :name="icon" :size="size" aria-hidden="true" />
  </button>
</template>

<style scoped>
.yx-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--yx-radius-md, 0.5rem);
  background: transparent;
  color: var(--yx-action-link, currentColor);
  cursor: pointer;
  transition:
    background-color var(--yx-motion-duration-fast)
      var(--yx-motion-ease-standard),
    color var(--yx-motion-duration-fast) var(--yx-motion-ease-standard);
}

.yx-icon-button:hover:not(:disabled) {
  background: var(--yx-action-secondary-bg, rgba(0, 0, 0, 0.05));
}

.yx-icon-button:focus-visible {
  outline: 3px solid var(--yx-focus-ring, currentColor);
  outline-offset: 2px;
}

.yx-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
