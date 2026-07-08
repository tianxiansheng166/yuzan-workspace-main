<script setup lang="ts">
withDefaults(
  defineProps<{
    href: string;
    target?: string;
    rel?: string;
    tone?: "default" | "muted" | "accent";
    surface?: "default" | "contrast";
  }>(),
  {
    target: undefined,
    rel: undefined,
    tone: "default",
    surface: "default",
  },
);
</script>

<template>
  <a
    class="yx-link"
    :class="[`yx-link--${tone}`, `yx-link--surface-${surface}`]"
    :href="href"
    :target="target"
    :rel="rel"
  >
    <slot />
  </a>
</template>

<style scoped>
.yx-link {
  --yx-link-color: var(--yx-action-link);
  --yx-link-color-hover: var(--yx-action-link-hover);
  display: inline;
  color: var(--yx-link-color);
  text-decoration-line: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
  transition:
    color var(--yx-motion-duration-base) var(--yx-motion-ease-standard),
    text-decoration-thickness var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard);
}

.yx-link:hover {
  color: var(--yx-link-color-hover);
  text-decoration-thickness: 0.12em;
}

.yx-link--muted {
  --yx-link-color: var(--yx-text-secondary);
  --yx-link-color-hover: var(--yx-text-primary);
}

.yx-link--accent {
  --yx-link-color: var(--yx-text-accent);
  --yx-link-color-hover: var(--yx-primitive-color-wine-800);
}

.yx-link--surface-contrast {
  --yx-link-color: var(--yx-text-contrast);
  --yx-link-color-hover: var(--yx-primitive-color-white);
}

.yx-link--surface-contrast.yx-link--accent {
  --yx-link-color: color-mix(
    in srgb,
    var(--yx-primitive-color-gold-100) 78%,
    var(--yx-primitive-color-white)
  );
  --yx-link-color-hover: var(--yx-primitive-color-white);
}
</style>
