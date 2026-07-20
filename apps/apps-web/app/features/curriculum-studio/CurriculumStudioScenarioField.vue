<script setup lang="ts">
import type { StudioScenario } from "./model";

const model = defineModel<StudioScenario>({ required: true });

const options: Array<{ value: StudioScenario; label: string }> = [
  { value: "demo", label: "demo" },
  { value: "loading", label: "loading" },
  { value: "empty", label: "empty" },
  { value: "error", label: "error" },
  { value: "permission", label: "permission" },
  { value: "unavailable", label: "unavailable" },
];
</script>

<template>
  <label class="scenario-field">
    <span>预览状态</span>
    <select v-model="model">
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.scenario-field {
  display: grid;
  gap: 0.4rem;
  font-size: var(--yx-text-sm);
}

select {
  min-height: 2.75rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-sm);
  background: var(--yx-color-surface);
  padding-inline: 0.75rem;
}
</style>
