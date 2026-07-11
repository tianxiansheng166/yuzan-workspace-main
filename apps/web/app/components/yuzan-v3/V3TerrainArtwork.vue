<script setup lang="ts">
withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    tone?: "plain" | "wine" | "sage";
    position?: "center" | "bottom";
  }>(),
  { alt: "", tone: "plain", position: "center" },
);
</script>

<template>
  <figure
    class="v3-artwork"
    :class="[`v3-artwork--${tone}`, `v3-artwork--${position}`]"
  >
    <img :src="src" :alt="alt" :aria-hidden="alt ? undefined : 'true'" />
    <div class="v3-artwork__contours" aria-hidden="true" />
    <div v-if="$slots.default" class="v3-artwork__content">
      <slot />
    </div>
  </figure>
</template>

<style scoped>
.v3-artwork {
  position: relative;
  min-height: 18rem;
  margin: 0;
  overflow: clip;
  border: 1px solid color-mix(in srgb, var(--yx-color-ink) 12%, transparent);
  border-radius: clamp(1.25rem, 3vw, 2.5rem);
  background: var(--yx-color-paper);
  isolation: isolate;
}

.v3-artwork img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter: saturate(0.86) contrast(0.96);
}

.v3-artwork--bottom img { object-position: center bottom; }
.v3-artwork--wine img { mix-blend-mode: multiply; opacity: 0.78; }
.v3-artwork--sage img { opacity: 0.88; }

.v3-artwork__contours {
  position: absolute;
  inset: 0;
  z-index: 1;
  background-image: url('/art/yuzan-v3/contour-texture.png');
  background-size: 42rem;
  opacity: 0.08;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.v3-artwork__content {
  position: relative;
  z-index: 2;
  display: grid;
  align-content: end;
  min-height: inherit;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  color: var(--yx-color-ink);
}

@media (prefers-reduced-motion: no-preference) {
  .v3-artwork img { transition: transform 700ms var(--yx-ease-standard); }
  .v3-artwork:hover img { transform: scale(1.025); }
}

@media (max-width: 40rem) {
  .v3-artwork { min-height: 14rem; }
}
</style>
