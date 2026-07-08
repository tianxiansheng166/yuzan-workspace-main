<script setup lang="ts">
import { computed, useAttrs, useId } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    modelValue?: string | number;
    label: string;
    type?: string;
    description?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    surface?: "default" | "contrast";
  }>(),
  {
    id: undefined,
    modelValue: "",
    type: "text",
    description: undefined,
    error: undefined,
    required: false,
    disabled: false,
    readonly: false,
    surface: "default",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const attrs = useAttrs();
const generatedId = useId();

const inputId = computed(() => props.id ?? generatedId);
const descriptionId = computed(() =>
  props.description ? `${inputId.value}-description` : undefined,
);
const errorId = computed(() =>
  props.error ? `${inputId.value}-error` : undefined,
);
const describedBy = computed(
  () =>
    [descriptionId.value, errorId.value].filter(Boolean).join(" ") || undefined,
);

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div
    class="yx-input"
    :class="[
      `yx-input--surface-${surface}`,
      {
        'is-disabled': disabled,
        'is-readonly': readonly,
        'has-error': Boolean(error),
      },
    ]"
  >
    <label class="yx-input__label" :for="inputId">
      <span>{{ label }}</span>
      <span v-if="required" class="yx-input__required">必填</span>
    </label>
    <p v-if="description" :id="descriptionId" class="yx-input__description">
      {{ description }}
    </p>
    <input
      v-bind="attrs"
      :id="inputId"
      class="yx-input__control"
      :type="type"
      :value="modelValue"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="onInput"
    />
    <p v-if="error" :id="errorId" class="yx-input__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.yx-input {
  --yx-input-bg: var(--yx-surface-default);
  --yx-input-border: var(--yx-border-default);
  --yx-input-border-hover: var(--yx-border-strong);
  --yx-input-border-error: var(--yx-danger-fg);
  --yx-input-color: var(--yx-text-primary);
  --yx-input-muted: var(--yx-text-muted);
  display: grid;
  gap: var(--yx-space-200);
  color: var(--yx-input-color);
}

.yx-input__label {
  display: inline-flex;
  align-items: center;
  gap: var(--yx-space-200);
  font-weight: var(--yx-font-weight-semibold);
  line-height: var(--yx-line-height-tight);
}

.yx-input__required {
  color: var(--yx-text-accent);
  font-size: var(--yx-font-size-200);
  font-weight: var(--yx-font-weight-medium);
}

.yx-input__description,
.yx-input__error {
  margin: 0;
  font-size: var(--yx-font-size-200);
  line-height: 1.5;
}

.yx-input__description {
  color: var(--yx-input-muted);
}

.yx-input__control {
  min-height: 2.75rem;
  width: 100%;
  border: 1px solid var(--yx-input-border);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-input-bg);
  color: inherit;
  transition:
    border-color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.yx-input__control:hover:not(:disabled):not(:read-only) {
  border-color: var(--yx-input-border-hover);
}

.yx-input__control::placeholder {
  color: var(--yx-input-muted);
}

.yx-input__control:read-only {
  background: var(--yx-bg-muted);
}

.yx-input.is-disabled .yx-input__control,
.yx-input__control:disabled {
  opacity: 0.64;
  cursor: not-allowed;
}

.yx-input.has-error .yx-input__control {
  border-color: var(--yx-input-border-error);
}

.yx-input__error {
  color: var(--yx-danger-fg);
}

.yx-input--surface-contrast {
  --yx-input-bg: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 6%,
    transparent
  );
  --yx-input-border: var(--yx-border-contrast);
  --yx-input-border-hover: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 44%,
    transparent
  );
  --yx-input-color: var(--yx-text-contrast);
  --yx-input-muted: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 74%,
    transparent
  );
}

.yx-input--surface-contrast .yx-input__control:read-only {
  background: color-mix(
    in srgb,
    var(--yx-primitive-color-white) 12%,
    transparent
  );
}
</style>
